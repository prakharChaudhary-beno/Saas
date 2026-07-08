// modules/dashboard/dashboard.controller.js
// UPDATED — tenantId → org_id + company_id + unit_id

const dashboardService = require("./dashboard.service");

// ─── Org Admin Dashboard ───────────────────────────────────────────────────────
// GET /api/v1/dashboard/org
exports.getOrgDashboard = async (req, res, next) => {
  try {
    const data = await dashboardService.getOrgDashboard(req.user);
    res.status(200).json({ success: true, message: "Org dashboard fetched", data });
  } catch (err) { next(err); }
};

// ─── Company Admin Dashboard ───────────────────────────────────────────────────
// GET /api/v1/dashboard/company
exports.getCompanyDashboard = async (req, res, next) => {
  try {
    const data = await dashboardService.getCompanyDashboard(req.user, req.query);
    res.status(200).json({ success: true, message: "Company dashboard fetched", data });
  } catch (err) { next(err); }
};

// ─── Unit Admin / HR Dashboard ────────────────────────────────────────────────
// GET /api/v1/dashboard/unit?month=YYYY-MM
exports.getUnitDashboard = async (req, res, next) => {
  try {
    const data = await dashboardService.getUnitDashboard(req.user, req.query);
    res.status(200).json({ success: true, message: "Unit dashboard fetched", data });
  } catch (err) { next(err); }
};

// ─── Manager Dashboard ────────────────────────────────────────────────────────
// GET /api/v1/dashboard/manager?month=YYYY-MM
exports.getManagerDashboard = async (req, res, next) => {
  try {
    const data = await dashboardService.getManagerDashboard(req.user, req.query);
    res.status(200).json({ success: true, message: "Manager dashboard fetched", data });
  } catch (err) { next(err); }
};

// ─── Employee Self-Service Dashboard ──────────────────────────────────────────
// GET /api/v1/dashboard/employee?month=YYYY-MM
exports.getEmployeeDashboard = async (req, res, next) => {
  try {
    const data = await dashboardService.getEmployeeDashboard(req.user, req.query);
    res.status(200).json({ success: true, message: "Employee dashboard fetched", data });
  } catch (err) { next(err); }
};

// ─── Super Admin Dashboard ─────────────────────────────────────────────────────
// GET /api/v1/dashboard/super-admin
exports.getSuperAdminDashboard = async (req, res, next) => {
  try {
    const data = await dashboardService.getSuperAdminDashboard();
    res.status(200).json({ success: true, message: "Super admin dashboard fetched", data });
  } catch (err) { next(err); }
};

exports.getCommonDashboard = async (req, res, next) => {
  try {
    const { role, level } = req.user;
    let data;
 
    if (role === "SUPER_ADMIN") {
      data = await dashboardService.getSuperAdminDashboard();
    } else if (level === "org") {
      data = await dashboardService.getOrgDashboard(req.user);
    } else if (level === "company") {
      data = await dashboardService.getCompanyDashboard(req.user);
    } else if (level === "unit") {
      // hr_manager, unit_admin, manager → unit dashboard
      if (req.user.role === "manager" || req.user.role === "employee") {
        data = await dashboardService.getEmployeeDashboard(req.user, req.query);
      } else {
        data = await dashboardService.getUnitDashboard(req.user, req.query);
      }
    } else {
      data = await dashboardService.getEmployeeDashboard(req.user, req.query);
    }
 
    res.status(200).json({ success: true, message: "Dashboard fetched", data });
  } catch (err) { next(err); }
};
 
exports.getCustomerDashboard = async (req, res, next) => {
  try {
    const data = await dashboardService.getCustomerDashboard(req.customer);
    res.json({ success: true, message: "Customer dashboard", data });
  } catch (err) { next(err); }
};