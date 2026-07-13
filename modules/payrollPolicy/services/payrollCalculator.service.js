// modules/payrollPolicy/services/payrollCalculator.service.js
// Enterprise-Grade Payroll Calculator with Full Tax Compliance
// Supports: PF, ESI, TDS (Old/New Regime), PT, LWF, LOP, Overtime, Gratuity

"use strict";

const mongoose = require("mongoose");
const { calculatePT } = require("../../../config/ptSlabs");
const { calculateTDSOldRegime, calculateTDSNewRegime, compareTaxRegimes, STANDARD_DEDUCTION } = require("../../../config/tdsSlabs");
const AppError = require("../../../utils/appError");
const Employee = require("../../employee/models/employee.model");
const Attendance = require("../../attendance/models/attendance.model");
const InvestmentDeclaration = require("../models/investmentDeclaration.model");
const CompanyConfig = require("../../companyConfig/models/companyConfig.model");

// ─── Main Payroll Calculator ────────────────────────────────────────────────────
exports.calculatePayroll = async (employeeId, company_id, unit_id, year, month, options = {}) => {
  const { policy, config, skipTDS = false, investmentOverride = null } = options;

  // ── Load Employee Data ──────────────────────────────────────────────
  const employee = await Employee.findOne({
    _id: employeeId,
    company_id,
    isDeleted: false,
  }).populate('departmentId designationId');

  if (!employee) {
    throw new AppError("Employee not found", 404);
  }

  // ── Get Attendance Summary ─────────────────────────────────────────
  const attendanceSummary = await _getAttendanceSummary(employeeId, company_id, year, month);

  // ── Calculate Salary Components ─────────────────────────────────────
  const salaryComponents = await _calculateSalaryComponents(employee, policy, config, attendanceSummary, year, month);

  // ── Calculate Deductions ───────────────────────────────────────────
  const deductions = await _calculateDeductions(employee, policy, config, salaryComponents, year, month, investmentOverride);

  // ── Calculate Taxes ─────────────────────────────────────────────────
  const taxes = skipTDS ? { tds: 0, taxBreakdown: null } : await _calculateTaxes(employee, policy, salaryComponents, deductions, year, investmentOverride);

  // ── Final Net Salary ────────────────────────────────────────────────
  const grossSalary = salaryComponents.totalEarnings;
  const totalDeductions = deductions.totalDeductions + taxes.tds;
  const netSalary = Math.max(0, grossSalary - totalDeductions);

  return {
    employee: {
      _id: employee._id,
      name: employee.name,
      employeeId: employee.employeeId,
      department: employee.departmentId?.name,
      designation: employee.designationId?.name,
      employmentType: employee.employmentType,
      joiningDate: employee.joiningDate,
    },
    period: { year, month },
    earnings: salaryComponents.earnings,
    deductions: deductions.deductions,
    taxes: taxes.deductions,
    grossSalary,
    grossAfterLOP: salaryComponents.grossAfterLOP,
    totalDeductions,
    netSalary,
    attendance: attendanceSummary,
    overtime: salaryComponents.overtime,
    proRata: salaryComponents.proRata,
    taxBreakdown: taxes.taxBreakdown,
  };
};

// ─── Attendance Summary ────────────────────────────────────────────────────
async function _getAttendanceSummary(employeeId, company_id, year, month) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1) - 1);

  const summary = await Attendance.aggregate([
    {
      $match: {
        employeeId: new mongoose.Types.ObjectId(String(employeeId)),
        company_id: new mongoose.Types.ObjectId(String(company_id)),
        date: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: null,
        present: { $sum: { $cond: [{ $in: ["$status", ["PRESENT", "WFH", "LATE"]] }, 1, 0] } },
        halfDay: { $sum: { $cond: [{ $eq: ["$status", "HALF_DAY"] }, 0.5, 0] } },
        onLeave: { $sum: { $cond: [{ $eq: ["$status", "ON_LEAVE"] }, 1, 0] } },
        holiday: { $sum: { $cond: [{ $eq: ["$status", "HOLIDAY"] }, 1, 0] } },
        weeklyOff: { $sum: { $cond: [{ $eq: ["$status", "WEEKLY_OFF"] }, 1, 0] } },
        absent: { $sum: { $cond: [{ $eq: ["$status", "ABSENT"] }, 1, 0] } },
        overtimeHours: { $sum: { $ifNull: ["$overtimeHours", 0] } },
      },
    },
  ]);

  const att = summary[0] || { present: 0, halfDay: 0, onLeave: 0, holiday: 0, weeklyOff: 0, absent: 0, overtimeHours: 0 };

  // Calculate working days (present days + holidays + weekly offs)
  const daysPresent = att.present + att.halfDay + att.holiday + att.weeklyOff;

  // Total calendar days in month
  const totalDaysInMonth = new Date(year, month, 0).getDate();

  const workingDaysInMonth = _calculateWorkingDaysInMonth(year, month);

  // LOP days = Total working days - Days present
  const lopDays = Math.max(0, workingDaysInMonth - daysPresent - att.onLeave);

  return {
    ...att,
    daysPresent: parseFloat(daysPresent.toFixed(1)),
    lopDays: parseFloat(lopDays.toFixed(2)),
    totalDaysInMonth,
    workingDaysInMonth,
  };
}

