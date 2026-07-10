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
router.get("/history", checkPermission("payroll.read"), historyCtrl.getPayrollHistory);

// ── CRUD ──────────────────────────────────────────────────────────────────────
router.post(  "/",    checkPermission("payroll.create"),   validate(createPolicySchema), ctrl.createPolicy);
router.get(   "/",    checkPermission("payroll.read"),                                 ctrl.getPolicies);
router.get(   "/:id", checkPermission("payroll.read"),                                 ctrl.getPolicyById);
router.put(   "/:id", checkPermission("payroll.update"),   validate(updatePolicySchema), ctrl.updatePolicy);
router.delete("/:id", checkPermission("payroll.delete"),                               ctrl.deletePolicy);

// ── Versioning ────────────────────────────────────────────────────────
router.get("/:id/versions",          checkPermission("payroll.read"), ctrl.getVersionHistory);
router.get("/:id/versions/:version", checkPermission("payroll.read"), ctrl.getVersionSnapshot);
router.post("/:id/restore/:version", checkPermission("payroll.update"), ctrl.restoreVersion);

// ── Status transitions ────────────────────────────────────────────────
router.patch("/:id/activate",   checkPermission("payroll.update"), ctrl.activatePolicy);
router.patch("/:id/deactivate", checkPermission("payroll.update"), ctrl.deactivatePolicy);
router.patch("/:id/archive",    checkPermission("payroll.update"), ctrl.archivePolicy);

// ── Payroll Run ───────────────────────────────────────────────────────
router.post("/run",              checkPermission("payroll.run"), runCtrl.runForTenant);
router.post("/run/:employeeId",  checkPermission("payroll.run"), runCtrl.runForEmployee);

module.exports = router;
