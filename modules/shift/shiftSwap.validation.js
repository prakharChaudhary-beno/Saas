// modules/shift/shiftSwap.validation.js
//
// Joi validation for Shift Swap operations

const Joi = require("joi");

// ─── Helper: MongoDB ObjectId pattern ────────────────────────
const objectId = Joi.string()
  .regex(/^[a-fA-F0-9]{24}$/)
  .messages({ "string.pattern.base": "Invalid ID format" });

// ─── RAISE SWAP REQUEST ───────────────────────────────────────
// POST /shift-swaps
exports.raiseSwapRequest = Joi.object({
  requested_employee_id: objectId.required()
    .messages({ "any.required": "requested_employee_id is required" }),

  swapDate: Joi.date()
    .iso()
    .min("now")
    .required()
    .messages({
      "any.required": "swapDate is required",
      "date.min": "swapDate must be today or a future date",
    }),

  reason: Joi.string()
    .trim()
    .max(500)
    .optional()
    .allow("", null)
    .description("Optional reason for the swap request"),

  unit_id: objectId
    .optional()
    .description("Target unit — defaults to user's unit if not provided"),
});

// ─── RESPOND TO SWAP (B accepts/declines) ────────────────────
// PATCH /shift-swaps/:id/respond
exports.respondToSwap = Joi.object({
  action: Joi.string()
    .valid("ACCEPT", "DECLINE")
    .required()
    .messages({
      "any.required": "action is required",
      "any.only": "action must be ACCEPT or DECLINE",
    }),

  comment: Joi.string()
    .trim()
    .max(500)
    .optional()
    .allow("", null)
    .description("Optional comment when responding"),
});

// ─── MANAGER ACTION (approve/reject) ─────────────────────────
// PATCH /shift-swaps/:id/approve OR /shift-swaps/:id/reject
exports.managerAction = Joi.object({
  comment: Joi.string()
    .trim()
    .max(500)
    .optional()
    .allow("", null)
    .description("Comment for approval or rejection (required for rejection)"),
});

// ─── CANCEL SWAP REQUEST ─────────────────────────────────────
// PATCH /shift-swaps/:id/cancel
exports.cancelSwapRequest = Joi.object({
  reason: Joi.string()
    .trim()
    .max(500)
    .optional()
    .allow("", null)
    .description("Optional cancellation reason"),
});

// ─── LIST SWAP REQUESTS (query params) ───────────────────────
// GET /shift-swaps?type=sent|received|pending_my_action&status=&month=
exports.listSwapRequests = Joi.object({
  type: Joi.string()
    .valid("sent", "received", "pending_my_action", "all")
    .optional()
    .description("Filter by swap request type"),

  status: Joi.string()
    .valid(
      "PENDING_ACCEPTANCE",
      "PENDING_APPROVAL",
      "ACCEPTED",
      "REJECTED_BY_B",
      "REJECTED_BY_MANAGER",
      "APPROVED",
      "CANCELLED",
      "EXPIRED"
    )
    .optional(),

  month: Joi.string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional()
    .messages({
      "string.pattern.base": "month must be in YYYY-MM format",
    }),

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

// ─── GET SWAP REQUEST BY ID ──────────────────────────────────
// GET /shift-swaps/:id
exports.getSwapRequestById = Joi.object({
  id: objectId.required(),
});
