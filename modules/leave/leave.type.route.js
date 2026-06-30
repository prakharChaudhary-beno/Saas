const express = require("express");
const router = express.Router();

const leaveController = require("./leave.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { checkRole, requireTenantUser } = require("../../middlewares/checkRole.middleware");
const checkTrial = require("../../middlewares/checkTrial.middleware");

router.use(authenticate);
router.use(requireTenantUser);

// POST /leave/types
router.post("/", checkTrial, checkRole("hr_manager"), leaveController.create);

// GET /leave/types
router.get("/", checkRole("employee"), leaveController.getAll);

// GET /leave/types/:id
router.get("/:id", checkRole("employee"), leaveController.getOne);

// PUT /leave/types/:id
router.put("/:id", checkTrial, checkRole("hr_manager"), leaveController.update);

// DELETE /leave/types/:id
router.delete("/:id", checkTrial, checkRole("hr_manager"), leaveController.remove);

module.exports = router;