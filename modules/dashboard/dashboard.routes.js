// modules/dashboard/dashboard.routes.js
// UPDATED — Role/Level based dashboard access (no permission check needed)

const express = require("express");
const router  = express.Router();
const ctrl    = require("./dashboard.controller");
const { authenticate }    = require("../../middlewares/auth.middleware");
const customerAuthenticate = require("../../middlewares/customerAuthenticate.middleware");

// Global auth - dashboard is always accessible to authenticated users
router.use(authenticate);

// ─── Super Admin Dashboard ────────────────────────────────────────────────────
// GET /api/v1/dashboard/super-admin
// Access: SUPER_ADMIN role (handled by controller or frontend)
router.get("/super-admin", ctrl.getSuperAdminDashboard);

// ─── Org Admin Dashboard ──────────────────────────────────────────────────────
// GET /api/v1/dashboard/org
// Access: org level users
router.get("/org", ctrl.getOrgDashboard);

// ─── Company Admin Dashboard ──────────────────────────────────────────────────
// GET /api/v1/dashboard/company
// Access: company level users
router.get("/company", ctrl.getCompanyDashboard);

// ─── Unit Admin Dashboard ────────────────────────────────────────────────
// GET /api/v1/dashboard/unit?month=YYYY-MM
// Access: unit level users
router.get("/unit", ctrl.getUnitDashboard);

// ─── HR Manager Dashboard ────────────────────────────────────────────────
// GET /api/v1/dashboard/hr?month=YYYY-MM
// Access: hr_manager role (uses unit dashboard)
router.get("/hr", ctrl.getUnitDashboard);

// ─── Manager Dashboard ────────────────────────────────────────────────────────
// GET /api/v1/dashboard/manager?month=YYYY-MM
// Access: manager role
router.get("/manager", ctrl.getManagerDashboard);

// ─── Employee Self-Service Dashboard ──────────────────────────────────────────
// GET /api/v1/dashboard/employee?month=YYYY-MM
// Access: All logged-in users
router.get("/employee", ctrl.getEmployeeDashboard);

// ─── Customer Dashboard (customer portal) ──────────────────────────────────────
// Access: Customer authenticated users
router.get("/customer", customerAuthenticate, ctrl.getCustomerDashboard);

module.exports = router;
