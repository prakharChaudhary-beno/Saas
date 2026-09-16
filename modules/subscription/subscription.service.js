// modules/subscription/subscription.service.js
//
// Trial extension workflow:
//   1. Org Admin  -> POST /subscriptions/trial-extension/request  (Pending)
//   2. Super Admin -> PATCH .../:id/approve  or  .../:id/reject
//
// Business rule (per product decision): a single org can accumulate at
// most MAX_TRIAL_EXTENSION_DAYS extra days in total, across any number
// of approved requests. This is enforced both at request time (so an
// org can't even submit a request that would blow the cap) and again
// at approval time (in case two requests were pending simultaneously).

const AppError = require("../../utils/appError");
const Subscription = require("./models/subscription.Models");
const TrialExtensionRequest = require("./models/trialExtensionRequest.model");

const MAX_TRIAL_EXTENSION_DAYS = 30;

// ─────────────────────────────────────────────────────────────
// ORG ADMIN
// ─────────────────────────────────────────────────────────────

// POST /subscriptions/trial-extension/request
exports.requestTrialExtension = async (user, { days, reason }) => {
  const requestedDays = Number(days);

  if (!requestedDays || requestedDays <= 0 || !Number.isFinite(requestedDays)) {
    throw new AppError("days must be a positive number", 400);
  }

  const subscription = await Subscription.findOne({
    org_id: user.orgId,
    is_active: true,
  });

  if (!subscription) {
    throw new AppError("No active subscription found for your organization", 404);
  }

  if (subscription.status !== "Trial") {
    throw new AppError(
      "Trial extension can only be requested while your subscription is in Trial status",
      400
    );
  }

  const alreadyUsed = subscription.trial_extension_days_used || 0;
  const remaining = MAX_TRIAL_EXTENSION_DAYS - alreadyUsed;

  if (remaining <= 0) {
    throw new AppError(
      `Trial extension limit already reached (max ${MAX_TRIAL_EXTENSION_DAYS} days total).`,
      400
    );
  }

  if (requestedDays > remaining) {
    throw new AppError(
      `You can request at most ${remaining} more day(s) — max ${MAX_TRIAL_EXTENSION_DAYS} days total, ${alreadyUsed} already used.`,
      400
    );
  }

  const existingPending = await TrialExtensionRequest.findOne({
    org_id: user.orgId,
    status: "Pending",
  });

  if (existingPending) {
    throw new AppError(
      "You already have a pending extension request. Please wait for it to be reviewed.",
      409
    );
  }

  return await TrialExtensionRequest.create({
    org_id: user.orgId,
    subscription_id: subscription._id,
    requested_days: requestedDays,
    reason: reason || "",
    requested_by: user.userId,
  });
};

// GET /subscriptions/trial-extension/my-requests
exports.getMyExtensionRequests = async (user) => {
  return await TrialExtensionRequest.find({ org_id: user.orgId })
    .populate("reviewed_by", "name email")
    .sort({ createdAt: -1 });
};

// ─────────────────────────────────────────────────────────────
// SUPER ADMIN
// ─────────────────────────────────────────────────────────────

// GET /subscriptions/trial-extension/requests?status=Pending
exports.getAllExtensionRequests = async (query = {}) => {
  const filter = {};
  if (query.status) filter.status = query.status;

  return await TrialExtensionRequest.find(filter)
    .populate("org_id", "name slug")
    .populate("requested_by", "name email")
    .populate("reviewed_by", "name email")
    .sort({ createdAt: -1 });
};

// PATCH /subscriptions/trial-extension/requests/:id/approve
exports.approveExtensionRequest = async (requestId, reviewer, note) => {
  return _reviewExtensionRequest(requestId, "Approve", reviewer, note);
};

// PATCH /subscriptions/trial-extension/requests/:id/reject
exports.rejectExtensionRequest = async (requestId, reviewer, note) => {
  return _reviewExtensionRequest(requestId, "Reject", reviewer, note);
};

// ─────────────────────────────────────────────────────────────
// INTERNAL
// ─────────────────────────────────────────────────────────────

async function _reviewExtensionRequest(requestId, action, reviewer, note) {
  const request = await TrialExtensionRequest.findById(requestId);

  if (!request) throw new AppError("Extension request not found", 404);

  if (request.status !== "Pending") {
    throw new AppError(
      `This request has already been ${request.status.toLowerCase()}`,
      400
    );
  }

  if (action === "Reject") {
    request.status = "Rejected";
    request.reviewed_by = reviewer.userId;
    request.reviewed_at = new Date();
    request.review_note = note || "";
    await request.save();
    return { request };
  }

  // ── Approve ────────────────────────────────────────────────
  const subscription = await Subscription.findById(request.subscription_id);
  if (!subscription) throw new AppError("Linked subscription not found", 404);

  const alreadyUsed = subscription.trial_extension_days_used || 0;
  const remaining = MAX_TRIAL_EXTENSION_DAYS - alreadyUsed;

  // Re-check the cap here too — a second request could have been
  // approved in between this one being submitted and reviewed.
  if (request.requested_days > remaining) {
    throw new AppError(
      `Cannot approve — would exceed the ${MAX_TRIAL_EXTENSION_DAYS}-day cap (only ${remaining} day(s) remaining for this org).`,
      400
    );
  }

  // Extend from whichever is later: "now" or the current ends_at.
  // (If the trial already lapsed before this got approved, we extend
  // from today rather than compounding onto a date in the past.)
  const base =
    subscription.ends_at && new Date(subscription.ends_at) > new Date()
      ? new Date(subscription.ends_at)
      : new Date();

  subscription.ends_at = new Date(
    base.getTime() + request.requested_days * 24 * 60 * 60 * 1000
  );
  subscription.trial_extension_days_used = alreadyUsed + request.requested_days;
  await subscription.save();

  request.status = "Approved";
  request.reviewed_by = reviewer.userId;
  request.reviewed_at = new Date();
  request.review_note = note || "";
  await request.save();

  return { request, subscription };
}

exports.MAX_TRIAL_EXTENSION_DAYS = MAX_TRIAL_EXTENSION_DAYS;
