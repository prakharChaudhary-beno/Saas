// middlewares/checkTrial.middleware.js
//
// Task 15 — REWRITTEN
//
// Old version: checked Tenant.plan field directly
// New version: checks subscriptions collection by org_id
//
// This middleware is lighter than permission.middleware.js —
// it ONLY checks subscription status, not modules or permissions.
//
// Use this on routes that need a quick "is this org allowed to operate"
// check without the full 3-layer permission check.
//
// permission.middleware.js already does Layer 1 (subscription check)
// internally, so you don't need BOTH on the same route.
//
// Use checkTrial standalone on:
//   - Routes that don't have a specific permission but need subscription gate
//   - Dashboard / home routes
//
// Status handling:
//   Trial     → allow, attach req.trialInfo with days remaining
//   Active    → allow, no trialInfo attached
//   PastDue   → allow within grace_ends_at, block after
//   Expired   → 403
//   Cancelled → 403

const Subscription = require("../modules/subscription/models/subscription.Models");

module.exports = async (req, res, next) => {
  try {

    // ── Super Admin / Product Admin — always bypass ───────────
    if (req.user.role === "SUPER_ADMIN" || req.user.role === "product_admin") {
      return next();
    }

    const orgId = req.user.orgId;

    // If no orgId on JWT — user is not scoped to an org yet
    // (e.g. Customer who hasn't created an org)
    if (!orgId) {
      return res.status(403).json({
        success: false,
        code:    "NO_ORG_ASSIGNED",
        message: "Your account is not linked to an organization.",
      });
    }

    // ── Find active subscription for this org ─────────────────
    const subscription = await Subscription.findOne({
      org_id:    orgId,
      is_active: true,
    });

    if (!subscription) {
      return res.status(403).json({
        success:    false,
        code:       "SUBSCRIPTION_NOT_FOUND",
        message:    "No active subscription found. Please contact support.",
        upgradeUrl: "/pricing",
      });
    }

    const now = new Date();

    // ── Cancelled ─────────────────────────────────────────────
    if (subscription.status === "Cancelled") {
      return res.status(403).json({
        success:    false,
        code:       "SUBSCRIPTION_CANCELLED",
        message:    "Your subscription has been cancelled. Please renew to continue.",
        upgradeUrl: "/pricing",
      });
    }

    // ── Expired ───────────────────────────────────────────────
    if (subscription.status === "Expired") {
      return res.status(403).json({
        success:    false,
        code:       "SUBSCRIPTION_EXPIRED",
        message:    "Your subscription has expired. Please upgrade your plan.",
        upgradeUrl: "/pricing",
      });
    }

    // ── PastDue ───────────────────────────────────────────────
    if (subscription.status === "PastDue") {
      // Block if grace period has ended
      if (!subscription.grace_ends_at || now > new Date(subscription.grace_ends_at)) {
        return res.status(403).json({
          success:    false,
          code:       "SUBSCRIPTION_GRACE_EXPIRED",
          message:    "Payment is overdue and grace period has ended. Please update billing.",
          upgradeUrl: "/billing",
        });
      }

      // Within grace period — allow but attach warning
      const graceDaysLeft = Math.ceil(
        (new Date(subscription.grace_ends_at) - now) / (1000 * 60 * 60 * 24)
      );

      req.subscriptionWarning = {
        status:        "PastDue",
        grace_ends_at: subscription.grace_ends_at,
        graceDaysLeft,
        message:       `Payment overdue. You have ${graceDaysLeft} day(s) before access is blocked.`,
      };

      return next();
    }

    // ── Trial ─────────────────────────────────────────────────
    if (subscription.status === "Trial") {
      // Block if trial has ended
      if (now > new Date(subscription.ends_at)) {
        return res.status(403).json({
          success:    false,
          code:       "TRIAL_EXPIRED",
          message:    "Your free trial has ended. Please upgrade to continue.",
          upgradeUrl: "/pricing",
        });
      }

      const daysLeft = Math.ceil(
        (new Date(subscription.ends_at) - now) / (1000 * 60 * 60 * 24)
      );

      // Attach trial info — frontend uses this to show trial banner
      req.trialInfo = {
        status:   "Trial",
        daysLeft: daysLeft > 0 ? daysLeft : 0,
        ends_at:  subscription.ends_at,
        plan:     subscription.plan_snapshot?.name || "Trial",
      };

      return next();
    }

    // ── Active ────────────────────────────────────────────────
    // Clean active subscription — just continue
    if (subscription.status === "Active") {
      return next();
    }

    // Fallback — unknown status
    return res.status(403).json({
      success: false,
      code:    "SUBSCRIPTION_UNKNOWN",
      message: "Subscription status could not be verified. Please contact support.",
    });

  } catch (error) {
    next(error);
  }
};