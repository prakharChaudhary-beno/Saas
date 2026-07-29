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

  next();
};