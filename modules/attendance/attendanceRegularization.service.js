// modules/attendance/attendanceRegularization.service.js
"use strict";

const AttendanceRegularization = require("./models/attendanceRegularization.model");
const Attendance               = require("./models/attendance.model");
const Employee                 = require("../employee/models/employee.model");
const User                     = require("../auth/models/user.model");
const AppError                 = require("../../utils/appError");
const mongoose                 = require("mongoose");
const CompanyConfig = require("../companyConfig/models/companyConfig.model");
const Notification  = require("../notification/notification.model");
const LeaveBalance = require("../leave/models/leaveBalance.models");
const LeaveRequest = require("../leave/models/leaveRequest.models");

const toObjId = (id) => new mongoose.Types.ObjectId(String(id));

// ─── Helper: find HR Manager of unit ─────────────────────────
const findHRManager = async (org_id, unit_id) => {
  const Role = require("../role/role.model");
  const hrRole = await Role.findOne({ slug: "hr_manager", isSystem: true }).lean();
  if (!hrRole) return null;
  return await User.findOne({
    org_id:  toObjId(org_id),
    unit_id: toObjId(unit_id),
    roleId:  hrRole._id,
    status:  "ACTIVE",
  }).select("_id").lean();
};


// ─── Resolve Approvers (Flexible — T-flexible) ────────────────
const resolveRegularizationApprovers = async (employee, user, approvalFlow) => {
  let l1ApproverId = null;
  let l2ApproverId = null;

  // L1 — Reporting Manager
  if (["L1_ONLY", "L1_L2"].includes(approvalFlow)) {
    if (employee.reportingManagerId) {
      const mgr = await Employee.findById(employee.reportingManagerId)
        .select("userId").lean();
      if (mgr?.userId) l1ApproverId = mgr.userId;
    }
  }

  // L2 — HR Manager
  if (["L2_ONLY", "L1_L2"].includes(approvalFlow)) {
    const hrUser = await findHRManager(user.orgId, user.unitId);
    if (hrUser?._id) l2ApproverId = hrUser._id;
  }

  // L1_ONLY but no reporting manager — fallback to L2
  if (approvalFlow === "L1_ONLY" && !l1ApproverId) {
    const hrUser = await findHRManager(user.orgId, user.unitId);
    if (hrUser?._id) l2ApproverId = hrUser._id;
  }

  return { l1ApproverId, l2ApproverId, approvalFlow };
};
// ─── Helper: recalculate attendance after approval ────────────
const recalculateAttendance = async (request, approvedBy) => {
  const date = new Date(request.date);
  date.setUTCHours(0, 0, 0, 0);

  let attendance = await Attendance.findOne({
    employeeId: request.employeeId,
    org_id:     request.org_id,
    date,
  });

  const checkIn  = request.requestedCheckIn  || (attendance?.checkIn  || null);
  const checkOut = request.requestedCheckOut || (attendance?.checkOut || null);

  if (!attendance) {
    // Create new attendance record
    attendance = new Attendance({
      org_id:     request.org_id,
      company_id: request.company_id,
      unit_id:    request.unit_id,
      employeeId: request.employeeId,
      userId:     request.userId,
      date,
      checkIn,
      checkOut,
      status:        request.requestedStatus || "PRESENT",
      isRegularized: true,
      regularizedBy: toObjId(approvedBy),
      regularizedAt: new Date(),
      remarks:       `Regularized — Request ID: ${request._id}`,
    });
  } else {
    // Update existing
    if (request.requestedCheckIn)  attendance.checkIn  = request.requestedCheckIn;
    if (request.requestedCheckOut) attendance.checkOut = request.requestedCheckOut;
    if (request.requestedStatus)   attendance.status   = request.requestedStatus;
    attendance.isRegularized = true;
    attendance.regularizedBy = toObjId(approvedBy);
    attendance.regularizedAt = new Date();
    attendance.remarks       = `Regularized — Request ID: ${request._id}`;
  }

  // Recalculate workingHours
  if (attendance.checkIn && attendance.checkOut) {
    const diffMs = new Date(attendance.checkOut) - new Date(attendance.checkIn);
    attendance.workingHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
    const extra = attendance.workingHours - (attendance.standardHours || 8);
    attendance.overtimeHours = extra > 0 ? parseFloat(extra.toFixed(2)) : 0;

    // Status based on hours
    if (attendance.workingHours >= (attendance.standardHours || 8)) {
      attendance.status = attendance.isWFH ? "WFH" : "PRESENT";
    } else if (attendance.workingHours >= 4) {
      attendance.status = "HALF_DAY";
    }

    // Late check
    if (attendance.checkIn && attendance.shiftStart) {
      const [sh, sm] = attendance.shiftStart.split(":").map(Number);
      const shiftStartMs = sh * 60 + sm;
      const ciDate = new Date(attendance.checkIn);
      const ciMs   = ciDate.getUTCHours() * 60 + ciDate.getUTCMinutes();
      const lateMinutes = ciMs - shiftStartMs - (attendance.graceMinutes || 15);
      if (lateMinutes > 0) {
        attendance.isLate     = true;
        attendance.lateMinutes = lateMinutes;
      } else {
        attendance.isLate     = false;
        attendance.lateMinutes = 0;
      }
    }
  }
  // ─── LWP / Leave handling ────────────────────────────────────
  if (request.requestedStatus === "ON_LEAVE" && request.leaveTypeId) {

    // Balance check
    const balance = await LeaveBalance.findOne({
      employeeId:  request.employeeId,
      leaveTypeId: request.leaveTypeId,
      org_id:      request.org_id,
    });

    const hasBalance = balance && balance.remaining >= 1;

    if (hasBalance) {
      // Balance hai — deduct karo + leave request auto create
      balance.used      += 1;
      balance.remaining -= 1;
      await balance.save();

      await LeaveRequest.create({
        org_id:      request.org_id,
        company_id:  request.company_id,
        unit_id:     request.unit_id,
        employeeId:  request.employeeId,
        userId:      request.userId,
        leaveTypeId: request.leaveTypeId,
        startDate:   date,
        endDate:     date,
        totalDays:   1,
        reason:      `Auto-created via attendance regularisation — Request ID: ${request._id}`,
        status:      "APPROVED",
        isAutoCreated: true,
      });

      // isLWP false rakho
      request.isLWP = false;

    } else {
      // Balance nahi — LWP
      request.isLWP = true;

      // Attendance pe LWP mark karo
      attendance.isLWP  = true;  // Attendance model mein bhi field add karni hogi
    }
  }

  await attendance.save();
  return attendance;
};

