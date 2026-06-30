"use strict";
const express = require("express");
const router  = express.Router();
const ctrl    = require("./auditLog.controller");
const { authenticate }  = require("../../middlewares/auth.middleware");
const checkPermission   = require("../../middlewares/permission.middleware");

// All logs — Unit Admin / HR Manager
router.get("/", authenticate, checkPermission("employee.read"), ctrl.getLogs);

// Employee timeline — by employeeId
router.get("/employee/:employeeId", authenticate, checkPermission("employee.read"), ctrl.getEmployeeTimeline);

module.exports = router;