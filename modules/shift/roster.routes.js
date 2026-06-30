// modules/shift/roster.routes.js

"use strict";

const express          = require("express");
const router           = express.Router();
const ctrl             = require("./roster.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const checkPermission  = require("../../middlewares/permission.middleware");
const checkFeature     = require("../../middlewares/checkFeature.middleware");
const checkTrial       = require("../../middlewares/checkTrial.middleware");

router.use(authenticate, checkTrial, checkFeature("roster"));

// Specific routes BEFORE /:id
router.get( "/calendar",   checkPermission("attendance.read"),   ctrl.getRosterCalendar);
router.post("/bulk",       checkPermission("attendance.create"), ctrl.bulkAssignRoster);
router.patch("/:id/revoke", checkPermission("attendance.update"), ctrl.revokeRoster);

router
  .route("/")
  .get(checkPermission("attendance.read"),    ctrl.getEmployeeRosters)
  .post(checkPermission("attendance.create"), ctrl.createRoster);

router
  .route("/:id")
  .get(checkPermission("attendance.read"),    ctrl.getRosterById)
  .put(checkPermission("attendance.update"),  ctrl.updateRoster);

module.exports = router;
