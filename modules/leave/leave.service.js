// modules/leave/leave.service.js
// UPDATED — tenantId → org_id + company_id + unit_id

const LeaveBalance = require("./models/leaveBalance.models");
const LeaveType    = require("./models/leaveType.models");
const Employee     = require("../employee/models/employee.model");
const AppError     = require("../../utils/appError");

// ── Scope filter ──────────────────────────────────────────
const buildScopeFilter = (user) => {
  if (user.role === "SUPER_ADMIN") return {};
  const filter = { org_id: user.orgId };
  if (user.companyId) filter.company_id = user.companyId;
  if (user.unitId)    filter.unit_id    = user.unitId;
  return filter;
};

// Company level filter — LeaveType ke liye
const buildCompanyFilter = (user) => {
  if (user.role === "SUPER_ADMIN") return {};
  const filter = { org_id: user.orgId };
  if (user.companyId) filter.company_id = user.companyId;
  return filter;
};

// ─── CREATE LEAVE TYPE ────────────────────────────────────
exports.create = async (payload, user) => {
  const { name, code } = payload;

  const existing = await LeaveType.findOne({
    company_id: user.companyId,
    code:       code.toUpperCase(),
    isDeleted:  false,
  });
  if (existing) throw new AppError(`Leave type with code '${code}' already exists`, 400);

  return await LeaveType.create({
    ...payload,
    code:       code.toUpperCase(),
    org_id:     user.orgId,
    company_id: user.companyId,
    isSystem:   false,
    createdBy:  user.userId,
  });
};

// ─── GET ALL LEAVE TYPES ──────────────────────────────────
exports.getAll = async (query, user) => {
  const { isActive, isPaid, search } = query;

  const filter = {
    ...buildCompanyFilter(user),
    isDeleted: false,
  };

  if (isActive !== undefined) filter.isActive = isActive === "true";
  if (isPaid   !== undefined) filter.isPaid   = isPaid   === "true";

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { code: { $regex: search, $options: "i" } },
    ];
  }

  return await LeaveType.find(filter).sort({ isSystem: -1, name: 1 });
};

// ─── GET ONE LEAVE TYPE ───────────────────────────────────
exports.getOne = async (id, user) => {
  const leaveType = await LeaveType.findOne({
    _id:       id,
    ...buildCompanyFilter(user),
    isDeleted: false,
  });
  if (!leaveType) throw new AppError("Leave type not found", 404);
  return leaveType;
};

// ─── UPDATE LEAVE TYPE ────────────────────────────────────
exports.update = async (id, payload, user) => {
  const leaveType = await LeaveType.findOne({
    _id:       id,
    ...buildCompanyFilter(user),
    isDeleted: false,
  });
  if (!leaveType) throw new AppError("Leave type not found", 404);

  if (leaveType.isSystem) throw new AppError("System leave types cannot be modified", 400);

  if (payload.code && payload.code.toUpperCase() !== leaveType.code) {
    const existing = await LeaveType.findOne({
      company_id: user.companyId,
      code:       payload.code.toUpperCase(),
      isDeleted:  false,
      _id:        { $ne: id },
    });
    if (existing) throw new AppError(`Leave type with code '${payload.code}' already exists`, 400);
    payload.code = payload.code.toUpperCase();
  }

  delete payload.isSystem;
  delete payload.org_id;
  delete payload.company_id;

  Object.assign(leaveType, { ...payload, updatedBy: user.userId });
  await leaveType.save();
  return leaveType;
};

// ─── DELETE LEAVE TYPE ────────────────────────────────────
exports.remove = async (id, user) => {
  const leaveType = await LeaveType.findOne({
    _id:       id,
    ...buildCompanyFilter(user),
    isDeleted: false,
  });
  if (!leaveType) throw new AppError("Leave type not found", 404);
  if (leaveType.isSystem) throw new AppError("System leave types cannot be deleted", 400);

  leaveType.isDeleted = true;
  leaveType.updatedBy = user.userId;
  await leaveType.save();
  return { message: "Leave type deleted successfully" };
};

// ─── TOGGLE STATUS ────────────────────────────────────────
exports.toggleStatus = async (id, user) => {
  const leaveType = await LeaveType.findOne({
    _id:       id,
    ...buildCompanyFilter(user),
    isDeleted: false,
  });
  if (!leaveType) throw new AppError("Leave type not found", 404);
  if (leaveType.isSystem) throw new AppError("System leave types cannot be deactivated", 400);

  leaveType.isActive  = !leaveType.isActive;
  leaveType.updatedBy = user.userId;
  await leaveType.save();

  return {
    message:  `Leave type ${leaveType.isActive ? "activated" : "deactivated"} successfully`,
    isActive: leaveType.isActive,
  };
};

