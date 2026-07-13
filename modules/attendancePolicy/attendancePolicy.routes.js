const express  = require("express");
const router   = express.Router();

const { authenticate }   = require("../../middlewares/auth.middleware");
const checkPermission    = require("../../middlewares/permission.middleware");
const checkTrial         = require("../../middlewares/checkTrial.middleware");
const validate           = require("../../middlewares/validate.middleware");
const { createPolicySchema, updatePolicySchema } = require("./attendancePolicy.validation");
const ctrl               = require("./attendancePolicy.controller");

// ── Global guards ─────────────────────────────────────────────────────────────
router.use(authenticate, checkTrial);

// ── POST /hrms/attendance-policies ───────────────────────────────────────────
router.post(
  "/",
  checkPermission("attendancePolicy.create"),
  validate(createPolicySchema),
  ctrl.createPolicy
);

// ── GET /hrms/attendance-policies ────────────────────────────────────────────
router.get(
  "/",
  checkPermission("attendancePolicy.read"),
  ctrl.getPolicies
);

// ── GET /hrms/attendance-policies/:id ────────────────────────────────────────────
router.get(
  "/:id",
  checkPermission("attendancePolicy.read"),
  ctrl.getPolicyById
);

// ── PUT /hrms/attendance-policies/:id ────────────────────────────────────────
router.put(
  "/:id",
  checkPermission("attendancePolicy.update"),
  validate(updatePolicySchema),
  ctrl.updatePolicy
);

// ── Versioning ────────────────────────────────────────────────────────
router.get("/:id/versions",          checkPermission("attendancePolicy.read"), ctrl.getVersionHistory);
router.get("/:id/versions/:version", checkPermission("attendancePolicy.read"), ctrl.getVersionSnapshot);
router.post("/:id/restore/:version", checkPermission("attendancePolicy.update"), ctrl.restoreVersion);

// ── Status transitions ──────────────────────────────────────
router.patch("/:id/activate",   checkPermission("attendancePolicy.update"), ctrl.activatePolicy);
router.patch("/:id/deactivate", checkPermission("attendancePolicy.update"), ctrl.deactivatePolicy);
router.patch("/:id/archive",    checkPermission("attendancePolicy.update"), ctrl.archivePolicy);

// ── DELETE /hrms/attendance-policies/:id ──────────────────────────────────────────
router.delete("/:id", checkPermission("attendancePolicy.delete"), ctrl.deletePolicy);

module.exports = router;
