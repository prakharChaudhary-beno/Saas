const departmentService = require("./department.service");
const departmentAuditService = require("./department.audit.service");

exports.create = async (req, res) => {
  try {

    const department = await departmentService.createDepartment(
      req.body,
      req.user
    );

    res.status(201).json({
      success: true,
      data: department
    });

  } catch (error) {

    res.status(400).json({
      success: false,
      message: error.message
    });

  }
};


exports.list = async (req, res) => {
  try {

    const departments = await departmentService.getDepartments(req.user);

    // Transform _id to id for frontend tree view compatibility
    const transformDept = (d) => ({
      ...d.toObject ? d.toObject() : d,
      id: d._id.toString(),
    });

    res.json({
      success: true,
      data: departments.map(transformDept)
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }
};


exports.getById = async (req, res) => {
  try {

    const department = await departmentService.getDepartmentById(
      req.params.id,
      req.user
    );

    res.json({
      success: true,
      data: department
    });

  } catch (error) {

    res.status(404).json({
      success: false,
      message: error.message
    });

  }
};


exports.update = async (req, res) => {
  try {

    const department = await departmentService.updateDepartment(
      req.params.id,
      req.body,
      req.user
    );

    res.json({
      success: true,
      data: department
    });

  } catch (error) {

    res.status(400).json({
      success: false,
      message: error.message
    });

  }
};


exports.delete = async (req, res) => {
  try {

    const result = await departmentService.deleteDepartment(
      req.params.id,
      req.user
    );

    res.json({
      success: true,
      message: result.message
    });

  } catch (error) {

    res.status(400).json({
      success: false,
      message: error.message
    });

  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// HIERARCHICAL ENDPOINTS (for Department Tree Page)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create department with hierarchy support
 */
exports.createTree = async (req, res) => {
  try {
    const department = await departmentService.createDepartmentTree(req.body, req.user);
    res.status(201).json({
      success: true,
      data: department
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get all departments as tree structure
 */
exports.listTree = async (req, res) => {
  try {
    const tree = await departmentService.getDepartmentsTree(req.user, req.query);
    
    res.json({
      success: true,
      data: tree
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get single department subtree
 */
exports.getTreeById = async (req, res) => {
  try {
    const department = await departmentService.getDepartmentTreeById(
      req.params.id,
      req.user
    );

    res.json({
      success: true,
      data: department
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Update department (with parent change support)
 */
exports.updateTree = async (req, res) => {
  try {
    const department = await departmentService.updateDepartmentTree(
      req.params.id,
      req.body,
      req.user
    );

    res.json({
      success: true,
      data: department
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Delete department (with cascade checks)
 */
exports.deleteTree = async (req, res) => {
  try {
    const result = await departmentService.deleteDepartmentTree(
      req.params.id,
      req.user
    );

    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Get audit logs for a specific department
exports.getAuditLogs = async (req, res) => {
  try {
    const result = await departmentAuditService.getDepartmentAuditLogs(
      req.params.id,
      req.user,
      req.query
    );

    res.json({
      success: true,
      data: result.logs,
      pagination: result.pagination
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
