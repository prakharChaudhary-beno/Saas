// modules/holiday/holiday.route.js

const express    = require("express");
const router     = express.Router();
const controller = require("./holiday.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const checkPermission  = require("../../middlewares/permission.middleware");

// ── Company Holiday CRUD ──────────────────────────────────
// ── Master List + Import — PEHLE rakhho ──────────────────
router.get(  "/master",  authenticate, checkPermission("holiday.read"),   controller.getMasterHolidays);
router.post( "/import",  authenticate, checkPermission("holiday.create"), controller.importHolidays);

// ── Company Holiday CRUD — BAAD MEIN ─────────────────────
router.post(  "/",    authenticate, checkPermission("holiday.create"), controller.createHoliday);
router.get(   "/",    authenticate, checkPermission("holiday.read"),   controller.listHolidays);
router.get(   "/:id", authenticate, checkPermission("holiday.read"),   controller.getHoliday);
router.patch( "/:id", authenticate, checkPermission("holiday.update"), controller.updateHoliday);
router.delete("/:id", authenticate, checkPermission("holiday.delete"), controller.deleteHoliday);
router.patch( "/:id/toggle", authenticate, checkPermission("holiday.update"), controller.toggleHoliday);

module.exports = router;