// ─── INITIALIZE LEAVE BALANCE ─────────────────────────────
exports.initializeLeaveBalance = async (body, user) => {
  const {
    employeeId,
    leaveTypeId,
    year          = new Date().getFullYear(),
    totalAllocated = null,
  } = body;

  // Employee check — unit scope
  const employee = await Employee.findOne({
    _id:        employeeId,
    org_id:     user.orgId,
    company_id: user.companyId,
    isDeleted:  false,
  }).select("name employeeId status unit_id");

  if (!employee) throw new AppError("Employee not found", 404);

  if (employee.status === "TERMINATED") {
    throw new AppError(`Cannot initialize balance for terminated employee: ${employee.name}`, 400);
  }

  // LeaveType check — company scope
  const leaveType = await LeaveType.findOne({
    _id:        leaveTypeId,
    company_id: user.companyId,
    isActive:   true,
  }).select("name code defaultDaysPerYear isPaid");

  if (!leaveType) throw new AppError("Leave type not found or inactive", 404);

  // Duplicate check
  const existing = await LeaveBalance.findOne({
    org_id:     user.orgId,
    company_id: user.companyId,
    employeeId,
    leaveTypeId,
    year,
  });

  if (existing) {
    throw new AppError(
      `Leave balance for "${leaveType.name}" already initialized for ${employee.name} in ${year}.`,
      400
    );
  }

  const allocated = totalAllocated !== null ? totalAllocated : (leaveType.defaultDaysPerYear || 0);

  const balance = await LeaveBalance.create({
    org_id:     user.orgId,
    company_id: user.companyId,
    unit_id:    employee.unit_id || null,
    employeeId,
    leaveTypeId,
    year,
    totalAllocated: allocated,
    used:           0,
    pending:        0,
    remaining:      allocated,
    adjustmentHistory: [{
      days:       allocated,
      reason:     `Initial balance set for ${year}`,
      adjustedBy: user.userId,
      type:       "YEAR_INITIALIZATION",
    }],
  });

  await balance.populate("leaveTypeId", "name code");
  await balance.populate("employeeId",  "name employeeId");
  return balance;
};

// ─── GET LEAVE BALANCES ───────────────────────────────────
exports.getLeaveBalances = async (employeeId, query, user) => {
  const year = query.year || new Date().getFullYear();

  const employee = await Employee.findOne({
    _id:        employeeId,
    org_id:     user.orgId,
    company_id: user.companyId,
    isDeleted:  false,
  }).select("name employeeId");

  if (!employee) throw new AppError("Employee not found", 404);

  const balances = await LeaveBalance.find({
    org_id:     user.orgId,
    company_id: user.companyId,
    employeeId,
    year,
  })
    .populate("leaveTypeId", "name code isPaid isHalfDayAllowed")
    .select("-adjustmentHistory -__v")
    .sort({ createdAt: 1 });

  return {
    employee: { id: employee._id, name: employee.name, employeeId: employee.employeeId },
    year,
    balances,
    summary: {
      totalLeaveTypes: balances.length,
      totalAllocated:  balances.reduce((s, b) => s + (b.totalAllocated || 0), 0),
      totalUsed:       balances.reduce((s, b) => s + b.used, 0),
      totalRemaining:  balances.reduce((s, b) => s + b.remaining, 0),
      totalPending:    balances.reduce((s, b) => s + b.pending, 0),
    },
  };
};

// ─── GET MY LEAVE BALANCES ────────────────────────────────
exports.getMyLeaveBalances = async (query, user) => {
  const year = query.year || new Date().getFullYear();

  const employee = await Employee.findOne({
    userId:     user.userId,
    org_id:     user.orgId,
    company_id: user.companyId,
    isDeleted:  false,
  }).select("name employeeId");

  if (!employee) throw new AppError("Employee record not found for your account", 404);

  const balances = await LeaveBalance.find({
    org_id:     user.orgId,
    company_id: user.companyId,
    employeeId: employee._id,
    year,
  })
    .populate("leaveTypeId", "name code isPaid isHalfDayAllowed")
    .select("-adjustmentHistory -__v")
    .sort({ createdAt: 1 });

  return {
    employee: { id: employee._id, name: employee.name, employeeId: employee.employeeId },
    year,
    balances,
    summary: {
      totalLeaveTypes: balances.length,
      totalAllocated:  balances.reduce((s, b) => s + (b.totalAllocated || 0), 0),
      totalUsed:       balances.reduce((s, b) => s + b.used, 0),
      totalRemaining:  balances.reduce((s, b) => s + b.remaining, 0),
      totalPending:    balances.reduce((s, b) => s + b.pending, 0),
    },
  };
};

