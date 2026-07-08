// modules/payrollPolicy/investmentDeclaration.routes.js
// Routes for Investment Declaration Management

const express = require("express");
const router = express.Router();

const { authenticate } = require("../../middlewares/auth.middleware");
const { checkRole } = require("../../middlewares/checkRole.middleware");
const checkTrial = require("../../middlewares/checkTrial.middleware");
const validate = require("../../middlewares/validate.middleware");
const investmentDeclarationService = require("./investmentDeclaration.service");
const Joi = require("joi");

// ─── Validation Schemas ──────────────────────────────────────────────────────
const upsertDeclarationSchema = Joi.object({
  financialYear: Joi.string().pattern(/^\d{4}-\d{4}$/).required(),
  taxRegime: Joi.string().valid("old", "new").default("new"),
  investments: Joi.array().items(Joi.object({
    section: Joi.string().required(),
    // Accept both 'subcategory' (backend) and 'type' (frontend)
    subcategory: Joi.string(),
    type: Joi.string(),
    // Accept both 'declaredAmount' (backend) and 'amount' (frontend)
    declaredAmount: Joi.number().min(0),
    amount: Joi.number().min(0),
    declaration: Joi.string().allow(""),
    remark: Joi.string().allow(""),
  })).min(1).required(),
  hraExemption: Joi.object({
    monthlyRent: Joi.number().min(0),
    landlordPan: Joi.string().allow(""),
    landlordName: Joi.string().allow(""),
    rentAddress: Joi.string().allow(""),
  }).optional(),
  ltaClaims: Joi.array().items(Joi.object({
    travelDate: Joi.date(),
    travelMode: Joi.string(),
    declaredAmount: Joi.number().min(0),
  })).optional(),
}).unknown(true);

const uploadProofSchema = Joi.object({
  investmentId: Joi.string().required(),
  proofType: Joi.string().required(),
  documentName: Joi.string().required(),
  documentUrl: Joi.string().required(),
});

const reviewDeclarationSchema = Joi.object({
  status: Joi.string().valid("APPROVED", "REJECTED").required(),
  reviewNotes: Joi.string().when("status", {
    is: "REJECTED",
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  investmentApprovals: Joi.array().items(Joi.object({
    investmentId: Joi.string().required(),
    approvedAmount: Joi.number().min(0).required(),
  })).optional(),
}).unknown(true);

// ─── Global guards ───────────────────────────────────────────────────────────
router.use(authenticate, checkTrial);

// ─── Employee Routes ──────────────────────────────────────────────────────────
// Employee creates/updates their investment declaration
router.post("/",
  validate(upsertDeclarationSchema),
  async (req, res, next) => {
    try {
      const employee = await getEmployeeFromUser(req.user);
      const result = await investmentDeclarationService.upsertDeclaration(
        employee._id,
        req.user.companyId,
        req.user.orgId || req.user.companyId,
        req.body,
        req.user
      );
      res.json({
        success: true,
        message: "Investment declaration saved successfully",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

// Get employee's own declaration for a financial year
// Handles /my?financialYear=2026-2027 (query param)
router.get("/my", 
  async (req, res, next) => {
    try {
      const employee = await getEmployeeFromUser(req.user);
      const { financialYear } = req.query;
      
      if (!financialYear) {
        return res.status(400).json({
          success: false,
          message: "Financial year is required (use ?financialYear=2026-2027)"
        });
      }
      
      const result = await investmentDeclarationService.getEmployeeDeclaration(
        employee._id,
        req.user.companyId,
        financialYear
      );
      res.json({
        success: true,
        message: "Investment declaration fetched",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

// Get employee's own declaration for a financial year (path param)
// Handles /my/2026-2027
router.get("/my/:financialYear", 
  async (req, res, next) => {
    try {
      const employee = await getEmployeeFromUser(req.user);
      const result = await investmentDeclarationService.getEmployeeDeclaration(
        employee._id,
        req.user.companyId,
        req.params.financialYear
      );
      res.json({
        success: true,
        message: "Investment declaration fetched",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

// Submit declaration for review (query param)
// Handles /submit?financialYear=2026-2027
router.post("/submit",
  async (req, res, next) => {
    try {
      const employee = await getEmployeeFromUser(req.user);
      const { financialYear } = req.query;
      
      if (!financialYear) {
        return res.status(400).json({
          success: false,
          message: "Financial year is required (use ?financialYear=2026-2027)"
        });
      }
      
      const result = await investmentDeclarationService.submitDeclaration(
        employee._id,
        req.user.companyId,
        financialYear,
        req.user
      );
      res.json({
        success: true,
        message: "Declaration submitted for review",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

// Submit declaration for review (path param)
// Handles /submit/2026-2027
router.post("/submit/:financialYear",
  async (req, res, next) => {
    try {
      const employee = await getEmployeeFromUser(req.user);
      const result = await investmentDeclarationService.submitDeclaration(
        employee._id,
        req.user.companyId,
        req.params.financialYear,
        req.user
      );
      res.json({
        success: true,
        message: "Declaration submitted for review",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

// Upload proof for investment
router.post("/proof",
  validate(uploadProofSchema),
  async (req, res, next) => {
    try {
      const employee = await getEmployeeFromUser(req.user);
      const result = await investmentDeclarationService.uploadProof(
        employee._id,
        req.user.companyId,
        req.body.financialYear || new Date().getMonth() >= 3 
          ? `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`
          : `${new Date().getFullYear() - 1}-${new Date().getFullYear()}`,
        req.body.investmentId,
        req.body,
        req.user
      );
      res.json({
        success: true,
        message: "Proof uploaded successfully",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── HR/Admin Routes ─────────────────────────────────────────────────────────
// Get all declarations for review (HR view)
router.get("/all",
  checkRole("hr_manager"),
  async (req, res, next) => {
    try {
      // Read unitId from query params (frontend) or user object (fallback)
      const { financialYear, status, page = 1, limit = 20, unitId } = req.query;
      
      // Use query param if provided, otherwise fallback to user's unit
      const filterUnitId = unitId || req.user.unitId || null;
      
      const result = await investmentDeclarationService.getDeclarationsForReview(
        req.user.companyId,
        filterUnitId,
        { financialYear, status, page, limit }
      );
      res.json({
        success: true,
        message: "Declarations fetched",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

// HR reviews and approves/rejects declaration
router.patch("/review/:declarationId",
  checkRole("hr_manager"),
  validate(reviewDeclarationSchema),
  async (req, res, next) => {
    try {
      const result = await investmentDeclarationService.reviewDeclaration(
        req.params.declarationId,
        req.body,
        req.user
      );
      res.json({
        success: true,
        message: "Declaration reviewed",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

// Lock declaration after approval
router.post("/lock/:declarationId",
  checkRole("hr_manager"),
  async (req, res, next) => {
    try {
      const result = await investmentDeclarationService.lockDeclaration(
        req.params.declarationId,
        req.user
      );
      res.json({
        success: true,
        message: "Declaration locked",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function getEmployeeFromUser(user) {
  const Employee = require("../employee/models/employee.model");
  const employee = await Employee.findOne({
    userId: user.userId,
    company_id: user.companyId,
    isDeleted: false,
  }).select("_id");
  
  if (!employee) {
    throw new Error("Employee record not found");
  }
  
  return employee;
}

module.exports = router;
