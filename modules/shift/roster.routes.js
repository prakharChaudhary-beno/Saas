// modules/shift/roster.routes.js

"use strict";

const express          = require("express");
const router           = express.Router();
const ctrl             = require("./roster.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const checkPermission  = require("../../middlewares/permission.middleware");
const checkFeature     = require("../../middlewares/checkFeature.middleware");
const checkTrial       = require("../../middlewares/checkTrial.middleware");
const validate         = require("../../middlewares/validate.middleware");
const {
  createRoster,
  bulkAssignRoster,
  updateRoster,
  revokeRoster,
  getRosters,
  getRosterCalendar
} = require("./roster.validation");

router.use(authenticate, checkTrial, checkFeature("roster"));

// Specific routes BEFORE /:id
router.get( "/calendar",   checkPermission("attendance.read"), validate(getRosterCalendar, "query"), ctrl.getRosterCalendar);
router.post("/bulk",       checkPermission("attendance.create"), validate(bulkAssignRoster, "body"), ctrl.bulkAssignRoster);
router.patch("/:id/revoke", checkPermission("attendance.update"), validate(revokeRoster, "body"), ctrl.revokeRoster);

router
  .route("/")
  .get(checkPermission("attendance.read"), validate(getRosters, "query"),    ctrl.getEmployeeRosters)
  .post(checkPermission("attendance.create"), validate(createRoster, "body"), ctrl.createRoster);

router
  .route("/:id")
  .get(checkPermission("attendance.read"),    ctrl.getRosterById)
  .put(checkPermission("attendance.update"),  validate(updateRoster, "body"), ctrl.updateRoster);

module.exports = router;
