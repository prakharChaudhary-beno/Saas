const express = require("express");
const router  = express.Router();

const leaveController = require("./leave.controller");
const leaveValidation = require("./leave.validation");

const { authenticate }  = require("../../middlewares/auth.middleware");
const checkPermission   = require("../../middlewares/permission.middleware");
const checkTrial        = require("../../middlewares/checkTrial.middleware");
const validate          = require("../../middlewares/validate.middleware");

// ── Global guards ─────────────────────────────────────────────────────────────
router.use(authenticate, checkTrial);

// ── SPECIFIC routes PEHLE (/:id se pehle hona chahiye) ───────────────────────

// POST /leave/balances/initialize
router.post(
  "/balances/initialize",
  checkPermission("leave.create"),
  validate(leaveValidation.initializeBalance),
  leaveController.initializeLeaveBalance
);

// GET /leave/balances/my  ← /:id se UPAR hona chahiye
router.get(
  "/balances/my",
  leaveController.getMyLeaveBalances
);

// GET /leave/balances/:employeeId
router.get(
  "/balances/:employeeId",
  checkPermission("leave.read"),
  validate(leaveValidation.getLeaveBalances, "query"),
  leaveController.getLeaveBalances
);

// PATCH /leave/balances/:id/adjust
router.patch(
  "/balances/:id/adjust",
  checkPermission("leave.update"),
  validate(leaveValidation.adjustLeaveBalance),
  leaveController.adjustLeaveBalance
);

// ── LEAVE REQUESTS ────────────────────────────────────────────────────────────

// POST /leave  — apply leave
router.post(
  "/",
  checkPermission("leave.create"),
  leaveController.applyLeave
);

// GET /leave  — all leave requests (employee: apni, HR: unit ki)
router.get(
  "/",
  checkPermission("leave.read"),
  leaveController.getAllLeaveRequests
);

// GET /leave/calendar — team leave calendar (month-wise)
// MUST be before /:id
router.get(
  "/calendar",
  checkPermission("leave.read"),
  leaveController.getTeamCalendar
);

// GET /leave/reports/liability — leave liability report (finance/HR)
// MUST be before /:id
router.get(
  "/reports/liability",
  checkPermission("leave.read"),
  leaveController.getLeaveLiabilityReport
);

// GET /leave/:id  — single leave request
router.get(
  "/:id",
  checkPermission("leave.read"),
  leaveController.getLeaveRequestById
);

// PATCH /leave/:id/toggle-status  ← /:id se PEHLE
router.patch(
  "/:id/toggle-status",
  checkPermission("leave.update"),
  leaveController.toggleStatus
);

// PATCH /leave/:id  — approve / reject
router.patch(
  "/:id",
  checkPermission("leave.approve"),
  leaveController.updateLeaveStatus
);

// DELETE /leave/:id
router.delete(
  "/:id",
  checkPermission("leave.create"),
  leaveController.remove
);

module.exports = router;