const Joi = require("joi");

const objectId = Joi.string()
  .pattern(/^[a-fA-F0-9]{24}$/)
  .messages({ "string.pattern.base": "Invalid ObjectId format" });

// ─── HH:MM pattern ────────────────────────────────────────────────────────────
const timeHHMM = Joi.string()
  .pattern(/^([01]\d|2[0-3]):[0-5]\d$/)
  .messages({ "string.pattern.base": "Time must be in HH:MM format (e.g. 09:00)" });

// ─── Shift ────────────────────────────────────────────────────────────────────
const shiftSchema = Joi.object({
  name:            Joi.string().trim().max(100).required(),
  start:           timeHHMM.required(),
  end:             timeHHMM.required(),
  graceMinutes:    Joi.number().integer().min(0).max(60).default(10),
  minimumHours:    Joi.number().min(1).max(24).default(8),
  halfDayMinHours: Joi.number().min(0.5).default(4),
});

// ─── Late Mark ────────────────────────────────────────────────────────────────
const lateMarkSchema = Joi.object({
  enabled:           Joi.boolean().default(true),
  countAfterMinutes: Joi.number().integer().min(0).default(15),
  penalty: Joi.object({
    type:  Joi.string().valid("leave", "salary").default("leave"),
    value: Joi.number().valid(0.5, 1).default(0.5),
  }).default(),
  allowedPerMonth:  Joi.number().integer().min(0).default(2),
  escalationAfter:  Joi.number().integer().min(1).default(3),
});

// ─── Sandwich Rule ────────────────────────────────────────────────────────────
const sandwichRuleSchema = Joi.object({
  enabled:                     Joi.boolean().default(false),
  includeHolidays:             Joi.boolean().default(true),
  includeWeekends:             Joi.boolean().default(true),
  consecutiveLeaveThreshold:   Joi.number().integer().min(1).default(2),
});

// ─── Overtime ─────────────────────────────────────────────────────────────────
const overtimeSchema = Joi.object({
  enabled:           Joi.boolean().default(false),
  compensationType:  Joi.string().valid("comp_off", "salary").default("comp_off"),
  minimumMinutes:    Joi.number().integer().min(1).default(60),
  rateMultiplier:    Joi.number().min(1).default(1.5),
  maxHoursPerDay:    Joi.number().min(0).default(4),
});

// ─── applicableFor ────────────────────────────────────────────────────────────
const applicableForSchema = Joi.object({
  departments:      Joi.array().items(objectId).default([]),
  designations:     Joi.array().items(objectId).default([]),
  roles:            Joi.array().items(Joi.string()).default([]),
  locations:        Joi.array().items(Joi.string().trim()).default([]),
  employmentTypes:  Joi.array()
    .items(Joi.string().valid("FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"))
    .default([]),
});

// ─── Create Schema ────────────────────────────────────────────────────────────
const createPolicySchema = Joi.object({
  name:          Joi.string().trim().max(150).required(),
  description:   Joi.string().trim().max(1000).optional().allow(""),
  status:        Joi.string().valid("draft", "active").default("draft"),
  shift:         shiftSchema.required(),
  lateMark:      lateMarkSchema.optional(),
  sandwichRule:  sandwichRuleSchema.optional(),
  overtime:      overtimeSchema.optional(),
  applicableFor: applicableForSchema.optional(),
});

// ─── Update Schema (all fields optional) ──────────────────────────────────────
const updatePolicySchema = Joi.object({
  name:          Joi.string().trim().max(150).optional(),
  description:   Joi.string().trim().max(1000).optional().allow(""),
  changeNote:    Joi.string().trim().max(500).optional().allow(null, ""),
  shift:         shiftSchema.optional(),
  lateMark:      lateMarkSchema.optional(),
  sandwichRule:  sandwichRuleSchema.optional(),
  overtime:      overtimeSchema.optional(),
  applicableFor: applicableForSchema.optional(),
  status:        Joi.string().valid("draft", "active").optional(),
});

module.exports = { createPolicySchema, updatePolicySchema };