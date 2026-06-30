// modules/role/role.route.js

const express        = require("express");
const router         = express.Router();
const roleController = require("./role.controller");
const { authenticate }  = require("../../middlewares/auth.middleware");
const checkPermission   = require("../../middlewares/permission.middleware");
const { validateRole, validateRoleUpdate }  = require("../../validations/auth.validations");

// ── Specific routes PEHLE — /:id se pehle hone chahiye ──────
router.get(
  "/assignable-permissions",
  authenticate,
  checkPermission("role.read"),
  roleController.getAssignablePermissions
);

// ── CRUD ─────────────────────────────────────────────────────
router.post(
  "/",
  authenticate,
  checkPermission("role.create"),
  validateRole,
  roleController.createRole
);

router.get(
  "/",
  authenticate,
  checkPermission("role.read"),
  roleController.getRoles
);

router.get(
  "/:id",
  authenticate,
  checkPermission("role.read"),
  roleController.getRoleById
);

router.put(
  "/:id",
  authenticate,
  checkPermission("role.update"),
  validateRoleUpdate,
  roleController.updateRole
);

router.delete(
  "/:id",
  authenticate,
  checkPermission("role.delete"),
  roleController.deleteRole
);

// T-03 — Role Module Matrix
// PUT /roles/:id/modules → update which modules role can access
router.put(
  "/:id/modules",
  authenticate,
  checkPermission("role.update"),
  roleController.updateRoleModules
);

module.exports = router;