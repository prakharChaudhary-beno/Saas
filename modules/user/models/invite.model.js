// modules/user/models/invite.model.js
// UPDATED — tenantId → org_id + company_id + unit_id

const mongoose = require("mongoose");

const inviteSchema = new mongoose.Schema(
  {
    email: {
      type:      String,
      required:  true,
      lowercase: true,
      trim:      true,
    },

    roleId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Role",
      required: true,
    },

    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  "Department",
    },

    token: {
      type:     String,
      required: true,
      unique:   true,
      index:    true,
    },

    expiresAt: {
      type:     Date,
      required: true,
    },

    status: {
      type:    String,
      enum:    ["pending", "accepted", "expired"],
      default: "pending",
    },

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
  },
  { timestamps: true }
);

inviteSchema.index({ org_id: 1, email: 1, status: 1 });

module.exports = mongoose.model("Invite", inviteSchema);