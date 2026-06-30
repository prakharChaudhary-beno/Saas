// modules/delegation/delegation.routes.js

"use strict";

const express          = require("express");
const router           = express.Router();
const ctrl             = require("./delegation.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const checkPermission  = require("../../middlewares/permission.middleware");
const checkFeature     = require("../../middlewares/checkFeature.middleware");
const checkTrial       = require("../../middlewares/checkTrial.middleware");

router.use(authenticate, checkTrial, checkFeature("horizontal_delegation"));

// Specific routes BEFORE /:id
router.get( "/received",      ctrl.getReceivedDelegations);
router.patch("/:id/revoke",   ctrl.revokeDelegation);
router.patch("/:id/approve",  checkPermission("role.update"), ctrl.approveDelegation);
router.patch("/:id/reject",   checkPermission("role.update"), ctrl.rejectDelegation);

router
  .route("/")
  .get(ctrl.getMyDelegations)
  .post(ctrl.createDelegation);

router.get("/:id", ctrl.getDelegationById);

module.exports = router;
