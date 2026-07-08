// modules/attendance/attendance.routes.js
//
// Route Rules:
//   Employee (self)  → punch-in, punch-out, own records
//   HR Manager+      → all employees' records, regularize
//
// ⚠️  /me/* routes MUST come before /:id routes — Express order matters

const express    = require("express");
const router     = express.Router();

const attendanceController             = require("./attendance.controller");
const attendanceValidation             = require("./attendance.validation");
const { authenticate }                 = require("../../middlewares/auth.middleware");
const { checkRole, requireTenantUser } = require("../../middlewares/checkRole.middleware");
const checkTrial                       = require("../../middlewares/checkTrial.middleware");
const validate                         = require("../../middlewares/validate.middleware");

// ── Global guards — sab routes pe ────────────────────────────
router.use(authenticate);
router.use(requireTenantUser);
router.use(checkTrial);

// ─────────────────────────────────────────────────────────────
// EMPLOYEE SELF-SERVICE routes  (/me/*)
// Must be declared BEFORE any /:id routes
// ─────────────────────────────────────────────────────────────

// ─── Attendance Policy (Company Config) ──────────────────────
const companyConfigController = require("../companyConfig/companyConfig.controller");
const { configSchema }        = require("../companyConfig/companyConfig.validation");

router.get(
  "/policy",
  checkRole("employee"),
  companyConfigController.getConfig
);

router.post(
  "/policy",
  checkRole("hr_manager"),
  validate(configSchema),
  companyConfigController.createConfig
);

router.put(
  "/policy",
  checkRole("hr_manager"),
  validate(configSchema),
  companyConfigController.updateConfig
);

// GET /hrms/me/attendance/today — aaj ka punch status (employee + unit_admin + manager)
router.get(
  "/me/today",
  checkRole("employee", "unit_admin", "manager", "hr_manager"),
  attendanceController.getTodayStatus
);

// GET /hrms/me/attendance/summary?month=YYYY-MM — monthly summary (employee + unit_admin + manager)
router.get(
  "/me/summary",
  checkRole("employee", "unit_admin", "manager", "hr_manager"),
  validate(attendanceValidation.getSummary, "query"),
  attendanceController.getMySummary
);

// GET /hrms/me/attendance?month=YYYY-MM — full detail records (employee + unit_admin + manager)
router.get(
  "/me",
  checkRole("employee", "unit_admin", "manager", "hr_manager"),  
  validate(attendanceValidation.getMyAttendance, "query"),
  attendanceController.getMyAttendance
);

// POST /hrms/me/attendance/punch-in — punch in (employee + unit_admin + manager)
router.post(
  "/me/punch-in",
  checkRole("employee", "unit_admin", "manager", "hr_manager"),
  validate(attendanceValidation.punchIn),
  attendanceController.punchIn
);

// POST /hrms/me/attendance/punch-out — punch out (employee + unit_admin + manager)
router.post(
  "/me/punch-out",
  checkRole("employee", "unit_admin", "manager", "hr_manager"),
  validate(attendanceValidation.punchOut),
  attendanceController.punchOut
);

// ─────────────────────────────────────────────────────────────
// MANAGER routes (Team Attendance)
// ─────────────────────────────────────────────────────────────

// GET /hrms/attendance/team — manager sees their team's attendance
router.get(
  "/team",
  checkRole("manager"),
  validate(attendanceValidation.getAttendance, "query"),
  attendanceController.getTeamAttendance
);

// ─────────────────────────────────────────────────────────────
// HR MANAGER + UNIT ADMIN routes
// ─────────────────────────────────────────────────────────────

// GET /hrms/attendance?month=&employeeId=&status= — all employees (unit scoped)
router.get(
  "/",
  checkRole("hr_manager", "unit_admin"),
  validate(attendanceValidation.getAttendance, "query"),
  attendanceController.getAllAttendance
);

// PATCH /hrms/attendance/:id/regularize — HR manually fix kare
router.patch(
  "/:id/regularize",
  checkRole("hr_manager"),
  validate(attendanceValidation.regularize),
  attendanceController.regularize
);

module.exports = router;