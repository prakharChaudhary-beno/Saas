const express = require("express");
const router = express.Router();

const leaveController = require("./leave.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const checkPermission  = require("../../middlewares/permission.middleware");
const checkTrial = require("../../middlewares/checkTrial.middleware");

router.use(authenticate);
router.use(checkTrial);

// POST /leave/types
router.post("/", checkPermission("leave_type.create"), leaveController.create);

// GET /leave/types
router.get("/", checkPermission("leave_type.read"), leaveController.getAll);

// GET /leave/types/:id
router.get("/:id", checkPermission("leave_type.read"), leaveController.getOne);

// PUT /leave/types/:id
router.put("/:id", checkPermission("leave_type.update"), leaveController.update);

// DELETE /leave/types/:id
router.delete("/:id", checkPermission("leave_type.delete"), leaveController.remove);

module.exports = router;
