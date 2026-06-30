"use strict";
const express    = require("express");
const router     = express.Router();
const ctrl       = require("./attendanceRegularization.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const checkPermission  = require("../../middlewares/permission.middleware");

// Employee — apply + view own requests
router.post("/",          authenticate, checkPermission("attendance.create"), ctrl.apply);
router.get("/my",         authenticate, checkPermission("attendance.read"),   ctrl.getMyRequests);
router.delete("/:id",     authenticate, checkPermission("attendance.create"), ctrl.cancelRequest);

// Manager/HR — pending approvals + action
router.get("/pending",    authenticate, checkPermission("attendance.approve"), ctrl.getPendingApprovals);
router.patch("/:id",      authenticate, checkPermission("attendance.approve"), ctrl.updateStatus);

module.exports = router;