// src/middlewares/superAdminGuard.middleware.js
const AppError = require("../utils/appError");

// ─────────────────────────────────────────
// Super Admin Guard
// authenticate ke BAAD lagao
// ─────────────────────────────────────────
// Checks:
//   1. role === "SUPER_ADMIN" (JWT se)
//   2. IP allowlist (production mein .env se)
// ─────────────────────────────────────────

// Client IP extract — proxy ke peeche bhi kaam kare
const getClientIp = (req) =>
  req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
  req.socket.remoteAddress;

// .env se allowed IPs parse karo
// SUPER_ADMIN_ALLOWED_IPS=127.0.0.1,::1,103.21.0.1
const getAllowedIps = () => {
  const raw = process.env.SUPER_ADMIN_ALLOWED_IPS || "";
  return raw.split(",").map((ip) => ip.trim()).filter(Boolean);
};

exports.superAdminGuard = (req, res, next) => {

  // ── 1. Role check ─────────────────────
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