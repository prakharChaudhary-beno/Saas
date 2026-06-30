// src/modules/superAdmin/models/auditLog.model.js
const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    // Kisne kiya
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // Super Admin ka DB record nahi hota
    },

    actorEmail: {
      type: String,
      required: true, // snapshot — user delete ho jaye toh bhi log rahe
    },

    // Kya kiya
    action: {
      type: String,
      required: true,
      enum: ["PLAN_OVERRIDE", "TENANT_SUSPEND", "TENANT_ACTIVATE", "LOGIN"],
      index: true,
    },

    // Kis tenant pe
    targetTenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      default: null,
    },

    // Extra info — from/to plan, reason etc.
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // IP address log karo
    ipAddress: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Indexes — frequent queries ke liye
auditLogSchema.index({ actorEmail: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ targetTenantId: 1 });
auditLogSchema.index({ createdAt: -1 });

// Audit logs permanent hain — soft delete nahi, pre hook nahi

module.exports = mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);