// ─── Helper: recalculate payroll if a draft payslip already exists ────────────
// (TC-070 — approving a regularisation can change attendance/LOP for a day that
// has already been pulled into a payroll draft. If a DRAFT payslip exists for
// the affected employee + month, re-run payroll so numbers stay accurate.
// PUBLISHED/PAID payslips are left untouched — those require an explicit
// re-run via the payroll module once the period is unlocked.)
const triggerPayrollRecalculation = async (request, approvedBy) => {
  try {
    const Payslip           = require("../payrollPolicy/models/payslip.model");
    const payrollRunService = require("../payrollPolicy/payrollRun.service");

    const date  = new Date(request.date);
    const year  = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;

    const existingPayslip = await Payslip.findOne({
      employee_id: request.employeeId,
      year,
      month,
      status: "DRAFT",
    }).lean();

    if (!existingPayslip) return; // no payroll run yet for this period — nothing to refresh

    const monthStr = `${year}-${String(month).padStart(2, "0")}`;

    await payrollRunService.runForEmployee(
      request.employeeId,
      request.company_id,
      request.unit_id,
      monthStr,
      { userId: approvedBy, orgId: request.org_id, unitId: request.unit_id }
    );
  } catch (err) {
    // Don't let a payroll recalculation failure block the regularisation approval —
    // log it so payroll/HR can re-run manually (e.g. if the period is locked).
    console.error("[triggerPayrollRecalculation] Failed to recalculate payroll:", err.message);
  }
};

