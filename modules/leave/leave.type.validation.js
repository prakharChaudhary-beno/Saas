const Joi = require("joi");

const objectId = Joi.string().hex().length(24);
const employmentTypes = ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"];

const leaveTypeFields = {
  name: Joi.string().trim().max(100),
  code: Joi.string().trim().uppercase().max(10),
  description: Joi.string().trim().max(500).allow(""),
  defaultDaysPerYear: Joi.number().min(0).max(366),
  maxDaysPerMonth: Joi.number().min(0).max(31),
  maxConsecutiveDays: Joi.number().min(0).max(366),
  minNoticeDays: Joi.number().min(0).max(366),
  isCarryForwardAllowed: Joi.boolean(),
  maxCarryForwardDays: Joi.number().min(0).max(366),
  isEncashmentAllowed: Joi.boolean(),
  isPaid: Joi.boolean(),
  isHalfDayAllowed: Joi.boolean(),
  isSandwichApplicable: Joi.boolean(),
  applicableGender: Joi.string().valid("ALL", "MALE", "FEMALE"),
  applicableEmploymentTypes: Joi.array().items(Joi.string().valid(...employmentTypes)).min(1),
  requiresDocumentAfterDays: Joi.number().min(1).max(366).allow(null),
  colorCode: Joi.string().trim().pattern(/^#[0-9A-Fa-f]{6}$/),
  requiresApproval: Joi.boolean(),
  isActive: Joi.boolean(),
};

const scopeQueryFields = {
  orgId: objectId.optional(),
  companyId: objectId.optional(),
  unit_id: objectId.optional(),
};

exports.createLeaveType = Joi.object({
  ...leaveTypeFields,
  name: leaveTypeFields.name.required(),
  code: leaveTypeFields.code.required(),
});

exports.updateLeaveType = Joi.object(leaveTypeFields).min(1);

exports.getLeaveTypes = Joi.object({
  ...scopeQueryFields,
  isActive: Joi.string().valid("true", "false").optional(),
  isPaid: Joi.string().valid("true", "false").optional(),
  search: Joi.string().trim().max(100).optional(),
});

exports.leaveTypeScope = Joi.object(scopeQueryFields);