// ─── ADJUST LEAVE BALANCE ─────────────────────────────────
exports.adjustLeaveBalance = async (balanceId, body, user) => {
  const { days, reason } = body;

  const balance = await LeaveBalance.findOne({
    _id:        balanceId,
    org_id:     user.orgId,
    company_id: user.companyId,
  })
    .populate("leaveTypeId", "name code")
    .populate("employeeId",  "name employeeId");

  if (!balance) throw new AppError("Leave balance record not found", 404);

  if (days < 0 && Math.abs(days) > balance.remaining) {
    throw new AppError(
      `Cannot debit ${Math.abs(days)} days. Current remaining: ${balance.remaining} days.`,
      400
    );
  }

  const type = days > 0 ? "MANUAL_CREDIT" : "MANUAL_DEBIT";

  balance.totalAllocated = Math.max(0, balance.totalAllocated + days);
  balance.adjustmentHistory.push({ days, reason, adjustedBy: user.userId, type });
  await balance.save();
  return balance;
};
// ─── TEAM LEAVE CALENDAR ──────────────────────────────────────
// GET /leave/calendar?month=YYYY-MM&unit_id=&department_id=
//
// Returns month-wise view of who is on leave when.
// Used by: manager (own team), hr_manager (full unit), employee (own unit view)
//
// Dynamic:
//   - Scope: manager → sirf reportingManagerId wale employees
//             hr_manager/unit_admin → poora unit
//             company_admin/org_admin → filter by unit_id param
//   - department_id filter optional
//   - Response includes dailySummary for frontend grid
//   - Only APPROVED leaves shown (not pending/draft)

const LeaveRequest = require("./models/leaveRequest.models");
const mongoose     = require("mongoose");
const toObjId = (id) => new mongoose.Types.ObjectId(String(id));

const fmtDateStr = (d) => {
  if (!d) return "";
  return new Date(d).toISOString().split("T")[0]; // "YYYY-MM-DD"
};

