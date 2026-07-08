// middlewares/checkFeature.middleware.js

"use strict";

const Subscription = require("../modules/subscription/models/subscription.Models");
const Plan         = require("../modules/plan/models/plan.model");

// Feature aliases: if user has the alias, they also have these features
// shift_roster is a bundle that includes shift, roster, and shift_roster
const FEATURE_ALIASES = {
  "shift_roster": ["shift", "roster", "shift_roster"],
  "shift": ["shift"],
  "roster": ["roster"],
};

module.exports = (featureKey) => {
  return async (req, res, next) => {
    try {
      // SUPER_ADMIN — always bypass
      if (req.user?.role === "SUPER_ADMIN" || req.user?.roleSlug === "super_admin") {
        return next();
      }

      // Active subscription fetch
      const subscription = await Subscription.findOne({
        org_id:    req.user.orgId,
        is_active: true,
      })
        .select("plan_id plan_snapshot.features plan_snapshot.package_type status")
        .lean();

      // Check plan_snapshot.features first
      let features = subscription?.plan_snapshot?.features || [];
      const planType = subscription?.plan_snapshot?.package_type || "professionals";

      // If snapshot features empty → fetch live from Plan (handles plan updates)
      if (features.length === 0 && subscription?.plan_id) {
        const plan = await Plan.findById(subscription.plan_id)
          .select("features")
          .lean();
        features = plan?.features || [];
      }

      // Expand features with aliases
      // If user has "shift_roster", they also have "shift" and "roster"
      const expandedFeatures = new Set(features);
      for (const f of features) {
        const aliases = FEATURE_ALIASES[f];
        if (aliases) {
          aliases.forEach(a => expandedFeatures.add(a));
        }
      }

      // Check: is featureKey in expanded features?
      if (!expandedFeatures.has(featureKey)) {
        return res.status(403).json({
          success:    false,
          code:       "FEATURE_NOT_IN_PLAN",
          feature:    featureKey,
          yourPlan:   planType,
          upgradeUrl: "/pricing",
          message:    `This feature is not included in your current plan. Please upgrade to access "${featureKey}".`,
        });
      }

      req.planType     = planType;
      req.planFeatures = Array.from(expandedFeatures);
      next();

    } catch (error) {
      next(error);
    }
  };
};