// ─── Calculate Working Days in Month ────────────────────────────────────────
function _calculateWorkingDaysInMonth(year, month, workDays = ["MON", "TUE", "WED", "THU", "FRI"]) {
  const dayMap = { 0: "SUN", 1: "MON", 2: "TUE", 3: "WED", 4: "THU", 5: "FRI", 6: "SAT" };
  const total = new Date(year, month, 0).getDate();
  let count = 0;

  for (let d = 1; d <= total; d++) {
    const dayName = dayMap[new Date(year, month - 1, d).getDay()];
    if (workDays.includes(dayName)) count++;
  }

  return count;
}

// ─── Calculate Salary Components ────────────────────────────────────────────
async function _calculateSalaryComponents(employee, policy, config, attendance, year, month) {
  const salary = employee.salary || {};
  
  // Base salary components (from employee record)
  const baseComponents = {
    basic: salary.basic || 0,
    hra: salary.hra || 0,
    conveyance: salary.conveyance || 0,
    medicalAllowance: salary.medicalAllowance || 0,
    specialAllowance: salary.specialAllowance || 0,
    lta: salary.lta || 0,
    otherAllowances: salary.otherAllowances || 0,
  };

  // Calculate gross before LOP
  const grossBeforeLOP = Object.values(baseComponents).reduce((sum, val) => sum + val, 0);

  // ── Pro-Rata Calculation (mid-month joiners/exiters) ───────────────────────
  let proRataFactor = 1;
  const proRataDetails = { applied: false, reason: null, daysWorked: null, totalDays: attendance.totalDaysInMonth };

  if (employee.joiningDate) {
    const joiningDate = new Date(employee.joiningDate);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);

    // Joined mid-month
    if (joiningDate >= monthStart && joiningDate <= monthEnd) {
      const daysWorked = monthEnd.getDate() - joiningDate.getDate() + 1;
      proRataFactor = daysWorked / attendance.totalDaysInMonth;
      proRataDetails.applied = true;
      proRataDetails.reason = 'MID_MONTH_JOINING';
      proRataDetails.daysWorked = daysWorked;
    }
  }

  // Exited mid-month
  if (employee.exitDate) {
    const exitDate = new Date(employee.exitDate);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);

    if (exitDate >= monthStart && exitDate <= monthEnd) {
      const daysWorked = exitDate.getDate();
      proRataFactor = daysWorked / attendance.totalDaysInMonth;
      proRataDetails.applied = true;
      proRataDetails.reason = 'MID_MONTH_EXIT';
      proRataDetails.daysWorked = daysWorked;
    }
  }

  // Apply pro-rata to all base components
  const earnings = {};
  for (const [key, value] of Object.entries(baseComponents)) {
    earnings[key] = parseFloat((value * proRataFactor).toFixed(2));
  }

  // ── LOP Deduction ────────────────────────────────────────────────────────
  let lopDeduction = 0;
  const lopDays = attendance.lopDays;
  
  if (lopDays > 0 && policy?.lop?.enabled !== false) {
    const dailySalary = attendance.totalDaysInMonth > 0 ? grossBeforeLOP / attendance.totalDaysInMonth : 0;
    lopDeduction = parseFloat((lopDays * dailySalary).toFixed(2));
  }

  // ── Overtime Pay ──────────────────────────────────────────────────────────
  let overtimePay = 0;
  const overtimeHours = attendance.overtimeHours || 0;

  if (overtimeHours > 0 && policy?.overtimePay?.enabled) {
    const hourlyBasic = baseComponents.basic / attendance.workingDaysInMonth / 8;
    const rateMultiplier = policy.overtimePay.rateMultiplier || 1.5;
    overtimePay = parseFloat((overtimeHours * hourlyBasic * rateMultiplier).toFixed(2));
  }

  // Add overtime to earnings
  if (overtimePay > 0) {
    earnings.overtime = overtimePay;
  }

  // Total earnings
  const totalEarnings = Object.values(earnings).reduce((sum, val) => sum + val, 0);

  // Gross after LOP
  const grossAfterLOP = parseFloat((totalEarnings - lopDeduction).toFixed(2));

  return {
    earnings,
    totalEarnings,
    grossBeforeLOP,
    lopDeduction,
    grossAfterLOP,
    overtime: {
      hours: overtimeHours,
      rate: policy?.overtimePay?.rateMultiplier || 1.5,
      amount: overtimePay,
    },
    proRata: proRataDetails,
    baseComponents, // For reference
  };
}

