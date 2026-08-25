// modules/subscription/subscription.controller.js

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
