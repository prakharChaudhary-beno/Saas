// modules/orgModule/orgModule.model.js
//
// Task 5 — NEW
//
// OrgModule = which modules are active for an organization.
//
// How it works:
//   When an org purchases a plan, this collection is auto-populated.
//   One document per module in the plan.
//   e.g. org buys "Growth" plan (modules: employee, attendance, leave, auth)
//   → 4 OrgModule documents are inserted automatically.
//
// Permission middleware Layer 2 checks this collection.
//   If org_module.is_active = false → 403 "Module not available in your plan"
//
// Super Admin can manually deactivate a module for a specific org
//   without touching the Plan (e.g. temporary suspension of payroll).
//
// Relationship to CompanyModule (Task 20):
//   OrgModule is the parent — org-level toggle.
//   CompanyModule is a subset — company-level toggle within the org.
//   CompanyModule.is_active cannot be true if parent OrgModule.is_active is false.

const mongoose = require("mongoose");

const orgModuleSchema = new mongoose.Schema(
  {
    // ─── Links ────────────────────────────────────────────────
    org_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: [true, "org_id is required"],
      index: true,
    },

    module_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Module",
      required: [true, "module_id is required"],
    },

    // ─── State ────────────────────────────────────────────────
    // true  = module is usable by this org
    // false = Super Admin disabled it (e.g. plan downgrade, violation)
    is_active: {
      type: Boolean,
      default: true,
    },

    // When this module was first activated for the org
    activated_at: {
      type: Date,
      default: Date.now,
    },

    // Set when Super Admin deactivates — null when active
    deactivated_at: {
      type: Date,
      default: null,
    },

    // Who activated (Super Admin user email or ID)
    created_by: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ─── Indexes ──────────────────────────────────────────────────
// One org cannot have the same module twice
orgModuleSchema.index({ org_id: 1, module_id: 1 }, { unique: true });

// Fast lookup in permission middleware: org + active modules
orgModuleSchema.index({ org_id: 1, is_active: 1 });

module.exports = mongoose.model("OrgModule", orgModuleSchema);