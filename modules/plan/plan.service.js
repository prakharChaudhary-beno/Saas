// modules/plan/plan.service.js

const AppError     = require("../../utils/appError");
const Plan         = require("./models/plan.model");
const Subscription = require("../subscription/models/subscription.Models");
const OrgModule    = require("../orgModule/models/orgModule.model");
const Module       = require("../module/models/module.model");

// ─────────────────────────────────────────────────────────────
// PUBLIC
// ─────────────────────────────────────────────────────────────

// GET /plans/public
exports.getPublicPlans = async () => {
  const plans = await Plan.find({
    status:     "Active",
    is_public:  true,
    is_deleted: false,
  })
    .populate("modules", "name slug description")
    .sort({ price_monthly: 1 });

  return plans.map(plan => ({
    _id:             plan._id,
    name:            plan.name,
    package_type:    plan.package_type,
    structure_level: plan.structure_level,
    price_monthly:   plan.price_monthly,
    price_annual:    plan.price_annual,
    seat_limit:      plan.seat_limit,
    modules:         plan.modules,
    is_custom:       plan.is_custom,
  }));
};

// GET /plans/:id/public
exports.getPlanById = async (planId) => {
  const plan = await Plan.findOne({
    _id:        planId,
    status:     "Active",
    is_deleted: false,
  }).populate("modules", "name slug description");

  if (!plan) throw new AppError("Plan not found", 404);
  return plan;
};

// ─────────────────────────────────────────────────────────────
// SUPER ADMIN
// ─────────────────────────────────────────────────────────────

// GET /plans
exports.getAllPlans = async () => {
  return await Plan.find({ is_deleted: false })
    .populate("modules", "name slug description")
    .sort({ createdAt: -1 });
};

// POST /plans
exports.createPlan = async (data, userId) => {
  const existing = await Plan.findOne({ name: data.name, is_deleted: false });
  if (existing) throw new AppError("Plan with this name already exists", 409);

  // Validate module IDs exist
  if (data.modules && data.modules.length) {
    const moduleDocs = await Module.find({ _id: { $in: data.modules }, is_active: true });
    if (moduleDocs.length !== data.modules.length) {
      throw new AppError("One or more module IDs are invalid or inactive", 400);
    }
  }

  const plan = await Plan.create({ ...data, created_by: userId });
  return await Plan.findById(plan._id).populate("modules", "name slug description");
};

// PUT /plans/:id
exports.updatePlan = async (planId, data) => {
  const plan = await Plan.findOne({ _id: planId, is_deleted: false })
    .populate("modules", "_id slug");

  if (!plan) throw new AppError("Plan not found", 404);

  const oldModuleIds  = plan.modules.map(m => m._id.toString());
  const newModuleIds  = data.modules ? data.modules.map(id => id.toString()) : oldModuleIds;

  const modulesChanged =
    data.modules &&
    JSON.stringify([...oldModuleIds].sort()) !== JSON.stringify([...newModuleIds].sort());

const featuresChanged = data.features && JSON.stringify(data.features.sort()) !== JSON.stringify((plan.features || []).sort());

if (modulesChanged || featuresChanged) {
    const removedIds = oldModuleIds.filter(id => !newModuleIds.includes(id));
    const addedIds   = newModuleIds.filter(id => !oldModuleIds.includes(id));

    // All orgs on this plan
    const affectedOrgs = await Subscription.find({
      plan_id:   planId,
      is_active: true,
      status:    { $in: ["Active", "Trial"] },
    }).distinct("org_id");

    if (affectedOrgs.length > 0) {

      // Disable removed modules
      if (removedIds.length > 0) {
        await OrgModule.updateMany(
          { org_id: { $in: affectedOrgs }, module_id: { $in: removedIds } },
          { is_active: false, deactivated_at: new Date() }
        );
      }

      // Enable added modules
      if (addedIds.length > 0) {
        const now = new Date();
        for (const orgId of affectedOrgs) {
          for (const moduleId of addedIds) {
            await OrgModule.findOneAndUpdate(
              { org_id: orgId, module_id: moduleId },
              { $setOnInsert: { org_id: orgId, module_id: moduleId, is_active: true, activated_at: now } },
              { upsert: true }
            );
          }
        }
      }

      // Update plan_snapshot — store slugs (permission filter uses slugs)
      const newModuleDocs = await Module.find({ _id: { $in: newModuleIds } }).select("slug");
      const newSlugs      = newModuleDocs.map(m => m.slug);

     await Subscription.updateMany(
    { plan_id: planId, is_active: true, status: { $in: ["Active", "Trial"] } },
    {
      $set: {
        "plan_snapshot.modules":         newSlugs,
        "plan_snapshot.features":        data.features         || plan.features || [],
        "plan_snapshot.structure_level": data.structure_level || plan.structure_level,
        "plan_snapshot.name":            data.name            || plan.name,
        "plan_snapshot.price_monthly":   data.price_monthly   ?? plan.price_monthly,
        "plan_snapshot.price_annual":    data.price_annual    ?? plan.price_annual,
        "plan_snapshot.seat_limit":      data.seat_limit      ?? plan.seat_limit,
      },
    }
);

console.log(`✅ plan_snapshot updated for ${affectedOrgs.length} orgs`);

      console.log(`✅ plan_snapshot updated for ${affectedOrgs.length} orgs`);
    }
  }

  data.version = (plan.version || 1) + 1;
  Object.assign(plan, data);
  await plan.save();

  return await Plan.findById(plan._id).populate("modules", "name slug description");
};

