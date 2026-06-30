const Joi = require("joi");

const objectId = Joi.string()
  .pattern(/^[a-fA-F0-9]{24}$/)
  .messages({ "string.pattern.base": "Invalid ObjectId format" });

// ─── Salary Cycle ─────────────────────────────────────────────────────────────
const salaryCycleSchema = Joi.object({
  type:             Joi.string().valid("monthly").default("monthly"),
  startDay:         Joi.number().integer().min(1).max(31).default(1),
  endDay:           Joi.number().integer().min(1).max(31).default(31),
  salaryDate:       Joi.number().integer().min(1).max(31).default(1),
  payrollRunDate:   Joi.number().integer().min(1).max(31).default(28),
  workingDaysCalc:  Joi.string().valid("fixed", "actual").default("actual"),
  fixedWorkingDays: Joi.number().integer().min(1).max(31).default(26),
}).custom((val, helpers) => {
  if (val.startDay >= val.endDay) {
    return helpers.error("any.invalid", { message: "startDay must be less than endDay" });
  }
  if (val.payrollRunDate > val.endDay) {
    return helpers.error("any.invalid", { message: "payrollRunDate must be <= endDay" });
  }
  return val;
});

// ─── LOP ──────────────────────────────────────────────────────────────────────
const lopSchema = Joi.object({
  enabled:                Joi.boolean().default(true),
  calculation:            Joi.string().valid("per_day", "per_hour").default("per_day"),
  perDayFormula:          Joi.string()
    .valid(
      "monthly_salary/working_days",
      "monthly_salary/30",
      "monthly_salary/26",
      "monthly_salary/calendar_days"
    )
    .default("monthly_salary/working_days"),
  perHourFormula:         Joi.string()
    .valid(
      "daily_rate/standard_hours",
      "monthly_salary/(working_days*standard_hours)"
    )
    .default("daily_rate/standard_hours"),
  roundingRule:           Joi.string().valid("floor", "ceil", "round", "round2").default("round2"),
  includeHolidaysInLOP:   Joi.boolean().default(false),
  includeWeekendsInLOP:   Joi.boolean().default(false),
});

// ─── Deduction Priority ───────────────────────────────────────────────────────
const deductionPrioritySchema = Joi.object({
  leaveDeductionPriority: Joi.array()
    .items(Joi.string().uppercase().trim())
    .default(["CL", "SL", "EL"])
    .custom((arr, helpers) => {
      const upper = arr.map((c) => c.toUpperCase());
      if (upper.length !== new Set(upper).size) {
        return helpers.error("any.invalid", { message: "Duplicate leave codes in deductionPriority" });
      }
      return upper;
    }),
  autoDeductInOrder: Joi.boolean().default(true),
});

// ─── Unpaid Leave ─────────────────────────────────────────────────────────────
const unpaidLeaveSchema = Joi.object({
  code:                   Joi.string().uppercase().trim().default("LWP"),
  autoAssign:             Joi.boolean().default(true),
  maxDaysPerMonth:        Joi.number().min(0).allow(null).default(null),
  maxDaysPerYear:         Joi.number().min(0).allow(null).default(null),
  countWeekendsBetween:   Joi.boolean().default(false),
  countHolidaysBetween:   Joi.boolean().default(false),
});

// ─── Overtime Pay ─────────────────────────────────────────────────────────────
const overtimePaySchema = Joi.object({
  enabled:          Joi.boolean().default(false),
  rateMultiplier:   Joi.number().min(1).max(5).default(1.5),
  capHoursPerMonth: Joi.number().min(0).allow(null).default(null),
  payableComponent: Joi.string().trim().default("BASIC"),
});

// ─── Pro-Rata ─────────────────────────────────────────────────────────────────
const proRataSchema = Joi.object({
  enabled:           Joi.boolean().default(true),
  basis:             Joi.string().valid("calendar_days", "working_days", "fixed_days").default("working_days"),
  fixedDivisor:      Joi.number().integer().min(1).max(31).default(26),
  includeJoiningDay: Joi.boolean().default(true),
  includeExitDay:    Joi.boolean().default(true),
});

