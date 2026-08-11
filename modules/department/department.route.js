const express = require("express");
const router = express.Router();
// const checkTrial = require("../../middlewares.middleware");
const departmentController = require("./department.controller");
const  {authenticate} = require("../../middlewares/auth.middleware");
const  checkPermission  = require("../../middlewares/permission.middleware");

// ═══════════════════════════════════════════════════════════════════════════════
// EXISTING ENDPOINTS (DO NOT MODIFY - used in multiple places)
// ═══════════════════════════════════════════════════════════════════════════════

router.post(
  "/create",
  authenticate,
  checkPermission("department.create"),
  departmentController.create
);

router.get(
  "/",
  authenticate,
  checkPermission("department.read"),
  departmentController.list
);

router.get(
  "/:id",
  authenticate,
  checkPermission("department.read"),
  departmentController.getById
);

router.put(
  "/:id",
  authenticate,
  checkPermission("department.update"),
  departmentController.update
);

router.delete(
  "/:id",
  authenticate,
  checkPermission("department.delete"),
  departmentController.delete
);

// ═══════════════════════════════════════════════════════════════════════════════
// HIERARCHICAL ENDPOINTS (New - for Department Tree Page only)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create department with parent support
 * Body: { name, parentId (optional), unit_id, company_id }
 */
router.post(
  "/tree/create",
  authenticate,
  checkPermission("department.create"),
  departmentController.createTree
);

/**
 * Get all departments as tree structure (with children array)
 * Query: { unit_id (optional) }
 */
router.get(
  "/tree/list",
  authenticate,
  checkPermission("department.read"),
  departmentController.listTree
);

/**
 * Get single department subtree
 * Returns: department with nested children
 */
router.get(
  "/tree/:id",
  authenticate,
  checkPermission("department.read"),
  departmentController.getTreeById
);

/**
 * Update department (can change parent)
 * Body: { name, parentId (optional), status }
 */
router.put(
  "/tree/:id",
  authenticate,
  checkPermission("department.update"),
  departmentController.updateTree
);

/**
 * Delete department (with cascade checks)
 * - Prevents deletion if has children
 * - Prevents deletion if has employees
 */
router.delete(
  "/tree/:id",
  authenticate,
  checkPermission("department.delete"),
  departmentController.deleteTree
);

/**
 * Get audit logs for a specific department
 * Query: { page, limit }
 */
router.get(
  "/:id/audit-logs",
  authenticate,
  checkPermission("department.read"),
  departmentController.getAuditLogs
);

module.exports = router;