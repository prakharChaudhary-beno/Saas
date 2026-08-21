// modules/employee/employeeTimeline.route.js
// Employee Career Timeline Routes

const express = require("express");
const router = express.Router({ mergeParams: true });

const employeeTimelineService = require("./employeeTimeline.service");
const { authenticate } = require("../../middlewares/auth.middleware");
const { requireTenantUser } = require("../../middlewares/checkRole.middleware");
const checkPermission = require("../../middlewares/permission.middleware");

// ── Global guards ───────────────────────────────────────────────
router.use(authenticate);
router.use(requireTenantUser);

// ── GET /api/v1/employees/:id/timeline ────────────────────────────
// Requires: employee.read permission
router.get(
  "/",
  checkPermission("employee.read"),
  async (req, res, next) => {
    try {
      const result = await employeeTimelineService.getEmployeeTimeline(
        req.params.id,
        req.user
      );

      res.json({
        success: true,
        message: "Employee timeline fetched successfully",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