// ─── Calculate Deductions (PF, ESI, PT, LWF) ────────────────────────────────
async function _calculateDeductions(employee, policy, config, salaryComponents, year, month) {
  const { earnings, grossAfterLOP } = salaryComponents;
  const deductions = {};
  const taxCompliance = policy?.taxCompliance || {};

  // ── PF Calculation ────────────────────────────────────────────────────────
  let pfEmployee = 0;
  let pfEmployer = 0;

  if (taxCompliance.pfEnabled !== false) {
    const pfRate = (taxCompliance.pfEmployeeRate ?? 12) / 100;
    const pfEmployerRate = (taxCompliance.pfEmployerRate ?? 12) / 100;
    const pfCeiling = taxCompliance.pfCeilingAmount ?? 15000;
    const basic = earnings.basic || 0;

    // Apply on actual basic or capped
    const pfBase = taxCompliance.pfApplyOnActualBasic ? basic : Math.min(basic, pfCeiling);

    pfEmployee = parseFloat((pfBase * pfRate).toFixed(2));
    pfEmployer = parseFloat((pfBase * pfEmployerRate).toFixed(2));
  }

  deductions.pf = pfEmployee;

  // ── ESI Calculation ────────────────────────────────────────────────────────
  let esiEmployee = 0;
  let esiEmployer = 0;

  const grossBeforeLOP = salaryComponents.grossBeforeLOP;
  const esiWageCeiling = taxCompliance.esiWageCeiling ?? 21000;

  if (taxCompliance.esiEnabled !== false && grossBeforeLOP <= esiWageCeiling) {
    const esiEmployeeRate = (taxCompliance.esiEmployeeRate ?? 0.75) / 100;
    const esiEmployerRate = (taxCompliance.esiEmployerRate ?? 3.25) / 100;

    esiEmployee = parseFloat((grossBeforeLOP * esiEmployeeRate).toFixed(2));
    esiEmployer = parseFloat((grossBeforeLOP * esiEmployerRate).toFixed(2));
  }

  deductions.esi = esiEmployee;

  // ── Professional Tax ───────────────────────────────────────────────────────
  let pt = 0;

  if (taxCompliance.ptEnabled !== false) {
    const ptState = taxCompliance.ptState || employee.currentAddress?.state || 'KA';
    pt = calculatePT(ptState, grossAfterLOP);
  }

  deductions.professionalTax = pt;

  // ── Labour Welfare Fund ────────────────────────────────────────────────────
  let lwfEmployee = 0;
  let lwfEmployer = 0;

  if (taxCompliance.lwfEnabled) {
    lwfEmployee = taxCompliance.lwfEmployeeRate || 0;
    lwfEmployer = taxCompliance.lwfEmployerRate || 0;
  }

  deductions.lwf = lwfEmployee;

  // ── LOP Deduction ──────────────────────────────────────────────────────────
  if (salaryComponents.lopDeduction > 0) {
    deductions.lop = salaryComponents.lopDeduction;
  }

  // ── Advance/Loan Recovery ───────────────────────────────────────────────────
  // TODO: Implement advance/loan deduction logic
  deductions.advance = 0;

  // ── Total Deductions (excluding TDS) ────────────────────────────────────────
  const totalDeductions = Object.values(deductions).reduce((sum, val) => sum + val, 0);

  return {
    deductions,
    totalDeductions,
    employerContributions: {
      pf: pfEmployer,
      esi: esiEmployer,
      lwf: lwfEmployer,
      gratuity: policy?.taxCompliance?.gratuityEnabled ? (earnings.basic * (policy.taxCompliance.gratuityRate || 4.81) / 100) : 0,
    },
  };
}

