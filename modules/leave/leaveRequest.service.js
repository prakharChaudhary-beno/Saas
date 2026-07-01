// modules/leave/leaveRequest.service.js
// T-11 + T-12 + T-13 + T-14 + T-15 + T-16 + T-31
// Leave Request — Apply, Approve, Reject, Cancel, List
// RULES:
//   - T-13: Past date blocked (same day allowed)
//   - T-14: Gender validation on leave type
//   - T-15: Employment type validation
//   - T-16: LOP — skip balance check
//   - T-12: Dynamic L1/L2 approval routing via LeavePolicy
//   - T-31: Email notification on approve/reject

"use strict";
const notifService = require("../notification/notification.service");

const mongoose     = require("mongoose");
const LeaveRequest = require("./models/leaveRequest.models");
const LeaveBalance = require("./models/leaveBalance.models");
const LeaveType    = require("./models/leaveType.models");
const Employee     = require("../employee/models/employee.model");
const User         = require("../auth/models/user.model");
const Role         = require("../role/role.model");
const AppError     = require("../../utils/appError");
const { sendEmail } = require("../../utils/email/email");
const {
  leaveApprovedTemplate,
  leaveRejectedTemplate,
  leavePendingTemplate,
} = require("../../utils/email/templates/leaveStatus");

const toObjId = (id) => new mongoose.Types.ObjectId(String(id));

// ─── Working days calculate (weekends excluded) ───────────────
const calcWorkingDays = (start, end) => {
  let count = 0;
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const endD = new Date(end);
  endD.setHours(0, 0, 0, 0);
  while (cur <= endD) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
};