// DELETE /plans/:id
exports.deletePlan = async (planId) => {
  const plan = await Plan.findOne({ _id: planId, is_deleted: false });
  if (!plan) throw new AppError("Plan not found", 404);

  const activeSubs = await Subscription.countDocuments({
    plan_id:   planId,
    is_active: true,
    status:    { $in: ["Active", "Trial"] },
  });

  if (activeSubs > 0) {
    throw new AppError(
      `Cannot delete — ${activeSubs} active subscription(s) use this plan.`,
      400
    );
  }

  plan.status     = "Deprecated";
  plan.is_deleted = true;
  await plan.save();

  return { message: "Plan deprecated successfully" };
};
// ─────────────────────────────────────────────────────────────
// GET MY FEATURES
// GET /plans/my-features
//
// Current user ke active subscription ka features[] return karo
// Frontend yahi use kare:
//   - Kaunsa button/screen lock dikhana hai
//   - Upgrade prompt kab dikhana hai
//
// Response:
// {
//   plan: { name, package_type },
//   features: ["shift_roster", "bulk_import_export", ...],
//   featureMap: { shift_roster: true, saml_sso: false, ... }
// }
//
// featureMap mein sab known features hain — true/false
// Frontend ek baar yeh call kare, cache kare locally
// ─────────────────────────────────────────────────────────────

// exports.getMyFeatures = async (user) => {
//   // ── Step 1: Sab active plans ke features ka union lo (fully dynamic) ──
//   // Koi naya feature kisi plan mein add ho → yahan automatically aayega
//   // No hardcoded list — DB se resolve hota hai
//   const allPlans = await Plan.find({
//     status:     "Active",
//     is_deleted: false,
//   }).select("features").lean();

//   const ALL_FEATURE_KEYS = [
//     ...new Set(allPlans.flatMap((p) => p.features || [])),
//   ];

//   // ── Step 2: SUPER_ADMIN — sab features milenge ───────────────
//   if (user.role === "SUPER_ADMIN" || user.roleSlug === "super_admin") {
//     const featureMap = {};
//     ALL_FEATURE_KEYS.forEach((k) => { featureMap[k] = true; });
//     return {
//       plan:       { name: "Super Admin", package_type: "enterprise" },
//       features:   ALL_FEATURE_KEYS,
//       featureMap,
//     };
//   }

//   // ── Step 3: Active subscription fetch ────────────────────────
//   const subscription = await Subscription.findOne({
//     org_id:    user.orgId,
//     is_active: true,
//   })
//     .select("plan_snapshot.features plan_snapshot.name plan_snapshot.package_type status")
//     .lean();

//   const features    = subscription?.plan_snapshot?.features    || [];
//   const planName    = subscription?.plan_snapshot?.name        || "Trial";
//   const packageType = subscription?.plan_snapshot?.package_type || "professionals";

