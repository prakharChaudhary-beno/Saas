// modules/payrollPolicy/middlewares/checkInvestmentConfig.js
// Middleware to check if investment declaration is enabled in payroll policy

"use strict";

const PayrollPolicy = require("../models/payrollPolicy.model");
const AppError = require("../../../utils/appError");

/**
 * Check if investment declaration is enabled in the active payroll policy
 */
exports.checkInvestmentEnabled = async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const unitId = req.user.unitId || req.user.unit_id;

    if (!companyId) {
      return next(new AppError("Company context required", 400));
    }

    // Find active payroll policy for this company/unit
    const query = {
      company_id: companyId,
      status: "active",
      isDeleted: { $ne: true }
    };

    // If unit context exists, check unit-specific policy first
    if (unitId) {
      query.unit_id = unitId;
    } else {
      // Company-level policy (unit_id = null)
      query.unit_id = null;
    }

    const policy = await PayrollPolicy.findOne(query);

    if (!policy) {
      return next(new AppError("No active payroll policy found. Please contact your administrator.", 403));
    }

    // Check if investment config is enabled
    if (!policy.investmentConfig || policy.investmentConfig.enabled !== true) {
      return next(new AppError("Investment declaration feature is not enabled in your payroll policy. Please contact HR.", 403));
    }

    // Store policy in request for later use
    req.payrollPolicy = policy;
    
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Optional check - doesn't block if no policy found, but uses if exists
 */
exports.checkInvestmentOptional = async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const unitId = req.user.unitId || req.user.unit_id;

    if (!companyId) {
      return next();
    }

    const query = {
      company_id: companyId,
      status: "active",
      isDeleted: { $ne: true }
    };

    if (unitId) {
      query.unit_id = unitId;
    } else {
      query.unit_id = null;
    }

    const policy = await PayrollPolicy.findOne(query);

    if (policy && policy.investmentConfig && policy.investmentConfig.enabled === true) {
      req.payrollPolicy = policy;
      req.investmentEnabled = true;
    } else {
      req.investmentEnabled = false;
    }
    
    next();
  } catch (err) {
    next();
  }
};
