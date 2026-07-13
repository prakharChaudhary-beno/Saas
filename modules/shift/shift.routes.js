// modules/shift/shift.routes.js

"use strict";

const express          = require("express");
const router           = express.Router();
const ctrl             = require("./shift.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const checkPermission  = require("../../middlewares/permission.middleware");
const checkFeature     = require("../../middlewares/checkFeature.middleware");
const checkTrial       = require("../../middlewares/checkTrial.middleware");
const validate         = require("../../middlewares/validate.middleware");
const { createShift, updateShift, getShifts } = require("./shift.validation");

router.use(authenticate, checkTrial);
//shift 
// All shift routes need shift_roster feature gate
router.use(checkFeature("shift"));

// GET  /shifts          — list
// POST /shifts          — create (hr_manager+)
router
  .route("/")
 .get(checkPermission("shift.read"), validate(getShifts, "query"),   ctrl.getAllShifts)
.post(checkPermission("shift.create"), validate(createShift, "body"), ctrl.createShift);

router.patch("/:id/activate",   checkPermission("shift.update"), ctrl.activateShift);
router.patch("/:id/deactivate", checkPermission("shift.update"), ctrl.deactivateShift);

router
  .route("/:id")
  .get(checkPermission("shift.read"),   ctrl.getShiftById)
  .put(checkPermission("shift.update"), validate(updateShift, "body"), ctrl.updateShift)
  .delete(checkPermission("shift.delete"), ctrl.deleteShift);

module.exports = router;
