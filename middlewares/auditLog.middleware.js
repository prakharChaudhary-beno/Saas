// middlewares/auditLog.middleware.js
// Enterprise Audit Middleware — Comprehensive Action Logging
// Captures ALL mutating operations across HRMS modules
"use strict";

const auditService = require("../modules/auditLogs/auditLog.service");

// ═══════════════════════════════════════════════════════════════════════════
// COMPREHENSIVE ACTION MAP - ALL ENTERPRISE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

const ACTION_MAP = {
  // ── AUTHENTICATION ──────────────────────────────────────────────────────
  // Note: LOGIN is logged manually in auth.controller.js since req.user doesn't exist
  "POST /auth/login":                              { action: "LOGIN",                  module: "auth" },
  "POST /auth/logout":                             { action: "LOGOUT",                 module: "auth" },
  "POST /auth/change-password":                    { action: "PASSWORD_CHANGED",       module: "auth" },
  "POST /auth/forgot-password":                    { action: "PASSWORD_RESET_REQUEST", module: "auth" },
  "POST /auth/reset-password":                     { action: "PASSWORD_RESET",          module: "auth" },
  "GET /auth/google/callback":                     { action: "GOOGLE_LOGIN",            module: "auth" }, // Note: needs manual logging
  "PATCH /auth/mfa/enable":                        { action: "MFA_ENABLED",             module: "auth" },
  "PATCH /auth/mfa/disable":                       { action: "MFA_DISABLED",            module: "auth" },

  // ── EMPLOYEE MANAGEMENT ────────────────────────────────────────────────
  "POST /employees":                               { action: "EMPLOYEE_CREATED",       module: "employee" },
  "PUT /employees/:id":                            { action: "EMPLOYEE_UPDATED",       module: "employee" },
  "PATCH /employees/:id":                          { action: "EMPLOYEE_UPDATED",       module: "employee" },
  "DELETE /employees/:id":                         { action: "EMPLOYEE_DELETED",       module: "employee" },
  "PATCH /employees/:id/status":                   { action: "STATUS_CHANGED",         module: "employee" },
  "POST /employees/:id/activate-login":            { action: "LOGIN_ACTIVATED",        module: "employee" },
  "PATCH /employees/:id/salary":                   { action: "SALARY_UPDATED",         module: "employee" },
  "PATCH /employees/:id/reporting-manager":        { action: "REPORTING_MANAGER_CHANGED", module: "employee" },
  "POST /employees/:id/photo":                     { action: "EMPLOYEE_PHOTO_UPDATED", module: "employee" },
  "POST /employees/bulk-import":                   { action: "EMPLOYEE_BULK_IMPORTED", module: "employee" },
  "GET /employees/:id":                            { action: "EMPLOYEE_PROFILE_VIEWED", module: "employee" },
  "POST /employees/export":                        { action: "EMPLOYEE_EXPORTED",      module: "employee" },

  // ── LEAVE MANAGEMENT ────────────────────────────────────────────────────
  "POST /leave":                                   { action: "LEAVE_APPLIED",         module: "leave" },
  "POST /leave/apply":                              { action: "LEAVE_APPLIED",         module: "leave" },
  "PATCH /leave/:id/approve-l1":                   { action: "LEAVE_APPROVED_L1",     module: "leave" },
  "PATCH /leave/:id/approve-l2":                   { action: "LEAVE_APPROVED_L2",     module: "leave" },
  "PATCH /leave/:id/approve":                      { action: "LEAVE_APPROVED_L1",     module: "leave" },
  "PATCH /leave/:id/reject":                       { action: "LEAVE_REJECTED",         module: "leave" },
  "DELETE /leave/:id":                             { action: "LEAVE_CANCELLED",         module: "leave" },
  "PATCH /leave/:id/cancel":                       { action: "LEAVE_CANCELLED",        module: "leave" },
  "PATCH /leave/:id/adjust-balance":               { action: "LEAVE_BALANCE_ADJUSTED", module: "leave" },
  "POST /leave/export":                            { action: "LEAVE_REPORT_DOWNLOADED", module: "leave" },

  // ── ATTENDANCE ───────────────────────────────────────────────────────────
  "POST /attendance/me/punch-in":                  { action: "PUNCH_IN",               module: "attendance" },
  "POST /attendance/me/punch-out":                 { action: "PUNCH_OUT",              module: "attendance" },
  "POST /attendance/punch-in":                     { action: "PUNCH_IN",               module: "attendance" },
  "POST /attendance/punch-out":                    { action: "PUNCH_OUT",              module: "attendance" },
  "POST /attendance/regularize":                   { action: "REGULARIZATION_APPLIED", module: "attendance" },
  "POST /attendance/regularize/apply":             { action: "REGULARIZATION_APPLIED", module: "attendance" },
  "PATCH /attendance/regularize/:id/approve-l1":   { action: "REGULARIZATION_APPROVED_L1", module: "attendance" },
  "PATCH /attendance/regularize/:id/approve":      { action: "REGULARIZATION_APPROVED_L1", module: "attendance" },
  "PATCH /attendance/regularize/:id/reject":       { action: "REGULARIZATION_REJECTED", module: "attendance" },
  "POST /attendance/manual-entry":                 { action: "ATTENDANCE_MANUAL_ENTRY", module: "attendance" },
  "POST /attendance/sync":                         { action: "BIOMETRIC_SYNC_STARTED", module: "attendance" },
  "POST /attendance/export":                       { action: "ATTENDANCE_REPORT_DOWNLOADED", module: "attendance" },
  "POST /attendance/bulk-upload":                  { action: "BULK_ATTENDANCE_UPLOADED", module: "attendance" },

  // ── PAYROLL ──────────────────────────────────────────────────────────────
  "POST /payroll/run":                             { action: "PAYROLL_RUN_STARTED",    module: "payroll" },
  "POST /payroll-policies/run/:id":                { action: "PAYROLL_RUN_STARTED",    module: "payroll" },
  "POST /payroll-policies/:id/run":                { action: "PAYROLL_RUN_STARTED",    module: "payroll" },
  "PATCH /payslips/:id/publish":                   { action: "PAYSLIP_PUBLISHED",      module: "payroll" },
  "DELETE /payslips/:id":                          { action: "PAYSLIP_DELETED",        module: "payroll" },
  "GET /payslips/:id":                             { action: "PAYSLIP_VIEWED",        module: "payroll" },
  "POST /payslips/generate":                       { action: "PAYSLIP_GENERATED",     module: "payroll" },
  "POST /investment-declarations":                 { action: "INVESTMENT_DECLARED",    module: "payroll" },
  "PATCH /investment-declarations/:id":            { action: "INVESTMENT_UPDATED",    module: "payroll" },
  "PATCH /investment-declarations/:id/approve":    { action: "INVESTMENT_APPROVED",   module: "payroll" },
  "POST /salary-revisions":                        { action: "SALARY_REVISION_CREATED",    module: "payroll" },
  "POST /reimbursements":                           { action: "REIMBURSEMENT_CLAIMED",     module: "payroll" },
  "PATCH /reimbursements/:id/approve":             { action: "REIMBURSEMENT_APPROVED",    module: "payroll" },

  // ── SHIFT MANAGEMENT ─────────────────────────────────────────────────────
  "POST /shifts":                                  { action: "SHIFT_CREATED",          module: "shift" },
  "PUT /shifts/:id":                               { action: "SHIFT_UPDATED",          module: "shift" },
  "PATCH /shifts/:id":                             { action: "SHIFT_UPDATED",          module: "shift" },
  "PATCH /shifts/:id/activate":                   { action: "SHIFT_ACTIVATED",        module: "shift" },
  "PATCH /shifts/:id/deactivate":                 { action: "SHIFT_DEACTIVATED",      module: "shift" },
  "DELETE /shifts/:id":                            { action: "SHIFT_DELETED",          module: "shift" },

  // ── ROSTER MANAGEMENT ────────────────────────────────────────────────────
  "POST /rosters":                                 { action: "ROSTER_ASSIGNED",        module: "roster" },
  "POST /rosters/bulk":                            { action: "ROSTER_ASSIGNED",        module: "roster" },
  "PUT /rosters/:id":                              { action: "ROSTER_UPDATED",         module: "roster" },
  "PATCH /rosters/:id/revoke":                     { action: "ROSTER_REVOKED",         module: "roster" },

  // ── ROLE MANAGEMENT ──────────────────────────────────────────────────────
  "POST /roles":                                   { action: "ROLE_CREATED",           module: "role" },
  "PUT /roles/:id":                                { action: "ROLE_UPDATED",           module: "role" },
  "PATCH /roles/:id":                              { action: "ROLE_UPDATED",           module: "role" },
  "DELETE /roles/:id":                             { action: "ROLE_DELETED",           module: "role" },
  "PATCH /roles/:id/permissions":                  { action: "PERMISSION_ASSIGNED",    module: "role" },
  "PATCH /users/:id/role":                         { action: "ROLE_ASSIGNED_TO_USER",  module: "role" },

  // ── DELEGATION ────────────────────────────────────────────────────────────
  "POST /delegations":                             { action: "DELEGATION_CREATED",     module: "delegation" },
  "PATCH /delegations/:id/revoke":                 { action: "DELEGATION_REVOKED",     module: "delegation" },
  "PATCH /delegations/:id/approve":                { action: "DELEGATION_APPROVED",    module: "delegation" },
  "PATCH /delegations/:id/reject":                 { action: "DELEGATION_REJECTED",    module: "delegation" },

  // ── POLICIES ──────────────────────────────────────────────────────────────
  "POST /attendance-policies":                     { action: "ATTENDANCE_POLICY_CREATED", module: "policy" },
  "PUT /attendance-policies/:id":                  { action: "ATTENDANCE_POLICY_UPDATED", module: "policy" },
  "POST /attendance-policies/:id/restore/:version": { action: "ATTENDANCE_POLICY_RESTORED", module: "policy" },
  "PATCH /attendance-policies/:id/activate":       { action: "ATTENDANCE_POLICY_ACTIVATED", module: "policy" },
  "PATCH /attendance-policies/:id/deactivate":     { action: "ATTENDANCE_POLICY_DEACTIVATED", module: "policy" },
  "PATCH /attendance-policies/:id/archive":        { action: "ATTENDANCE_POLICY_ARCHIVED", module: "policy" },
  "DELETE /attendance-policies/:id":               { action: "ATTENDANCE_POLICY_DELETED", module: "policy" },

  "POST /leave-policies":                          { action: "LEAVE_POLICY_CREATED",       module: "policy" },
  "PUT /leave-policies/:id":                       { action: "LEAVE_POLICY_UPDATED",       module: "policy" },
  "DELETE /leave-policies/:id":                    { action: "LEAVE_POLICY_DELETED",       module: "policy" },

  "POST /payroll-policies":                        { action: "PAYROLL_POLICY_CREATED",     module: "policy" },
  "PUT /payroll-policies/:id":                     { action: "PAYROLL_POLICY_UPDATED",     module: "policy" },
  "DELETE /payroll-policies/:id":                  { action: "PAYROLL_POLICY_DELETED",     module: "policy" },

  // ── ORGANIZATION STRUCTURE ──────────────────────────────────────────────
  "POST /organization":                            { action: "ORGANIZATION_CREATED",    module: "organization" },
  "PUT /organization/:id":                         { action: "ORGANIZATION_UPDATED",    module: "organization" },
  "PATCH /organization/:id":                       { action: "ORGANIZATION_UPDATED",    module: "organization" },

  "POST /companies":                                { action: "COMPANY_CREATED",         module: "company" },
  "PUT /companies/:id":                            { action: "COMPANY_UPDATED",         module: "company" },
  "PATCH /companies/:id":                          { action: "COMPANY_UPDATED",         module: "company" },

  "POST /units":                                   { action: "UNIT_CREATED",            module: "unit" },
  "PUT /units/:id":                                { action: "UNIT_UPDATED",            module: "unit" },
  "PATCH /units/:id":                              { action: "UNIT_UPDATED",            module: "unit" },
  "DELETE /units/:id":                             { action: "UNIT_DELETED",            module: "unit" },

  "POST /departments":                             { action: "DEPARTMENT_CREATED",      module: "department" },
  "PUT /departments/:id":                          { action: "DEPARTMENT_UPDATED",      module: "department" },
  "PATCH /departments/:id":                        { action: "DEPARTMENT_UPDATED",      module: "department" },

  "POST /designations":                            { action: "DESIGNATION_CREATED",     module: "designation" },
  "PUT /designations/:id":                         { action: "DESIGNATION_UPDATED",     module: "designation" },
  "PATCH /designations/:id":                       { action: "DESIGNATION_UPDATED",     module: "designation" },

  // ── HOLIDAYS ──────────────────────────────────────────────────────────────
  "POST /holidays":                                { action: "HOLIDAY_CREATED",         module: "holiday" },
  "PUT /holidays/:id":                             { action: "HOLIDAY_UPDATED",         module: "holiday" },
  "DELETE /holidays/:id":                          { action: "HOLIDAY_DELETED",         module: "holiday" },

  // ── SUPER ADMIN ACTIONS ──────────────────────────────────────────────────
  "POST /super-admin/tenants":                     { action: "TENANT_CREATED",        module: "superAdmin" },
  "DELETE /super-admin/tenant/:id":                { action: "TENANT_DELETED",        module: "superAdmin" },
  "PATCH /super-admin/plan-override/:id":          { action: "PLAN_OVERRIDE",           module: "superAdmin" },
  "PATCH /super-admin/tenant/:id/suspend":          { action: "TENANT_SUSPEND",          module: "superAdmin" },
  "PATCH /super-admin/tenant/:id/activate":         { action: "TENANT_ACTIVATE",         module: "superAdmin" },
  "PATCH /super-admin/tenant/:id/status":          { action: "TENANT_STATUS_CHANGE",    module: "superAdmin" },
  "POST /super-admin/customers/:id/approve":        { action: "CUSTOMER_APPROVED",        module: "superAdmin" },
  "POST /super-admin/export/*":                    { action: "DATA_EXPORTED",         module: "superAdmin" },
  "PATCH /super-admin/config":                     { action: "SYSTEM_CONFIG_CHANGED", module: "superAdmin" }
};

