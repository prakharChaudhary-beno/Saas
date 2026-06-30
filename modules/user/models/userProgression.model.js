// modules/user/models/userProgression.model.js
// UPDATED — tenantId → org_id + company_id + unit_id
// Immutable log — never update or delete

const mongoose = require("mongoose");

const userProgressionSchema = new mongoose.Schema(
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

    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",
      required: true,
      index:    true,
    },

    // ── Role change ───────────────────────────────────
    fromRoleId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "Role",
      default: null,
    },

    toRoleId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "Role",
      default: null,
    },

    // ── Department change ─────────────────────────────
    fromDeptId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "Department",
      default: null,
    },

    toDeptId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "Department",
      default: null,
    },

    changeType: {
      type:     String,
      enum:     ["role", "department", "both"],
      required: true,
    },

    changedBy: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",
      required: true,
    },

    note: {
      type:      String,
      trim:      true,
      maxlength: 500,
      default:   null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

userProgressionSchema.index({ userId: 1, createdAt: -1 });
userProgressionSchema.index({ org_id: 1, userId: 1 });

module.exports = mongoose.model("UserProgression", userProgressionSchema);