exports.getTeamCalendar = async (query, user) => {
  const { month, unit_id, department_id } = query;

  if (!month) throw new AppError("month is required (format: YYYY-MM)", 400);
  const [yr, mo] = month.split("-").map(Number);
  if (!yr || !mo || mo < 1 || mo > 12) {
    throw new AppError("Invalid month format. Use YYYY-MM", 400);
  }

  const monthStart = new Date(yr, mo - 1, 1);
  const monthEnd   = new Date(yr, mo, 0);
  monthEnd.setHours(23, 59, 59, 999);

  // ── Build scope ──────────────────────────────────────────────
  const requestFilter = {
    org_id:     toObjId(user.orgId),
    company_id: toObjId(user.companyId),
    status:     "APPROVED",
    startDate:  { $lte: monthEnd },
    endDate:    { $gte: monthStart },
  };

  const targetUnitId = unit_id || user.unitId;
  if (targetUnitId) requestFilter.unit_id = toObjId(targetUnitId);

  // ── Fetch approved leaves ────────────────────────────────────
  const leaves = await LeaveRequest.find(requestFilter)
    .populate({
      path:   "employeeId",
      select: "name employeeId departmentId",
      match:  department_id
        ? { departmentId: toObjId(department_id), isDeleted: false }
        : { isDeleted: false },
    })
    .populate("leaveTypeId", "name code colorCode")
    .lean();

  // Filter out nulls from department match
  const validLeaves = leaves.filter((l) => l.employeeId !== null);

  // ── Manager scope — sirf apni team ──────────────────────────
  // If manager role: further filter to employees who have this manager as reportingManagerId
  let filteredLeaves = validLeaves;
  if (user.roleSlug === "manager") {
    const myTeam = await Employee.find({
      reportingManagerId: toObjId(user.employeeId || "000000000000000000000000"),
      org_id:             toObjId(user.orgId),
      company_id:         toObjId(user.companyId),
      isDeleted:          false,
      status:             "ACTIVE",
    }).select("_id").lean();

    const teamIds = new Set(myTeam.map((e) => e._id.toString()));
    filteredLeaves = validLeaves.filter(
      (l) => teamIds.has(l.employeeId._id.toString())
    );
  }

  // ── Build employee map ───────────────────────────────────────
  const employeeMap = new Map();
  const daysInMonth = new Date(yr, mo, 0).getDate();

  for (const leave of filteredLeaves) {
    const empId  = leave.employeeId._id.toString();
    const emp    = leave.employeeId;
    const lt     = leave.leaveType;

    if (!employeeMap.has(empId)) {
      employeeMap.set(empId, {
        employee: {
          id:           emp._id,
          name:         emp.name,
          employeeId:   emp.employeeId,
          departmentId: emp.departmentId,
        },
        leaves:       [],
        leaveDates:   [], // flat array of "YYYY-MM-DD" strings for this month
      });
    }

    const entry = employeeMap.get(empId);

    entry.leaves.push({
      leaveId:   leave._id,
      startDate: leave.startDate,
      endDate:   leave.endDate,
      totalDays: leave.totalDays,
      leaveType: leave.leaveTypeId
        ? { name: leave.leaveTypeId.name, code: leave.leaveTypeId.code, color: leave.leaveTypeId.colorCode }
        : null,
      isHalfDay: leave.isHalfDay,
      session:   leave.session,
    });

    // Build flat date array clipped to this month
    const rangeStart = new Date(Math.max(new Date(leave.startDate), monthStart));
    const rangeEnd   = new Date(Math.min(new Date(leave.endDate),   monthEnd));
    const cur        = new Date(rangeStart);
    while (cur <= rangeEnd) {
      const ds = fmtDateStr(cur);
      if (!entry.leaveDates.includes(ds)) entry.leaveDates.push(ds);
      cur.setDate(cur.getDate() + 1);
    }
  }

  // ── Build dailySummary ───────────────────────────────────────
  // { "2026-06-05": { count: 3, employees: ["Rahul", "Priya"] } }
  const dailySummary = {};
  for (const entry of employeeMap.values()) {
    for (const dateStr of entry.leaveDates) {
      if (!dailySummary[dateStr]) {
        dailySummary[dateStr] = { count: 0, employees: [] };
      }
      dailySummary[dateStr].count++;
      dailySummary[dateStr].employees.push(entry.employee.name);
    }
  }

  return {
    month,
    daysInMonth,
    totalOnLeave:  employeeMap.size,
    employees:     Array.from(employeeMap.values()),
    dailySummary,
  };
};

// ─── LEAVE LIABILITY REPORT ───────────────────────────────────
// GET /leave/reports/liability?unit_id=&department_id=&asOfDate=
//
// Finance report: agar aaj sab employees ne apni encashable leave
// cash karwa li toh company ko kitna paisa dena padega?
//
// Dynamic:
//   - Only leaveTypes with isEncashmentAllowed: true
//   - encashableLimit pe cap: Math.min(balance, encashableLimit ?? Infinity)
//   - minBalanceAfterEncashment: employee must retain this much
//   - encashmentBasis: BASIC / GROSS / LAST_DRAWN → salary / 26 × days
//   - encashmentTrigger filter: YEAR_END + ON_RESIGN types included
//     ANYTIME always included
//   - Grouped by department in response