// Extract target information from response
const extractTarget = (body, matched) => {
  const data = body?.data || body;
  
  // Employee operations
  if (matched.module === "employee" && data) {
    return {
      type: "Employee",
      id: data._id || data.id || null,
      name: data.name || `${data.firstName || ''} ${data.lastName || ''}`.trim(),
      employeeId: data.employeeId || data.employee_id || null,
    };
  }
  
  // Leave operations
  if (matched.module === "leave" && data) {
    return {
      type: "Leave",
      id: data._id || data.id || null,
      name: data.employee?.name || data.name || null,
      employeeId: data.employeeId || data.employee_id || null,
    };
  }
  
  // Attendance operations
  if (matched.module === "attendance" && data) {
    return {
      type: "Attendance",
      id: data._id || data.id || null,
      name: data.employee?.name || data.name || null,
      employeeId: data.employeeId || data.employee_id || null,
    };
  }
  
  // Payroll operations
  if (matched.module === "payroll" && data) {
    return {
      type: matched.action.includes("PAYSLIP") ? "Payslip" : "Payroll",
      id: data._id || data.id || null,
      name: data.employee?.name || data.name || null,
      employeeId: data.employeeId || data.employee_id || null,
    };
  }
  
  // Organization structure
  if (matched.module === "organization" && data) {
    return { type: "Organization", id: data._id || data.id, name: data.name || data.org_name };
  }
  
  if (matched.module === "company" && data) {
    return { type: "Company", id: data._id || data.id, name: data.name || data.company_name };
  }
  
  if (matched.module === "unit" && data) {
    return { type: "Unit", id: data._id || data.id, name: data.name || data.unit_name };
  }
  
  if (matched.module === "department" && data) {
    return { type: "Department", id: data._id || data.id, name: data.name || data.department_name };
  }
  
  if (matched.module === "designation" && data) {
    return { type: "Designation", id: data._id || data.id, name: data.name || data.designation_name };
  }
  
  // Roles and permissions
  if (matched.module === "role" && data) {
    return { type: "Role", id: data._id || data.id, name: data.name || data.role_name };
  }
  
  if (matched.module === "delegation" && data) {
    return { 
      type: "Delegation", 
      id: data._id || data.id, 
      name: `${data.from?.name || 'N/A'} → ${data.to?.name || 'N/A'}` 
    };
  }
  
  // Policies
  if (matched.module === "policy" && data) {
    const policyType = matched.action.split('_')[0]; // ATTENDANCE_POLICY_CREATED → ATTENDANCE
    return { 
      type: `${policyType}Policy`, 
      id: data._id || data.id, 
      name: data.name || data.policy_name || null 
    };
  }
  
  // Shifts and Rosters
  if (matched.module === "shift" && data) {
    return { type: "Shift", id: data._id || data.id, name: data.name || data.shift_name };
  }
  
  if (matched.module === "roster" && data) {
    return { 
      type: "Roster", 
      id: data._id || data.id, 
      name: data.employee?.name || data.name || null,
      employeeId: data.employeeId || null,
    };
  }
  
  // Holidays
  if (matched.module === "holiday" && data) {
    return { type: "Holiday", id: data._id || data.id, name: data.name || data.holiday_name };
  }
  
  // Super Admin operations
  if (matched.module === "superAdmin" && data) {
    return { 
      type: matched.action.includes("TENANT") ? "Tenant" : "Customer",
      id: data._id || data.id, 
      name: data.name || data.org_name || data.company_name || null 
    };
  }
  
  // Default fallback
  return {
    type: matched.module.charAt(0).toUpperCase() + matched.module.slice(1),
    id: body?.data?._id || body?.data?.id || null,
    name: body?.data?.name || null,
  };
};