// ─── Format date for emails ───────────────────────────────────
const fmtDate = (d) => {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

// ─── Resolve L1/L2 approvers from policy ─────────────────────
const resolveApprovers = async (employee, user, leavePolicy) => {
  const approvalType = leavePolicy?.approvalFlow?.type || "L1_L2";

  let l1ApproverId = null;
  let l2ApproverId = null;

  // L1 — Reporting Manager (if type is L1 or L1_L2)
  if (["L1", "L1_L2"].includes(approvalType)) {
   if (employee.reportingManagerId) {
  const managerEmployee = await Employee.findOne({
    _id:       employee.reportingManagerId,
    isDeleted: false,
    status:    "ACTIVE",
  }).select("userId").lean();

  if (managerEmployee?.userId) {
    const mgr = await User.findById(managerEmployee.userId)
      .select("_id name email");
    if (mgr) l1ApproverId = mgr._id;
  }
}
  }

  // L2 — HR Manager in unit (if type is L1_L2 or no L1 found)
  if (approvalType === "L1_L2" || (approvalType === "L1" && !l1ApproverId)) {
    const hrRole = await Role.findOne({ slug: "hr_manager", isSystem: true }).select("_id");
    if (hrRole) {
      const hrUser = await User.findOne({
        org_id:     employee.org_id,
        company_id: employee.company_id,
        unit_id:    employee.unit_id,
        roleId:     hrRole._id,
        is_deleted: false,
        status:     "ACTIVE",
      }).select("_id name email");

      if (hrUser) l2ApproverId = hrUser._id;
      else {
        // Fallback — company-level HR Manager
        const companyHrUser = await User.findOne({
          org_id:     employee.org_id,
          company_id: employee.company_id,
          roleId:     hrRole._id,
          is_deleted: false,
          status:     "ACTIVE",
        }).select("_id name email");
        if (companyHrUser) l2ApproverId = companyHrUser._id;
      }
    }
  }

  // AUTO → no approver, auto-approve logic
  if (approvalType === "AUTO") {
    l1ApproverId = null;
    l2ApproverId = null;
  }

  return { l1ApproverId, l2ApproverId, approvalType };
};

// ─────────────────────────────────────────────────────────────────────────────
// T-11 + T-12 + T-13 + T-14 + T-15 + T-16
// APPLY LEAVE
// ─────────────────────────────────────────────────────────────────────────────

exports.applyLeave = async (payload, user) => {
  const {
    leaveTypeId, startDate, endDate,
    isHalfDay = false, session = null, remarks,reason,
  } = payload;

  // Find employee
  const employee = await Employee.findOne({
    userId:     user.userId,
    org_id:     user.orgId,
    company_id: user.companyId,
    isDeleted:  false,
  }).select("name email employeeId unit_id reportingManagerId status gender employmentType");

  if (!employee) throw new AppError("Employee record not found for your account", 404);
  if (employee.status === "TERMINATED") throw new AppError("Terminated employees cannot apply for leave", 400);

  // Leave type check
  const leaveType = await LeaveType.findOne({
    _id:        leaveTypeId,
    company_id: user.companyId,
    isActive:   true,
    isDeleted:  false,
  });
  if (!leaveType) throw new AppError("Leave type not found or inactive", 404);

  // T-14 — Gender validation
  if (leaveType.applicableGender && leaveType.applicableGender !== "ALL") {
    if (employee.gender && employee.gender !== leaveType.applicableGender) {
      throw new AppError(
        `${leaveType.name} is only applicable for ${leaveType.applicableGender} employees`,
        400
      );
    }
  }

  // T-15 — Employment type validation
  if (leaveType.applicableEmploymentTypes && leaveType.applicableEmploymentTypes.length > 0) {
    if (employee.employmentType && !leaveType.applicableEmploymentTypes.includes(employee.employmentType)) {
      throw new AppError(
        `${leaveType.name} is not applicable for ${employee.employmentType} employees`,
        400
      );
    }
  }

  const start = new Date(startDate);
  const end   = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  // T-13 — Past date validation (same day allowed)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (start < today) {
    throw new AppError("Cannot apply leave for past dates. Same day application is allowed.", 400);
  }

  if (end < start) throw new AppError("End date cannot be before start date", 400);

  // Total days calculate
  let totalDays;
  if (isHalfDay) {
    if (!session) throw new AppError("session (FIRST_HALF/SECOND_HALF) required for half day", 400);
    if (start.getTime() !== end.getTime()) throw new AppError("Start and end date must be same for half day", 400);
    totalDays = 0.5;
  } else {
    totalDays = calcWorkingDays(start, end);
    if (totalDays === 0) throw new AppError("No working days in selected date range", 400);
  }

  // Min notice days check
  const noticeDays = Math.ceil((start - today) / (1000 * 60 * 60 * 24));
  if (leaveType.minNoticeDays > 0 && noticeDays < leaveType.minNoticeDays) {
    throw new AppError(`This leave type requires ${leaveType.minNoticeDays} day(s) advance notice`, 400);
  }

  // Max consecutive days check
  if (leaveType.maxConsecutiveDays > 0 && !isHalfDay && totalDays > leaveType.maxConsecutiveDays) {
    throw new AppError(`Maximum ${leaveType.maxConsecutiveDays} consecutive days allowed for ${leaveType.name}`, 400);
  }

  // Overlap check
  const overlap = await LeaveRequest.findOne({
    employeeId: employee._id,
    status:     { $in: ["PENDING", "UNDER_REVIEW", "APPROVED"] },
    startDate:  { $lte: end },
    endDate:    { $gte: start },
  });
  if (overlap) throw new AppError("You already have a leave request for overlapping dates", 409);

  // T-16 — LOP: skip balance check
  const isLOP = leaveType.code === "LOP" || leaveType.isPaid === false;
  let balance = null;

  if (!isLOP) {
    const year = today.getFullYear();
    balance = await LeaveBalance.findOne({
      employeeId: employee._id,
      leaveTypeId,
      year,
      org_id:     user.orgId,
      company_id: user.companyId,
    });

    if (!balance) {
      throw new AppError(
        "Leave balance not initialized for this leave type. Please contact HR.",
        400
      );
    }

    if (balance.remaining < totalDays) {
      throw new AppError(
        `Insufficient leave balance. Available: ${balance.remaining} day(s), Requested: ${totalDays} day(s)`,
        400
      );
    }
  }

  // T-12 — Resolve approvers from LeavePolicy
  let leavePolicy = null;
  try {
    const { resolveLeavePolicy } = require("../../utils/policyResolver");
    leavePolicy = await resolveLeavePolicy(
      employee._id.toString(),
      user.companyId.toString(),
      employee.unit_id ? employee.unit_id.toString() : null
    );
  } catch (e) {
    // No leave policy configured — default to L1_L2
  }

  const { l1ApproverId, l2ApproverId, approvalType } = await resolveApprovers(employee, user, leavePolicy);

  // Update balance — pending++, remaining-- (only for paid leaves)
  if (balance) {
    balance.pending   = (balance.pending   || 0) + totalDays;
    balance.remaining = (balance.remaining || 0) - totalDays;
    await balance.save();
  }

  // Determine initial status
  let initialStatus = "PENDING";
  if (approvalType === "AUTO") initialStatus = "APPROVED";

  // Create leave request
  const leaveRequest = await LeaveRequest.create({
    org_id:     user.orgId,
    company_id: user.companyId,
    unit_id:    employee.unit_id || user.unitId || null,
    employeeId: employee._id,
    userId:     user.userId,
    leaveTypeId,
    startDate:  start,
    endDate:    end,
    isHalfDay,
    session:    isHalfDay ? session : null,
    totalDays,
    reason:     remarks || reason || "No reason provided",
    status:     initialStatus,
    l1ApproverId,
    l2ApproverId,
    isBalanceDeducted: approvalType === "AUTO",
    balanceAtRequest: balance ? {
      totalAllocated: balance.totalAllocated,
      used:           balance.used,
      remaining:      balance.remaining + totalDays,
    } : null,
    createdBy: user.userId,
  });

  await leaveRequest.populate("leaveTypeId", "name code colorCode");

  // T-31 — Notify L1 approver (if set)
  if (l1ApproverId) {
    try {
      const approver = await User.findById(l1ApproverId).select("name email");
      if (approver?.email) {
        await sendEmail({
          to:      approver.email,
          subject: `Leave Approval Required — ${employee.name}`,
          html:    leavePendingTemplate({
            approverName: approver.name || "Manager",
            employeeName: employee.name,
            leaveType:    leaveType.name,
            startDate:    fmtDate(start),
            endDate:      fmtDate(end),
            totalDays,
            reason:       remarks,
          }),
        });
      }
    } catch (e) {
      console.error("Leave notification email failed:", e.message);
    }
  }

  // In-app notification to L1 approver
  if (l1ApproverId) {
    notifService.createNotification({
      type:          "LEAVE_APPLIED",
      userId:        l1ApproverId,
      org_id:        user.orgId,
      unit_id:       user.unitId,
      referenceId:   leaveRequest._id,
      referenceType: "LeaveRequest",
      data: {
        employeeName: employee.name,
        leaveType:    leaveType?.code || "Leave",
        startDate:    fmtDate(start),
        endDate:      fmtDate(end),
        totalDays,
        leaveId:      leaveRequest._id,
      },
    }).catch(() => {});
  }

  return leaveRequest;
};

