// middlewares/checkRole.middleware.js
//
// UPDATED — tenant_admin hierarchy → org/company/unit hierarchy
//
// Hierarchy (high → low):
//   SUPER_ADMIN > org_admin > company_admin > company_hr_manager
//   > unit_admin > hr_manager > manager > employee
//
// Usage:
//   checkRole("org_admin")              → org_admin + upar wale allowed
//   checkRole("hr_manager", "manager")  → exact match (+ SUPER_ADMIN)
//   checkRole("employee")               → sab logged-in users
//
// Note: Permission-based checks use permission.middleware.js
//       checkRole is for role-level access only

const AppError = require("../utils/appError");

// Role hierarchy — number jitna bada, utni zyada power
const ROLE_HIERARCHY = {
  SUPER_ADMIN:        100,
  org_admin:           90,
  company_admin:       80,
  company_hr_manager:  70,
  unit_admin:          60,
  hr_manager:          50,
  manager:             40,
  employee:            10,
};

// ─────────────────────────────────────────────────────────────
// checkRole(...allowedRoles)
//
// Ek role diya  → hierarchy mode: us role + upar wale allowed
// Do+ roles diye → exact match mode: sirf wahi roles allowed
//                  (SUPER_ADMIN hamesha allowed)
// ─────────────────────────────────────────────────────────────
exports.checkRole = (...allowedRoles) => {
  return (req, res, next) => {
    const userRole = req.user?.role;

    if (!userRole) {
      return next(new AppError("Authentication required", 401));
    }

    // SUPER_ADMIN — har jagah allowed
    if (userRole === "SUPER_ADMIN") return next();
    
    console.log(`[ROLE CHECK] Required: [${allowedRoles.join(', ')}], User role: ${userRole}, Match: ${allowedRoles.includes(userRole)}`);

    // Exact role match (including array of roles)
    if (allowedRoles.includes(userRole)) return next();

    // Hierarchy check — sirf tab jab ek hi role specify kiya ho
    if (allowedRoles.length === 1) {
      const requiredLevel = ROLE_HIERARCHY[allowedRoles[0]];
      const userLevel     = ROLE_HIERARCHY[userRole];

      if (
        userLevel     !== undefined &&
        requiredLevel !== undefined &&
        userLevel     >= requiredLevel
      ) {
        return next();
      }
    }

    return next(new AppError("Access denied — insufficient role", 403));
  };
};

// ─────────────────────────────────────────────────────────────
// requireSuperAdmin
// Sirf SUPER_ADMIN allowed
// ─────────────────────────────────────────────────────────────
exports.requireSuperAdmin = (req, res, next) => {
  if (req.user?.role !== "SUPER_ADMIN") {
    return next(new AppError("Access restricted to Super Admin only", 403));
  }
  next();
};

// ─────────────────────────────────────────────────────────────
// requireTenantUser
// UPDATED — tenantId → orgId
// SUPER_ADMIN ko org routes pe block karo
// ─────────────────────────────────────────────────────────────
exports.requireTenantUser = (req, res, next) => {
  if (req.user?.role === "SUPER_ADMIN") {
    return next(new AppError("Super Admin cannot access organisation routes", 403));
  }
  if (!req.user?.orgId) {
    return next(new AppError("Organisation context missing", 403));
  }
  return next();
};

// ─────────────────────────────────────────────────────────────
// requireOrgAdmin
// Sirf org_admin allowed (+ SUPER_ADMIN)
// ─────────────────────────────────────────────────────────────
exports.requireOrgAdmin = (req, res, next) => {
  const userRole = req.user?.role;
  if (userRole === "SUPER_ADMIN" || userRole === "org_admin") return next();
  return next(new AppError("Access restricted to Org Admin only", 403));
};

// ─────────────────────────────────────────────────────────────
// requireCompanyAdmin
// company_admin + org_admin + SUPER_ADMIN allowed
// ─────────────────────────────────────────────────────────────
exports.requireCompanyAdmin = (req, res, next) => {
  const userRole = req.user?.role;
  const allowed  = ["SUPER_ADMIN", "org_admin", "company_admin"];
  if (allowed.includes(userRole)) return next();
  return next(new AppError("Access restricted to Company Admin or above", 403));
};

// ─────────────────────────────────────────────────────────────
// requireUnitAdmin
// unit_admin + company_admin + org_admin + SUPER_ADMIN allowed
// ─────────────────────────────────────────────────────────────
exports.requireUnitAdmin = (req, res, next) => {
  const userRole = req.user?.role;
  const allowed  = ["SUPER_ADMIN", "org_admin", "company_admin", "unit_admin"];
  if (allowed.includes(userRole)) return next();
  return next(new AppError("Access restricted to Unit Admin or above", 403));
};