// ─── Payslip Config ───────────────────────────────────────────────────────────
const payslipConfigSchema = Joi.object({
  showLeaveBalance:        Joi.boolean().default(true),
  showAttendanceSummary:   Joi.boolean().default(true),
  showYTDEarnings:         Joi.boolean().default(true),
  showYTDTax:              Joi.boolean().default(true),
  digitSignatureEnabled:   Joi.boolean().default(false),
  companyLogoOnPayslip:    Joi.boolean().default(true),
  footerNote:              Joi.string().trim().max(500).allow(null, "").default(null),
});

// ─── Tax & Compliance ─────────────────────────────────────────────────────────
const taxComplianceSchema = Joi.object({
  tdsEnabled:           Joi.boolean().default(true),
  tdsSurchargeEnabled:  Joi.boolean().default(false),

  pfEnabled:            Joi.boolean().default(true),
  pfEmployeeRate:       Joi.number().min(0).max(100).default(12),
  pfEmployerRate:       Joi.number().min(0).max(100).default(12),
  pfCeilingAmount:      Joi.number().min(0).default(15000),
  pfApplyOnActualBasic: Joi.boolean().default(false),

  esiEnabled:           Joi.boolean().default(true),
  esiEmployeeRate:      Joi.number().min(0).max(100).default(0.75),
  esiEmployerRate:      Joi.number().min(0).max(100).default(3.25),
  esiWageCeiling:       Joi.number().min(0).default(21000),

  ptEnabled:            Joi.boolean().default(false),
  ptState:              Joi.string().trim().uppercase().length(2).allow(null).default(null),

  gratuityEnabled:      Joi.boolean().default(false),
  gratuityRate:         Joi.number().min(0).max(100).default(4.81),
});

// ─── Arrear ───────────────────────────────────────────────────────────────────
const arrearSchema = Joi.object({
  enabled:        Joi.boolean().default(true),
  autoCalculate:  Joi.boolean().default(true),
  maxBackMonths:  Joi.number().integer().min(1).max(24).default(3),
});

// ─── applicableFor ────────────────────────────────────────────────────────────
const applicableForSchema = Joi.object({
  departments:     Joi.array().items(objectId).default([]),
  designations:    Joi.array().items(objectId).default([]),
  roles:           Joi.array().items(Joi.string()).default([]),
  locations:       Joi.array().items(Joi.string().trim()).default([]),
  employmentTypes: Joi.array()
    .items(Joi.string().valid("FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"))
    .default([]),
});

// ─── Create Schema ────────────────────────────────────────────────────────────
const createPolicySchema = Joi.object({
  name:              Joi.string().trim().max(150).required(),
  description:       Joi.string().trim().max(1000).optional().allow(""),
  status:            Joi.string().valid("draft", "active").default("draft"),
  effectiveFrom:     Joi.date().required(),
  effectiveTo:       Joi.date().greater(Joi.ref("effectiveFrom")).allow(null).optional(),

  applicableFor:     applicableForSchema.optional(),
  salaryCycle:       salaryCycleSchema.optional(),
  lop:               lopSchema.optional(),
  deductionPriority: deductionPrioritySchema.optional(),
  unpaidLeave:       unpaidLeaveSchema.optional(),
  overtimePay:       overtimePaySchema.optional(),
  proRata:           proRataSchema.optional(),
  payslipConfig:     payslipConfigSchema.optional(),
  taxCompliance:     taxComplianceSchema.optional(),
  arrear:            arrearSchema.optional(),
});

// ─── Update Schema (all top-level fields optional) ────────────────────────────
const updatePolicySchema = createPolicySchema.fork(
  ["name", "effectiveFrom"],
  (schema) => schema.optional()
).keys({
  changeNote: Joi.string().trim().max(500).optional().allow(null, ""),
});

module.exports = { createPolicySchema, updatePolicySchema };