// Extract changes from request body
const extractChanges = (req) => {
  // For updates, capture what changed
  if (!req.body || Object.keys(req.body).length === 0) return undefined;
  
  // Don't log passwords or sensitive data
  const sanitized = { ...req.body };
  delete sanitized.password;
  delete sanitized.confirmPassword;
  delete sanitized.oldPassword;
  delete sanitized.newPassword;
  delete sanitized.token;
  delete sanitized.refreshToken;
  
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
};

// Match route pattern
const matchRoute = (method, path) => {
  // Remove /api/v1 prefix
  const cleanPath = path.replace(/^\/api\/v1/, "");
  const key = `${method} ${cleanPath}`;

  // Exact match
  if (ACTION_MAP[key]) return ACTION_MAP[key];

  // Pattern match — replace IDs with :id (handles both ObjectId and numeric IDs)
  const normalized = cleanPath.replace(/\/[a-f0-9]{24}/gi, "/:id").replace(/\/\d+/, "/:id");
  const patternKey = `${method} ${normalized}`;
  if (ACTION_MAP[patternKey]) return ACTION_MAP[patternKey];

  // Wildcard match for dynamic routes
  const segments = cleanPath.split('/').filter(Boolean);
  for (let i = segments.length; i > 0; i--) {
    const partialPath = '/' + segments.slice(0, i).join('/');
    const partialKey = `${method} ${partialPath}/:id`;
    if (ACTION_MAP[partialKey]) return ACTION_MAP[partialKey];
  }

  return null;
};

