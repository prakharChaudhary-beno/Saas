// seeders/planSeeder.js
//
// UPDATED — modules are now ObjectId refs instead of slugs
// Run order: moduleSeeder → planSeeder → permissionSeeder → roleSeeder

const Plan   = require("../modules/plan/models/plan.model");
const Module = require("../modules/module/models/module.model");

const planDefs = [
  {
    name:            "Professionals",
    package_type:    "professionals",
    structure_level: "unit",
    price_monthly:   499,
    price_annual:    399,
    seat_limit:      50,
    moduleSlugs:     ["employee", "attendance", "leave", "auth"],
    // Basic features only — no advanced modules
    // No shift/roster features for basic plan
    features:        [],
    status:          "Active",
    is_custom:       false,
    is_public:       true,
    version:         1,
  },
  {
    name:            "Teams",
    package_type:    "teams",
    structure_level: "company",
    price_monthly:   1499,
    price_annual:    1199,
    seat_limit:      200,
    moduleSlugs:     ["employee", "attendance", "leave", "payroll", "auth"],
    features: [
      "shift",           // MODERATE GAP 5: explicit shift feature
      "roster",          // MODERATE GAP 5: explicit roster feature
      "shift_roster",    // Existing: shift swap feature
      "bulk_import_export",
      "leave_encashment",
      "sandwich_rule",
      "leave_liability_report",
      "custom_roles",
      "horizontal_delegation",
      "payslip_pdf_download",
      "advanced_reports",
      "bu_site_structure",
    ],
    status:          "Active",
    is_custom:       false,
    is_public:       true,
    version:         1,
  },
  {
    name:            "Enterprise",
    package_type:    "enterprise",
    structure_level: "enterprise",
    price_monthly:   null,
    price_annual:    null,
    seat_limit:      null,
    moduleSlugs:     ["employee", "attendance", "leave", "payroll", "organisation", "auth"],
    // All features included
    features: [
      "shift",           // MODERATE GAP 5: explicit shift feature
      "roster",          // MODERATE GAP 5: explicit roster feature
      "shift_roster",    // Existing: shift swap feature
      "bulk_import_export",
      "leave_encashment",
      "sandwich_rule",
      "leave_liability_report",
      "custom_roles",
      "horizontal_delegation",
      "delegation_approval_flow",
      "payslip_pdf_download",
      "saml_sso",
      "ip_allowlisting",
      "session_activity_log",
      "biometric_integration",
      "bu_site_structure",
      "bu_independent_payroll",
      "advanced_reports",
      "feature_gate_matrix",
    ],
    status:          "Active",
    is_custom:       false,
    is_public:       true,
    version:         1,
  },
];

exports.seedPlans = async () => {
  try {
    // Fetch all modules once
    const allModules = await Module.find({}, "_id slug");

    if (!allModules.length) {
      console.warn("⚠️  No modules found. Run seedModules() first.");
      return;
    }

    const slugToId = {};
    allModules.forEach(m => { slugToId[m.slug] = m._id; });

    let inserted = 0;
    let skipped  = 0;

    for (const def of planDefs) {
      const { moduleSlugs, ...rest } = def;

      // Convert slugs to ObjectIds
      const moduleIds = moduleSlugs
        .map(slug => {
          if (!slugToId[slug]) console.warn(`  ⚠️  Module slug not found: ${slug}`);
          return slugToId[slug];
        })
        .filter(Boolean);

      const exists = await Plan.findOne({ name: def.name, is_deleted: false });
      if (!exists) {
        await Plan.create({ ...rest, modules: moduleIds, features: def.features || [] });
        inserted++;
      } else {
        skipped++;
      }
    }

    console.log(`✅ Plans seeded — ${inserted} inserted, ${skipped} already existed`);
  } catch (error) {
    console.error("❌ Plan seeder failed:", error.message);
  }
};