//   // ── Step 4: featureMap build karo ────────────────────────────
//   // Sab known keys (from DB) → true if user ke plan mein hai
//   // Agar Super Admin naya feature add kare kisi plan mein →
//   // yeh map mein automatically aayega, code change nahi chahiye
//   const featureMap = {};
//   ALL_FEATURE_KEYS.forEach((key) => {
//     featureMap[key] = features.includes(key);
//   });

//   return {
//     plan: {
//       name:         planName,
//       package_type: packageType,
//       status:       subscription?.status || "Trial",
//     },
//     features,    // array of enabled feature keys for this user
//     featureMap,  // { shift_roster: true, saml_sso: false, ... }
//     // allFeatureKeys included so frontend knows complete universe
//     allFeatureKeys: ALL_FEATURE_KEYS,
//   };
// };


exports.getMyFeatures = async (user) => {
  // ── Step 1: Sab active plans ke features ka union lo (fully dynamic) ──
  // Koi naya feature kisi plan mein add ho → yahan automatically aayega
  // No hardcoded list — DB se resolve hota hai
  const allPlans = await Plan.find({
    status:     "Active",
    is_deleted: false,
  }).select("features moduleSlugs").lean();

  const ALL_FEATURE_KEYS = [
    ...new Set(allPlans.flatMap((p) => p.features || [])),
  ];

  // ── ALL_MODULE_KEYS — same pattern as features, but for base modules ──
  // (employee/attendance/leave/payroll/shift/etc.) so the frontend can
  // build its sidebar dynamically instead of hardcoding which nav items
  // exist per role.
  const ALL_MODULE_KEYS = [
    ...new Set(allPlans.flatMap((p) => p.moduleSlugs || [])),
  ];

  // ── Step 2: SUPER_ADMIN — sab features milenge ───────────────
  if (user.role === "SUPER_ADMIN" || user.roleSlug === "super_admin") {
    const featureMap = {};
    ALL_FEATURE_KEYS.forEach((k) => { featureMap[k] = true; });

    const moduleMap = {};
    ALL_MODULE_KEYS.forEach((k) => { moduleMap[k] = true; });

    return {
      plan:       { name: "Super Admin", package_type: "enterprise" },
      features:   ALL_FEATURE_KEYS,
      featureMap,
      modules:    ALL_MODULE_KEYS,
      moduleMap,
    };
  }

  // ── Step 3: Active subscription fetch ────────────────────────
  const subscription = await Subscription.findOne({
    org_id:    user.orgId,
    is_active: true,
  })
    .select("plan_snapshot.features plan_snapshot.modules plan_snapshot.name plan_snapshot.package_type status")
    .lean();

  const features    = subscription?.plan_snapshot?.features    || [];
  const modules      = subscription?.plan_snapshot?.modules     || [];
  const planName    = subscription?.plan_snapshot?.name        || "Trial";
  const packageType = subscription?.plan_snapshot?.package_type || "professionals";

  // ── Step 4: featureMap / moduleMap build karo ─────────────────
  // Sab known keys (from DB) → true if user ke plan mein hai
  // Agar Super Admin naya feature/module add kare kisi plan mein →
  // yeh maps mein automatically aayega, code change nahi chahiye
  const featureMap = {};
  ALL_FEATURE_KEYS.forEach((key) => {
    featureMap[key] = features.includes(key);
  });

  const moduleMap = {};
  ALL_MODULE_KEYS.forEach((key) => {
    moduleMap[key] = modules.includes(key);
  });

  return {
    plan: {
      name:         planName,
      package_type: packageType,
      status:       subscription?.status || "Trial",
    },
    features,    // array of enabled feature keys for this user
    featureMap,  // { shift_roster: true, saml_sso: false, ... }
    modules,     // array of enabled BASE modules — ["employee","attendance",...]
    moduleMap,   // { attendance: true, payroll: false, ... } — for building sidebar/nav dynamically
    // allFeatureKeys/allModuleKeys included so frontend knows complete universe
    allFeatureKeys: ALL_FEATURE_KEYS,
    allModuleKeys:  ALL_MODULE_KEYS,
  };
};