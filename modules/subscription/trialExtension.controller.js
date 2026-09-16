// modules/subscription/trialExtension.controller.js
// Trial Extension Request Management

const TrialExtensionRequest = require('./models/trialExtensionRequest.model');
const Subscription = require('./models/subscription.Models');
const Organization = require('../organisation/models/organization.model');
const AppError = require('../../utils/appError');

const MAX_TOTAL_EXTENSION_DAYS = 30;

// ─── Org Admin: Request trial extension ─────────────────────
// POST /api/v1/subscriptions/trial-extension/request
exports.requestExtension = async (req, res, next) => {
  try {
    const orgId = req.user.orgId;
    const userId = req.user.id;
    const { days, reason } = req.body;

    // Validation
    if (!days || days < 1) {
      return next(new AppError('Number of days is required and must be positive', 400));
    }

    // Check if subscription exists and is in Trial status
    const subscription = await Subscription.findOne({ org_id: orgId, is_active: true });
    if (!subscription) {
      return next(new AppError('No active subscription found', 404));
    }

    if (subscription.status !== 'Trial') {
      return next(new AppError('Trial extension is only available for Trial subscriptions', 400));
    }

    // Check if already has a pending request
    const existingPending = await TrialExtensionRequest.findOne({
      org_id: orgId,
      status: 'Pending'
    });

    if (existingPending) {
      return next(new AppError('You already have a pending extension request. Please wait for it to be reviewed.', 409));
    }

    // Calculate total approved extension days
    const approvedRequests = await TrialExtensionRequest.find({
      org_id: orgId,
      status: 'Approved'
    });

    const totalApprovedDays = approvedRequests.reduce((sum, req) => sum + req.requested_days, 0);
    const daysLeftEligible = MAX_TOTAL_EXTENSION_DAYS - totalApprovedDays;

    if (days > daysLeftEligible) {
      return next(new AppError(
        `You can request a maximum of ${daysLeftEligible} more days (already approved ${totalApprovedDays} days). Total extension cap is ${MAX_TOTAL_EXTENSION_DAYS} days.`,
        400
      ));
    }

    // Create extension request
    const extensionRequest = await TrialExtensionRequest.create({
      org_id: orgId,
      subscription_id: subscription._id,
      requested_days: days,
      reason: reason || '',
      status: 'Pending',
      requested_by: userId,
      requested_at: new Date()
    });

    res.status(201).json({
      success: true,
      message: 'Extension request submitted — awaiting Super Admin approval',
      data: extensionRequest
    });
  } catch (err) {
    next(err);
  }
};

// ─── Org Admin: View own extension requests ─────────────────
// GET /api/v1/subscriptions/trial-extension/my-requests
exports.getMyRequests = async (req, res, next) => {
  try {
    const orgId = req.user.orgId;

    const requests = await TrialExtensionRequest.find({ org_id: orgId })
      .populate('reviewed_by', 'name email')
      .sort({ requested_at: -1 });

    res.json({
      success: true,
      data: requests
    });
  } catch (err) {
    next(err);
  }
};

// ─── Super Admin: Get all extension requests ───────────────
// GET /api/v1/subscriptions/trial-extension/requests
exports.getAllRequests = async (req, res, next) => {
  try {
    const { status } = req.query;

    const filter = {};
    if (status && ['Pending', 'Approved', 'Rejected'].includes(status)) {
      filter.status = status;
    }

    const requests = await TrialExtensionRequest.find(filter)
      .populate('org_id', 'name slug')
      .populate('requested_by', 'name email')
      .populate('reviewed_by', 'name email')
      .sort({ requested_at: -1 });

    res.json({
      success: true,
      data: requests
    });
  } catch (err) {
    next(err);
  }
};

// ─── Super Admin: Approve extension request ────────────────
// PATCH /api/v1/subscriptions/trial-extension/requests/:id/approve
exports.approveRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const reviewerId = req.user.id;

    const request = await TrialExtensionRequest.findById(id);
    if (!request) {
      return next(new AppError('Extension request not found', 404));
    }

    if (request.status !== 'Pending') {
      return next(new AppError('This request has already been reviewed', 400));
    }

    // Verify again that org hasn't exceeded cap (handle race conditions)
    const approvedRequests = await TrialExtensionRequest.find({
      org_id: request.org_id,
      status: 'Approved',
      _id: { $ne: id }
    });

    const totalApprovedDays = approvedRequests.reduce((sum, req) => sum + req.requested_days, 0);
    if (totalApprovedDays + request.requested_days > MAX_TOTAL_EXTENSION_DAYS) {
      return next(new AppError('Approval would exceed the 30-day cap', 400));
    }

    // Update request
    request.status = 'Approved';
    request.reviewed_by = reviewerId;
    request.reviewed_at = new Date();
    request.review_note = note || '';

    await request.save();

    // Extend subscription trial end date
    const subscription = await Subscription.findById(request.subscription_id);
    if (subscription) {
      const newEndDate = new Date(subscription.ends_at);
      newEndDate.setDate(newEndDate.getDate() + request.requested_days);
      subscription.ends_at = newEndDate;
      await subscription.save();
    }

    res.json({
      success: true,
      message: 'Extension approved — subscription end date updated',
      data: {
        request: request,
        subscription: subscription
      }
    });
  } catch (err) {
    next(err);
  }
};

// ─── Super Admin: Reject extension request ──────────────────
// PATCH /api/v1/subscriptions/trial-extension/requests/:id/reject
exports.rejectRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const reviewerId = req.user.id;

    const request = await TrialExtensionRequest.findById(id);
    if (!request) {
      return next(new AppError('Extension request not found', 404));
    }

    if (request.status !== 'Pending') {
      return next(new AppError('This request has already been reviewed', 400));
    }

    request.status = 'Rejected';
    request.reviewed_by = reviewerId;
    request.reviewed_at = new Date();
    request.review_note = note || '';

    await request.save();

    res.json({
      success: true,
      message: 'Extension request rejected',
      data: { request }
    });
  } catch (err) {
    next(err);
  }
};