// ─────────────────────────────────────────────────────────────────────────────
// GET ALL LEAVE REQUESTS
// ─────────────────────────────────────────────────────────────────────────────

exports.getAllLeaveRequests = async (query, user) => {
  const { status, employeeId, page = 1, limit = 10 } = query;

  const filter = {
    org_id:     user.orgId,
    company_id: user.companyId,
  };

  if (user.role === "employee" || user.role === "manager") {
    const emp = await Employee.findOne({
      userId:     user.userId,
      org_id:     user.orgId,
      company_id: user.companyId,
      isDeleted:  false,
    }).select("_id");
    if (emp) filter.employeeId = emp._id;
  } else {
    if (user.unitId)  filter.unit_id    = user.unitId;
    if (employeeId)   filter.employeeId = toObjId(employeeId);
  }

  if (status) filter.status = status;

  const skip  = (Number(page) - 1) * Number(limit);
  const total = await LeaveRequest.countDocuments(filter);

  const requests = await LeaveRequest.find(filter)
    .populate("employeeId",   "name employeeId email")
    .populate("leaveTypeId",  "name code colorCode")
    .populate("l1ApproverId", "name email")
    .populate("l2ApproverId", "name email")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  return {
    requests,
    pagination: {
      total,
      page:  Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit)),
    },
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// GET ONE LEAVE REQUEST
// ─────────────────────────────────────────────────────────────────────────────

exports.getLeaveRequestById = async (id, user) => {
  const request = await LeaveRequest.findOne({
    _id:        id,
    org_id:     user.orgId,
    company_id: user.companyId,
  })
    .populate("employeeId",   "name employeeId email")
    .populate("leaveTypeId",  "name code colorCode")
    .populate("l1ApproverId", "name email")
    .populate("l2ApproverId", "name email");

  if (!request) throw new AppError("Leave request not found", 404);
  return request;
};

