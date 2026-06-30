// modules/tenant/tenant.validation.js
//
// Task 16 — UPDATED (corrected)
//
// registerOrgSchema — used by POST /tenant/register
//
// Fields explained:
//   plan_id       — which plan the customer is signing up for
//   business_name — Customer's commercial entity name (e.g. "TCS Ltd")
//   contact_name  — Primary person's name (becomes Org Admin's display name)
//   contact_email — Login email for the Org Admin user
//   contact_phone — Customer contact number
//   org_name      — Optional: Organization name if different from business_name
//                   e.g. Customer "TCS Ltd" but Org "Tata Group"
//                   Defaults to business_name if omitted
//   industry, country, address — optional org details

const Joi = require("joi");

exports.registerOrgSchema = Joi.object({
  plan_id: Joi.string()
    .pattern(/^[a-f\d]{24}$/i, "MongoDB ObjectId")
    .required()
    .messages({
      "string.pattern.name": "plan_id must be a valid MongoDB ObjectId",
      "any.required":        "plan_id is required",
    }),

  business_name: Joi.string().min(2).max(100).trim().required(),
  contact_name:  Joi.string().min(2).max(100).trim().required(),
  contact_email: Joi.string().email().lowercase().trim().required(),
  contact_phone: Joi.string()
    .pattern(/^[0-9+\-\s()]{7,20}$/)
    .required()
    .messages({ "string.pattern.base": "contact_phone must be a valid phone number" }),

  // Optional — if omitted, org_name defaults to business_name in service
  org_name: Joi.string().min(2).max(100).trim().optional().allow("", null),

  industry: Joi.string().max(100).trim().optional().allow("", null),
  country:  Joi.string().max(100).trim().optional().allow("", null),
  address: Joi.object({
    country: Joi.string().optional().allow("", null),
    state:   Joi.string().optional().allow("", null),
    city:    Joi.string().optional().allow("", null),
    pincode: Joi.string().optional().allow("", null),
  }).optional(),
});