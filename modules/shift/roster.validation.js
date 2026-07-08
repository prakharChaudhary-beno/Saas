// modules/shift/roster.validation.js
//
// Joi validation for Roster operations

const Joi = require("joi");

// ─── Helper: MongoDB ObjectId pattern ────────────────────────
const objectId = Joi.string()
  .regex(/^[a-fA-F0-9]{24}$/)
  .messages({ "string.pattern.base": "Invalid ID format" });

// ─── CREATE ROSTER ───────────────────────────────────────────
// POST /rosters
exports.createRoster = Joi.object({
  employee_id: objectId.required()
    .messages({ "any.required": "employee_id is required" }),

  shift_id: objectId.required()
    .messages({ "any.required": "shift_id is required" }),

  startDate: Joi.date()
    .iso()
    .required()
    .messages({ "any.required": "startDate is required" }),

  endDate: Joi.date()
    .iso()
    .min(Joi.ref("startDate"))
    .required()
    .messages({
      "any.required": "endDate is required",
      "date.min": "endDate must be on or after startDate",
    }),

  notes: Joi.string()
    .trim()
    .max(500)
    .optional()
    .allow("", null),

  unit_id: objectId
    .optional()
    .description("Target unit — defaults to user's unit if not provided"),
});

// ─── BULK ASSIGN ROSTER ─────────────────────────────────────
// POST /rosters/bulk
exports.bulkAssignRoster = Joi.object({
  employee_ids: Joi.array()
    .items(objectId)
    .min(1)
    .max(100)
    .required()
    .messages({
      "any.required": "employee_ids array is required",
      "array.min": "At least one employee_id is required",
      "array.max": "Cannot assign more than 100 employees at once",
    }),

  shift_id: objectId.required()
    .messages({ "any.required": "shift_id is required" }),

  startDate: Joi.date()
    .iso()
    .required()
    .messages({ "any.required": "startDate is required" }),

  endDate: Joi.date()
    .iso()
    .min(Joi.ref("startDate"))
    .required()
    .messages({
      "any.required": "endDate is required",
      "date.min": "endDate must be on or after startDate",
    }),

  notes: Joi.string()
    .trim()
    .max(500)
    .optional()
    .allow("", null),

  unit_id: objectId.optional(),
});

// ─── UPDATE ROSTER ───────────────────────────────────────────
// PUT /rosters/:id
exports.updateRoster = Joi.object({
  shift_id: objectId.optional(),

  startDate: Joi.date()
    .iso()
    .optional(),

  endDate: Joi.date()
    .iso()
    .optional()
    .when("startDate", {
      is: Joi.exist(),
      then: Joi.date().min(Joi.ref("startDate")),
      otherwise: Joi.date(),
    }),

  notes: Joi.string()
    .trim()
    .max(500)
    .optional()
    .allow("", null),

  status: Joi.string()
    .valid("ACTIVE", "REVOKED")
    .optional(),
});

// ─── REVOKE ROSTER ───────────────────────────────────────────
// PATCH /rosters/:id/revoke
exports.revokeRoster = Joi.object({
  reason: Joi.string()
    .trim()
    .max(500)
    .optional()
    .allow("", null)
    .description("Optional reason for revocation"),
});

// ─── GET ROSTERS (query params) ─────────────────────────────
// GET /rosters?employee_id=&month=YYYY-MM&status=
exports.getRosters = Joi.object({
  employee_id: objectId.optional(),

  month: Joi.string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional()
    .messages({
      "string.pattern.base": "month must be in YYYY-MM format",
    }),

  status: Joi.string()
    .valid("ACTIVE", "REVOKED")
    .optional(),

  unit_id: objectId.optional(),

  page: Joi.number()
    .integer()
    .min(1)
    .default(1),

  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(20),
});

// ─── CALENDAR VIEW ───────────────────────────────────────────
// GET /rosters/calendar?month=YYYY-MM&unit_id=&department_id=
exports.getRosterCalendar = Joi.object({
  month: Joi.string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .required()
    .messages({
      "any.required": "month is required",
      "string.pattern.base": "month must be in YYYY-MM format",
    }),

  unit_id: objectId.optional(),

  department_id: objectId.optional(),
});
