// modules/department/department.service.js
// Departments are unit-level

const Department = require("./department.model");
const AppError   = require("../../utils/appError");
const { logDepartmentAudit } = require("./department.audit");

// Scope filter — unit level
const buildFilter = (user, query = {}) => {
  const requestedOrgId = query.orgId;
  const requestedCompanyId = query.companyId;
  const requestedUnitId = query.unit_id;

  if (user.role !== "SUPER_ADMIN" && requestedOrgId && String(requestedOrgId) !== String(user.orgId)) {
    throw new AppError("Organization access denied", 403);
  }
  if (user.companyId && requestedCompanyId && String(requestedCompanyId) !== String(user.companyId)) {
    throw new AppError("Company access denied", 403);
  }
  if (user.unitId && requestedUnitId && String(requestedUnitId) !== String(user.unitId)) {
    throw new AppError("Unit access denied", 403);
  }

  const filter = {};
  const orgId = user.role === "SUPER_ADMIN" ? requestedOrgId : user.orgId;
  const companyId = user.companyId || requestedCompanyId;
  const unitId = user.unitId || requestedUnitId;

  if (orgId) filter.org_id = orgId;
  if (companyId) filter.company_id = companyId;
  if (unitId) filter.unit_id = unitId;
  return filter;
};

exports.createDepartment = async (data, user) => {
  const unitId = data.unit_id || user.unitId;
  if (!unitId) throw new AppError("unit_id is required", 400);

  // Duplicate check within same unit
  const existing = await Department.findOne({
    unit_id:   unitId,
    name:      { $regex: `^${data.name}$`, $options: "i" },
    isDeleted: false,
  });
  if (existing) throw new AppError("Department with this name already exists in this unit", 409);

  return await Department.create({
    org_id:     user.orgId,
    company_id: data.company_id || user.companyId,
    unit_id:    unitId,
    name:       data.name,
    created_by: user.userId,
  });
};

exports.getDepartments = async (user, query = {}) => {
  const { unit_id, search } = query;
  const filter = { isDeleted: false, ...buildFilter(user) };

  if (unit_id && !user.unitId) filter.unit_id = unit_id;
  if (search) filter.name = { $regex: search, $options: "i" };

  const departments = await Department.find(filter)
    .populate("unit_id", "name")
    .sort({ createdAt: -1 })
    .lean();

  // ── Employee count per department (single query, no N+1) ──────
  const Employee = require("../employee/models/employee.model");
  const counts = await Employee.aggregate([
    {
      $match: {
        departmentId: { $in: departments.map(d => d._id) },
        isDeleted: false,
      },
    },
    { $group: { _id: "$departmentId", count: { $sum: 1 } } },
  ]);

  const countMap = {};
  counts.forEach(c => { countMap[c._id.toString()] = c.count; });

  return departments.map(d => ({
    ...d,
    employeeCount: countMap[d._id.toString()] || 0,
  }));
};

exports.getDepartmentById = async (id, user) => {
  const filter = { _id: id, isDeleted: false, ...buildFilter(user) };
  const department = await Department.findOne(filter)
    .populate("unit_id", "name")
    .populate("departmentHeadId", "name employeeId designation profilePhoto");
  if (!department) throw new AppError("Department not found", 404);
  return department;
};

exports.updateDepartment = async (id, data, user) => {
  const filter = { _id: id, isDeleted: false, ...buildFilter(user) };
  const department = await Department.findOne(filter);
  if (!department) throw new AppError("Department not found", 404);

  if (data.name)   department.name   = data.name;
  if (data.status) department.status = data.status;

  await department.save();
  return department;
};

exports.deleteDepartment = async (id, user) => {
  // T-24 — Cascade delete protection
  const Employee = require("../employee/models/employee.model");
  const activeEmployees = await Employee.countDocuments({
    departmentId: id,
    isDeleted:    false,
    status:       { $nin: ["TERMINATED"] },
  });
  if (activeEmployees > 0) {
    throw new AppError(
      `Cannot delete department — ${activeEmployees} active employee(s) are assigned. Reassign them first.`,
      400
    );
  }
  const filter = { _id: id, isDeleted: false, ...buildFilter(user) };
  const department = await Department.findOne(filter);
  if (!department) throw new AppError("Department not found", 404);

  department.isDeleted = true;
  await department.save();
  return { message: "Department deleted successfully" };
};

// ═══════════════════════════════════════════════════════════════════════════════
// HIERARCHICAL OPERATIONS (for Department Tree Page)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create department with hierarchy support
 * - Validates parentId exists in same unit
 * - Validates departmentHeadId if provided
 * - Prevents duplicate names at same level
 */