// ─── APPLY (Employee) ─────────────────────────────────────────
exports.applyRegularization = async (payload, user) => {
  const {
    date,
    requestedCheckIn,
    requestedCheckOut,
    requestedStatus = "PRESENT",
    reason,
    regularizationType,
    attachments = [],
    targetEmployeeId,
  } = payload;

  // AT-14 — HR/Unit Admin hi kisi aur ke liye raise kar sakta hai
  const isOnBehalf = !!targetEmployeeId;
  if (isOnBehalf) {
    const allowedRoles = ["hr_manager", "unit_admin", "company_admin", "org_admin"];
    if (!allowedRoles.includes(user.role)) {
      throw new AppError("Only HR or Admin can raise regularisation on behalf of an employee", 403);
    }
  }

  if (!date)               throw new AppError("date is required", 400);
  if (!reason)             throw new AppError("reason is required", 400);
  if (!regularizationType) throw new AppError("regularizationType is required", 400);
  if (requestedStatus === "ON_LEAVE" && !payload.leaveTypeId) {
    throw new AppError("leaveTypeId is required when requestedStatus is ON_LEAVE", 400);
  }

  const reqDate = new Date(date);
  reqDate.setUTCHours(0, 0, 0, 0);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // Employee fetch
  let employee;

  if (isOnBehalf) {
    employee = await Employee.findOne({
      _id:       toObjId(targetEmployeeId),
      org_id:    toObjId(user.orgId),
      isDeleted: false,
    }).lean();
    if (!employee) throw new AppError("Target employee not found", 404);

    if (user.level === "unit" && String(employee.unit_id) !== String(user.unitId)) {
      throw new AppError("You can only raise regularisation for employees in your unit", 403);
    }
  } else {
    employee = await Employee.findOne({
      userId: toObjId(user.userId),
      org_id: toObjId(user.orgId),
    }).lean();

    if (!employee && user.email) {
      employee = await Employee.findOne({
        email:  user.email,
        org_id: toObjId(user.orgId),
      }).lean();
    }

    if (!employee) throw new AppError("Employee record not found — please ensure your employee profile is linked", 404);
  }

  // ─── FETCH EFFECTIVE POLICY ─────────────────────────────────────
  const RegularisationPolicy = require("./models/regularisationPolicy.model");
  
  // Fallback to company config if no policy
  const policy = await RegularisationPolicy.findOne({
    org_id: toObjId(user.orgId),
    company_id: toObjId(user.companyId),
    enabled: true,
    status: "active",
    isDeleted: false,
    $or: [
      { unit_id: employee.unit_id },
      { unit_id: null },
    ],
  }).sort({ unit_id: -1 }).lean();

  // Fallback to company config if no policy found
  const config = policy ? null : await CompanyConfig.findOne({ company_id: toObjId(user.companyId) })
    .select("regularisationApprovalFlow regularisationWindowDays").lean();

  const windowDays = policy?.requestWindow?.pastDaysAllowed || config?.regularisationWindowDays || 30;
  const approvalFlow = policy?.approvalFlow || config?.regularisationApprovalFlow || "L2_ONLY";
  const allowFuture = policy?.requestWindow?.futureAllowed || false;

  // Future date check
  if (!allowFuture && reqDate > today) {
    throw new AppError("Cannot regularize a future date", 400);
  }

  // Window check
  const diffDays = (today - reqDate) / (1000 * 60 * 60 * 24);
  if (diffDays > windowDays) {
    throw new AppError(`Cannot regularize attendance older than ${windowDays} days`, 400);
  }

  // ─── VALIDATE AGAINST POLICY ─────────────────────────────────────
  if (policy) {
    // Check if regularisation type is allowed
    const typeMap = {
      "MISSED_PUNCH_IN": "missed_punch",
      "MISSED_PUNCH_OUT": "missed_punch",
      "BOTH_MISSED": "missed_punch",
      "WRONG_TIME": "late",
      "WFH_CORRECTION": "absent",
      "STATUS_CORRECTION": "absent",
    };
    
    const reqType = typeMap[regularizationType] || "absent";
    
    if (!policy.allowedFor.includes(reqType)) {
      throw new AppError(`Regularisation for '${reqType}' is not permitted under current policy`, 400);
    }

    // Check monthly quota
    if (policy.maxRequestsPerMonth) {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
      
      const monthlyCount = await AttendanceRegularization.countDocuments({
        employeeId: employee._id,
        org_id: toObjId(user.orgId),
        createdAt: { $gte: monthStart, $lte: monthEnd },
        status: { $nin: ["REJECTED", "CANCELLED"] },
        isDeleted: false,
      });

      if (monthlyCount >= policy.maxRequestsPerMonth) {
        throw new AppError(`Monthly regularisation limit (${policy.maxRequestsPerMonth}) reached`, 400);
      }
    }

    // Check document requirement
    if (policy.documentRequired?.enabled && policy.documentRequired?.forTypes?.includes(reqType)) {
      if (!attachments || attachments.length === 0) {
        throw new AppError(`Document is mandatory for '${reqType}' regularisation`, 400);
      }
    }
  }

  // Duplicate check
  const existing = await AttendanceRegularization.findOne({
    employeeId: employee._id,
    org_id:     toObjId(user.orgId),
    date:       reqDate,
    status:     { $in: ["PENDING", "UNDER_REVIEW"] },
    isDeleted:  false,
  });
  if (existing) throw new AppError("A regularization request already exists for this date", 409);

  // Attendance record fetch
  const attendance = await Attendance.findOne({
    employeeId: employee._id,
    org_id:     toObjId(user.orgId),
    date:       reqDate,
  }).lean();

  // Approvers resolve
  const { l1ApproverId, l2ApproverId } = await resolveRegularizationApprovers(
    employee,
    user,
    approvalFlow
  );

  const request = await AttendanceRegularization.create({
    org_id:            toObjId(user.orgId),
    company_id:        toObjId(user.companyId),
    unit_id:           toObjId(user.unitId),
    raisedOnBehalf:    isOnBehalf,
    raisedBy:          toObjId(user.userId),
    employeeId:        employee._id,
    userId:            toObjId(user.userId),
    attendanceId:      attendance?._id || null,
    date:              reqDate,
    approvalFlow,
    policyId:          policy?._id || null,  // Link to policy
    leaveTypeId:       payload.leaveTypeId ? toObjId(payload.leaveTypeId) : null,
    requestedCheckIn:  requestedCheckIn  ? new Date(requestedCheckIn)  : null,
    requestedCheckOut: requestedCheckOut ? new Date(requestedCheckOut) : null,
    requestedStatus,
    reason,
    regularizationType,
    attachments,
    l1ApproverId,
    l2ApproverId,
    status:    "PENDING",
    createdBy: toObjId(user.userId),
  });

  // N-05 — Approver ko notification
  const notifyUserId = l1ApproverId || l2ApproverId;
  if (notifyUserId) {
    Notification.create({
      org_id:  toObjId(user.orgId),
      userId:  notifyUserId,
      type:    "REGULARIZATION_APPLIED",
      title:   "New Regularisation Request",
      message: `${employee.name} ne ${date} ke liye regularisation request ki hai`,
      meta: {
        regularizationId: request._id,
        employeeId:       employee._id,
        date,
      },
    }).catch(() => {});
  }

  // HR on behalf — employee ko bhi notify karo
  if (isOnBehalf) {
    Notification.create({
      org_id:  toObjId(user.orgId),
      userId:  request.userId,
      type:    "REGULARIZATION_APPLIED",
      title:   "Regularisation Request Raised on Your Behalf",
      message: `HR ne tumhari taraf se ${date} ke liye regularisation request raise ki hai`,
      meta:    { regularizationId: request._id, date },
    }).catch(() => {});
  }

  return request;
};

