// modules/plan/plan.route.js

const express    = require("express");
const router     = express.Router();
const controller = require("./plan.controller");
const { authenticate }   = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");

// ── Public routes — no auth needed ────────────────────────────
// Used on pricing page and during registration
router.get("/public",     controller.getPublicPlans);
router.get("/:id/public", controller.getPlanById);

// ── Authenticated — current user ka plan features ─────────────
// MUST be before /:id to avoid Express route conflict
// Frontend app load pe yahi call kare — feature gates cache karo
router.get("/my-features", authenticate, controller.getMyFeatures);

// ── Super Admin only ──────────────────────────────────────────
router.get(   "/",    authenticate, authorizeRoles("SUPER_ADMIN"), controller.getAllPlans);
router.post(  "/",    authenticate, authorizeRoles("SUPER_ADMIN"), controller.createPlan);
router.put(   "/:id", authenticate, authorizeRoles("SUPER_ADMIN"), controller.updatePlan);
router.delete("/:id", authenticate, authorizeRoles("SUPER_ADMIN"), controller.deletePlan);

module.exports = router;
