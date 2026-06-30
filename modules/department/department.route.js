const express = require("express");
const router = express.Router();
// const checkTrial = require("../../middlewares.middleware");
const departmentController = require("./department.controller");
const  {authenticate} = require("../../middlewares/auth.middleware");
const  checkPermission  = require("../../middlewares/permission.middleware");
router.post(
  "/create",
  authenticate,
  checkPermission("department.create"),
  departmentController.create
);

router.get(
  "/",
  authenticate,
  checkPermission("department.read"),
  departmentController.list
);

router.get(
  "/:id",
  authenticate,
  checkPermission("department.read"),
  departmentController.getById
);

router.put(
  "/:id",
  authenticate,
  checkPermission("department.update"),
  departmentController.update
);

router.delete(
  "/:id",
  authenticate,
  checkPermission("department.delete"),
  departmentController.delete
);

module.exports = router;