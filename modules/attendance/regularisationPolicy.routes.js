// modules/attendance/regularisationPolicy.routes.js
// Enterprise-level Regularisation Policy Routes

const express = require("express");
const router = express.Router();
const controller = require("./regularisationPolicy.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const checkPermission = require("../../middlewares/permission.middleware");

// ─── Routes ────────────────────────────────────────────────────────

/**
 * @route   GET /api/v1/regularisation/policies
 * @desc    Get all regularisation policies for company
 * @access  Private (requires: attendancePolicy.read)
 */
router.get(
  "/",
  authenticate,
  checkPermission("regularisationPolicy.read"),
  controller.getPolicies
);

/**
 * @route   GET /api/v1/regularisation/policies/effective
 * @desc    Get effective policy for current employee
 * @access  Private (all authenticated users)
 */
router.get(
  "/effective",
  authenticate,
  controller.getEffectivePolicy
);

/**
 * @route   GET /api/v1/regularisation/policies/:id
 * @desc    Get policy by ID
 * @access  Private (requires: attendancePolicy.read)
 */
router.get(
  "/:id",
  authenticate,
  checkPermission("regularisationPolicy.read"),
  controller.getPolicyById
);

/**
 * @route   POST /api/v1/regularisation/policies
 * @desc    Create new regularisation policy
 * @access  Private (requires: attendancePolicy.create)
 */
router.post(
  "/",
  authenticate,
  checkPermission("regularisationPolicy.create"),
  controller.createPolicy
);

/**
 * @route   PUT /api/v1/regularisation/policies/:id
 * @desc    Update regularisation policy
 * @access  Private (requires: attendancePolicy.update)
 */
router.put(
  "/:id",
  authenticate,
  checkPermission("regularisationPolicy.update"),
  controller.updatePolicy
);

/**
 * @route   DELETE /api/v1/regularisation/policies/:id
 * @desc    Delete regularisation policy (soft delete)
 * @access  Private (requires: attendancePolicy.delete)
 */
router.delete(
  "/:id",
  authenticate,
  checkPermission("regularisationPolicy.delete"),
  controller.deletePolicy
);

/**
 * @route   PATCH /api/v1/regularisation/policies/:id/toggle
 * @desc    Toggle policy enable/disable
 * @access  Private (requires: attendancePolicy.update)
 */
router.patch(
  "/:id/toggle",
  authenticate,
  checkPermission("regularisationPolicy.update"),
  controller.togglePolicy
);

module.exports = router;
