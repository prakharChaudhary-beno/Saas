// modules/unit/unit.route.js

const express    = require("express");
const router     = express.Router();
const controller = require("./unit.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const checkPermission  = require("../../middlewares/permission.middleware");

router.post(  "/",    authenticate, checkPermission("unit.create"), controller.createUnit);
router.get(   "/",    authenticate, checkPermission("unit.read"),   controller.getUnits);
router.get(   "/:id", authenticate, checkPermission("unit.read"),   controller.getUnitById);
router.put(   "/:id", authenticate, checkPermission("unit.update"), controller.updateUnit);
router.delete("/:id", authenticate, checkPermission("unit.delete"), controller.deleteUnit);

module.exports = router;