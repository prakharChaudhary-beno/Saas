// modules/shift/shift.routes.js

"use strict";

const express          = require("express");
const router           = express.Router();
const ctrl             = require("./shift.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const checkPermission  = require("../../middlewares/permission.middleware");
const checkFeature     = require("../../middlewares/checkFeature.middleware");
const checkTrial       = require("../../middlewares/checkTrial.middleware");

router.use(authenticate, checkTrial);

// All shift routes need shift_roster feature gate
router.use(checkFeature("shift"));

// GET  /shifts          — list
// POST /shifts          — create (hr_manager+)
router
  .route("/")
 .get(checkPermission("shift.read"),   ctrl.getAllShifts)
.post(checkPermission("shift.create"), ctrl.createShift);

router.patch("/:id/activate",   checkPermission("shift.update"), ctrl.activateShift);
router.patch("/:id/deactivate", checkPermission("shift.update"), ctrl.deactivateShift);

router
  .route("/:id")
  .get(checkPermission("shift.read"),   ctrl.getShiftById)
  .put(checkPermission("shift.update"), ctrl.updateShift)
  .delete(checkPermission("shift.delete"), ctrl.deleteShift);

module.exports = router;
