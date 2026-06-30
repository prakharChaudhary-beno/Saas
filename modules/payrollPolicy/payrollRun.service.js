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

  // ── Professional Tax ─────────────────────────────────────────
  // Simplified slab (Karnataka example — ideally per pt_state)
  let professionalTax = 0;
  if (grossSalary > 15000) professionalTax = 200;
  else if (grossSalary > 10000) professionalTax = 150;
  else if (grossSalary > 7500) professionalTax = 100;

  // ── TDS (simplified annual projection) ──────────────────────
  const tdsConfig = policy?.taxCompliance?.tds;
  let tds = 0;
  if (tdsConfig?.enabled && tdsConfig.annualTax) {
    tds = parseFloat((tdsConfig.annualTax / 12).toFixed(2));
  }

  // ── Net salary ───────────────────────────────────────────────
  const totalDeductions = parseFloat((pfEmployee + esiEmployee + tds + professionalTax + lopDeduction).toFixed(2));
  const netSalary       = parseFloat((grossSalary - (pfEmployee + esiEmployee + tds + professionalTax)).toFixed(2));

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