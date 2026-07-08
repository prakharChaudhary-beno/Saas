// modules/payrollPolicy/investmentDeclaration.service.js
// Service for managing employee investment declarations

"use strict";

const InvestmentDeclaration = require("./models/investmentDeclaration.model");
const AppError = require("../../utils/appError");

// ─── Create or Update Investment Declaration ─────────────────────────────────
exports.upsertDeclaration = async (employeeId, company_id, org_id, data, user) => {
  const { financialYear, taxRegime, investments, hraExemption, ltaClaims } = data;

  // Normalize investment items - support both frontend field names
  const normalizedInvestments = (investments || []).map(item => ({
    section: item.section,
    subcategory: item.subcategory || item.type || 'General',
    declaredAmount: item.declaredAmount || item.amount || 0,
    approvedAmount: item.approvedAmount || 0,
    proofDocuments: item.proofDocuments || [],
    proofSubmitted: item.proofSubmitted || false,
    proofVerified: item.proofVerified || false,
    remark: item.remark || item.declaration || ''
  }));

  // Check if declaration already exists for this FY
  let declaration = await InvestmentDeclaration.findOne({
    employee_id: employeeId,
    company_id,
    financialYear,
  });

  if (declaration && declaration.isLocked) {
    throw new AppError("Declaration is locked and cannot be modified", 403);
  }

  if (declaration) {
    // Update existing
    declaration.taxRegime = taxRegime || declaration.taxRegime;
    declaration.regimeDeclaredAt = new Date();
    declaration.investments = normalizedInvestments.length > 0 ? normalizedInvestments : declaration.investments;
    declaration.hraExemption = hraExemption || declaration.hraExemption;
    declaration.ltaClaims = ltaClaims || declaration.ltaClaims;
    declaration.status = 'DRAFT';
    declaration.updatedBy = user.userId;

    await declaration.save();
  } else {
    // Create new
    declaration = await InvestmentDeclaration.create({
      org_id,
      company_id,
      unit_id: user.unitId || user.unit_id, // Save unit_id from user context
      employee_id: employeeId,
      financialYear,
      taxRegime: taxRegime || 'new',
      regimeDeclaredAt: new Date(),
      investments: normalizedInvestments,
      hraExemption: hraExemption || {},
      ltaClaims: ltaClaims || [],
      status: 'DRAFT',
      createdBy: user.userId,
      updatedBy: user.userId,
    });
  }

  return declaration;
};

// ─── Submit Declaration ─────────────────────────────────────────────────────
exports.submitDeclaration = async (employeeId, company_id, financialYear, user) => {
  const declaration = await InvestmentDeclaration.findOne({
    employee_id: employeeId,
    company_id,
    financialYear,
  });

  if (!declaration) {
    throw new AppError("Declaration not found. Please save your declaration first.", 404);
  }

  if (declaration.status === 'SUBMITTED') {
    throw new AppError("Declaration already submitted", 400);
  }

  if (declaration.status === 'APPROVED' || declaration.status === 'LOCKED') {
    throw new AppError("Declaration already approved/locked and cannot be modified", 400);
  }

  declaration.status = 'SUBMITTED';
  declaration.submittedAt = new Date();
  declaration.updatedBy = user.userId;

  await declaration.save();

  return declaration;
};

// ─── Upload Proof ────────────────────────────────────────────────────────────
exports.uploadProof = async (employeeId, company_id, financialYear, investmentId, proofData, user) => {
  const declaration = await InvestmentDeclaration.findOne({
    employee_id: employeeId,
    company_id,
    financialYear,
  });

  if (!declaration) {
    throw new AppError("Declaration not found", 404);
  }

  // If no specific investmentId, add proof to declaration level
  if (!investmentId) {
    declaration.proofDocuments = declaration.proofDocuments || [];
    declaration.proofDocuments.push({
      filename: proofData.documentName || proofData.filename,
      url: proofData.documentUrl || proofData.url,
      uploadedAt: new Date(),
    });
    declaration.updatedBy = user.userId;
    await declaration.save();
    return declaration;
  }

  const investment = declaration.investments.id(investmentId);
  if (!investment) {
    throw new AppError("Investment item not found", 404);
  }

  investment.proofDocuments.push({
    filename: proofData.documentName || proofData.filename,
    url: proofData.documentUrl || proofData.url,
    uploadedAt: new Date(),
  });

  investment.proofSubmitted = true;
  declaration.status = 'SUBMITTED';
  declaration.updatedBy = user.userId;

  await declaration.save();

  return declaration;
};

