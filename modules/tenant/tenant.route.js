// modules/tenant/tenant.route.js
//
// Task 16 — UPDATED (corrected)

const express    = require("express");
const router     = express.Router();
const controller = require("./tenant.controller");
const { authenticate }   = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");
const validate           = require("../../middlewares/validate.middleware");
const { registerOrgSchema } = require("./tenant.validation");

// ─── Public ───────────────────────────────────────────────────
router.post("/register", validate(registerOrgSchema), controller.registerOrg);

// ─── Super Admin (Product Admin) only ─────────────────────────
router.get(   "/",    authenticate, authorizeRoles("SUPER_ADMIN"), controller.getCustomers);
router.get(   "/:id", authenticate, authorizeRoles("SUPER_ADMIN"), controller.getCustomerById);
router.put(   "/:id", authenticate, authorizeRoles("SUPER_ADMIN"), controller.updateCustomer);
router.delete("/:id", authenticate, authorizeRoles("SUPER_ADMIN"), controller.deleteCustomer);

module.exports = router;