module.exports = (req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = function (body) {
    // Only log successful mutating requests
    if (
      ["POST", "PUT", "PATCH", "DELETE"].includes(req.method) &&
      res.statusCode >= 200 &&
      res.statusCode < 300 &&
      body?.success !== false
    ) {
      const matched = matchRoute(req.method, req.originalUrl || req.url);
      
      // Debug logging
      if (req.method !== "GET") {
        console.log('[AuditLog DEBUG]', {
          method: req.method,
          url: req.originalUrl,
          matched: matched,
          hasUser: !!req.user,
          statusCode: res.statusCode,
          bodySuccess: body?.success
        });
      }
      
      if (matched && req.user) {
        setImmediate(() => {
          try {
            const target = extractTarget(body, matched);
            const changes = extractChanges(req);
            
            console.log('[AuditLog] Creating log:', {
              action: matched.action,
              module: matched.module,
              targetName: target.name,
              actorRole: req.user.role
            });
            
            auditService.log({
              action:      matched.action,
              module:      matched.module,
              org_id:      req.user.orgId,
              company_id:  req.user.companyId,
              unit_id:     req.user.unitId,
              actor: {
                userId: req.user.userId,
                name:   req.user.name || (req.user.role === "SUPER_ADMIN" ? "Super Admin" : "System"),
                role:   req.user.role,
                email:  req.user.email,
              },
              target: target,
              changes: changes,
              description: `${matched.action} by ${req.user.role}`,
              metadata: {
                ip:        req.ip || req.headers["x-forwarded-for"] || req.connection?.remoteAddress,
                userAgent: req.headers["user-agent"],
                requestId: req.headers["x-request-id"] || req.id || null,
              },
            }).catch(err => {
              console.error('[AuditLog] Failed to create log:', err.message);
            });
          } catch (err) {
            console.error('[AuditLog] Middleware error:', err.message);
          }
        });
      } else if (!matched && req.method !== "GET") {
        console.warn('[AuditLog] NO MATCH for route:', req.method, req.originalUrl);
      }
    }
    return originalJson(body);
  };

  next();
};