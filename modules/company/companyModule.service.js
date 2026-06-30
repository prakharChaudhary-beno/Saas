// modules/company/companyModule.service.js

const OrgModule     = require("../orgModule/models/orgModule.model");
const CompanyModule = require("./models/companyModule.model");
const Company       = require("./models/company.model");
const Module        = require("../module/models/module.model");
const AppError      = require("../../utils/appError");

// ─── GET all modules for a company ────────────────────────────
// Returns merged view: all org-level modules with company override status
// Frontend uses this to render toggle switches per module
exports.getCompanyModules = async (companyId, reqUser) => {

  // Verify company belongs to this org
  const company = await Company.findOne({
    _id:        companyId,
    org_id:     reqUser.orgId,
    is_deleted: false,
  });
  if (!company) throw new AppError("Company not found", 404);

  // Get all org-level modules
  const orgModules = await OrgModule.find({
    org_id: reqUser.orgId,
  }).populate("module_id", "name slug description").lean();

  // Get company-level overrides
  const companyModules = await CompanyModule.find({
    org_id:     reqUser.orgId,
    company_id: companyId,
  }).lean();

  // Build a map: module_id → company override
  const overrideMap = {};
  companyModules.forEach((cm) => {
    overrideMap[cm.module_id.toString()] = cm;
  });

  // Merge — for each org module, show effective status for this company
  const result = orgModules.map((om) => {
    const override = overrideMap[om.module_id._id.toString()];
    return {
      module_id:           om.module_id._id,
      module_name:         om.module_id.name,
      module_slug:         om.module_id.slug,
      module_description:  om.module_id.description,
      org_level_active:    om.is_active,
      // Company level: use override if exists, else inherit from org
      company_level_active: override ? override.is_active : om.is_active,
      // If org is OFF, company CANNOT turn it on
      can_toggle:           om.is_active,
    };
  });

  return result;
};

// ─── UPDATE module toggles for a company ──────────────────────
// payload: [{ module_id: "...", is_active: true/false }, ...]
// Rule: cannot enable a module that is OFF at org level
exports.updateCompanyModules = async (companyId, modules, reqUser) => {

  if (!Array.isArray(modules) || modules.length === 0) {
    throw new AppError("modules array is required", 400);
  }

  // Verify company belongs to this org
  const company = await Company.findOne({
    _id:        companyId,
    org_id:     reqUser.orgId,
    is_deleted: false,
  });
  if (!company) throw new AppError("Company not found", 404);

  // Get org-level modules for validation
  const orgModules = await OrgModule.find({ org_id: reqUser.orgId }).lean();
  const orgModuleMap = {};
  orgModules.forEach((om) => {
    orgModuleMap[om.module_id.toString()] = om.is_active;
  });

  const results = [];

  for (const item of modules) {
    const { module_id, is_active } = item;

    // Rule: cannot enable if org has it OFF
    if (is_active && orgModuleMap[module_id] === false) {
      throw new AppError(
        `Cannot enable module — it is disabled at organization level. Contact your Org Admin.`,
        403
      );
    }

    // Upsert — create if not exists, update if exists
    const updated = await CompanyModule.findOneAndUpdate(
      { org_id: reqUser.orgId, company_id: companyId, module_id },
      {
        is_active,
        ...(is_active  ? { activated_at: new Date(),   deactivated_at: null } : {}),
        ...(!is_active ? { deactivated_at: new Date()                       } : {}),
        created_by: reqUser.userId,
      },
      { upsert: true, new: true }
    );

    results.push(updated);
  }

  return results;
};