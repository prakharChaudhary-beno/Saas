// modules/payrollPolicy/payrollRun.controller.js
// FIXED — tenantId → companyId + unitId

const payrollRunService = require("./payrollRun.service");

// POST /payroll-policies/run/:employeeId
exports.runForEmployee = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const { month }      = req.body;

    if (!month) {
      return res.status(400).json({ success: false, message: "month is required (YYYY-MM)" });
    }

    const payslip = await payrollRunService.runForEmployee(
      employeeId,
      req.user.companyId,
      req.user.unitId,
      month,
      req.user
    );

    res.json({ success: true, message: "Payroll computed successfully", data: payslip });
  } catch (err) { next(err); }
};

// POST /payroll-policies/run
exports.runForTenant = async (req, res, next) => {
  try {
    const { month } = req.body;

    if (!month) {
      return res.status(400).json({ success: false, message: "month is required (YYYY-MM)" });
    }

    const result = await payrollRunService.runForTenant(
      req.user.companyId,
      req.user.unitId,
      month,
      req.user.userId,
      req.user
    );

    res.json({
      success: true,
      message: `Payroll run complete. Processed: ${result.summary.processed}, Failed: ${result.summary.failed}`,
      data: result,
    });
  } catch (err) { next(err); }
};