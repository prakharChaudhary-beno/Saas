const mongoose = require("mongoose");

// ─── Sub-Schema: Salary Cycle ─────────────────────────────────────────────────
// Keka/Darwinbox: monthly cycle with precise start/end/run day config
const salaryCycleSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["monthly"],
      default: "monthly",                    // future: weekly, bi-weekly
    },

    startDay: {
      type: Number,
      default: 1,
      min: 1,
      max: 31,                               // e.g. 1 = 1st of month
    },

    endDay: {
      type: Number,
      default: 31,
      min: 1,
      max: 31,                               // e.g. 31 = last day of month
    },

    salaryDate: {
      type: Number,
      default: 1,
      min: 1,
      max: 31,                               // day of NEXT month salary is credited
    },

    payrollRunDate: {
      type: Number,
      default: 28,
      min: 1,
      max: 31,                               // day HR closes & runs payroll
    },

    workingDaysCalc: {
      type: String,
      enum: ["fixed", "actual"],
      default: "actual",
      // fixed  → always divide by fixedWorkingDays (e.g. 26)
      // actual → count actual working days in that month (from CompanyConfig.workWeek)
    },

    fixedWorkingDays: {
      type: Number,
      default: 26,
      min: 1,
      max: 31,                               // only used when workingDaysCalc = "fixed"
    },
  },
  { _id: false }
);

