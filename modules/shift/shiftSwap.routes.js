// modules/shift/shiftSwap.routes.js

"use strict";

const express          = require("express");
const router           = express.Router();
const ctrl             = require("./shiftSwap.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const checkPermission  = require("../../middlewares/permission.middleware");
const checkFeature     = require("../../middlewares/checkFeature.middleware");
const checkTrial       = require("../../middlewares/checkTrial.middleware");
const validate         = require("../../middlewares/validate.middleware");
const {
  raiseSwapRequest,
  respondToSwap,
  managerAction,
  cancelSwapRequest,
  listSwapRequests
} = require("./shiftSwap.validation");

router.use(authenticate, checkTrial, checkFeature("shift_roster"));

// Specific action routes BEFORE /:id
router.patch("/:id/respond",  checkPermission("attendance.update"), validate(respondToSwap, "body"), ctrl.respondToSwap);
router.patch("/:id/approve",  checkPermission("attendance.update"), validate(managerAction, "body"), ctrl.approveSwap);
router.patch("/:id/reject",   checkPermission("attendance.update"), validate(managerAction, "body"), ctrl.rejectSwap);
router.patch("/:id/cancel",   checkPermission("attendance.update"), validate(cancelSwapRequest, "body"), ctrl.cancelSwapRequest);

router
  .route("/")
  .get(checkPermission("attendance.read"), validate(listSwapRequests, "query"),    ctrl.listSwapRequests)
  .post(checkPermission("attendance.create"), validate(raiseSwapRequest, "body"), ctrl.raiseSwapRequest);

router.get("/:id", checkPermission("attendance.read"), ctrl.getSwapRequestById);

module.exports = router;
