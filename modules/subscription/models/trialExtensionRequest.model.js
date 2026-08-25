// modules/subscription/models/trialExtensionRequest.model.js
//
// Trial extension workflow:
//   Org Admin requests extra trial days → Super Admin approves/rejects.
//   On approval, subscription.service.js pushes Subscription.ends_at
//   forward and increments Subscription.trial_extension_days_used.
//
// One request document per ask — full history stays visible to both
// the org (their own requests) and Super Admin (all requests).

const mongoose = require("mongoose");
const { Schema } = mongoose;

const trialExtensionRequestSchema = new Schema(
  {
    org_id: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    subscription_id: {
      type: Schema.Types.ObjectId,
      ref: "Subscription",
      required: true,
    },

    // Number of extra days being requested in this ask
    requested_days: {
      type: Number,
      required: true,
      min: 1,
    },

    // Optional note from the org admin explaining why they need more time
    reason: {
      type: String,
      default: "",
      trim: true,
    },

    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
      index: true,
    },

    requested_by: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    requested_at: {
      type: Date,
      default: Date.now,
    },

    // ─── Review (Super Admin) ─────────────────────────────────
    reviewed_by: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    reviewed_at: {
      type: Date,
      default: null,
    },

    review_note: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

// Fast lookup: "does this org already have a pending request?"
trialExtensionRequestSchema.index({ org_id: 1, status: 1 });

module.exports = mongoose.model("TrialExtensionRequest", trialExtensionRequestSchema);
