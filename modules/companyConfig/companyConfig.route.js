const express = require("express");
const router = express.Router();

const { authenticate } = require("../../middlewares/auth.middleware");
const checkPermission  = require("../../middlewares/permission.middleware");
const checkTrial = require("../../middlewares/checkTrial.middleware");
const  validate  = require("../../middlewares/validate.middleware");
const { configSchema } = require("./companyConfig.validation");
const controller = require("./companyConfig.controller");

// All routes require auth + trial check
router.use(authenticate, checkTrial);

// GET — all roles can read config
router.get("/config", checkPermission("attendance.read"), controller.getConfig);

// POST — company_admin (onboarding)
router.post("/config", checkPermission("attendance.create"), validate(configSchema), controller.createConfig);

// PUT — unit_admin
router.put("/config", checkPermission("attendance.update"), validate(configSchema), controller.updateConfig);

module.exports = router;
