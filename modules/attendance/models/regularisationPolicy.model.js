// modules/attendance/models/regularisationPolicy.model.js
// Enterprise-level Regularisation Policy Model

"use strict";

const mongoose = require("mongoose");
const { Schema } = mongoose;

/**
 * Regularisation Policy Schema
 * 
 * Enterprise standards implemented:
 * 1. Multi-tier approval workflow (L1_ONLY, L2_ONLY, L1_L2, AUTO)
 * 2. Request window limitations (pastDaysAllowed, futureAllowed)
 * 3. Monthly request quota (maxRequestsPerMonth)
 * 4. Document requirements per type
 * 5. Auto-approval rules
 * 6. Auto-reject after N days
 * 7. Allowed regularisation types
 * 8. Policy applicability (departments, designations, roles)
 */

const regularisationPolicySchema = new Schema(
  {
    // ─── Scope ─────────────────────────────────────────────────
    org_id: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    company_id: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    unit_id: {
      type: Schema.Types.ObjectId,
      ref: "Unit",
      default: null, // null = company-wide policy
      index: true,
    },

    // ─── Policy Details ────────────────────────────────────────
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    enabled: {
      type: Boolean,
      default: true,
      index: true,
    },
    isDefault: {
      type: Boolean,
      default: false, // Only one default policy per company
    },

    // ─── Allowed Regularisation Types ──────────────────────────
    allowedFor: {
      type: [String],
      enum: ["late", "absent", "missed_punch", "early_exit"],
      default: ["late", "absent", "missed_punch"],
      validate: {
        validator: (arr) => arr.length > 0,
        message: "At least one regularisation type must be allowed",
      },
    },

    // ─── Request Limits ────────────────────────────────────────
    maxRequestsPerMonth: {
      type: Number,
      default: 3,
      min: 1,
      max: 31,
    },
    
    // ─── Request Window ────────────────────────────────────────
    requestWindow: {
      pastDaysAllowed: {
        type: Number,
        default: 30,
        min: 1,
        max: 90,
      },
      futureAllowed: {
        type: Boolean,
        default: false,
      },
    },

    // ─── Approval Flow ──────────────────────────────────────────
    approvalFlow: {
      type: String,
      enum: ["L1_ONLY", "L2_ONLY", "L1_L2", "AUTO"],
      default: "L2_ONLY",
      required: true,
    },

    // ─── Auto-Approval Rules ────────────────────────────────────
    autoApproval: {
      enabled: {
        type: Boolean,
        default: false,
      },
      conditions: [{
        type: {
          type: String,
          enum: ["hours_threshold", "frequency_based", "type_based", "first_request"],
        },
        value: Schema.Types.Mixed, // e.g., 1 (hour), 2 (requests), ["late", "missed_punch"]
        description: String,
      }],
    },

    // ─── Auto-Reject ────────────────────────────────────────────
    autoRejectAfterDays: {
      type: Number,
      default: 7,
      min: 1,
      max: 30,
    },

    // ─── Document Requirements ─────────────────────────────────
    documentRequired: {
      enabled: {
        type: Boolean,
        default: false,
      },
      forTypes: {
        type: [String],
        enum: ["late", "absent", "missed_punch", "early_exit"],
        default: [],
      },
      maxSizeMB: {
        type: Number,
        default: 5,
        min: 1,
        max: 20,
      },
      allowedFormats: {
        type: [String],
        default: ["pdf", "jpg", "jpeg", "png"],
      },
    },

    // ─── Escalation ────────────────────────────────────────────
    escalation: {
      enabled: {
        type: Boolean,
        default: false,
      },
      afterDays: {
        type: Number,
        default: 3,
        min: 1,
        max: 14,
      },
      escalateTo: {
        type: String,
        enum: ["l2", "unit_admin", "company_admin"],
        default: "l2",
      },
    },

    // ─── Policy Applicability ───────────────────────────────────
    applicableFor: {
      departments: [{
        type: Schema.Types.ObjectId,
        ref: "Department",
      }],
      designations: [{
        type: Schema.Types.ObjectId,
        ref: "Designation",
      }],
      roles: [{
        type: Schema.Types.ObjectId,
        ref: "Role",
      }],
      employeeTypes: [{
        type: String,
        enum: ["full_time", "part_time", "contract", "intern"],
      }],
    },

    // ─── Audit ─────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["draft", "active", "inactive", "archived"],
      default: "active",
      index: true,
    },
    effectiveFrom: {
      type: Date,
      default: null,
    },
    effectiveTill: {
      type: Date,
      default: null,
    },

    // ─── Soft Delete ────────────────────────────────────────────
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ────────────────────────────────────────────────────
regularisationPolicySchema.index({ org_id: 1, company_id: 1, isDefault: 1 });
regularisationPolicySchema.index({ org_id: 1, company_id: 1, enabled: 1, status: 1 });
regularisationPolicySchema.index({ org_id: 1, company_id: 1, unit_id: 1 });
regularisationPolicySchema.index({ org_id: 1, "applicableFor.departments": 1 });
regularisationPolicySchema.index({ org_id: 1, "applicableFor.designations": 1 });

// ─── Pre-save Hook ──────────────────────────────────────────────
regularisationPolicySchema.pre("save", async function () {
  // Ensure only one default policy per company
  if (this.isDefault && this.isModified("isDefault")) {
    await this.constructor.findOneAndUpdate(
      { org_id: this.org_id, company_id: this.company_id, isDefault: true, _id: { $ne: this._id } },
      { isDefault: false }
    );
  }
});

// ─── Virtuals ────────────────────────────────────────────────────
regularisationPolicySchema.virtual("isActive").get(function () {
  return this.enabled && this.status === "active" && !this.isDeleted;
});

module.exports = mongoose.model("RegularisationPolicy", regularisationPolicySchema);
