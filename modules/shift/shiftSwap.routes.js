// modules/shift/shiftSwap.routes.js

"use strict";

const express          = require("express");
const router           = express.Router();
const ctrl             = require("./shiftSwap.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const checkPermission  = require("../../middlewares/permission.middleware");
const checkFeature     = require("../../middlewares/checkFeature.middleware");
const checkTrial       = require("../../middlewares/checkTrial.middleware");

router.use(authenticate, checkTrial, checkFeature("shift_roster"));

// Specific action routes BEFORE /:id
router.patch("/:id/respond",  checkPermission("attendance.update"), ctrl.respondToSwap);
router.patch("/:id/approve",  checkPermission("attendance.update"), ctrl.approveSwap);
router.patch("/:id/reject",   checkPermission("attendance.update"), ctrl.rejectSwap);
router.patch("/:id/cancel",   checkPermission("attendance.update"), ctrl.cancelSwapRequest);

router
  .route("/")
  .get(checkPermission("attendance.read"),    ctrl.listSwapRequests)
  .post(checkPermission("attendance.create"), ctrl.raiseSwapRequest);

router.get("/:id", checkPermission("attendance.read"), ctrl.getSwapRequestById);

module.exports = router;
