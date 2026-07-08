// modules/payrollPolicy/payrollRun.service.js
// T-30 — Complete Payroll Run Engine
// Handles: PF, ESI, TDS, LOP, Pro-rata, Payslip generation

"use strict";
const lockService = require("./payrollLock.service");

const AppError               = require("../../utils/appError");
const { resolvePayrollPolicy } = require("../../utils/policyResolver");
const Employee               = require("../employee/models/employee.model");
const Attendance             = require("../attendance/models/attendance.model");
const LeaveBalance           = require("../leave/models/leaveBalance.models");
const CompanyConfig          = require("../companyConfig/models/companyConfig.model");
const Payslip                = require("./models/payslip.model");
const InvestmentDeclaration  = require("./models/investmentDeclaration.model");
const mongoose               = require("mongoose");

// ─── Parse "YYYY-MM" → { year, month, start, end } ───────────
const parseMonth = (monthStr) => {
  if (!/^\d{4}-\d{2}$/.test(monthStr)) {
    throw new AppError('month must be "YYYY-MM"', 400);
  }
  const [year, month] = monthStr.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end   = new Date(Date.UTC(year, month, 1) - 1);
  return { year, month, start, end };
};

// ─── Calendar days in month ───────────────────────────────────
const daysInMonth = (year, month) => new Date(year, month, 0).getDate();

// ─── Working days in month (Mon-Fri) ─────────────────────────
const workingDaysInMonth = (year, month, workDays = ["MON","TUE","WED","THU","FRI"]) => {
  const dayMap = { 0: "SUN", 1: "MON", 2: "TUE", 3: "WED", 4: "THU", 5: "FRI", 6: "SAT" };
  const total  = daysInMonth(year, month);
  let count = 0;
  for (let d = 1; d <= total; d++) {
    const dayName = dayMap[new Date(year, month - 1, d).getDay()];
    if (workDays.includes(dayName)) count++;
  }
  return count;
};

// ─────────────────────────────────────────────────────────────────────────────
// CALCULATE PAYROLL FOR ONE EMPLOYEE
// ─────────────────────────────────────────────────────────────────────────────

