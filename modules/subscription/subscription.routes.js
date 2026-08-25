// modules/subscription/subscription.routes.js

const express = require("express");
const router = express.Router();

const controller = require("./subscription.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");

// ── Org Admin — request an extension / view own history ───────
router.post(
  "/trial-extension/request",
  authenticate,
  authorizeRoles("org_admin"),
  controller.requestTrialExtension
);

router.get(
  "/trial-extension/my-requests",
  authenticate,
  authorizeRoles("org_admin"),
  controller.getMyExtensionRequests
);

// ── Super Admin — review queue ─────────────────────────────────
router.get(
  "/trial-extension/requests",
  authenticate,
  authorizeRoles("SUPER_ADMIN"),
  controller.getAllExtensionRequests
);

router.patch(
  "/trial-extension/requests/:id/approve",
  authenticate,
  authorizeRoles("SUPER_ADMIN"),
  controller.approveExtensionRequest
);

router.patch(
  "/trial-extension/requests/:id/reject",
  authenticate,
  authorizeRoles("SUPER_ADMIN"),
  controller.rejectExtensionRequest
);

module.exports = router;
