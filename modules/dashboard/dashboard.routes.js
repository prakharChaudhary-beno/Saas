// modules/dashboard/dashboard.routes.js
// UPDATED — role slugs updated to new hierarchy

const express = require("express");
const router  = express.Router();
const ctrl    = require("./dashboard.controller");
const { authenticate }    = require("../../middlewares/auth.middleware");
const { checkRole }       = require("../../middlewares/checkRole.middleware");
const customerAuthenticate = require("../../middlewares/customerAuthenticate.middleware");

// Global auth
router.use(authenticate);

// ─── Super Admin Dashboard ────────────────────────────────────────────────────
// GET /api/v1/dashboard/super-admin
// Only SUPER_ADMIN
router.get(
  "/super-admin",
  checkRole("SUPER_ADMIN"),
  ctrl.getSuperAdminDashboard
);

// ─── Org Admin Dashboard ──────────────────────────────────────────────────────
// GET /api/v1/dashboard/org
// org_admin + above
router.get(
  "/org",
  checkRole("org_admin"),
  ctrl.getOrgDashboard
);

// ─── Company Admin Dashboard ──────────────────────────────────────────────────
// GET /api/v1/dashboard/company
// company_admin + above
router.get(
  "/company",
  checkRole("company_admin"),
  ctrl.getCompanyDashboard
);

// ─── Unit Admin / HR Dashboard ────────────────────────────────────────────────
// GET /api/v1/dashboard/unit?month=YYYY-MM
// unit_admin + above
router.get(
  "/unit",
  checkRole("unit_admin"),
  ctrl.getUnitDashboard
);

// ─── Employee Self-Service Dashboard ──────────────────────────────────────────
// GET /api/v1/dashboard/employee?month=YYYY-MM
// Sab logged-in users — employee + upar wale
router.get(
  "/employee",
  checkRole("employee"),
  ctrl.getEmployeeDashboard
);

router.get(
  "/",
  authenticate,
  ctrl.getCommonDashboard
);

// Customer Dashboard
router.get(
  "/customer",
  customerAuthenticate,
  ctrl.getCustomerDashboard
);

module.exports = router;