const calculateForEmployee = async (employee, company_id, unit_id, year, month, policy, config) => {
  const { start, end } = parseMonth(`${year}-${String(month).padStart(2, "0")}`);

  const totalWorkingDays = workingDaysInMonth(year, month, config?.workWeek);

  // ── Attendance summary ──────────────────────────────────────
  const attendanceSummary = await Attendance.aggregate([
    {
      $match: {
        employeeId: employee._id,
        company_id: new mongoose.Types.ObjectId(String(company_id)),
        date:       { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id:           null,
        present:       { $sum: { $cond: [{ $in: ["$status", ["PRESENT", "WFH", "LATE"]] }, 1, 0] } },
        halfDay:       { $sum: { $cond: [{ $eq: ["$status", "HALF_DAY"] }, 0.5, 0] } },
        onLeave:       { $sum: { $cond: [{ $eq: ["$status", "ON_LEAVE"] }, 1, 0] } },
        holiday:       { $sum: { $cond: [{ $eq: ["$status", "HOLIDAY"] }, 1, 0] } },
        overtimeHours: { $sum: { $ifNull: ["$overtimeHours", 0] } },
      },
    },
  ]);

  const att          = attendanceSummary[0] || { present: 0, halfDay: 0, onLeave: 0, holiday: 0, overtimeHours: 0 };
  const daysPresent  = att.present + att.halfDay + att.onLeave + att.holiday;
  const lopDays      = Math.max(0, totalWorkingDays - daysPresent);

  // ── Pro-rata (mid-month joiners/exiters) ─────────────────────
  let proRataFactor = 1;
  if (employee.joiningDate) {
    const joinDate = new Date(employee.joiningDate);
    if (joinDate > start && joinDate <= end) {
      // Joined mid-month
      const daysFromJoin = totalWorkingDays - (workingDaysInMonth(year, month, config?.workWeek) -
        workingDaysInMonth(year, month, config?.workWeek, joinDate));
      proRataFactor = daysPresent / totalWorkingDays;
    }
  }

  const salary = employee.salary;
  const basic  = (salary?.basic || 0) * proRataFactor;
  const hra    = (salary?.hra   || 0) * proRataFactor;
  const travel = (salary?.travelAllowance  || 0) * proRataFactor;
  const medical= (salary?.medicalAllowance || 0) * proRataFactor;
  const special= (salary?.specialAllowance || 0) * proRataFactor;

  // ── LOP deduction ────────────────────────────────────────────
  const dailySalary   = totalWorkingDays > 0 ? (basic + hra + travel + medical + special) / totalWorkingDays : 0;
  const lopDeduction  = parseFloat((lopDays * dailySalary).toFixed(2));

  // ── Overtime pay ─────────────────────────────────────────────
 const hourlyBasic = basic / 26 / 8; // 26 working days, 8 hours/day
const overtimePay = policy?.overtimePay?.enabled
  ? parseFloat(((att.overtimeHours || 0) * (policy.overtimePay.rateMultiplier || 1.5) * hourlyBasic).toFixed(2))
  : 0;

  // ── Gross salary ─────────────────────────────────────────────
  const grossBeforeLOP = parseFloat((basic + hra + travel + medical + special + overtimePay).toFixed(2));
  const grossSalary    = parseFloat((grossBeforeLOP - lopDeduction).toFixed(2));

  // ── PF calculation ───────────────────────────────────────────
  // Employee: 12% of Basic | Employer: 12% of Basic
const taxC        = policy?.taxCompliance || {};
const pfConfig    = {
  enabled:      taxC.pfEnabled !== false,
  employeeRate: taxC.pfEmployeeRate ?? 12,
  employerRate: taxC.pfEmployerRate ?? 12,
  ceiling:      taxC.pfCeilingAmount ?? 15000,
};  let pfEmployee    = 0;
  let pfEmployer    = 0;
  if (pfConfig?.enabled !== false) {
    const pfRate    = (pfConfig?.employeeRate  ?? 12) / 100;
    const empRate   = (pfConfig?.employerRate  ?? 12) / 100;
    const pfCeiling = pfConfig?.ceiling ?? null;
    const pfBase    = pfCeiling ? Math.min(basic, pfCeiling) : basic;
    pfEmployee      = parseFloat((pfBase * pfRate).toFixed(2));
    pfEmployer      = parseFloat((pfBase * empRate).toFixed(2));
  }

  // ── ESI calculation ──────────────────────────────────────────
  // Applicable only if gross < 21,000
  const esiConfig    = policy?.taxCompliance?.esi;
  let esiEmployee    = 0;
if ((esiConfig?.enabled !== false) && grossBeforeLOP < 21000) {
    const esiRate  = (esiConfig?.employeeRate ?? 0.75) / 100;
   esiEmployee = parseFloat((grossBeforeLOP * esiRate).toFixed(2));
  }

  // ── Professional Tax (State-wise) ─────────────────────────────────────────
  const { calculatePT } = require("../../config/ptSlabs");
  const ptState = policy?.taxCompliance?.ptState || employee?.location?.state || 'KA';
  const professionalTax = calculatePT(ptState, grossSalary);

  // ── TDS Calculation (Old/New Regime) ──────────────────────────────────────
  const { calculateTDSOldRegime, calculateTDSNewRegime, STANDARD_DEDUCTION } = require("../../config/tdsSlabs");
  const InvestmentDeclaration = require("./models/investmentDeclaration.model");
  
  let tds = 0;
  let taxBreakdown = null;
  
  if (policy?.tdsConfig?.enabled !== false) {
    try {
      // Get investment declaration for tax exemption
      const financialYear = year >= 4 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
      const declaration = await InvestmentDeclaration.findOne({
        employee_id: employee._id,
        financialYear,
        status: { $in: ["APPROVED", "LOCKED"] }
      }).lean();
      
      const investments = declaration?.investments || [];
      const totalExemption = investments.reduce((sum, inv) => sum + (inv.approvedAmount || inv.declaredAmount || 0), 0);
      
      // Annual taxable income
      const annualGross = grossSalary * 12;
      const taxableIncome = Math.max(0, annualGross - STANDARD_DEDUCTION - totalExemption);
      
      // Calculate age for senior citizen exemption
      const age = employee.dateOfBirth ? Math.floor((new Date() - new Date(employee.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000)) : 30;
      const ageGroup = age >= 80 ? 'super_senior' : age >= 60 ? 'senior' : 'general';
      
      const regime = policy?.tdsConfig?.taxRegime || 'new';
      
      if (regime === 'new') {
        const tdsCalc = calculateTDSNewRegime(taxableIncome);
        tds = tdsCalc.monthlyTDS;
        taxBreakdown = tdsCalc;
      } else {
        const tdsCalc = calculateTDSOldRegime(taxableIncome, ageGroup);
        tds = tdsCalc.monthlyTDS;
        taxBreakdown = tdsCalc;
      }
    } catch (err) {
      console.error('TDS calculation error:', err.message);
      tds = 0; // Fallback to 0 if calculation fails
    }
  }

  // ── Net salary ───────────────────────────────────────────────
  const totalDeductions = parseFloat((pfEmployee + esiEmployee + tds + professionalTax + lopDeduction).toFixed(2));
  const netSalary       = parseFloat((grossSalary - (pfEmployee + esiEmployee + tds + professionalTax)).toFixed(2));

  // ── Calculate YTD (Year-to-Date) ─────────────────────────────────────────
  const ytdPayslips = await Payslip.find({
    employee_id: employee._id,
    year,
    month: { $lte: month },
    status: { $ne: "DRAFT" }
  }).lean();
  
  const ytd = {
    earnings: {
      basic: 0,
      hra: 0,
      travelAllowance: 0,
      medicalAllowance: 0,
      specialAllowance: 0,
      overtime: 0,
      bonus: 0,
      arrears: 0,
      totalEarnings: 0,
    },
    deductions: {
      pf: 0,
      esi: 0,
      tds: 0,
      professionalTax: 0,
      lop: 0,
      totalDeductions: 0,
    }
  };
  
  // Sum up previous months
  ytdPayslips.forEach(slip => {
    ytd.earnings.basic += slip.earnings?.basic || 0;
    ytd.earnings.hra += slip.earnings?.hra || 0;
    ytd.earnings.travelAllowance += slip.earnings?.travelAllowance || 0;
    ytd.earnings.medicalAllowance += slip.earnings?.medicalAllowance || 0;
    ytd.earnings.specialAllowance += slip.earnings?.specialAllowance || 0;
    ytd.earnings.overtime += slip.earnings?.overtime || 0;
    ytd.earnings.bonus += slip.earnings?.bonus || 0;
    ytd.earnings.arrears += slip.earnings?.arrears || 0;
    
    ytd.deductions.pf += slip.deductions?.pf || 0;
    ytd.deductions.esi += slip.deductions?.esi || 0;
    ytd.deductions.tds += slip.deductions?.tds || 0;
    ytd.deductions.professionalTax += slip.deductions?.professionalTax || 0;
    ytd.deductions.lop += slip.deductions?.lop || 0;
  });
  
  // Add current month
  ytd.earnings.basic += parseFloat(basic.toFixed(2));
  ytd.earnings.hra += parseFloat(hra.toFixed(2));
  ytd.earnings.travelAllowance += parseFloat(travel.toFixed(2));
  ytd.earnings.medicalAllowance += parseFloat(medical.toFixed(2));
  ytd.earnings.specialAllowance += parseFloat(special.toFixed(2));
  ytd.earnings.overtime += overtimePay;
  ytd.earnings.totalEarnings = Object.values(ytd.earnings).reduce((a, b) => a + b, 0);
  
  ytd.deductions.pf += pfEmployee;
  ytd.deductions.esi += esiEmployee;
  ytd.deductions.tds += tds;
  ytd.deductions.professionalTax += professionalTax;
  ytd.deductions.lop += lopDeduction;
  ytd.deductions.totalDeductions = Object.values(ytd.deductions).reduce((a, b) => a + b, 0);

  return {
    earnings: {
      basic:            parseFloat(basic.toFixed(2)),
      hra:              parseFloat(hra.toFixed(2)),
      travelAllowance:  parseFloat(travel.toFixed(2)),
      medicalAllowance: parseFloat(medical.toFixed(2)),
      specialAllowance: parseFloat(special.toFixed(2)),
      overtime:         overtimePay,
      bonus:            0,
      arrears:          0,
    },
    deductions: {
      pf:              pfEmployee,
      esi:             esiEmployee,
      tds,
      lop:             lopDeduction,
      professionalTax,
      advance:         0,
      other:           0,
    },
    grossSalary:       parseFloat(grossBeforeLOP.toFixed(2)),
    grossAfterLOP:      parseFloat(grossSalary.toFixed(2)),     //
    netSalary:         Math.max(0, netSalary),
    totalWorkingDays,
    daysPresent:       parseFloat(daysPresent.toFixed(1)),
    lopDays:           parseFloat(lopDays.toFixed(2)),
    overtimeHours:     parseFloat((att.overtimeHours || 0).toFixed(2)),
    
    // Employer contributions
    employerContributions: {
      pf:    pfEmployer,
      esi:   parseFloat((grossBeforeLOP * ((policy?.taxCompliance?.esi?.employerRate ?? 3.25) / 100)).toFixed(2)),
      gratuity: policy?.taxCompliance?.gratuityEnabled ? parseFloat((basic * ((policy?.taxCompliance?.gratuityRate ?? 4.81) / 100)).toFixed(2)) : 0
    },
    
    // Tax information
    taxRegime: policy?.tdsConfig?.taxRegime || 'new',
    taxBreakdown: taxBreakdown ? {
      taxableIncome: taxBreakdown.taxableIncome,
      grossTax: taxBreakdown.grossTax,
      rebate87A: taxBreakdown.rebate87A,
      surcharge: taxBreakdown.surcharge,
      cess: taxBreakdown.cess,
      totalTax: taxBreakdown.totalTax,
    } : null,
    
    // Year-to-Date
    ytd: {
      earnings: ytd.earnings,
      deductions: ytd.deductions
    }
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// RUN FOR SINGLE EMPLOYEE
// ─────────────────────────────────────────────────────────────────────────────

exports.runForEmployee = async (employeeId, company_id, unit_id, month, user) => {
  const { year, month: mon } = parseMonth(month);

  // ── Payroll Period Lock check ────────────────────────────────
  if (user) {
    const isLocked = await lockService.isPeriodLocked(mon, year, user.orgId, user.unitId);
    if (isLocked) {
      throw new AppError(
        `Payroll for this period is locked. Please unlock it first before re-running.`,
        423  // 423 Locked
      );
    }
  }

  const employee = await Employee.findOne({
    _id:        employeeId,
    company_id,
    isDeleted:  false,
    status:     { $ne: "TERMINATED" },
  });
  if (!employee) throw new AppError("Employee not found", 404);

  // Check duplicate
  const existing = await Payslip.findOne({ employee_id: employee._id, year, month: mon });
  if (existing && existing.status !== "DRAFT") {
    throw new AppError("Payslip already generated for this month", 409);
  }

  const policy = await resolvePayrollPolicy(employee._id.toString(), company_id, unit_id).catch(() => null);
  const config  = await CompanyConfig.findOne({ company_id }).lean();

  const calc = await calculateForEmployee(employee, company_id, unit_id, year, mon, policy, config);

  const payslip = await Payslip.findOneAndUpdate(
    { employee_id: employee._id, year, month: mon },
    {
      org_id:     employee.org_id,
      company_id,
      unit_id:    employee.unit_id || unit_id,
      employee_id: employee._id,
      year,
      month:      mon,
      ...calc,
      status: "DRAFT",
    },
    { upsert: true, new: true }
  );

  return payslip;
};

// ─────────────────────────────────────────────────────────────────────────────
// RUN FOR ALL EMPLOYEES (Batch)
// ─────────────────────────────────────────────────────────────────────────────

exports.runForTenant = async (company_id, unit_id, month, createdBy, user) => {
  const { year, month: mon } = parseMonth(month);

  // ── Payroll Period Lock check ─────────────────────────────
  if (user) {
    const isLocked = await lockService.isPeriodLocked(mon, year, user.orgId, user.unitId);
    if (isLocked) throw new AppError("Payroll for this period is locked. Please unlock first.", 423);
  }

  const filter = {
    company_id,
    isDeleted: false,
    status:    { $nin: ["TERMINATED"] },
  };
  if (unit_id) filter.unit_id = unit_id;

  const employees = await Employee.find(filter).lean();
  if (!employees.length) throw new AppError("No active employees found", 404);

  const config = await CompanyConfig.findOne({ company_id }).lean();

  const results = { processed: 0, failed: 0, errors: [] };

  for (const employee of employees) {
    try {
      const policy = await resolvePayrollPolicy(
        employee._id.toString(), company_id,
        employee.unit_id?.toString() || unit_id
      ).catch(() => null);

      const calc = await calculateForEmployee(
        employee, company_id,
        employee.unit_id || unit_id,
        year, mon, policy, config
      );

      await Payslip.findOneAndUpdate(
        { employee_id: employee._id, year, month: mon },
        {
          org_id:      employee.org_id,
          company_id,
          unit_id:     employee.unit_id || unit_id,
          employee_id: employee._id,
          year,
          month:       mon,
          ...calc,
          status:      "DRAFT",
          generatedBy: createdBy,
        },
        { upsert: true, new: true }
      );

      results.processed++;
    } catch (err) {
      results.failed++;
      results.errors.push({ employeeId: employee._id, name: employee.name, error: err.message });
    }
  }

  return {
    month,
    summary: results,
    message: `Payroll run complete. Processed: ${results.processed}, Failed: ${results.failed}`,
  };
};