// ─── Review Declaration (HR/Admin) ───────────────────────────────────────────
exports.reviewDeclaration = async (declarationId, reviewData, user) => {
  const declaration = await InvestmentDeclaration.findById(declarationId);

  if (!declaration) {
    throw new AppError("Declaration not found", 404);
  }

  const { investments, status, remarks } = reviewData;

  // Update each investment item
  if (investments && Array.isArray(investments)) {
    for (const invUpdate of investments) {
      const investment = declaration.investments.id(invUpdate._id);
      if (investment) {
        investment.approvedAmount = invUpdate.approvedAmount;
        investment.proofVerified = invUpdate.approvedAmount > 0;
        investment.remark = invUpdate.remark || '';
        investment.proofDocuments.forEach(doc => {
          if (!doc.verifiedAt) {
            doc.verifiedAt = new Date();
            doc.verifiedBy = user.userId;
          }
        });
      }
    }
  }

  declaration.status = status;
  declaration.reviewedAt = new Date();
  declaration.reviewedBy = user.userId;
  declaration.updatedBy = user.userId;

  await declaration.save();

  return declaration;
};

// ─── Get Employee's Declaration ──────────────────────────────────────────────
exports.getEmployeeDeclaration = async (employeeId, company_id, financialYear) => {
  const declaration = await InvestmentDeclaration.findOne({
    employee_id: employeeId,
    company_id,
    financialYear,
  })
    .populate('employee_id', 'name employeeId email')
    .populate('reviewedBy', 'name email')
    .lean();

  if (!declaration) {
    return null;
  }

  // Calculate tax exemptions if method exists
  let calculatedExemptions = null;
  try {
    const doc = new InvestmentDeclaration(declaration);
    if (typeof doc.calculateTaxExemption === 'function') {
      calculatedExemptions = doc.calculateTaxExemption();
    }
  } catch (err) {
    console.log('Tax calculation skipped:', err.message);
  }

  return {
    ...declaration,
    calculatedExemptions,
  };
};

// ─── Get All Declarations for Review (HR/Admin) ─────────────────────────────
exports.getDeclarationsForReview = async (company_id, unit_id, query = {}) => {
  const { status, financialYear, page = 1, limit = 20 } = query;

  const filter = { company_id };
  
  // Only filter by unit_id if specifically provided and not 'all'
  // Handles both new declarations (with unit_id) and legacy declarations (without unit_id)
  if (unit_id && unit_id !== 'all') {
    filter.$or = [
      { unit_id: unit_id },
      { unit_id: { $exists: false } }  // Include legacy declarations without unit_id
    ];
  }
  if (status) filter.status = status;
  if (financialYear) filter.financialYear = financialYear;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [declarations, total] = await Promise.all([
    InvestmentDeclaration.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('employee_id', 'name employeeId email departmentId designationId')
      .populate('reviewedBy', 'name email')
      .lean(),
    InvestmentDeclaration.countDocuments(filter),
  ]);

  return {
    declarations,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit)),
    },
  };
};

// ─── Lock Declaration (prevent further edits) ────────────────────────────────
exports.lockDeclaration = async (declarationId, user) => {
  const declaration = await InvestmentDeclaration.findById(declarationId);

  if (!declaration) {
    throw new AppError("Declaration not found", 404);
  }

  if (declaration.status !== 'APPROVED') {
    throw new AppError("Only approved declarations can be locked", 400);
  }

  declaration.isLocked = true;
  declaration.lockedAt = new Date();
  declaration.updatedBy = user.userId;

  await declaration.save();

  return declaration;
};
