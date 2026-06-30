const express  = require("express");
const router   = express.Router();

const { authenticate }   = require("../../middlewares/auth.middleware");
const { checkRole }      = require("../../middlewares/checkRole.middleware");
const checkTrial         = require("../../middlewares/checkTrial.middleware");
const validate           = require("../../middlewares/validate.middleware");
const { createPolicySchema, updatePolicySchema } = require("./attendancePolicy.validation");
const ctrl               = require("./attendancePolicy.controller");

// ── Global guards ─────────────────────────────────────────────────────────────
router.use(authenticate, checkTrial);

// ── POST /hrms/attendance-policies ───────────────────────────────────────────
router.post(
  "/",
  checkRole("hr_manager"),
  validate(createPolicySchema),
  ctrl.createPolicy
);

// ── GET /hrms/attendance-policies ────────────────────────────────────────────
router.get(
  "/",
  checkRole("hr_manager"),
  ctrl.getPolicies
);

// ── GET /hrms/attendance-policies/:id ────────────────────────────────────────
router.get(
  "/:id",
  checkRole("hr_manager"),
  ctrl.getPolicyById
);

// ── PUT /hrms/attendance-policies/:id ────────────────────────────────────────
router.put(
  "/:id",
  checkRole("hr_manager"),
  validate(updatePolicySchema),
  ctrl.updatePolicy
);

// ── Versioning ────────────────────────────────────────────────────────────────
router.get("/:id/versions",          checkRole("hr_manager"), ctrl.getVersionHistory);
router.get("/:id/versions/:version", checkRole("hr_manager"), ctrl.getVersionSnapshot);
router.post("/:id/restore/:version", checkRole("hr_manager"), ctrl.restoreVersion);

// ── Status transitions — Unit Admin only ──────────────────────────────────────
router.patch("/:id/activate",   checkRole("unit_admin"), ctrl.activatePolicy);
router.patch("/:id/deactivate", checkRole("unit_admin"), ctrl.deactivatePolicy);
router.patch("/:id/archive",    checkRole("unit_admin"), ctrl.archivePolicy);

// ── DELETE /hrms/attendance-policies/:id ──────────────────────────────────────
router.delete("/:id", checkRole("unit_admin"), ctrl.deletePolicy);

module.exports = router;
