// modules/organisation/organization.route.js

const express = require("express");
const router = express.Router();
const { upload } = require("../../config/cloudinary");
const organizationController = require("./organization.controller");
const { authenticate, authorize } = require("../../middlewares/auth.middleware");

// ─── Organization Config Routes (Org Admin Only) ─────────────

// GET organization config
router.get("/config", authenticate, organizationController.getConfig);

// PUT organization config (timezone, currency, fiscalYearStart, address)
router.put("/config", authenticate, organizationController.updateConfig);

// POST upload logo (uses Cloudinary)
router.post(
  "/logo",
  authenticate,
  upload.single("logo"), // 'logo' field name in form-data
  organizationController.uploadLogo
);

module.exports = router;
