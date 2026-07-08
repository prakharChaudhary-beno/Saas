// modules/policyVersion/policyVersion.routes.js
// Policy Version History API - GET /api/v1/policy-versions/:policyType/:policyId

"use strict";

const express = require("express");
const router  = express.Router();

const { authenticate } = require("../../middlewares/auth.middleware");
const policyVersionService = require("./policyVersion.service");
const AppError = require("../../utils/appError");

// ─── GET /api/v1/policy-versions/:policyType/:policyId ─────────────────────
// Fetch version history for a specific policy
// policyType: 'leavePolicy' | 'attendancePolicy' | 'payrollPolicy'
router.get("/:policyType/:policyId", authenticate, async (req, res, next) => {
  try {
    const { policyType, policyId } = req.params;

    // Validate policyType
    const VALID_POLICY_TYPES = ['leavePolicy', 'attendancePolicy', 'payrollPolicy'];
    if (!VALID_POLICY_TYPES.includes(policyType)) {
      throw new AppError(`Invalid policyType. Must be one of: ${VALID_POLICY_TYPES.join(', ')}`, 400);
    }

    // Get version history
    const versions = await policyVersionService.getVersions(policyType, policyId);

    res.status(200).json({
      success: true,
      message: "Version history fetched successfully",
      data: versions
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/v1/policy-versions/:policyType/:policyId/latest ─────────────
// Get the latest version record (for display before saving changes)
router.get("/:policyType/:policyId/latest", authenticate, async (req, res, next) => {
  try {
    const { policyType, policyId } = req.params;

    const VALID_POLICY_TYPES = ['leavePolicy', 'attendancePolicy', 'payrollPolicy'];
    if (!VALID_POLICY_TYPES.includes(policyType)) {
      throw new AppError(`Invalid policyType. Must be one of: ${VALID_POLICY_TYPES.join(', ')}`, 400);
    }

    const latestVersion = await policyVersionService.getLatestVersion(policyType, policyId);

    if (!latestVersion) {
      return res.status(404).json({
        success: false,
        message: "No version history found for this policy"
      });
    }

    res.status(200).json({
      success: true,
      message: "Latest version fetched",
      data: latestVersion
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