exports.getLeaveLiabilityReport = async (query, user) => {
  const { unit_id, department_id, asOfDate } = query;

  const asOf = asOfDate ? new Date(asOfDate) : new Date();

  // ── Scope ────────────────────────────────────────────────────
  const empFilter = {
    org_id:     toObjId(user.orgId),
    company_id: toObjId(user.companyId),
    isDeleted:  false,
    status:     "ACTIVE",
  };
  if (unit_id || user.unitId)     empFilter.unit_id     = toObjId(unit_id || user.unitId);
  if (department_id)               empFilter.departmentId = toObjId(department_id);

  // ── Get all active employees in scope ────────────────────────
  const employees = await Employee.find(empFilter)
    .select("name employeeId departmentId salary")
    .lean();

  if (employees.length === 0) {
    return {
      asOfDate:       fmtDateStr(asOf),
      totalEmployees: 0,
      totalLiability: 0,
      currency:       "INR",
      employees:      [],
      byDepartment:   [],
    };
  }

  // ── Get encashable leave types for this company ──────────────
  const encashableTypes = await LeaveType.find({
    org_id:               toObjId(user.orgId),
    company_id:           toObjId(user.companyId),
    isEncashmentAllowed:  true,
    isDeleted:            false,
    isActive:             true,
  }).lean();

  if (encashableTypes.length === 0) {
    return {
      asOfDate:       fmtDateStr(asOf),
      totalEmployees: employees.length,
      totalLiability: 0,
      currency:       "INR",
      note:           "No encashable leave types configured for this company",
      employees:      [],
      byDepartment:   [],
    };
  }

  const encashableTypeMap = new Map(encashableTypes.map((t) => [t._id.toString(), t]));
  const employeeIds       = employees.map((e) => e._id);

  // ── Get leave balances for all employees + encashable types ──
  const balances = await LeaveBalance.find({
    org_id:      toObjId(user.orgId),
    company_id:  toObjId(user.companyId),
    employeeId:  { $in: employeeIds },
    leaveTypeId: { $in: encashableTypes.map((t) => t._id) },
  }).lean();

  // Group balances by employeeId
  const balanceMap = new Map();
  for (const bal of balances) {
    const eid = bal.employeeId.toString();
    if (!balanceMap.has(eid)) balanceMap.set(eid, []);
    balanceMap.get(eid).push(bal);
  }

  // ── Calculate liability per employee ─────────────────────────
  const employeeResults = [];
  const deptMap         = new Map();

  for (const emp of employees) {
    const empBalances   = balanceMap.get(emp._id.toString()) || [];
    let   totalEncashable = 0;
    let   totalLiability  = 0;
    const breakdown       = [];

    for (const bal of empBalances) {
      const lt = encashableTypeMap.get(bal.leaveTypeId.toString());
      if (!lt) continue;

      const remaining = bal.remaining || 0;

      // Min balance employee must retain
      const minRetain    = lt.minBalanceAfterEncashment ?? 0;
      const availableForEncash = Math.max(0, remaining - minRetain);
      if (availableForEncash <= 0) continue;

      // Apply encashable limit cap
      const cap          = lt.encashableLimit ?? Infinity;
      const encashableDays = Math.min(availableForEncash, cap);
      if (encashableDays <= 0) continue;

      // Daily rate based on encashmentBasis
      // salary object: { basic, gross, ... } — use emp.salary fields
      let salaryBasis = 0;
      const salaryObj = emp.salary || {};
      if (lt.encashmentBasis === "GROSS") {
        salaryBasis = salaryObj.grossSalary || salaryObj.gross || salaryObj.ctc || 0;
      } else if (lt.encashmentBasis === "LAST_DRAWN") {
        // Last drawn = gross (for now; payslip integration can refine later)
        salaryBasis = salaryObj.grossSalary || salaryObj.gross || salaryObj.ctc || 0;
      } else {
        // Default: BASIC
        salaryBasis = salaryObj.basicSalary || salaryObj.basic || 0;
      }

      const dailyRate    = salaryBasis > 0 ? Math.round(salaryBasis / 26) : 0;
      const liability    = Math.round(encashableDays * dailyRate);

      totalEncashable   += encashableDays;
      totalLiability    += liability;

      breakdown.push({
        leaveType:       lt.name,
        leaveCode:       lt.code,
        balance:         remaining,
        minRetain,
        encashableDays,
        dailyRate,
        liability,
        encashmentBasis: lt.encashmentBasis,
        encashmentTrigger: lt.encashmentTrigger,
      });
    }

    if (breakdown.length === 0) continue; // no encashable balance

    const result = {
      employeeId:     emp._id,
      employeeCode:   emp.employeeId,
      name:           emp.name,
      departmentId:   emp.departmentId,
      totalEncashableDays: Math.round(totalEncashable * 10) / 10,
      totalLiability,
      breakdown,
    };
    employeeResults.push(result);

    // Dept aggregation
    const deptId = emp.departmentId?.toString() || "unassigned";
    if (!deptMap.has(deptId)) {
      deptMap.set(deptId, { departmentId: emp.departmentId, totalDays: 0, totalLiability: 0, count: 0 });
    }
    const deptEntry = deptMap.get(deptId);
    deptEntry.totalDays      += totalEncashable;
    deptEntry.totalLiability += totalLiability;
    deptEntry.count++;
  }

  // ── Grand total ──────────────────────────────────────────────
  const grandTotal = employeeResults.reduce((sum, e) => sum + e.totalLiability, 0);

  return {
    asOfDate:       fmtDateStr(asOf),
    totalEmployees: employeeResults.length,
    totalLiability: grandTotal,
    currency:       "INR",
    employees:      employeeResults.sort((a, b) => b.totalLiability - a.totalLiability),
    byDepartment:   Array.from(deptMap.values()).map((d) => ({
      ...d,
      totalDays:      Math.round(d.totalDays * 10) / 10,
    })),
  };
};