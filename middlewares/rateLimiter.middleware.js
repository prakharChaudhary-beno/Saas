const rateLimit = require("express-rate-limit");

const isDisabled = "true";

// Common handler
const rateLimitHandler = (req, res) => {
  return res.status(429).json({
    success: false,
    message: "Too many requests. Please try again later.",
    statusCode: 429
  });
};

// Auth Rate Limiter
const authLimiter = isDisabled
  ? (req, res, next) => next()
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 5,
      standardHeaders: true,
      legacyHeaders: false,
      handler: rateLimitHandler
    });

// API Rate Limiter
const apiLimiter = isDisabled
  ? (req, res, next) => next()
  : rateLimit({
      windowMs: 60 * 1000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
      handler: rateLimitHandler
    });

module.exports = {
  authLimiter,
  apiLimiter
};