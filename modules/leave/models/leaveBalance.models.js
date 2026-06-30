// modules/leave/models/leaveBalance.models.js
// UPDATED — tenantId → org_id + company_id + unit_id

const mongoose = require("mongoose");

const adjustmentSchema = new mongoose.Schema(
  {
    days:   { type: Number, required: true },
    reason: { type: String, required: true, trim: true, maxlength: 300 },

    leaveRequestId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "LeaveRequest",
      default: null,
    },

    adjustedBy: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",
      required: true,
    },

    type: {
      type: String,
      enum: ["YEAR_INITIALIZATION", "MANUAL_CREDIT", "MANUAL_DEBIT",
             "LEAVE_DEDUCTION", "LEAVE_RESTORE", "CARRY_FORWARD", "LAPSE"],
      required: true,
    },

    adjustedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const leaveBalanceSchema = new mongoose.Schema(
  {
    // ── Scope Fields ──────────────────────────────────────
    org_id: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Organization",
      required: true,
      index:    true,
    },

    company_id: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Company",
      required: true,
      index:    true,
    },

    unit_id: {
      type:  mongoose.Schema.Types.ObjectId,
      ref:   "Unit",
      index: true,
    },

    employeeId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Employee",
      required: true,
      index:    true,
    },

    leaveTypeId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "LeaveType",
      required: true,
    },

    year: { type: Number, required: true },

    totalAllocated: { type: Number, default: 0 },
    used:           { type: Number, default: 0 },
    pending:        { type: Number, default: 0 },
    remaining:      { type: Number, default: 0 },
    carryForward:   { type: Number, default: 0 },
    lapsed:         { type: Number, default: 0 },

    adjustmentHistory: [adjustmentSchema],
    isDeleted: { type: Boolean, default: false, select: false },
  },
  { timestamps: true }
);

// Unique: one record per employee per leaveType per year
leaveBalanceSchema.index(
  { employeeId: 1, leaveTypeId: 1, year: 1 },
  { unique: true }
);
leaveBalanceSchema.index({ org_id: 1, company_id: 1, employeeId: 1, year: 1 });
leaveBalanceSchema.index({ company_id: 1, isDeleted: 1 });

// Pre-save — remaining recalculate
leaveBalanceSchema.pre("save", function (next) {
  this.remaining = Math.max(0, this.totalAllocated - this.used - this.pending);
  // next();
});

module.exports = mongoose.model("LeaveBalance", leaveBalanceSchema);