exports.createDepartmentTree = async (data, user) => {
  const unitId = data.unit_id || user.unitId;
  if (!unitId) throw new AppError("unit_id is required", 400);

  // Validate parentId if provided
  if (data.parentId) {
    const parentDept = await Department.findOne({
      _id: data.parentId,
      unit_id: unitId,
      isDeleted: false,
    });
    if (!parentDept) {
      throw new AppError("Parent department not found or not in same unit", 404);
    }
  }

  // Validate departmentHeadId if provided
  if (data.departmentHeadId) {
    const Employee = require("../employee/models/employee.model");
    const deptHead = await Employee.findOne({
      _id: data.departmentHeadId,
      unit_id: unitId,
      isDeleted: false,
    });
    if (!deptHead) {
      throw new AppError("Department head employee not found or not in same unit", 404);
    }
  }

  // Check duplicate at same level (same parent + same unit)
  const existing = await Department.findOne({
    unit_id: unitId,
    name: { $regex: `^${data.name}$`, $options: "i" },
    parentId: data.parentId || null,
    isDeleted: false,
  });
  if (existing) {
    throw new AppError(
      "Department with this name already exists " + 
      (data.parentId ? "under same parent" : "at root level"),
      409
    );
  }

  const dept = await Department.create({
    org_id: user.orgId,
    company_id: data.company_id || user.companyId,
    unit_id: unitId,
    name: data.name,
    departmentCode: data.departmentCode || null,
    parentId: data.parentId || null,
    departmentHeadId: data.departmentHeadId || null,
    description: data.description || "",
    created_by: user.userId,
  });

  // Log audit
  await logDepartmentAudit({
    action: "DEPARTMENT_CREATED",
    org_id: dept.org_id,
    company_id: dept.company_id,
    unit_id: dept.unit_id,
    actor: { userId: user.userId, name: user.name, role: user.role, email: user.email },
    department: dept,
    metadata: { isNew: true }
  });

  return dept;
};

/**
 * Get departments as tree structure (recursive)
 * - Returns nested children array
 * - Includes employee count per department
 * - Populates department head details
 */
exports.getDepartmentsTree = async (user, query = {}) => {
  const filter = { isDeleted: false, ...buildFilter(user, query) };

  // Fetch all departments (flat)
  const departments = await Department.find(filter)
    .populate("parentId", "name")
    .populate("departmentHeadId", "name employeeId designation profilePhoto email")
    .sort({ name: 1 })
    .lean();

  // Get employee counts
  const Employee = require("../employee/models/employee.model");
  const counts = await Employee.aggregate([
    {
      $match: {
        departmentId: { $in: departments.map(d => d._id) },
        isDeleted: false,
      },
    },
    { $group: { _id: "$departmentId", count: { $sum: 1 } } },
  ]);

  const countMap = {};
  counts.forEach(c => { countMap[c._id.toString()] = c.count; });

  // Transform to id + children structure
  const withMeta = departments.map(d => ({
    ...d,
    id: d._id.toString(),
    employeeCount: countMap[d._id.toString()] || 0,
    children: [],
  }));

  // Build tree recursively
  return buildTree(withMeta);
};

/**
 * Get single department with nested children
 */
exports.getDepartmentTreeById = async (id, user) => {
  const filter = { _id: id, isDeleted: false, ...buildFilter(user) };
  const department = await Department.findOne(filter)
    .populate("parentId", "name")
    .lean();

  if (!department) throw new AppError("Department not found", 404);

  // Get all descendants
  const descendants = await getAllDescendants(id);
  const allIds = [id, ...descendants.map(d => d._id)];

  // Get employee counts for all
  const Employee = require("../employee/models/employee.model");
  const counts = await Employee.aggregate([
    {
      $match: {
        departmentId: { $in: allIds },
        isDeleted: false,
      },
    },
    { $group: { _id: "$departmentId", count: { $sum: 1 } } },
  ]);

  const countMap = {};
  counts.forEach(c => { countMap[c._id.toString()] = c.count; });

  // Build subtree
  const withMeta = [
    { ...department, id: department._id.toString(), employeeCount: countMap[id] || 0 },
    ...descendants.map(d => ({
      ...d,
      id: d._id.toString(),
      employeeCount: countMap[d._id.toString()] || 0,
    })),
  ];

  return buildTree(withMeta)[0];
};

/**
 * Update department (can change parent)
 * - Prevents setting parent to self or descendant
 * - Validates departmentHeadId if provided
 * - Prevents duplicate names at same level
 */
