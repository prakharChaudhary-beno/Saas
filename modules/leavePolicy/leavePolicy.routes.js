const express = require("express");
const router = express.Router();

const { authenticate } = require("../../middlewares/auth.middleware");
const checkPermission  = require("../../middlewares/permission.middleware");
const checkTrial = require("../../middlewares/checkTrial.middleware");
const  validate  = require("../../middlewares/validate.middleware");
const { createPolicySchema, updatePolicySchema, updateLeaveTypesSchema } = require("./leavePolicy.validation");
const ctrl = require("./leavePolicy.controller");

router.use(authenticate, checkTrial);

// ── Helper: seeded leave types list (for HR to pick while building policy) ────
router.get("/available-leave-types", checkPermission("leavePolicy.read"), ctrl.getAvailableLeaveTypes);

// ── CRUD ──────────────────────────────────────────────────────────────────────
router.post(  "/",    checkPermission("leavePolicy.create"),    validate(createPolicySchema),    ctrl.createPolicy);
router.get(   "/",    checkPermission("leavePolicy.read"),                                     ctrl.getPolicies);
router.get(   "/:id", checkPermission("leavePolicy.read"),                                     ctrl.getPolicyById);
router.put(   "/:id", checkPermission("leavePolicy.update"),    validate(updatePolicySchema),    ctrl.updatePolicy);

// ── Leave types ───────────────────────────────────────────────────────
router.put("/:id/leave-types", checkPermission("leavePolicy.update"), validate(updateLeaveTypesSchema), ctrl.updateLeaveTypes);

// ── Versioning ────────────────────────────────────────────────────────
router.get("/:id/versions",            checkPermission("leavePolicy.read"), ctrl.getVersionHistory);
router.get("/:id/versions/:version",   checkPermission("leavePolicy.read"), ctrl.getVersionSnapshot);
router.post("/:id/restore/:version",   checkPermission("leavePolicy.update"), ctrl.restoreVersion);

// ── Status transitions ────────────────────────────────────────────────
router.delete("/:id",           checkPermission("leavePolicy.delete"), ctrl.deletePolicy);
router.patch("/:id/activate",   checkPermission("leavePolicy.update"), ctrl.activatePolicy);
router.patch("/:id/archive",    checkPermission("leavePolicy.update"), ctrl.archivePolicy);
router.patch("/:id/deactivate", checkPermission("leavePolicy.update"), ctrl.deactivatePolicy);

module.exports = router;
