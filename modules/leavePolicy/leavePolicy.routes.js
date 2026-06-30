const express = require("express");
const router = express.Router();

const { authenticate } = require("../../middlewares/auth.middleware");
const {checkRole} = require("../../middlewares/checkRole.middleware");
const checkTrial = require("../../middlewares/checkTrial.middleware");
const  validate  = require("../../middlewares/validate.middleware");
const { createPolicySchema, updatePolicySchema, updateLeaveTypesSchema } = require("./leavePolicy.validation");
const ctrl = require("./leavePolicy.controller");

router.use(authenticate, checkTrial);

// ── Helper: seeded leave types list (for HR to pick while building policy) ────
router.get("/available-leave-types", checkRole("hr_manager"), ctrl.getAvailableLeaveTypes);

// ── CRUD ──────────────────────────────────────────────────────────────────────
router.post(  "/",    checkRole("hr_manager"),    validate(createPolicySchema),    ctrl.createPolicy);
router.get(   "/",    checkRole("hr_manager"),                                     ctrl.getPolicies);
router.get(   "/:id", checkRole("hr_manager"),                                     ctrl.getPolicyById);
router.put(   "/:id", checkRole("hr_manager"),    validate(updatePolicySchema),    ctrl.updatePolicy);

// ── Leave types ───────────────────────────────────────────────────────────────
router.put("/:id/leave-types", checkRole("hr_manager"), validate(updateLeaveTypesSchema), ctrl.updateLeaveTypes);

// ── Versioning ────────────────────────────────────────────────────────────────
// View history / specific snapshot — same access as viewing the policy
router.get("/:id/versions",            checkRole("hr_manager"), ctrl.getVersionHistory);
router.get("/:id/versions/:version",   checkRole("hr_manager"), ctrl.getVersionSnapshot);
// Restore — same access level as updatePolicy (config rollback only, no status change)
router.post("/:id/restore/:version",   checkRole("hr_manager"), ctrl.restoreVersion);

// ── Status transitions ────────────────────────────────────────────────────────
router.delete("/:id",           checkRole("unit_admin"), ctrl.deletePolicy);
router.patch("/:id/activate",   checkRole("unit_admin"), ctrl.activatePolicy);
router.patch("/:id/archive",    checkRole("unit_admin"), ctrl.archivePolicy);
router.patch("/:id/deactivate", checkRole("unit_admin"), ctrl.deactivatePolicy);

module.exports = router;
