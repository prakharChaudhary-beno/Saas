// employee.routes.js
const express = require("express");
const router = express.Router();

const employeeController = require("./employee.controller");
const { authenticate }     = require("../../middlewares/auth.middleware");
const  checkPermission  = require("../../middlewares/permission.middleware");

// const  checkTrial         = require("../../middlewares/checkTrial.middleware");
const  validate  = require("../../middlewares/validate.middleware");  

const { createEmployeeSchema } = require("./employee.validation");
const { updateEmployeeSchema } = require("./employee.validation");
const { activateLoginSchema } = require("./employee.validation");
const { upload } = require("../../config/cloudinary");
const { uploadDocumentSchema } = require("./employee.validation");


router.get("/me", authenticate, employeeController.getMyProfile);

// E-08 — Apna profile update karo (sirf phone, address, emergencyContact, profilePhoto)
router.put(
  "/me",
  authenticate,
  async (req, res, next) => {
    const Employee = require("./models/employee.model");
    const emp = await Employee.findOne({
      userId:    req.user.userId,
      org_id:    req.user.orgId,
      isDeleted: false,
    }).select("_id").lean();

    if (!emp) return res.status(404).json({ success: false, message: "Employee profile not found" });

    req.params.id = emp._id.toString();
    next();
  },
  employeeController.updateEmployee
);

// E-09 — Apne documents dekho aur download karo
router.get("/me/documents", authenticate, employeeController.getMyDocuments);

// E-10 — Profile completion score
router.get("/me/profile-completion", authenticate, employeeController.getProfileCompletion);

router.post(
  "/",
  authenticate,
  
  checkPermission("employee.create"),
  validate(createEmployeeSchema),
  employeeController.createEmployee
);

router.get(
  "/",
  authenticate,
  
  checkPermission("employee.read"),
  employeeController.getEmployees
);

router.get(
  "/:id",
  authenticate,
  
  checkPermission("employee.read"),
  employeeController.getEmployeeById
);

router.put(
  "/:id",
  authenticate,
  
  checkPermission("employee.update"),
  validate(updateEmployeeSchema),
  employeeController.updateEmployee
);

router.delete(
  "/:id",
  authenticate,

  checkPermission("employee.delete"),
  employeeController.deleteEmployee
);

router.post(
  "/:id/activate-login",
  authenticate,
  
  checkPermission("employee.update"),
  validate(activateLoginSchema),
  employeeController.activateLogin
);


router.post(
  "/:id/documents",
  authenticate,
  
  checkPermission("employee.update"),
  upload.single("file"),          // ✅ file upload
  employeeController.uploadDocument
);

router.get(
  "/:id/documents",
  authenticate,
  
  checkPermission("employee.read"),
  employeeController.getDocuments
);

router.delete(
  "/:id/documents/:docId",
  authenticate,
  
  checkPermission("employee.update"),
  employeeController.deleteDocument
);

router.patch(
  "/:id/documents/:docId/verify",
  authenticate,
  
  checkPermission("employee.update"),
  employeeController.verifyDocument
);

router.patch("/:id/status",   authenticate,
  
  checkPermission("employee.update"),
  employeeController.changeStatus
);
module.exports = router;