// ─── Sub-Schema: LOP (Loss of Pay) ───────────────────────────────────────────
// Keka: per_day or per_hour with formula selection
const lopSchema = new mongoose.Schema(
  {
    enabled: {
      type: Boolean,
      default: true,
    },

    calculation: {
      type: String,
      enum: ["per_day", "per_hour"],
      default: "per_day",
    },

    perDayFormula: {
      type: String,
      enum: [
        "monthly_salary/working_days",       // actual or fixed working days that month
        "monthly_salary/30",                 // always divide by 30
        "monthly_salary/26",                 // always divide by 26 (industry standard)
        "monthly_salary/calendar_days",      // divide by actual calendar days in month
      ],
      default: "monthly_salary/working_days",
    },

    perHourFormula: {
      type: String,
      enum: [
        "daily_rate/standard_hours",         // daily_rate ÷ standardHoursPerDay from CompanyConfig
        "monthly_salary/(working_days*standard_hours)",
      ],
      default: "daily_rate/standard_hours",  // only used when calculation = per_hour
    },

    roundingRule: {
      type: String,
      enum: ["floor", "ceil", "round", "round2"],
      default: "round2",                     // round to 2 decimal places (payroll standard)
    },

    includeHolidaysInLOP: {
      type: Boolean,
      default: false,                        // sandwich rule — if holiday falls between LOP days
    },

    includeWeekendsInLOP: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

// ─── Sub-Schema: Deduction Priority ──────────────────────────────────────────
// Darwinbox: ordered leave type codes — consumed in order before LOP kicks in
const deductionPrioritySchema = new mongoose.Schema(
  {
    // Ordered array: e.g. ['CL', 'SL', 'EL', 'LWP']
    // Engine deducts from index 0 first — if exhausted, moves to next
    leaveDeductionPriority: {
      type: [String],
      default: ["CL", "SL", "EL"],           // LWP not here — it IS the LOP trigger
      validate: {
        validator: function (arr) {
          return arr.length === new Set(arr.map((c) => c.toUpperCase())).size;
        },
        message: "Duplicate leave type codes in deductionPriority",
      },
    },

    // Whether to auto-deduct in order without employee selection
    autoDeductInOrder: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

// ─── Sub-Schema: Unpaid Leave Config ─────────────────────────────────────────
// LWP = Leave Without Pay — auto-assigned when all paid leaves exhausted
const unpaidLeaveSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      default: "LWP",
      uppercase: true,
      trim: true,                            // must match a LeaveType code in the tenant
    },

    autoAssign: {
      type: Boolean,
      default: true,                         // auto-create LWP leave request on LOP trigger
    },

    maxDaysPerMonth: {
      type: Number,
      default: null,                         // null = unlimited LWP
      min: 0,
    },

    maxDaysPerYear: {
      type: Number,
      default: null,
      min: 0,
    },

    countWeekendsBetween: {
      type: Boolean,
      default: false,                        // sandwich rule for LWP
    },

    countHolidaysBetween: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

// ─── Sub-Schema: Overtime Pay Config ─────────────────────────────────────────
// Keka: OT pay rate multiplier & cap
const overtimePaySchema = new mongoose.Schema(
  {
    enabled: {
      type: Boolean,
      default: false,
    },

    rateMultiplier: {
      type: Number,
      default: 1.5,
      min: 1,
      max: 5,                                // e.g. 1.5x, 2x
    },

    capHoursPerMonth: {
      type: Number,
      default: null,                         // null = no cap
      min: 0,
    },

    payableComponent: {
      type: String,
      default: "BASIC",                      // which salary component OT is calculated on
    },
  },
  { _id: false }
);

// ─── Sub-Schema: Pro-Rata Config ──────────────────────────────────────────────
// For joiners/exits mid-month — how to calculate partial month salary
const proRataSchema = new mongoose.Schema(
  {
    enabled: {
      type: Boolean,
      default: true,
    },

    basis: {
      type: String,
      enum: ["calendar_days", "working_days", "fixed_days"],
      default: "working_days",
    },

    fixedDivisor: {
      type: Number,
      default: 26,                           // only used when basis = fixed_days
      min: 1,
      max: 31,
    },

    // Include joining/exit day itself?
    includeJoiningDay: {
      type: Boolean,
      default: true,
    },

    includeExitDay: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

// ─── Sub-Schema: Payslip Config ───────────────────────────────────────────────
const payslipConfigSchema = new mongoose.Schema(
  {
    showLeaveBalance: {
      type: Boolean,
      default: true,
    },

    showAttendanceSummary: {
      type: Boolean,
      default: true,
    },

    showYTDEarnings: {
      type: Boolean,
      default: true,                         // year-to-date cumulative
    },

    showYTDTax: {
      type: Boolean,
      default: true,
    },

    digitSignatureEnabled: {
      type: Boolean,
      default: false,
    },

    companyLogoOnPayslip: {
      type: Boolean,
      default: true,
    },

    // Custom note on every payslip
    footerNote: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
  },
  { _id: false }
);

// ─── Sub-Schema: Tax & Compliance Config ─────────────────────────────────────
// India-specific: TDS, PF, ESI, PT
const taxComplianceSchema = new mongoose.Schema(
  {
    tdsEnabled: {
      type: Boolean,
      default: true,
    },

    tdsSurchargeEnabled: {
      type: Boolean,
      default: false,
    },

    // PF
    pfEnabled: {
      type: Boolean,
      default: true,
    },

    pfEmployeeRate: {
      type: Number,
      default: 12,                           // % of basic
      min: 0,
      max: 100,
    },

    pfEmployerRate: {
      type: Number,
      default: 12,
      min: 0,
      max: 100,
    },

    pfCeilingAmount: {
      type: Number,
      default: 15000,                        // statutory ceiling on basic for PF
    },

    pfApplyOnActualBasic: {
      type: Boolean,
      default: false,                        // true = ignore ceiling, apply on actual basic
    },

    // ESI
    esiEnabled: {
      type: Boolean,
      default: true,
    },

    esiEmployeeRate: {
      type: Number,
      default: 0.75,                         // %
    },

    esiEmployerRate: {
      type: Number,
      default: 3.25,
    },

    esiWageCeiling: {
      type: Number,
      default: 21000,                        // employees earning above this are ESI-exempt
    },

    // Professional Tax - Enhanced with state-wise slabs
    ptEnabled: {
      type: Boolean,
      default: false,
    },

    ptState: {
      type: String,
      default: null,
      enum: [
        null, '',
        'AN', 'AP', 'AR', 'AS', 'BR', 'CH', 'CT', 'DN', 'DD', 'DL', 'GA', 'GJ', 'HR', 'HP', 'JK', 'JH',
        'KA', 'KL', 'LA', 'LD', 'MP', 'MH', 'MN', 'ML', 'MZ', 'NL', 'OD', 'PY', 'PB', 'RJ', 'SK', 'TN',
        'TG', 'TR', 'UP', 'UT', 'WB'
      ],
    },

    ptSlabs: [{
      minGross: { type: Number, default: 0 },
      maxGross: { type: Number, default: null },
      monthlyAmount: { type: Number, default: 0 },
      _id: false,
    }],

    // Labour Welfare Fund
    lwfEnabled: {
      type: Boolean,
      default: false,
    },

    lwfState: {
      type: String,
      default: null,
    },

    lwfEmployeeRate: {
      type: Number,
      default: 0,
    },

    lwfEmployerRate: {
      type: Number,
      default: 0,
    },

    // Gratuity
    gratuityEnabled: {
      type: Boolean,
      default: false,
    },

    gratuityRate: {
      type: Number,
      default: 4.81,                         // % of basic (15/26 * 1/12 * 100 ≈ 4.81)
    },
  },
  { _id: false }
);

// ─── Sub-Schema: Arrear Config ────────────────────────────────────────────────
const arrearSchema = new mongoose.Schema(
  {
    enabled: {
      type: Boolean,
      default: true,
    },

    autoCalculate: {
      type: Boolean,
      default: true,                         // auto-compute arrears on salary revision
    },

    maxBackMonths: {
      type: Number,
      default: 3,
      min: 1,
      max: 24,                               // how far back arrears can be calculated
    },
  },
  { _id: false }
);

// ─── Main PayrollPolicy Schema ────────────────────────────────────────────────
const payrollPolicySchema = new mongoose.Schema(
  {
    org_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },

    unit_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Unit",
      default: null,
    },

    // ── Identity ──────────────────────────────────────────────────────────────
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,                        // e.g. "Default Payroll Policy", "Contractor Policy"
    },

    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    // ── Status & Versioning ───────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["draft", "active", "inactive", "archived"],
      default: "draft",
      index: true,
    },

    version: {
      type: Number,
      default: 1,
      min: 1,                                // increment on every PUT
    },

    effectiveFrom: {
      type: Date,
      required: true,
    },

    effectiveTo: {
      type: Date,
      default: null,
    },

    // ── Scope ─────────────────────────────────────────────────────────────────
    // Same applicableFor pattern as LeavePolicy & AttendancePolicy
    applicableFor: {
      departments:     [{ type: mongoose.Schema.Types.ObjectId, ref: "Department" }],
      designations:    [{ type: mongoose.Schema.Types.ObjectId, ref: "Designation" }],
      roles:           [{ type: String }],
      locations:       [{ type: String, trim: true }],
      employmentTypes: {
        type: [String],
        enum: ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"],
      },
    },

    // ── TDS & Tax Regime Configuration ───────────────────────────────────────
    tdsConfig: {
      enabled: { type: Boolean, default: true },
      taxRegime: {
        type: String,
        enum: ['old', 'new'],
        default: 'new',
      },
      // Old regime deductions
      standardDeduction: { type: Number, default: 50000 },
      professionalTaxExempt: { type: Boolean, default: true },
      hraExemptionMethod: {
        type: String,
        enum: ['actual', 'standard', 'none'],
        default: 'actual',
      },
      // New regime (FY 2023-24 onwards)
      newRegimeRebate: { type: Boolean, default: true },
      newRegimeSurcharge: { type: Boolean, default: true },
      // Education cess
      educationCessRate: { type: Number, default: 4 }, // 4% on tax
      // Surcharge slabs
      surchargeSlabs: [{
        minIncome: { type: Number, default: 0 },
        maxIncome: { type: Number, default: null },
        rate: { type: Number, default: 0 },
        _id: false,
      }],
      _id: false,
    },

    // ── Investment Declarations ───────────────────────────────────────────────
    investmentConfig: {
      enabled: { type: Boolean, default: true },
      // 80C limits
      max80C: { type: Number, default: 150000 },
      max80CCD: { type: Number, default: 50000 }, // Additional NPS
      max80D: { type: Number, default: 75000 }, // Health insurance (25K self + 25K parents, 50K if senior)
      max80E: { type: Number, default: null }, // Education loan (no limit)
      max80EEA: { type: Number, default: 150000 }, // Additional housing interest
      max80TTA: { type: Number, default: 10000 }, // Savings interest
      max80G: { type: Number, default: null }, // Donations (varies)
      max80EEB: { type: Number, default: 50000 }, // Electric vehicle loan
      max80DD: { type: Number, default: 75000 }, // Disabled dependent
      max80DDB: { type: Number, default: 40000 }, // Medical treatment
      max80U: { type: Number, default: 75000 }, // Personal disability
      // Submission deadline
      submissionDeadline: { type: String, default: '01-15' }, // Jan 15
      // Proof submission deadline
      proofDeadline: { type: String, default: '02-15' }, // Feb 15
      _id: false,
    },

    // ── Salary Structure Configuration ─────────────────────────────────────────
    salaryStructure: {
      // Earnings components
      fixedComponents: [{
        code: { type: String, required: true },
        name: { type: String, required: true },
        type: { type: String, enum: ['FIXED', 'PERCENTAGE', 'FORMULA'], default: 'FIXED' },
        value: { type: Number, default: 0 },
        percentage: { type: Number, default: 0 },
        baseComponent: { type: String },
        formula: { type: String },
        taxable: { type: Boolean, default: true },
        pfApplicable: { type: Boolean, default: false },
        esiApplicable: { type: Boolean, default: false },
        ptApplicable: { type: Boolean, default: false },
        order: { type: Number, default: 0 },
        _id: false,
      }],
      // Reimbursements
      reimbursements: [{
        code: { type: String, required: true },
        name: { type: String, required: true },
        monthlyLimit: { type: Number, default: 0 },
        taxExempt: { type: Boolean, default: true },
        requireProof: { type: Boolean, default: true },
       rollover: { type: Boolean, default: false },
        _id: false,
      }],
      // Variable pay
      variablePay: [{
        code: { type: String, required: true },
        name: { type: String, required: true },
        frequency: { type: String, enum: ['MONTHLY', 'QUARTERLY', 'ANNUAL'], default: 'ANNUAL' },
        percentageOfCTC: { type: Number, default: 0 },
        payoutMonths: [{ type: Number }],
        linkedToPerformance: { type: Boolean, default: true },
        _id: false,
      }],
      _id: false,
    },

    // ── Core Policy Sections ──────────────────────────────────────────────────
    salaryCycle:        { type: salaryCycleSchema,        default: () => ({}) },
    lop:                { type: lopSchema,                default: () => ({}) },
    deductionPriority:  { type: deductionPrioritySchema,  default: () => ({}) },
    unpaidLeave:        { type: unpaidLeaveSchema,        default: () => ({}) },
    overtimePay:        { type: overtimePaySchema,        default: () => ({}) },
    proRata:            { type: proRataSchema,            default: () => ({}) },
    payslipConfig:      { type: payslipConfigSchema,      default: () => ({}) },
    taxCompliance:      { type: taxComplianceSchema,      default: () => ({}) },
    arrear:             { type: arrearSchema,             default: () => ({}) },

    // ── Audit ──────────────────────────────────────────────────────────────────
    activatedBy:  { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    activatedAt:  { type: Date, default: null },
    archivedBy:   { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    archivedAt:   { type: Date, default: null },

    isDeleted:    { type: Boolean, default: false, select: false },
    createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy:    { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
payrollPolicySchema.index({ org_id: 1, company_id: 1, status: 1, isDeleted: 1 });
payrollPolicySchema.index({ org_id: 1, company_id: 1, effectiveFrom: 1, effectiveTo: 1 });
payrollPolicySchema.index({ org_id: 1, company_id: 1, "applicableFor.departments": 1 });
payrollPolicySchema.index({ org_id: 1, company_id: 1, "applicableFor.designations": 1 });
payrollPolicySchema.index({ org_id: 1, company_id: 1, "applicableFor.employmentTypes": 1 });

// ─── Virtuals ─────────────────────────────────────────────────────────────────
payrollPolicySchema.virtual("isActive").get(function () {
  return this.status === "active";
});

// ─── Pre-save Hook ────────────────────────────────────────────────────────────
payrollPolicySchema.pre("save", async function () {
  if (this.effectiveTo && this.effectiveTo <= this.effectiveFrom) {
    throw new Error("effectiveTo must be after effectiveFrom");
  }

  // salaryCycle: payrollRunDate must be <= endDay
  if (
    this.salaryCycle &&
    this.salaryCycle.payrollRunDate > this.salaryCycle.endDay
  ) {
    throw new Error("salaryCycle.payrollRunDate must be <= salaryCycle.endDay");
  }

  // salaryCycle: startDay < endDay
  if (
    this.salaryCycle &&
    this.salaryCycle.startDay >= this.salaryCycle.endDay
  ) {
    throw new Error("salaryCycle.startDay must be less than salaryCycle.endDay");
  }

  // Clear PT state and slabs if PT is disabled
  if (this.taxCompliance && !this.taxCompliance.ptEnabled) {
    this.taxCompliance.ptState = null;
    this.taxCompliance.ptSlabs = [];
  }

  // Auto-populate ptSlabs from ptState if PT is enabled and ptState is set
  if (this.taxCompliance?.ptEnabled && this.taxCompliance?.ptState) {
    try {
      const { PT_SLABS } = require("../../config/ptSlabs");
      const stateCode = this.taxCompliance.ptState;
      if (PT_SLABS[stateCode]?.slabs) {
        this.taxCompliance.ptSlabs = PT_SLABS[stateCode].slabs;
      }
    } catch (err) {
      console.error("Failed to auto-populate ptSlabs:", err.message);
    }
  }
});

// ─── Query Middleware ─────────────────────────────────────────────────────────
payrollPolicySchema.pre(/^find/, async function () {
  if (!this.getOptions().includeDeleted) {
    this.where({ isDeleted: false });
  }
});

// ─── Static Methods ───────────────────────────────────────────────────────────
payrollPolicySchema.statics.getActivePolicies = function (company_id) {
  return this.find({
    company_id,
    status:        "active",
    isDeleted:     false,
    effectiveFrom: { $lte: new Date() },
    $or: [{ effectiveTo: null }, { effectiveTo: { $gte: new Date() } }],
  });
};

module.exports = mongoose.model("PayrollPolicy", payrollPolicySchema);