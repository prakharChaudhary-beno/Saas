// src/modules/superAdmin/superAdmin.validation.js
const Joi = require("joi");

// ─────────────────────────────────────────
// GET /super-admin/tenants — query filters
// ─────────────────────────────────────────
exports.tenantListSchema = Joi.object({

  plan: Joi.string()
    .valid("TRIAL", "BASIC", "PRO", "ENTERPRISE")
    .messages({
      "any.only": "Plan sirf TRIAL, BASIC, PRO, ya ENTERPRISE ho sakta hai"
    }),

  status: Joi.string()
    .valid("ACTIVE", "SUSPENDED", "INACTIVE")
    .messages({
      "any.only": "Status sirf ACTIVE, SUSPENDED, ya INACTIVE ho sakta hai"
    }),

  search: Joi.string().trim().max(100),

  page:  Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

exports.planOverrideSchema = Joi.object({
  planId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({ "string.pattern.base": "Invalid planId format" }),

  reason: Joi.string().trim().max(500).optional()
    .messages({
      "any.only": "Plan sirf TRIAL, BASIC, PRO, ya ENTERPRISE ho sakta hai",
      "any.required": "Plan required hai",
    }),

  reason: Joi.string().min(10).max(500).trim().required()
    .messages({
      "string.min": "Reason kam se kam 10 characters ka hona chahiye",
      "any.required": "Reason required hai",
    }),
});

// Audit Log filters (2.2 ke liye)
exports.auditLogQuerySchema = Joi.object({
  actor:  Joi.string().hex().length(24),
  action: Joi.string().valid(
    "PLAN_OVERRIDE", "TENANT_SUSPEND",
    "TENANT_ACTIVATE", "LOGIN"
  ),
  from:   Joi.date().iso(),
  to:     Joi.date().iso(),
  page:   Joi.number().integer().min(1).default(1),
  limit:  Joi.number().integer().min(1).max(100).default(20),
});

exports.createCustomerSchema = Joi.object({
  business_name:  Joi.string().trim().min(2).max(100).required(),
  contact_name:   Joi.string().trim().min(2).max(100).required(),
  contact_email:  Joi.string().email().lowercase().trim().required(),
  contact_phone:  Joi.string().trim().min(7).max(15).required(),
  plan_id:        Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required()
                    .messages({ "string.pattern.base": "Invalid plan_id" }),
  country:        Joi.string().trim().max(100).optional(),
  industry:       Joi.string().trim().max(100).optional(),
});

exports.createOrgSchema = Joi.object({
  org_name:      Joi.string().trim().min(2).max(100).required(),
  plan_id:       Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
  contact_phone: Joi.string().trim().optional(),
  industry:      Joi.string().trim().optional(),
  country:       Joi.string().trim().optional(),
  address:       Joi.object().optional(),
});