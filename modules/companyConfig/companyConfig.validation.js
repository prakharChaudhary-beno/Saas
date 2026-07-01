// modules/companyConfig/companyConfig.validation.js
// UPDATED — T-08 fields added: smtp, mfa, security, google maps

const Joi = require("joi");

const isValidTimezone = (tz) => {
  try { Intl.DateTimeFormat(undefined, { timeZone: tz }); return true; }
  catch { return false; }
};

const smtpSchema = Joi.object({
  host:    Joi.string().trim().optional().allow(null, ""),
  port:    Joi.number().integer().min(1).max(65535).optional().default(587),
  user:    Joi.string().trim().optional().allow(null, ""),
  pass:    Joi.string().optional().allow(null, ""),
  from:    Joi.string().trim().optional().allow(null, ""),
  secure:  Joi.boolean().optional().default(false),
}).optional();

const configSchema = Joi.object({
  // ── PAN (required for TDS) ──────────────────────────────────────────
  pan: Joi.string().trim().uppercase().length(10)
    .pattern(/^[A-Z]{5}\d{4}[A-Z]{1}$/)
    .optional()
    .messages({ 'string.pattern.base': 'Invalid PAN format. Example: AADCM4321B' }),

  // ── Existing fields ──────────────────────────────────────────
  fiscalYearStart: Joi.number().integer().min(1).max(12).optional(),

  timezone: Joi.string().trim().optional()
    .custom((value, helpers) => {
      if (!isValidTimezone(value)) return helpers.error("any.invalid");
      return value;
    })
    .messages({ "any.invalid": "Invalid IANA timezone. Example: Asia/Kolkata" }),

  currency: Joi.string().trim().uppercase().length(3)
    .pattern(/^[A-Z]{3}$/).optional()
    .messages({ "string.pattern.base": "Currency must be 3-letter ISO code. Example: INR" }),

  dateFormat: Joi.string()
    .valid("DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD").optional(),

  workWeek: Joi.array()
    .items(Joi.string().valid("MON","TUE","WED","THU","FRI","SAT","SUN"))
    .min(1).optional(),

  defaultWorkingHoursPerDay: Joi.number().min(1).max(24).optional(),
  payrollCutoffDay:          Joi.number().integer().min(1).max(28).optional(),
  salaryDay:                 Joi.number().integer().min(1).max(28).optional(),
  workingDaysPerWeek:        Joi.number().valid(5, 6).optional(),
  standardHoursPerDay:       Joi.number().min(1).max(24).optional(),
  overtimeThresholdHours:    Joi.number().min(1).max(24).optional(),
  lateThresholdMinutes:      Joi.number().integer().min(0).max(120).optional(),
  halfDayThresholdHours:     Joi.number().min(1).max(12).optional(),

  // ── T-08 New fields ──────────────────────────────────────────
  regularisationWindowDays:  Joi.number().integer().min(1).max(90).optional(),
  regularisationApprovalFlow: Joi.string()
  .valid("L1_ONLY", "L2_ONLY", "L1_L2", "AUTO").optional(),
  defaultFallbackShift:      Joi.string().trim().optional().allow(null, ""),

  // Security
  mfaEnforcementLevel: Joi.string()
    .valid("NONE", "OPTIONAL", "MANDATORY").optional(),
  sessionTimeoutMinutes: Joi.number().integer().min(5).max(10080).optional(),
  loginMaxAttempts:      Joi.number().integer().min(3).max(20).optional(),
  loginLockoutMinutes:   Joi.number().integer().min(5).max(1440).optional(),

  // OAuth
  googleOAuthEnabled:    Joi.boolean().optional(),
  microsoftOAuthEnabled: Joi.boolean().optional(),

  // SMTP
  smtp: smtpSchema,

  // Integrations
  googleMapsApiKey: Joi.string().trim().optional().allow(null, ""),
});

module.exports = { configSchema };
