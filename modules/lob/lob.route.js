// modules/lob/lob.route.js

const express    = require("express");
const router     = express.Router();
const controller = require("./lob.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const checkPermission  = require("../../middlewares/permission.middleware");

router.post(  "/",    authenticate, checkPermission("lob.create"), controller.createLob);
router.get(   "/",    authenticate, checkPermission("lob.read"),   controller.getLobs);
router.get(   "/:id", authenticate, checkPermission("lob.read"),   controller.getLobById);
router.put(   "/:id", authenticate, checkPermission("lob.update"), controller.updateLob);
router.delete("/:id", authenticate, checkPermission("lob.delete"), controller.deleteLob);

module.exports = router;