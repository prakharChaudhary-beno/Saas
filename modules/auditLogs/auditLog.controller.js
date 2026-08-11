"use strict";
const service = require("./auditLog.service");
const AppError = require("../../utils/appError");

// ── STRICT ROLE CHECK: Only Admins Can Access ──────────────────────────────
// Note: SUPER_ADMIN JWT uses uppercase, but role.slug in DB is lowercase "super_admin"
const ADMIN_ROLES = ["SUPER_ADMIN", "super_admin", "org_admin", "company_admin", "unit_admin"];

exports.getLogs = async (req, res, next) => {
  try {
    // Enforce strict admin-only access
    if (!ADMIN_ROLES.includes(req.user.role)) {
      throw new AppError("Access denied. Only administrators can view audit logs.", 403);
    }
    const data = await service.getLogs(req.query, req.user);
    res.status(200).json({ success: true, data });
  } catch (e) { next(e); }
};

exports.getEmployeeTimeline = async (req, res, next) => {
  try {
    // Enforce strict admin-only access
    if (!ADMIN_ROLES.includes(req.user.role)) {
      throw new AppError("Access denied. Only administrators can view audit logs.", 403);
    }
    const data = await service.getEmployeeTimeline(req.params.employeeId, req.user);
    res.status(200).json({ success: true, data });
  } catch (e) { next(e); }
};

// ── HR-SPECIFIC AUDIT LOGS (Employee-level actions for HR) ─────────────────
// HR Manager/HR roles can view specific employee actions within their scope
const HR_ROLES = ["hr_manager", "company_hr_manager", "hr", "company_admin", "unit_admin"];

exports.getHREmployeeLogs = async (req, res, next) => {
  try {
    // Only HR roles and company admins can access this endpoint
    if (!HR_ROLES.includes(req.user.role)) {
      throw new AppError("Access denied. Only HR personnel can view employee audit logs.", 403);
    }
    
    const data = await service.getHREmployeeLogs(req.query, req.user);
    res.status(200).json({ success: true, data });
  } catch (e) { next(e); }
};