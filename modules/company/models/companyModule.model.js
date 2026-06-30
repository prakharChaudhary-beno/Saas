// modules/companyModule/models/companyModule.model.js
//
// Company level module control.
// Always a SUBSET of org_modules.
// Org Admin can restrict which modules a specific company can access.
//
// Rule: company cannot have a module ON if org has it OFF.

const mongoose = require("mongoose");

const companyModuleSchema = new mongoose.Schema(
  {
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

    module_id: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Module",
      required: true,
    },

    // Cannot be true if parent org_modules.is_active is false
    is_active: {
      type:    Boolean,
      default: true,
    },

    activated_at: {
      type:    Date,
      default: Date.now,
    },

    deactivated_at: {
      type:    Date,
      default: null,
    },

    // Org Admin who changed this
    created_by: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "User",
      default: null,
    },
  },
  { timestamps: true }
);

// One record per company per module
companyModuleSchema.index(
  { company_id: 1, module_id: 1 },
  { unique: true }
);

companyModuleSchema.index({ org_id: 1, company_id: 1 });

module.exports = mongoose.model("CompanyModule", companyModuleSchema);