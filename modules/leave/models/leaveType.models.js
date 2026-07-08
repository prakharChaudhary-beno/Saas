// modules/leave/models/leaveType.models.js
// UPDATED — tenantId → org_id + company_id (company-level)

const mongoose = require("mongoose");

const leaveTypeSchema = new mongoose.Schema(
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

    name: {
      type:     String,
      required: [true, "Leave type name is required"],
      trim:     true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },

    code: {
      type:      String,
      required:  [true, "Leave type code is required"],
      trim:      true,
      uppercase: true,
      maxlength: [10, "Code cannot exceed 10 characters"],
    },

    description: { type: String, trim: true },

    defaultDaysPerYear:    { type: Number, default: 0 },
    maxDaysPerMonth:       { type: Number, default: 0 },
    maxConsecutiveDays:    { type: Number, default: 0 },
    minNoticeDays:         { type: Number, default: 0 },
    isCarryForwardAllowed: { type: Boolean, default: false },
    maxCarryForwardDays:   { type: Number, default: 0 },
    isEncashmentAllowed:   { type: Boolean, default: false },
    isPaid:                { type: Boolean, default: true },
    isHalfDayAllowed:      { type: Boolean, default: false },
    isSandwichApplicable:  { type: Boolean, default: false },

    applicableGender: {
      type:    String,
      enum:    ["ALL", "MALE", "FEMALE"],
      default: "ALL",
    },

    applicableEmploymentTypes: {
      type:    [String],
      enum:    ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"],
      default: ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"],
    },

    requiresDocumentAfterDays: { type: Number, default: null },
    colorCode:                 { type: String, default: "#4F46E5" },

    requiresApproval: { type: Boolean, default: true },
    isSystem:         { type: Boolean, default: false },
    isActive:         { type: Boolean, default: true },
    isDeleted:        { type: Boolean, default: false },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Unique code per company
leaveTypeSchema.index({ company_id: 1, code: 1 }, { unique: true });
leaveTypeSchema.index({ company_id: 1, isDeleted: 1, isActive: 1 });

module.exports = mongoose.model("LeaveType", leaveTypeSchema);