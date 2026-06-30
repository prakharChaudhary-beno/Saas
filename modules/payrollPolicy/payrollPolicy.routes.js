const express = require("express");
const router  = express.Router();

const { authenticate }   = require("../../middlewares/auth.middleware");
const { checkRole }      = require("../../middlewares/checkRole.middleware");
const checkTrial         = require("../../middlewares/checkTrial.middleware");
const validate           = require("../../middlewares/validate.middleware");
const { createPolicySchema, updatePolicySchema } = require("./payrollPolicy.validation");
const ctrl               = require("./payrollPolicy.controller");
const runCtrl            = require("./payrollRun.controller");

// ── Global guards ─────────────────────────────────────────────────────────────
router.use(authenticate, checkTrial);

// ── CRUD ──────────────────────────────────────────────────────────────────────
router.post(  "/",    checkRole("hr_manager"),   validate(createPolicySchema), ctrl.createPolicy);
router.get(   "/",    checkRole("hr_manager"),                                 ctrl.getPolicies);
router.get(   "/:id", checkRole("hr_manager"),                                 ctrl.getPolicyById);
router.put(   "/:id", checkRole("hr_manager"),   validate(updatePolicySchema), ctrl.updatePolicy);
router.delete("/:id", checkRole("unit_admin"),                               ctrl.deletePolicy);

// ── Versioning ────────────────────────────────────────────────────────────────
router.get("/:id/versions",          checkRole("hr_manager"), ctrl.getVersionHistory);
router.get("/:id/versions/:version", checkRole("hr_manager"), ctrl.getVersionSnapshot);
router.post("/:id/restore/:version", checkRole("hr_manager"), ctrl.restoreVersion);

// ── Status transitions ────────────────────────────────────────────────────────
router.patch("/:id/activate",   checkRole("unit_admin"), ctrl.activatePolicy);
router.patch("/:id/deactivate", checkRole("unit_admin"), ctrl.deactivatePolicy);
router.patch("/:id/archive",    checkRole("unit_admin"), ctrl.archivePolicy);

// ── Payroll Run ───────────────────────────────────────────────────────────────
// POST /payroll-policies/run              → run for all active employees (tenant-wide)
// POST /payroll-policies/run/:employeeId  → run for one employee
router.post("/run",              checkRole("hr_manager"), runCtrl.runForTenant);
router.post("/run/:employeeId",  checkRole("hr_manager"), runCtrl.runForEmployee);

module.exports = router;