exports.updateDepartmentTree = async (id, data, user) => {
  const filter = { _id: id, isDeleted: false, ...buildFilter(user) };
  const department = await Department.findOne(filter);
  if (!department) throw new AppError("Department not found", 404);

  // Prevent changing to self or descendant
  if (data.parentId) {
    if (data.parentId === id) {
      throw new AppError("Cannot set department as its own parent", 400);
    }
    const descendants = await getAllDescendants(id);
    if (descendants.some(d => d._id.toString() === data.parentId)) {
      throw new AppError("Cannot set a descendant as parent", 400);
    }

    // Validate parent exists in same unit
    const parentDept = await Department.findOne({
      _id: data.parentId,
      unit_id: department.unit_id,
      isDeleted: false,
    });
    if (!parentDept) {
      throw new AppError("Parent department not found or not in same unit", 404);
    }
  }

  // Validate departmentHeadId if provided
  if (data.departmentHeadId) {
    const Employee = require("../employee/models/employee.model");
    const deptHead = await Employee.findOne({
      _id: data.departmentHeadId,
      unit_id: department.unit_id,
      isDeleted: false,
    });
    if (!deptHead) {
      throw new AppError("Department head employee not found or not in same unit", 404);
    }
  }

  // Check duplicate name at target level
  if (data.name && data.name !== department.name) {
    const existing = await Department.findOne({
      unit_id: department.unit_id,
      name: { $regex: `^${data.name}$`, $options: "i" },
      parentId: data.parentId !== undefined ? (data.parentId || null) : department.parentId,
      isDeleted: false,
      _id: { $ne: id },
    });
    if (existing) {
      throw new AppError("Department with this name already exists at this level", 409);
    }
  }

  if (data.name) department.name = data.name;
  if (data.departmentCode !== undefined) department.departmentCode = data.departmentCode || null;
  if (data.parentId !== undefined) department.parentId = data.parentId || null;
  if (data.departmentHeadId !== undefined) department.departmentHeadId = data.departmentHeadId || null;
  if (data.description !== undefined) department.description = data.description || "";
  if (data.status) department.status = data.status;

  await department.save();

  // Log audit
  await logDepartmentAudit({
    action: "DEPARTMENT_UPDATED",
    org_id: department.org_id,
    company_id: department.company_id,
    unit_id: department.unit_id,
    actor: { userId: user.userId, name: user.name, role: user.role, email: user.email },
    department: department,
    changes: data,
    metadata: { updateType: "tree" }
  });

  await department.populate("parentId", "name");
  await department.populate("departmentHeadId", "name employeeId designation profilePhoto email");
  
  return department;
};

/**
 * Delete department (cascade check)
 * - Prevents deletion if has active employees OR has sub-departments
 */
exports.deleteDepartmentTree = async (id, user) => {
  // Check for sub-departments
  const childCount = await Department.countDocuments({
    parentId: id,
    isDeleted: false,
  });
  if (childCount > 0) {
    throw new AppError(
      `Cannot delete — ${childCount} sub-department(s) exist. Delete them first.`,
      400
    );
  }

  // Check for active employees
  const Employee = require("../employee/models/employee.model");
  const activeEmployees = await Employee.countDocuments({
    departmentId: id,
    isDeleted: false,
    status: { $nin: ["TERMINATED"] },
  });
  if (activeEmployees > 0) {
    throw new AppError(
      `Cannot delete — ${activeEmployees} active employee(s) are assigned. Reassign them first.`,
      400
    );
  }

  const filter = { _id: id, isDeleted: false, ...buildFilter(user) };
  const department = await Department.findOne(filter);
  if (!department) throw new AppError("Department not found", 404);

  department.isDeleted = true;
  await department.save();

  // Log audit
  await logDepartmentAudit({
    action: "DEPARTMENT_DELETED",
    org_id: department.org_id,
    company_id: department.company_id,
    unit_id: department.unit_id,
    actor: { userId: user.userId, name: user.name, role: user.role, email: user.email },
    department: department,
    metadata: { deletionType: "soft" }
  });

  return { message: "Department deleted successfully" };
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build tree from flat array
 * @param {Array} items - flat list with parentId
 * @returns {Array} - nested tree
 */
function buildTree(items) {
  const itemMap = {};
  const tree = [];

  // First pass: create map
  items.forEach(item => {
    itemMap[item.id] = { ...item, children: [] };
  });

  // Second pass: build tree
  items.forEach(item => {
    const node = itemMap[item.id];
    // Handle both populated and unpopulated parentId
    const parentDbId = item.parentId?._id?.toString() || item.parentId?.toString() || null;
    
    if (parentDbId) {
      const parent = itemMap[parentDbId];
      if (parent) {
        parent.children.push(node);
      } else {
        // Parent not found, add to root
        tree.push(node);
      }
    } else {
      tree.push(node);
    }
  });

  return tree;
}

/**
 * Get all descendants of a department (recursive)
 * @param {String} parentId - parent department ID
 * @returns {Array} - all descendants (flat)
 */
async function getAllDescendants(parentId) {
  const children = await Department.find({
    parentId: parentId,
    isDeleted: false,
  }).lean();

  const descendants = [...children];
  for (const child of children) {
    const grandChildren = await getAllDescendants(child._id);
    descendants.push(...grandChildren);
  }

  return descendants;
}