// ─── Calculate TDS (Tax Deducted at Source) ────────────────────────────────
async function _calculateTaxes(employee, policy, salaryComponents, deductions, year, investmentOverride) {
  const { earnings } = salaryComponents;

  // Get employee's age group
  const ageGroup = _getAgeGroup(employee.dateOfBirth);

  // Determine tax regime
  const taxRegime = policy?.taxConfig?.taxRegime || 'new';

  // Get investments for the financial year
  const fy = _getFinancialYear(year, month);
  
  let investments = investmentOverride;

  if (!investments) {
    const declaration = await InvestmentDeclaration.findOne({
      employee_id: employee._id,
      financialYear: fy,
      status: { $in: ['SUBMITTED', 'APPROVED', 'DECLARED'] },
    });

    if (declaration) {
      investments = declaration.calculateTaxExemption();
      investments.regime = declaration.taxRegime;
    }
  }

  // Calculate annual taxable income
  const monthlyGross = earnings.basic + earnings.hra + (earnings.conveyance || 0) + (earnings.medicalAllowance || 0) + (earnings.specialAllowance || 0);
  const annualGross = monthlyGross * 12;

  // Old regime taxable income (with exemptions)
  let oldRegimeTaxableIncome = annualGross;
  
  if (investments && (taxRegime === 'old' || !investments.regime || investments.regime === 'old')) {
    oldRegimeTaxableIncome = annualGross
      - STANDARD_DEDUCTION * 12 // Standard deduction
      - Math.min(investments.total80C || 0, 150000)
      - Math.min(investments.total80CCD || 0, 50000)
      - Math.min(investments.total80D || 0, 75000)
      - (investments.total80E || 0)
      - Math.min(investments.total80EEA || 0, 150000)
      - Math.min(investments.total80TTA || 0, 10000)
      - (deductions.deductions.professionalTax || 0) * 12
      - (investments.hraExemption || 0)
      - (investments.ltaExemption || 0);
    
    oldRegimeTaxableIncome = Math.max(0, oldRegimeTaxableIncome);
  }

  // New regime taxable income (minimal exemptions)
  const newRegimeTaxableIncome = annualGross - STANDARD_DEDUCTION * 12;

  // Calculate TDS based on regime
  let tdsCalculation;
  
  if (taxRegime === 'old' || (investments && investments.regime === 'old')) {
    tdsCalculation = calculateTDSOldRegime(oldRegimeTaxableIncome, ageGroup);
  } else {
    tdsCalculation = calculateTDSNewRegime(newRegimeTaxableIncome);
  }

  const monthlyTDS = Math.ceil(tdsCalculation.totalTax / 12);

  return {
    tds: monthlyTDS,
    deductions: {
      tds: monthlyTDS,
    },
    taxBreakdown: {
      regime: taxRegime,
      annualGross,
      annualTaxableIncome: taxRegime === 'old' ? oldRegimeTaxableIncome : newRegimeTaxableIncome,
      grossTax: tdsCalculation.grossTax,
      rebate87A: tdsCalculation.rebate87A,
      surcharge: tdsCalculation.surcharge,
      cess: tdsCalculation.cess,
      totalAnnualTax: tdsCalculation.totalTax,
      monthlyTDS,
    },
  };
}

// ─── Helper: Get Age Group ──────────────────────────────────────────────────
function _getAgeGroup(dateOfBirth) {
  if (!dateOfBirth) return 'general';

  const age = Math.floor((new Date() - new Date(dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000));

  if (age >= 80) return 'super_senior';
  if (age >= 60) return 'senior';
  return 'general';
}

// ─── Helper: Get Financial Year ─────────────────────────────────────────────
function _getFinancialYear(year, month) {
  // In India, FY starts from April
  if (month >= 4) {
    return `${year}-${(year + 1).toString().slice(-2)}`;
  } else {
    return `${year - 1}-${year.toString().slice(-2)}`;
  }
}

module.exports._getAttendanceSummary = _getAttendanceSummary;
module.exports._calculateSalaryComponents = _calculateSalaryComponents;
module.exports._calculateDeductions = _calculateDeductions;
module.exports._calculateTaxes = _calculateTaxes;
