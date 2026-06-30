// middlewares/auditLog.middleware.js
// Auto audit middleware — logs every successful mutating request
"use strict";

const auditService = require("../modules/auditLogs/auditLog.service");

// Map HTTP method + route pattern → action
const ACTION_MAP = {
  "POST /employees":                    { action: "EMPLOYEE_CREATED",   module: "employee" },
  "PUT /employees/:id":                 { action: "EMPLOYEE_UPDATED",   module: "employee" },
  "PATCH /employees/:id/status":        { action: "STATUS_CHANGED",     module: "employee" },
  "POST /employees/:id/activate-login": { action: "LOGIN_ACTIVATED",    module: "employee" },
  "POST /auth/login":                   { action: "LOGIN",              module: "auth" },
  "POST /leave":                        { action: "LEAVE_APPLIED",      module: "leave" },
  "DELETE /leave/:id":                  { action: "LEAVE_CANCELLED",    module: "leave" },
  "POST /attendance/me/punch-in":       { action: "PUNCH_IN",           module: "attendance" },
  "POST /attendance/me/punch-out":      { action: "PUNCH_OUT",          module: "attendance" },
  "POST /attendance/regularize":        { action: "REGULARIZATION_APPLIED", module: "attendance" },
  "POST /shifts":                       { action: "SHIFT_CREATED",      module: "shift" },
  "POST /rosters":                      { action: "ROSTER_ASSIGNED",    module: "roster" },
  "POST /roles":                        { action: "ROLE_CREATED",       module: "role" },
  "PUT /roles/:id":                     { action: "ROLE_UPDATED",       module: "role" },
  "DELETE /roles/:id":                  { action: "ROLE_DELETED",       module: "role" },
  "POST /delegations":                  { action: "DELEGATION_CREATED", module: "delegation" },
  "POST /payroll-policies/run/:id":     { action: "PAYROLL_RUN",        module: "payroll" },
  "PATCH /payslips/:id/publish":        { action: "PAYSLIP_PUBLISHED",  module: "payroll" },
};

// Match route pattern
const matchRoute = (method, path) => {
  // Remove /api/v1 prefix
  const cleanPath = path.replace(/^\/api\/v1/, "");
  const key = `${method} ${cleanPath}`;

  // Exact match
  if (ACTION_MAP[key]) return ACTION_MAP[key];

  // Pattern match — replace IDs with :id
  const normalized = cleanPath.replace(/\/[a-f0-9]{24}/g, "/:id");
  const patternKey = `${method} ${normalized}`;
  if (ACTION_MAP[patternKey]) return ACTION_MAP[patternKey];

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
      if (matched && req.user) {
        setImmediate(() => {
          auditService.log({
            action:      matched.action,
            module:      matched.module,
            org_id:      req.user.orgId,
            company_id:  req.user.companyId,
            unit_id:     req.user.unitId,
            actor: {
              userId: req.user.userId,
              name:   req.user.name,
              role:   req.user.role,
              email:  req.user.email,
            },
            target: {
              type: matched.module,
              id:   body?.data?._id || body?.data?.id || null,
              name: body?.data?.name || body?.data?.employee?.name || null,
            },
            description: `${matched.action} by ${req.user.role}`,
            metadata: {
              ip:        req.ip || req.headers["x-forwarded-for"],
              userAgent: req.headers["user-agent"],
            },
          }).catch(() => {});
        });
      }
    }
    return originalJson(body);
  };

  next();
};