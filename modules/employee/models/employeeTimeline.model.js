// modules/employee/models/employeeTimeline.model.js
// Employee Career Timeline - Tracks position, designation, department, reporting manager changes
// Immutable log - never update or delete

const mongoose = require("mongoose");

const employeeTimelineSchema = new mongoose.Schema(
  {
    // ── Scope Fields ──────────────────────────────────
    org_id: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Organization",
      required: true,
      index:    true,
    },

    company_id: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "Company",
      default: null,
    },

    unit_id: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "Unit",
      default: null,
    },

    employeeId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Employee",
      required: true,
      index:    true,
    },

    userId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "User",
      default: null,
    },

    // ── Event Type ───────────────────────────────────
    eventType: {
      type:     String,
      enum:     [
        "designation_change",
        "department_transfer",
        "reporting_manager_change",
        "status_change",
        "joining",
        "confirmation",
        "exit",
        "salary_revision",
        "employment_type_change"
      ],
      required: true,
    },

    // ── Designation Change ───────────────────────────
    fromDesignationId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "Designation",
      default: null,
    },

    toDesignationId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "Designation",
      default: null,
    },

    // ── Department Transfer ───────────────────────────
    fromDepartmentId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "Department",
      default: null,
    },

    toDepartmentId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "Department",
      default: null,
    },

    // ── Reporting Manager Change ─────────────────────
    fromReportingManagerId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "Employee",
      default: null,
    },

    toReportingManagerId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "Employee",
      default: null,
    },

    // ── Status Change ────────────────────────────────
    fromStatus: {
      type:    String,
      enum:    ["ACTIVE", "INACTIVE", "ON_NOTICE", "TERMINATED", "ON_LEAVE"],
      default: null,
    },

    toStatus: {
      type:    String,
      enum:    ["ACTIVE", "INACTIVE", "ON_NOTICE", "TERMINATED", "ON_LEAVE"],
      default: null,
    },

    // ── Employment Type Change ───────────────────────
    fromEmploymentType: {
      type:    String,
      enum:    ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"],
      default: null,
    },

    toEmploymentType: {
      type:    String,
      enum:    ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"],
      default: null,
    },

    // ── Salary Revision ──────────────────────────────
    fromSalary: {
      grossSalary: { type: Number, default: null },
      netSalary:   { type: Number, default: null },
    },

    toSalary: {
      grossSalary: { type: Number, default: null },
      netSalary:   { type: Number, default: null },
    },

    // ── Metadata ──────────────────────────────────────
    effectiveDate: {
      type:     Date,
      required: true,
      default:  Date.now,
    },

    changeReason: {
      type:      String,
      trim:      true,
      maxlength: 500,
      default:   null,
    },

    changedBy: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ── Indexes ────────────────────────────────────────────────────────────────
employeeTimelineSchema.index({ employeeId: 1, effectiveDate: -1 });
employeeTimelineSchema.index({ org_id: 1, employeeId: 1 });
employeeTimelineSchema.index({ eventType: 1 });

module.exports = mongoose.model("EmployeeTimeline", employeeTimelineSchema);
