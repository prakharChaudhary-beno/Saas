const express = require("express");
const router = express.Router();

const { authenticate } = require("../../middlewares/auth.middleware");
const {checkRole} = require("../../middlewares/checkRole.middleware");
const checkTrial = require("../../middlewares/checkTrial.middleware");
const  validate  = require("../../middlewares/validate.middleware");
const { configSchema } = require("./companyConfig.validation");
const controller = require("./companyConfig.controller");

// All routes require auth + tenant user + trial check
router.use(authenticate, checkTrial);

// GET — all roles can read config
router.get("/config", checkRole("employee"), controller.getConfig);

// POST — only tenant_admin (onboarding)
router.post("/config", checkRole("company_admin"), validate(configSchema), controller.createConfig);

// PUT — only tenant_admin
router.put("/config", checkRole("unit_admin"), validate(configSchema), controller.updateConfig);

module.exports = router;