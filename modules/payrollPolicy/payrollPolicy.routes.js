const express = require("express");
const router  = express.Router();

const { authenticate }   = require("../../middlewares/auth.middleware");
const checkPermission    = require("../../middlewares/permission.middleware");
const checkTrial         = require("../../middlewares/checkTrial.middleware");
const validate           = require("../../middlewares/validate.middleware");
const { createPolicySchema, updatePolicySchema } = require("./payrollPolicy.validation");
const ctrl               = require("./payrollPolicy.controller");
const runCtrl            = require("./payrollRun.controller");
const historyCtrl        = require("./payrollHistory.controller");

// ── Global guards ─────────────────────────────────────────────────────────────
router.use(authenticate, checkTrial);

// ── Metadata endpoints (must come before /:id routes) ───────────────────────
router.get("/meta/pt-states", ctrl.getPTStates);

// ── Payroll History (aggregated by month) ─────────────────────────────────────
router.get("/history", checkPermission("payrollpolicy.read"), historyCtrl.getPayrollHistory);

// ── CRUD ──────────────────────────────────────────────────────────────────────
router.post(  "/",    checkPermission("payrollpolicy.create"),   validate(createPolicySchema), ctrl.createPolicy);
router.get(   "/",    checkPermission("payrollpolicy.read"),                                 ctrl.getPolicies);
router.get(   "/:id", checkPermission("payrollpolicy.read"),                                 ctrl.getPolicyById);
router.put(   "/:id", checkPermission("payrollpolicy.update"),   validate(updatePolicySchema), ctrl.updatePolicy);
router.delete("/:id", checkPermission("payrollpolicy.delete"),                               ctrl.deletePolicy);

// ── Versioning ────────────────────────────────────────────────────────
router.get("/:id/versions",          checkPermission("payrollpolicy.read"), ctrl.getVersionHistory);
router.get("/:id/versions/:version", checkPermission("payrollpolicy.read"), ctrl.getVersionSnapshot);
router.post("/:id/restore/:version", checkPermission("payrollpolicy.update"), ctrl.restoreVersion);

// ── Status transitions ────────────────────────────────────────────────
router.patch("/:id/activate",   checkPermission("payrollpolicy.update"), ctrl.activatePolicy);
router.patch("/:id/deactivate", checkPermission("payrollpolicy.update"), ctrl.deactivatePolicy);
router.patch("/:id/archive",    checkPermission("payrollpolicy.update"), ctrl.archivePolicy);

// ── Payroll Run ───────────────────────────────────────────────────────
router.post("/run",              checkPermission("payroll.run"), runCtrl.runForTenant);
router.post("/run/:employeeId",  checkPermission("payroll.run"), runCtrl.runForEmployee);

module.exports = router;
