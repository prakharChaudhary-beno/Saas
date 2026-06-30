// modules/policyVersion/models/policyVersion.model.js
// FIXED — removed unique index on (policyType, policyId, version)
// Reason: same version number can have multiple entries
//   e.g. CREATE saves version=1, then UPDATE saves version=1 (snapshot of
//   state BEFORE the bump). The bump happens AFTER the snapshot.
//   Using changedAt + action for ordering instead.

const mongoose = require("mongoose");

const policyVersionSchema = new mongoose.Schema(
  {
    policyType: {
      type:     String,
      enum:     ["LEAVE", "ATTENDANCE", "PAYROLL"],
      required: true,
      index:    true,
    },

    policyId: {
      type:     mongoose.Schema.Types.ObjectId,
      required: true,
      index:    true,
    },

    org_id:     { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    company_id: { type: mongoose.Schema.Types.ObjectId, ref: "Company",      required: true, index: true },
    unit_id:    { type: mongoose.Schema.Types.ObjectId, ref: "Unit",         default: null },

    // Version of the policy AT THE TIME this snapshot was taken
    // (i.e. BEFORE the change that will bump it)
    version: {
      type:     Number,
      required: true,
    },

    snapshot: {
      type:     mongoose.Schema.Types.Mixed,
      required: true,
    },

    action: {
      type: String,
      enum: ["CREATE", "UPDATE", "ACTIVATE", "DEACTIVATE", "ARCHIVE", "RESTORE"],
      required: true,
    },

    changeNote: {
      type:      String,
      trim:      true,
      maxlength: 500,
      default:   null,
    },

    changedFields: {
      type:    [String],
      default: [],
    },

    changedBy: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",
      required: true,
    },

    changedAt: {
      type:    Date,
      default: Date.now,
      index:   true,
    },
  },
  { timestamps: true }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
// NO unique index — multiple entries per version are valid
// (CREATE at v1, then UPDATE also saves v1 snapshot before bumping to v2)
policyVersionSchema.index({ policyType: 1, policyId: 1, changedAt: -1 });
policyVersionSchema.index({ policyType: 1, policyId: 1, version: -1 });

module.exports = mongoose.model("PolicyVersion", policyVersionSchema);