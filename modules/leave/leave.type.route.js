const express = require("express");
const router = express.Router();

const leaveController = require("./leave.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const checkPermission  = require("../../middlewares/permission.middleware");
const checkTrial = require("../../middlewares/checkTrial.middleware");
const validate = require("../../middlewares/validate.middleware");
const {
	createLeaveType,
	updateLeaveType,
	getLeaveTypes,
	leaveTypeScope,
} = require("./leave.type.validation");

router.use(authenticate);
router.use(checkTrial);

// POST /leave/types
router.post("/", checkPermission("leaveType.create"), validate(leaveTypeScope, "query"), validate(createLeaveType), leaveController.create);

// GET /leave/types
router.get("/", checkPermission("leaveType.read"), validate(getLeaveTypes, "query"), leaveController.getAll);

// GET /leave/types/:id
router.get("/:id", checkPermission("leaveType.read"), validate(leaveTypeScope, "query"), leaveController.getOne);

// PUT /leave/types/:id
router.put("/:id", checkPermission("leaveType.update"), validate(leaveTypeScope, "query"), validate(updateLeaveType), leaveController.update);

// DELETE /leave/types/:id
router.delete("/:id", checkPermission("leaveType.delete"), validate(leaveTypeScope, "query"), leaveController.removeLeaveType);

module.exports = router;
