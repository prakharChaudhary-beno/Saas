// modules/subscription/subscription.route.js

const express = require('express');
const router = express.Router();
const subscriptionController = require('./subscription.controller');
const trialExtensionController = require('./trialExtension.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { checkRole } = require('../../middlewares/checkRole.middleware');

// ─── Subscription Upgrade (Org Admin) ────────────────────────
router.post(
  '/upgrade',
  authenticate,
  checkRole('org_admin'),
  subscriptionController.upgradePlan
);

// ─── Current Subscription Info ───────────────────────────────
router.get(
  '/current',
  authenticate,
  subscriptionController.getCurrentSubscription
);

// ─── Seat Limit Check ─────────────────────────────────────────
router.get(
  '/check-seat-limit',
  authenticate,
  subscriptionController.checkSeatLimit
);

// ─── Trial Extension - Org Admin ─────────────────────────────
router.post(
  '/trial-extension/request',
  authenticate,
  checkRole('org_admin'),
  trialExtensionController.requestExtension
);

router.get(
  '/trial-extension/my-requests',
  authenticate,
  checkRole('org_admin'),
  trialExtensionController.getMyRequests
);

// ─── Trial Extension - Super Admin ───────────────────────────
router.get(
  '/trial-extension/requests',
  authenticate,
  checkRole('SUPER_ADMIN'),
  trialExtensionController.getAllRequests
);

router.patch(
  '/trial-extension/requests/:id/approve',
  authenticate,
  checkRole('SUPER_ADMIN'),
  trialExtensionController.approveRequest
);

router.patch(
  '/trial-extension/requests/:id/reject',
  authenticate,
  checkRole('SUPER_ADMIN'),
  trialExtensionController.rejectRequest
);

module.exports = router;
