// modules/subscription/subscription.controller.js
// Subscription management - Plan upgrades and Trial Extension

const Subscription = require('./models/subscription.Models');
const Plan = require('../plan/models/plan.model');
const Organization = require('../organisation/models/organization.model');
const AppError = require('../../utils/appError');
const mongoose = require('mongoose');

// ─── POST /api/v1/subscriptions/upgrade ─────────────────────
// Org Admin upgrades their subscription to a new plan
exports.upgradePlan = async (req, res, next) => {
  try {
    const { planId, billingCycle } = req.body;
    const orgId = req.user.orgId;

    // Validation
    if (!planId) {
      return next(new AppError('Plan ID is required', 400));
    }

    if (!['monthly', 'annual'].includes(billingCycle)) {
      return next(new AppError('Billing cycle must be "monthly" or "annual"', 400));
    }

    // Fetch the new plan
    const newPlan = await Plan.findById(planId);
    if (!newPlan) {
      return next(new AppError('Plan not found', 404));
    }

    if (newPlan.status !== 'Active' || !newPlan.is_public || newPlan.is_deleted) {
      return next(new AppError('This plan is not available for subscription', 400));
    }

    // Check if organization exists
    const org = await Organization.findById(orgId);
    if (!org) {
      return next(new AppError('Organization not found', 404));
    }

    // Find or create subscription
    let subscription = await Subscription.findOne({ org_id: orgId, is_active: true });

    const now = new Date();
    const endsAt = new Date(now);
    
    if (billingCycle === 'monthly') {
      endsAt.setDate(endsAt.getDate() + 30);
    } else {
      endsAt.setFullYear(endsAt.getFullYear() + 1);
    }

    // Create plan snapshot (features cannot be changed after purchase)
    const planSnapshot = {
      name: newPlan.name,
      price_monthly: newPlan.price_monthly,
      price_annual: newPlan.price_annual,
      seat_limit: newPlan.seat_limit,
      modules: newPlan.modules || [],
      structure_level: newPlan.structure_level,
      package_type: newPlan.package_type,
      features: newPlan.features || []
    };

    if (!subscription) {
      // Create new subscription
      subscription = await Subscription.create({
        org_id: orgId,
        plan_id: newPlan._id,
        plan_snapshot: planSnapshot,
        status: 'Active',
        billing_cycle: billingCycle,
        seats_purchased: newPlan.seat_limit,
        starts_at: now,
        ends_at: endsAt,
        is_active: true
      });
    } else {
      // Upgrade existing subscription
      subscription.plan_id = newPlan._id;
      subscription.plan_snapshot = planSnapshot;
      subscription.status = 'Active';
      subscription.billing_cycle = billingCycle;
      subscription.seats_purchased = newPlan.seat_limit;
      subscription.starts_at = now;
      subscription.ends_at = endsAt;
      subscription.grace_ends_at = null;
      subscription.cancelled_at = null;
      subscription.is_active = true;

      await subscription.save();
    }

    // Update organization's plan reference
    await Organization.findByIdAndUpdate(orgId, {
      $set: { plan_id: newPlan._id }
    });

    res.json({
      success: true,
      message: 'Subscription upgraded successfully',
      data: {
        subscription: {
          _id: subscription._id,
          plan_id: subscription.plan_id,
          plan_snapshot: subscription.plan_snapshot,
          status: subscription.status,
          billing_cycle: subscription.billing_cycle,
          starts_at: subscription.starts_at,
          ends_at: subscription.ends_at
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/subscriptions/current ─────────────────────
// Get current subscription details for logged-in org admin
exports.getCurrentSubscription = async (req, res, next) => {
  try {
    const orgId = req.user.orgId || req.user.org_id;

    const subscription = await Subscription.findOne({ org_id: orgId, is_active: true })
      .populate('plan_id', 'name package_type price_monthly price_annual seat_limit modules features')
      .sort({ createdAt: -1 });

    if (!subscription) {
      // Return default trial subscription info
      return res.json({
        success: true,
        data: {
          planId: null,
          planName: 'Trial',
          package_type: 'professionals',
          status: 'Trial',
          billing_cycle: 'monthly',
          trial_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          next_billing: null,
          seats_used: 0,
          seat_limit: 10,
          plan_snapshot: null,
          starts_at: new Date(),
          ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
        }
      });
    }

    res.json({
      success: true,
      data: {
        planId: subscription.plan_id?._id,
        planName: subscription.plan_snapshot?.name || subscription.plan_id?.name,
        package_type: subscription.plan_snapshot?.package_type,
        status: subscription.status,
        billing_cycle: subscription.billing_cycle,
        trial_end: subscription.status === 'Trial' ? subscription.ends_at : null,
        next_billing: subscription.status === 'Active' ? subscription.ends_at : null,
        seats_used: subscription.seats_purchased,
        seat_limit: subscription.plan_snapshot?.seat_limit,
        plan_snapshot: subscription.plan_snapshot,
        starts_at: subscription.starts_at,
        ends_at: subscription.ends_at
      }
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/subscriptions/check-seat-limit ──────────
// Check if organization can add more users/employees
exports.checkSeatLimit = async (req, res, next) => {
  try {
    const orgId = req.user.orgId;

    const subscription = await Subscription.findOne({ org_id: orgId, is_active: true });
    if (!subscription) {
      return res.json({
        success: true,
        data: {
          canAdd: true,
          message: 'No subscription limit found'
        }
      });
    }

    // Count current users/employees
    const User = require('../auth/models/user.model');
    const currentCount = await User.countDocuments({
      org_id: orgId,
      isDeleted: false
    });

    const seatLimit = subscription.plan_snapshot?.seat_limit;
    const canAdd = !seatLimit || currentCount < seatLimit;

    res.json({
      success: true,
      data: {
        canAdd,
        currentCount,
        seatLimit: seatLimit || 'Unlimited',
        remaining: seatLimit ? Math.max(0, seatLimit - currentCount) : 'Unlimited',
        message: canAdd ? 'Seats available' : 'Seat limit reached'
      }
    });
  } catch (err) {
    next(err);

const subscriptionService = require("./subscription.service");

// ── Org Admin ────────────────────────────────────────────────

// POST /subscriptions/trial-extension/request
exports.requestTrialExtension = async (req, res, next) => {
  try {
    const request = await subscriptionService.requestTrialExtension(req.user, req.body);
    return res.status(201).json({
      success: true,
      message: "Extension request submitted — awaiting Super Admin approval",
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

// GET /subscriptions/trial-extension/my-requests
exports.getMyExtensionRequests = async (req, res, next) => {
  try {
    const requests = await subscriptionService.getMyExtensionRequests(req.user);
    return res.status(200).json({ success: true, data: requests });
  } catch (error) {
    next(error);
  }
};

// ── Super Admin ──────────────────────────────────────────────

// GET /subscriptions/trial-extension/requests
exports.getAllExtensionRequests = async (req, res, next) => {
  try {
    const requests = await subscriptionService.getAllExtensionRequests(req.query);
    return res.status(200).json({ success: true, data: requests });
  } catch (error) {
    next(error);
  }
};

// PATCH /subscriptions/trial-extension/requests/:id/approve
exports.approveExtensionRequest = async (req, res, next) => {
  try {
    const result = await subscriptionService.approveExtensionRequest(
      req.params.id,
      req.user,
      req.body?.note
    );
    return res.status(200).json({
      success: true,
      message: "Extension approved — subscription end date updated",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /subscriptions/trial-extension/requests/:id/reject
exports.rejectExtensionRequest = async (req, res, next) => {
  try {
    const result = await subscriptionService.rejectExtensionRequest(
      req.params.id,
      req.user,
      req.body?.note
    );
    return res.status(200).json({
      success: true,
      message: "Extension request rejected",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
