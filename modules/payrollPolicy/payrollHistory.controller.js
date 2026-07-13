// modules/payrollPolicy/payrollHistory.controller.js

"use strict";

const historyService = require("./payrollHistory.service");

// GET /api/v1/payroll-policies/history
exports.getPayrollHistory = async (req, res, next) => {
  try {
    const data = await historyService.getPayrollHistory(req.query, req.user);
    res.json({ success: true, message: "Payroll history fetched", data });
  } catch (err) {
    next(err);
  }
};
