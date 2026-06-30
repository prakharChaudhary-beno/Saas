const router = require("express").Router();
// const checkTrial= require("../../middlewares.middleware");
const controller = require("./designation.controller");
const  {authenticate} = require("../../middlewares/auth.middleware");
const  checkPermission  = require("../../middlewares/permission.middleware");
router.post(
  "/create",
  authenticate,
  checkPermission("designation.create"),
  controller.create
);

router.get(
  "/",
  authenticate,
  checkPermission("designation.read"),
  controller.list
);

router.get(
  "/:id",
  authenticate,
  checkPermission("designation.read"),
  controller.getById
);

router.put(
  "/:id",
  authenticate,
  checkPermission("designation.update"),
  controller.update
);

router.delete(
  "/:id",
  authenticate,
  checkPermission("designation.delete"),
  controller.delete
);

module.exports = router;