// ─────────────────────────────────────────────────────────────────────────────
// T-12 — APPROVE / REJECT (L1/L2 flow)
// PATCH /api/v1/leave/:id
// ─────────────────────────────────────────────────────────────────────────────

exports.updateLeaveStatus = async (id, payload, user) => {
  const { status, remarks } = payload;

  if (!["APPROVED", "REJECTED", "UNDER_REVIEW"].includes(status)) {
    throw new AppError("Invalid status. Use APPROVED, REJECTED, or UNDER_REVIEW", 400);
  }
const filter = { _id: id, org_id: user.orgId };
if (user.companyId) filter.company_id = user.companyId;

const request = await LeaveRequest.findOne(filter)
  .populate("employeeId", "name email");


  if (!request) throw new AppError("Leave request not found", 404);

  if (!["PENDING", "UNDER_REVIEW"].includes(request.status)) {
    throw new AppError(`Cannot update — request is already ${request.status}`, 400);
  }

  const isSuperAdmin   = user.role === "SUPER_ADMIN";
  const isOrgAdmin     = user.role === "org_admin";
  const isCompanyAdmin = user.role === "company_admin";
 const isHRManager = ["hr_manager", "company_hr_manager", "unit_admin"].includes(user.role);
const isL1 = request.l1ApproverId && String(request.l1ApproverId) === String(user.userId);
const isL2 = request.l2ApproverId && String(request.l2ApproverId) === String(user.userId);

// Custom role — permission check
const userRole = await Role.findById(user.roleId).populate("permissions").lean();
const hasLeaveApprove = userRole?.permissions?.some(p => p.slug === "leave.approve") || false;

const canAct =
  isSuperAdmin || isOrgAdmin || isCompanyAdmin ||
  (request.status === "PENDING"      && (isL1 || isHRManager || hasLeaveApprove)) ||
  (request.status === "UNDER_REVIEW" && (isL2 || isHRManager || hasLeaveApprove));

  if (!canAct) {
    throw new AppError("You are not authorized to act on this leave request", 403);
  }

  const year = new Date(request.startDate).getFullYear();

  if (status === "APPROVED") {
    request.status = "APPROVED";
    if (isL1 && !request.l2ApproverId) {
      request.l1Status   = "APPROVED";
      request.l1ActionAt = new Date();
      request.l1Comment  = remarks || null;
    } else {
      request.l2Status   = "APPROVED";
      request.l2ActionAt = new Date();
      request.l2Comment  = remarks || null;
    }

    // Deduct balance (pending → used)
    if (!request.isBalanceDeducted) {
      const balance = await LeaveBalance.findOne({
        employeeId:  request.employeeId._id || request.employeeId,
        leaveTypeId: request.leaveTypeId,
        year,
        org_id:      user.orgId,
        company_id:  user.companyId,
      });

      if (balance) {
        balance.pending  = Math.max(0, (balance.pending || 0) - request.totalDays);
        balance.used     = (balance.used || 0) + request.totalDays;
        await balance.save();
        request.isBalanceDeducted = true;
      }
    }

  } else if (status === "REJECTED") {
    request.status = "REJECTED";
    if (isL1 && !request.l2ApproverId) {
      request.l1Status   = "REJECTED";
      request.l1ActionAt = new Date();
      request.l1Comment  = remarks || null;
    } else {
      request.l2Status   = "REJECTED";
      request.l2ActionAt = new Date();
      request.l2Comment  = remarks || null;
    }

    // Restore balance (pending → remaining)
    const balance = await LeaveBalance.findOne({
      employeeId:  request.employeeId._id || request.employeeId,
      leaveTypeId: request.leaveTypeId,
      year,
      org_id:      user.orgId,
      company_id:  user.companyId,
    });

    if (balance) {
      balance.pending   = Math.max(0, (balance.pending   || 0) - request.totalDays);
      balance.remaining = (balance.remaining || 0) + request.totalDays;
      await balance.save();
    }

  } else if (status === "UNDER_REVIEW") {
    // L1 approved → forward to L2
    request.status     = "UNDER_REVIEW";
    request.l1Status   = "APPROVED";
    request.l1ActionAt = new Date();
    request.l1Comment  = remarks || null;
  }

  // Audit history
  request.approvalHistory.push({
    level:        isL1 ? 1 : 2,
    approverId:   user.userId,
    approverName: user.name || "Approver",
    approverRole: user.role,
    action:       status,
    comment:      remarks || null,
    actionAt:     new Date(),
  });

  request.updatedBy = user.userId;
  await request.save();

  // T-31 — Notify employee on final decision
  const employeeEmail = request.employeeId?.email;
  const employeeName  = request.employeeId?.name || "Employee";

  if (employeeEmail && ["APPROVED", "REJECTED"].includes(status)) {
    const leaveTypeDoc = await LeaveType.findById(request.leaveTypeId).select("name");
    const approverUser = await User.findById(user.userId).select("name");
    try {
      await sendEmail({
        to:      employeeEmail,
        subject: `Your Leave Request has been ${status}`,
        html:    status === "APPROVED"
          ? leaveApprovedTemplate({
              name:         employeeName,
              leaveType:    leaveTypeDoc?.name || "Leave",
              startDate:    fmtDate(request.startDate),
              endDate:      fmtDate(request.endDate),
              totalDays:    request.totalDays,
              approverName: approverUser?.name || "Manager",
            })
          : leaveRejectedTemplate({
              name:         employeeName,
              leaveType:    leaveTypeDoc?.name || "Leave",
              startDate:    fmtDate(request.startDate),
              endDate:      fmtDate(request.endDate),
              totalDays:    request.totalDays,
              approverName: approverUser?.name || "Manager",
              reason:       remarks || "",
            }),
      });
    } catch (e) {
      console.error("Leave status notification failed:", e.message);
    }
  }

  return request;
};

