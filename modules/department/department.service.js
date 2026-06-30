// modules/department/department.service.js
// Departments are unit-level

const Department = require("./department.model");
const AppError   = require("../../utils/appError");

// Scope filter — unit level
const buildFilter = (user) => {
  if (user.role === "SUPER_ADMIN") return {};
  const filter = { org_id: user.orgId };
  if (user.companyId) filter.company_id = user.companyId;
  if (user.unitId)    filter.unit_id    = user.unitId;
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

  // Allow filtering by specific unit_id (for Org/Company Admin)
  if (unit_id && !user.unitId) filter.unit_id = unit_id;

  if (search) filter.name = { $regex: search, $options: "i" };

  return await Department.find(filter)
    .populate("unit_id", "name")
    .sort({ createdAt: -1 });
};

exports.getDepartmentById = async (id, user) => {
  const filter = { _id: id, isDeleted: false, ...buildFilter(user) };
  const department = await Department.findOne(filter).populate("unit_id", "name");
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