// src/middlewares/superAdminGuard.middleware.js
const AppError = require("../utils/appError");

// ─────────────────────────────────────────
// Super Admin Guard
// authenticate ke BAAD lagao
// ─────────────────────────────────────────
// Checks:
//   1. role === "SUPER_ADMIN" (JWT se)
// ─────────────────────────────────────────

exports.superAdminGuard = (req, res, next) => {

  // ── Role check ─────────────────────
  if (!req.user || req.user.role !== "SUPER_ADMIN") {
    return next(new AppError("Access restricted", 403));
  }

  // ── 2. IP check — sirf production mein, aur sirf jab explicitly
  //      configured ho. Vercel/serverless deployments have dynamic
  //      egress IPs, and admins often connect from non-static IPs too,
  //      so treating "not configured" as a hard block ends up locking
  //      out every super admin action (including just viewing a
  //      customer). Only enforce once an allowlist is actually set.
  if (process.env.NODE_ENV === "production") {
    const clientIp   = getClientIp(req);
    const allowedIps = getAllowedIps();

    if (allowedIps.length && !allowedIps.includes(clientIp)) {
      return next(new AppError("Access restricted", 403));
    }

    if (!allowedIps.length) {
      console.warn("[superAdminGuard] SUPER_ADMIN_ALLOWED_IPS not set — IP allowlisting is disabled.");
    }
  }

  next();
};