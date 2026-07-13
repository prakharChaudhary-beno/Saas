"use strict";
const express = require("express");
const router  = express.Router();
const ctrl    = require("./payrolllock.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const checkPermission  = require("../../middlewares/permission.middleware");

// All routes need payroll.run permission (HR Manager / Unit Admin)
router.get("/",              authenticate, checkPermission("payroll.read"), ctrl.getAllLocks);
router.get("/:month",        authenticate, checkPermission("payroll.read"), ctrl.getLockStatus);
router.post("/lock",         authenticate, checkPermission("payroll.run"),  ctrl.lockPeriod);
router.post("/unlock",       authenticate, checkPermission("payroll.run"),  ctrl.unlockPeriod);

module.exports = router;