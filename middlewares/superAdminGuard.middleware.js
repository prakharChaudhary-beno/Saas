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

  // ── 2. IP check — sirf production mein ──
  if (process.env.NODE_ENV === "production") {
    const clientIp   = getClientIp(req);
    const allowedIps = getAllowedIps();

    // .env mein IPs configure nahi — block karo (safe default)
    if (!allowedIps.length) {
      return next(new AppError("Super admin IP allowlist not configured", 500));
    }

    if (!allowedIps.includes(clientIp)) {
      return next(new AppError("Access restricted", 403));
    }
  }

  next();
};