// ─────────────────────────────────────────────────────────────────────────────
// CANCEL LEAVE REQUEST
// ─────────────────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────────────────
// GET PENDING APPROVALS — for L1/L2 approvers
// GET /leave/pending
// ─────────────────────────────────────────────────────────────────────────────
exports.getPendingApprovals = async (query, user) => {
  const { page = 1, limit = 10 } = query;

  const isHRManager = ["hr_manager", "company_hr_manager", "unit_admin", "org_admin", "company_admin"].includes(user.role);

  const managerEmployee = await Employee.findOne({ userId: user.userId, isDeleted: false }).select("_id");
  const isReportingManager = managerEmployee
    ? !!(await Employee.exists({ reportingManagerId: managerEmployee._id, isDeleted: false, status: "ACTIVE" }))
    : false;

  if (!isHRManager && !isReportingManager) {
    throw new AppError("You are not authorized to view pending approvals", 403);
  }

  const filter = {
    org_id:     user.orgId,
    company_id: user.companyId,
    status:     { $in: ["PENDING", "UNDER_REVIEW"] },
  };

  if (!isHRManager) {
    filter.$or = [
      { l1ApproverId: user.userId },
      { l2ApproverId: user.userId },
    ];
  } else if (user.unitId) {
    filter.unit_id = user.unitId;
  }

  const skip  = (Number(page) - 1) * Number(limit);
  const total = await LeaveRequest.countDocuments(filter);

  const requests = await LeaveRequest.find(filter)
    .populate("employeeId",   "name employeeId email")
    .populate("leaveTypeId",  "name code colorCode")
    .populate("l1ApproverId", "name email")
    .populate("l2ApproverId", "name email")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  return {
    requests,
    pagination: {
      total,
      page:  Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit)),
    },
  };
};
exports.cancelLeaveRequest = async (id, user) => {
  const request = await LeaveRequest.findOne({
    _id:        id,
    userId:     user.userId,
    org_id:     user.orgId,
    company_id: user.companyId,
  });

  if (!request) throw new AppError("Leave request not found", 404);

  if (!["PENDING", "UNDER_REVIEW"].includes(request.status)) {
    throw new AppError(`Cannot cancel — request is already ${request.status}`, 400);
  }

  request.status             = "CANCELLED";
  request.cancelledAt        = new Date();
  request.cancelledBy        = user.userId;
  request.cancellationReason = "Cancelled by employee";
  await request.save();

  // Restore balance
  const year = new Date(request.startDate).getFullYear();
  const balance = await LeaveBalance.findOne({
    employeeId:  request.employeeId,
    leaveTypeId: request.leaveTypeId,
    year,
    org_id:      user.orgId,
    company_id:  user.companyId,
  });

  if (balance) {
    balance.pending   = Math.max(0, (balance.pending   || 0) - request.totalDays);
    balance.remaining = (balance.remaining || 0) + request.totalDays;
    await balance.save();
  }

  return { message: "Leave request cancelled successfully" };
};