// ─── GET MY REQUESTS (Employee) ──────────────────────────────
exports.getMyRequests = async (query, user) => {
  const { page = 1, limit = 10, status, month } = query;

  let employee = await Employee.findOne({
    userId: toObjId(user.userId),
    org_id: toObjId(user.orgId),
  }).lean();
  if (!employee && user.email) {
    employee = await Employee.findOne({ email: user.email, org_id: toObjId(user.orgId) }).lean();
  }
  if (!employee) throw new AppError("Employee record not found", 404);

  const filter = {
    employeeId: employee._id,
    org_id:     toObjId(user.orgId),
    isDeleted:  false,
  };

  if (status) filter.status = status;
  if (month) {
    const start = new Date(`${month}-01`);
    const end   = new Date(start);
    end.setMonth(end.getMonth() + 1);
    filter.date = { $gte: start, $lt: end };
  }

  const skip  = (Number(page) - 1) * Number(limit);
  const total = await AttendanceRegularization.countDocuments(filter);
  const requests = await AttendanceRegularization.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .populate("l1ApproverId", "name email")
    .populate("l2ApproverId", "name email")
    .lean();

  return { requests, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) };
};

// ─── GET PENDING FOR APPROVAL (Manager/HR) ───────────────────
exports.getPendingApprovals = async (query, user) => {
  const { page = 1, limit = 10, status } = query;

  const filter = {
    org_id:    toObjId(user.orgId),
    isDeleted: false,
  };

  if (user.role === "manager") {
    // L1 — sirf PENDING
    filter.l1ApproverId = toObjId(user.userId);
    filter.status       = "PENDING";
  } else if (user.role === "hr_manager") {
    // L2 — PENDING (L2_ONLY flow) ya UNDER_REVIEW (L1_L2 flow) dono
    filter.l2ApproverId = toObjId(user.userId);
    filter.status       = { $in: ["PENDING", "UNDER_REVIEW"] };
  } else {
    // Unit Admin / higher — apni unit ki sab requests
    filter.unit_id = toObjId(user.unitId);
    if (status) filter.status = status;
  }

  const skip  = (Number(page) - 1) * Number(limit);
  const total = await AttendanceRegularization.countDocuments(filter);
  const requests = await AttendanceRegularization.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .populate("employeeId",    "name employeeId email")
    .populate("l1ApproverId",  "name email")
    .populate("l2ApproverId",  "name email")
    .lean();

  return { requests, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) };
};

