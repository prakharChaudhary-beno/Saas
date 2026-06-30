// modules/company/company.route.js

const express    = require("express");
const router     = express.Router();
const controller = require("./company.controller");
const moduleController = require("./companyModule.controller");
const { authenticate }    = require("../../middlewares/auth.middleware");
const checkPermission     = require("../../middlewares/permission.middleware");

// ── Company CRUD ──────────────────────────────────────────────
// All routes: Org Admin only (permission slug: company.*)
router.post(  "/",    authenticate, checkPermission("company.create"), controller.createCompany);
router.get(   "/",    authenticate, checkPermission("company.read"),   controller.getCompanies);
router.get(   "/:id", authenticate, checkPermission("company.read"),   controller.getCompanyById);
router.put(   "/:id", authenticate, checkPermission("company.update"), controller.updateCompany);
router.delete("/:id", authenticate, checkPermission("company.delete"), controller.deleteCompany);

// ── Company Module Management ─────────────────────────────────
// GET  /companies/:id/modules → company ke active modules
// PUT  /companies/:id/modules → enable/disable modules per company
router.get("/:id/modules", authenticate, checkPermission("company.read"),   moduleController.getCompanyModules);
router.put("/:id/modules", authenticate, checkPermission("company.update"), moduleController.updateCompanyModules);

module.exports = router;