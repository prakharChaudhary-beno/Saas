const express = require("express");
const router  = express.Router();

const { authenticate }    = require("../../middlewares/auth.middleware");
const { superAdminGuard } = require("../../middlewares/superAdminGuard.middleware");
const validate            = require("../../middlewares/validate.middleware");
const ctrl                = require("./superAdmin.controller");
const customerAuthenticate = require("../../middlewares/customerAuthenticate.middleware"); // ← no destructuring
const { tenantListSchema, planOverrideSchema, auditLogQuerySchema, createCustomerSchema, createOrgSchema } = require("./superAdmin.validation");

// ── Customer org create — superAdminGuard se BAHAR ───────────
// Yeh route customer token se access hoga
router.post(
  "/customers/create-org",
  customerAuthenticate,
  ctrl.createOrgForCustomer
);

// ── Baki sab super admin only ─────────────────────────────────
router.use(authenticate);
router.use(superAdminGuard);

router.get("/hierarchy", ctrl.getCustomerHierarchy);

router.get(
  "/tenants",
  validate(tenantListSchema, "query"),
  ctrl.getAllTenants
);

router.get("/tenants/:id", ctrl.getTenantById);

router.post(
  "/tenants/:id/plan",
  validate(planOverrideSchema),
  ctrl.overridePlan
);

router.patch("/tenants/:id/status", ctrl.updateStatus);

router.post(
  "/customers",
  validate(createCustomerSchema),
  ctrl.createCustomer
);

router.get(
  "/audit-log",
  validate(auditLogQuerySchema, "query"),
  ctrl.getAuditLog
);

module.exports = router;