// ─── APPROVE / REJECT ────────────────────────────────────────
exports.updateStatus = async (requestId, payload, user) => {
  const { action, comment } = payload;

  if (!["APPROVED", "REJECTED"].includes(action)) {
    throw new AppError("action must be APPROVED or REJECTED", 400);
  }

  const request = await AttendanceRegularization.findOne({
    _id:       toObjId(requestId),
    org_id:    toObjId(user.orgId),
    isDeleted: false,
  });
  if (!request) throw new AppError("Regularization request not found", 404);

  if (["APPROVED", "REJECTED", "CANCELLED", "APPLIED"].includes(request.status)) {
    throw new AppError(`Request already ${request.status.toLowerCase()}`, 400);
  }

  const isL1 = request.l1ApproverId && String(request.l1ApproverId) === String(user.userId);
  const isL2 = request.l2ApproverId && String(request.l2ApproverId) === String(user.userId);
  const isAdmin = ["unit_admin", "company_admin", "org_admin"].includes(user.role);

  // ── L1 Action ─────────────────────────────────────────────
  if (isL1 && request.status === "PENDING") {
    request.l1Status   = action;
    request.l1ActionAt = new Date();
    request.l1Comment  = comment || null;
    request.updatedBy  = toObjId(user.userId);

    request.approvalHistory.push({
      level:     1,
      actorId:   toObjId(user.userId),
      actorName: user.name  || "Approver",
      actorRole: user.role,
      action,
      comment:   comment || null,
      actionAt:  new Date(),
    });

    if (action === "REJECTED") {
      request.status = "REJECTED";
      await request.save();

      // Employee ko notify karo
      Notification.create({
        org_id:  request.org_id,
        userId:  request.userId,
        type:    "REGULARIZATION_REJECTED",
        title:   "Regularisation Request Rejected",
        message: `Tumhari ${new Date(request.date).toDateString()} ki regularisation request reject ho gayi`,
        meta:    { regularizationId: request._id },
      }).catch(() => {});

    } else if (request.l2ApproverId) {
      // L2 approval still required — forward the request
      request.status = "UNDER_REVIEW";
      await request.save();

      Notification.create({
        org_id:  request.org_id,
        userId:  request.l2ApproverId,
        type:    "REGULARIZATION_APPLIED",
        title:   "Regularisation Request Pending Your Approval",
        message: `Ek regularisation request aapke approval ke liye aayi hai`,
        meta:    { regularizationId: request._id },
      }).catch(() => {});

    } else {
      // No L2 approver assigned — true L1-only flow. Finalize directly instead
      // of leaving the request stuck at UNDER_REVIEW forever.
      request.status = "APPROVED";
      await request.save();

      await recalculateAttendance(request, user.userId);
      await triggerPayrollRecalculation(request, user.userId);

      request.isApplied = true;
      request.appliedAt = new Date();
      request.appliedBy = toObjId(user.userId);
      request.status    = "APPLIED";
      await request.save();

      Notification.create({
        org_id:  request.org_id,
        userId:  request.userId,
        type:    "REGULARIZATION_APPROVED",
        title:   "Regularisation Request Approved",
        message: `Tumhari ${new Date(request.date).toDateString()} ki regularisation request approve ho gayi`,
        meta:    { regularizationId: request._id },
      }).catch(() => {});
    }

    return request;
  }

  // ── L2 Action ─────────────────────────────────────────────
  if (isL2 && ["PENDING", "UNDER_REVIEW"].includes(request.status)) {
    request.l2Status   = action;
    request.l2ActionAt = new Date();
    request.l2Comment  = comment || null;
    request.updatedBy  = toObjId(user.userId);

    request.approvalHistory.push({
      level:     2,
      actorId:   toObjId(user.userId),
      actorName: user.name  || "Approver",
      actorRole: user.role,
      action,
      comment:   comment || null,
      actionAt:  new Date(),
    });

    if (action === "REJECTED") {
      request.status = "REJECTED";
      await request.save();

      Notification.create({
        org_id:  request.org_id,
        userId:  request.userId,
        type:    "REGULARIZATION_REJECTED",
        title:   "Regularisation Request Rejected",
        message: `Tumhari ${new Date(request.date).toDateString()} ki regularisation request reject ho gayi`,
        meta:    { regularizationId: request._id },
      }).catch(() => {});

    } else {
      request.status = "APPROVED";
      await request.save();

      await recalculateAttendance(request, user.userId);
      await triggerPayrollRecalculation(request, user.userId);

      request.isApplied = true;
      request.appliedAt = new Date();
      request.appliedBy = toObjId(user.userId);
      request.status    = "APPLIED";
      await request.save();

      Notification.create({
        org_id:  request.org_id,
        userId:  request.userId,
        type:    "REGULARIZATION_APPROVED",
        title:   "Regularisation Request Approved",
        message: `Tumhari ${new Date(request.date).toDateString()} ki regularisation request approve ho gayi`,
        meta:    { regularizationId: request._id },
      }).catch(() => {});
    }

    return request;
  }

  // ── Admin Direct Action ────────────────────────────────────
  if (isAdmin) {
    request.l1Status   = action;
    request.l2Status   = action;
    request.l1ActionAt = new Date();
    request.l2ActionAt = new Date();
    request.updatedBy  = toObjId(user.userId);

    request.approvalHistory.push({
      level:     0,
      actorId:   toObjId(user.userId),
      actorName: user.name  || "Admin",
      actorRole: user.role,
      action,
      comment:   comment || null,
      actionAt:  new Date(),
    });

    if (action === "REJECTED") {
      request.status = "REJECTED";
      await request.save();

      Notification.create({
        org_id:  request.org_id,
        userId:  request.userId,
        type:    "REGULARIZATION_REJECTED",
        title:   "Regularisation Request Rejected",
        message: `Tumhari ${new Date(request.date).toDateString()} ki regularisation request reject ho gayi`,
        meta:    { regularizationId: request._id },
      }).catch(() => {});

    } else {
      request.status = "APPROVED";
      await request.save();

      await recalculateAttendance(request, user.userId);
      await triggerPayrollRecalculation(request, user.userId);

      request.isApplied = true;
      request.appliedAt = new Date();
      request.appliedBy = toObjId(user.userId);
      request.status    = "APPLIED";
      await request.save();

      Notification.create({
        org_id:  request.org_id,
        userId:  request.userId,
        type:    "REGULARIZATION_APPROVED",
        title:   "Regularisation Request Approved",
        message: `Tumhari ${new Date(request.date).toDateString()} ki regularisation request approve ho gayi`,
        meta:    { regularizationId: request._id },
      }).catch(() => {});
    }

    return request;
  }

  throw new AppError("You are not authorized to take action on this request", 403);
};

// ─── CANCEL (Employee) ────────────────────────────────────────
exports.cancelRequest = async (requestId, user) => {
  let employee = await Employee.findOne({
    userId: toObjId(user.userId),
    org_id: toObjId(user.orgId),
  }).lean();
  if (!employee && user.email) {
    employee = await Employee.findOne({ email: user.email, org_id: toObjId(user.orgId) }).lean();
  }
  if (!employee) throw new AppError("Employee record not found", 404);

  const request = await AttendanceRegularization.findOne({
    _id:        toObjId(requestId),
    employeeId: employee._id,
    org_id:     toObjId(user.orgId),
    isDeleted:  false,
  });
  if (!request) throw new AppError("Request not found", 404);

  if (!["PENDING", "UNDER_REVIEW"].includes(request.status)) {
    throw new AppError(`Cannot cancel — request is already ${request.status}`, 400);
  }

  request.status    = "CANCELLED";
  request.updatedBy = toObjId(user.userId);
  await request.save();
  return request;
};