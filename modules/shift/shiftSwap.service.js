// modules/shift/shiftSwap.service.js
//
// Shift Swap Workflow:
//
//  EMPLOYEE_THEN_MANAGER flow (default):
//    A raises request → B notified → B accepts/declines
//    → if accepted → Manager notified → Manager approves/rejects
//    → if approved → both rosters updated
//
//  MANAGER_ONLY flow:
//    A raises request → Manager notified directly → Manager approves/rejects
//    → if approved → both rosters updated
//
// Dynamic:
//   - approvalType from unit AttendancePolicy config
//   - managerId from A's reportingManagerId → fallback unit hr_manager
//   - Roster update on approval: existing rosters get new shift_id for swapDate
//     (creates date-specific single-day roster overrides)
//   - Email sent at every step: raise, B accept/decline, manager approve/reject
//   - swapDate must be today or future
//   - A cannot swap with themselves
//   - Both A and B must be in same unit

"use strict";

const ShiftSwapRequest = require("./models/shiftSwapRequest.model");
const Roster           = require("./models/roster.model");
const Shift            = require("./models/shift.model");
const Employee         = require("../employee/models/employee.model");
const User             = require("../auth/models/user.model");
const Role             = require("../role/role.model");
const AppError         = require("../../utils/appError");
const { sendEmail }    = require("../../utils/email/email");
const mongoose         = require("mongoose");

// Import resolveShiftForEmployee from shift.service
const { resolveShiftForEmployee } = require("./shift.service");

const toObjId   = (id) => new mongoose.Types.ObjectId(String(id));
const toMidnight = (d) => { const dt = new Date(d); dt.setHours(0,0,0,0); return dt; };
const fmtDate   = (d) => d
  ? new Date(d).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" })
  : "";

// ─── Resolve Manager for swap approval ───────────────────────
// Priority: A's reportingManagerId → unit hr_manager
const resolveManager = async (requesterEmployee, unitId, orgId, companyId) => {
  // 1. Reporting manager
  if (requesterEmployee.reportingManagerId) {
    const mgr = await Employee.findOne({
      _id:        requesterEmployee.reportingManagerId,
      isDeleted:  false,
      status:     "ACTIVE",
    }).select("userId name").lean();

    if (mgr?.userId) {
      const mgrUser = await User.findById(mgr.userId).select("_id name email").lean();
      if (mgrUser) return mgrUser;
    }
  }

  // 2. Fallback: hr_manager in unit
  const hrRole = await Role.findOne({
    slug:     "hr_manager",
    isSystem: true,
  }).select("_id").lean();

  if (hrRole) {
    const hrUser = await User.findOne({
      unit_id:    toObjId(unitId),
      org_id:     toObjId(orgId),
      company_id: toObjId(companyId),
      roleId:     hrRole._id,
      isActive:   true,
    }).select("_id name email").lean();

    if (hrUser) return hrUser;
  }

  return null; // no manager found — service will warn
};

// ─── RAISE SWAP REQUEST ──────────────────────────────────────
// POST /shift-swaps
// Body: { requested_employee_id, swapDate, reason?, unit_id? }
exports.raiseSwapRequest = async (payload, user) => {
  const { requested_employee_id, swapDate, reason = "", unit_id } = payload;

  const targetUnitId = unit_id || user.unitId;
  if (!targetUnitId) throw new AppError("unit_id is required", 400);

  const swapDateObj = toMidnight(swapDate);
  if (isNaN(swapDateObj.getTime())) throw new AppError("Invalid swapDate", 400);

  const today = toMidnight(new Date());
  if (swapDateObj < today) throw new AppError("swapDate cannot be in the past", 400);

  // Requester employee
  const requesterEmployee = await Employee.findOne({
    userId:     toObjId(user.userId),
    org_id:     toObjId(user.orgId),
    company_id: toObjId(user.companyId),
    unit_id:    toObjId(targetUnitId),
    isDeleted:  false,
    status:     "ACTIVE",
  }).lean();
  if (!requesterEmployee) throw new AppError("Your employee profile not found in this unit", 404);

  // Cannot swap with self
  if (requesterEmployee._id.toString() === requested_employee_id.toString()) {
    throw new AppError("You cannot raise a swap request with yourself", 400);
  }

  // Requested employee (B)
  const requestedEmployee = await Employee.findOne({
    _id:        toObjId(requested_employee_id),
    org_id:     toObjId(user.orgId),
    company_id: toObjId(user.companyId),
    unit_id:    toObjId(targetUnitId),
    isDeleted:  false,
    status:     "ACTIVE",
  }).lean();
  if (!requestedEmployee) throw new AppError("Requested employee not found in this unit", 404);

  // B's user account
  const requestedUser = await User.findById(requestedEmployee.userId).select("_id name email").lean();
  if (!requestedUser) throw new AppError("Requested employee does not have a user account", 404);

  // Duplicate request check — pending request already exists for same date+pair
  const existing = await ShiftSwapRequest.findOne({
    requesterEmployeeId: requesterEmployee._id,
    requestedEmployeeId: requestedEmployee._id,
    swapDate:            swapDateObj,
    status:              { $in: ["PENDING_ACCEPTANCE", "PENDING_APPROVAL"] },
    is_deleted:          false,
  }).lean();
  if (existing) {
    throw new AppError(
      `A pending swap request already exists for ${fmtDate(swapDateObj)} with this employee`,
      409
    );
  }

  // Resolve both shifts for swapDate (for display / snapshot)
  const aShiftResult = await resolveShiftForEmployee(
    requesterEmployee._id, targetUnitId, user.orgId, user.companyId, swapDateObj
  );
  const bShiftResult = await resolveShiftForEmployee(
    requestedEmployee._id, targetUnitId, user.orgId, user.companyId, swapDateObj
  );

  // Resolve manager
  const manager = await resolveManager(
    requesterEmployee, targetUnitId, user.orgId, user.companyId
  );

  // CRITICAL GAP 3: Read approvalType from AttendancePolicy (dynamic)
  // Default to EMPLOYEE_THEN_MANAGER if no policy found
  const AttendancePolicy = require("../attendancePolicy/models/attendancePolicy.model");
  const policy = await AttendancePolicy.findOne({
    org_id:     toObjId(user.orgId),
    company_id: toObjId(user.companyId),
    unit_id:    toObjId(targetUnitId),
    status:     "active",
    isDeleted:  false,
  }).select("shiftSwapApprovalType").lean();

  const approvalType = policy?.shiftSwapApprovalType || "EMPLOYEE_THEN_MANAGER";

  const initialStatus = approvalType === "MANAGER_ONLY"
    ? "PENDING_APPROVAL"
    : "PENDING_ACCEPTANCE";

  const swapRequest = await ShiftSwapRequest.create({
    org_id:              user.orgId,
    company_id:          user.companyId,
    unit_id:             targetUnitId,
    requesterEmployeeId: requesterEmployee._id,
    requesterUserId:     user.userId,
    requestedEmployeeId: requestedEmployee._id,
    requestedUserId:     requestedUser._id,
    swapDate:            swapDateObj,
    requesterShiftId:    aShiftResult?.shift?._id || null,
    requesterShiftName:  aShiftResult?.shift
      ? `${aShiftResult.shift.name} (${aShiftResult.shift.startTime}-${aShiftResult.shift.endTime})`
      : "Default / No roster",
    requestedShiftId:    bShiftResult?.shift?._id || null,
    requestedShiftName:  bShiftResult?.shift
      ? `${bShiftResult.shift.name} (${bShiftResult.shift.startTime}-${bShiftResult.shift.endTime})`
      : "Default / No roster",
    reason,
    approvalType,
    managerId:           manager?._id || null,
    status:              initialStatus,
    expiresAt:           new Date(swapDateObj.getTime() - 24 * 60 * 60 * 1000), // 1 day before swapDate
    createdBy:           user.userId,
    actionHistory: [{
      actorType: "REQUESTER",
      actorId:   user.userId,
      actorName: requesterEmployee.name,
      action:    "RAISED",
      comment:   reason || null,
      actionAt:  new Date(),
    }],
  });

  // ── Email to B (EMPLOYEE_THEN_MANAGER) or Manager (MANAGER_ONLY) ──
  try {
    if (approvalType === "EMPLOYEE_THEN_MANAGER") {
      await sendEmail({
        to:      requestedUser.email,
        subject: `Shift Swap Request for ${fmtDate(swapDateObj)} — Action Required`,
        html:    shiftSwapRequestEmailTemplate({
          toName:        requestedEmployee.name,
          fromName:      requesterEmployee.name,
          swapDate:      fmtDate(swapDateObj),
          fromShift:     swapRequest.requesterShiftName,
          toShift:       swapRequest.requestedShiftName,
          reason,
          action:        "accept or decline",
          swapRequestId: swapRequest._id,
        }),
      });
    } else if (approvalType === "MANAGER_ONLY" && manager) {
      await sendEmail({
        to:      manager.email,
        subject: `Shift Swap Approval Required — ${fmtDate(swapDateObj)}`,
        html:    shiftSwapApprovalEmailTemplate({
          toName:        manager.name,
          requesterName: requesterEmployee.name,
          requestedName: requestedEmployee.name,
          swapDate:      fmtDate(swapDateObj),
          fromShift:     swapRequest.requesterShiftName,
          toShift:       swapRequest.requestedShiftName,
          reason,
        }),
      });
    }
  } catch (_) {
    // Email failure non-fatal — swap request already created
  }

  return swapRequest;
};

// ─── B RESPONDS (accept / decline) ───────────────────────────
// PATCH /shift-swaps/:id/respond
// Body: { action: "ACCEPT" | "DECLINE", comment? }
// Only requestedEmployee (B) can call this
exports.respondToSwap = async (id, payload, user) => {
  const { action, comment = "" } = payload;
  if (!["ACCEPT", "DECLINE"].includes(action)) {
    throw new AppError("action must be ACCEPT or DECLINE", 400);
  }

  const swap = await ShiftSwapRequest.findOne({
    _id:        toObjId(id),
    org_id:     toObjId(user.orgId),
    company_id: toObjId(user.companyId),
    is_deleted: false,
  });
  if (!swap) throw new AppError("Swap request not found", 404);

  // Only B can respond
  if (swap.requestedUserId.toString() !== user.userId.toString()) {
    throw new AppError("Only the requested employee can respond to this swap", 403);
  }

  if (swap.status !== "PENDING_ACCEPTANCE") {
    throw new AppError(`Cannot respond — current status is ${swap.status}`, 400);
  }

  // swapDate passed?
  if (toMidnight(swap.swapDate) < toMidnight(new Date())) {
    swap.status = "EXPIRED";
    await swap.save();
    throw new AppError("Swap request has expired — swap date has passed", 400);
  }

  const requestedEmployee = await Employee.findById(swap.requestedEmployeeId)
    .select("name").lean();

  if (action === "DECLINE") {
    swap.status      = "REJECTED_BY_B";
    swap.bDeclinedAt = new Date();
    swap.bComment    = comment;
    swap.actionHistory.push({
      actorType: "REQUESTED_EMPLOYEE",
      actorId:   user.userId,
      actorName: requestedEmployee?.name,
      action:    "DECLINED",
      comment:   comment || null,
      actionAt:  new Date(),
    });
    await swap.save();

    // Notify A
    try {
      const requesterUser = await User.findById(swap.requesterUserId)
        .select("name email").lean();
      if (requesterUser) {
        await sendEmail({
          to:      requesterUser.email,
          subject: `Shift Swap Declined — ${fmtDate(swap.swapDate)}`,
          html:    shiftSwapStatusEmailTemplate({
            toName:   requesterUser.name,
            status:   "DECLINED",
            byName:   requestedEmployee?.name,
            swapDate: fmtDate(swap.swapDate),
            comment,
          }),
        });
      }
    } catch (_) {}

    return { message: "Swap request declined", swap };
  }

  // ACCEPT → move to PENDING_APPROVAL, notify manager
  swap.status      = "PENDING_APPROVAL";
  swap.bAcceptedAt = new Date();
  swap.bComment    = comment;
  swap.actionHistory.push({
    actorType: "REQUESTED_EMPLOYEE",
    actorId:   user.userId,
    actorName: requestedEmployee?.name,
    action:    "ACCEPTED",
    comment:   comment || null,
    actionAt:  new Date(),
  });
  await swap.save();

  // Notify manager
  try {
    if (swap.managerId) {
      const manager = await User.findById(swap.managerId).select("name email").lean();
      if (manager) {
        const requesterEmployee = await Employee.findById(swap.requesterEmployeeId)
          .select("name").lean();
        await sendEmail({
          to:      manager.email,
          subject: `Shift Swap Approval Required — ${fmtDate(swap.swapDate)}`,
          html:    shiftSwapApprovalEmailTemplate({
            toName:        manager.name,
            requesterName: requesterEmployee?.name,
            requestedName: requestedEmployee?.name,
            swapDate:      fmtDate(swap.swapDate),
            fromShift:     swap.requesterShiftName,
            toShift:       swap.requestedShiftName,
            reason:        swap.reason,
          }),
        });
      }
    }
  } catch (_) {}

  return { message: "Swap request accepted — awaiting manager approval", swap };
};

// ─── MANAGER APPROVES / REJECTS ──────────────────────────────
// PATCH /shift-swaps/:id/approve  OR  /shift-swaps/:id/reject
// Body for reject: { comment }
exports.managerAction = async (id, action, payload, user) => {
  if (!["APPROVE", "REJECT"].includes(action)) {
    throw new AppError("action must be APPROVE or REJECT", 400);
  }

  const swap = await ShiftSwapRequest.findOne({
    _id:        toObjId(id),
    org_id:     toObjId(user.orgId),
    company_id: toObjId(user.companyId),
    is_deleted: false,
  });
  if (!swap) throw new AppError("Swap request not found", 404);

  if (swap.status !== "PENDING_APPROVAL") {
    throw new AppError(`Cannot act — current status is ${swap.status}`, 400);
  }

  // Manager check — swap.managerId or hr_manager/unit_admin can also act
  const allowedRoles = ["manager", "hr_manager", "company_hr_manager", "unit_admin",
                        "company_admin", "org_admin"];
  const isAllowed = swap.managerId?.toString() === user.userId.toString()
    || allowedRoles.includes(user.roleSlug);
  if (!isAllowed) throw new AppError("You are not authorized to approve this swap", 403);

  const { comment = "" } = payload || {};

  if (action === "REJECT") {
    if (!comment) throw new AppError("Comment is required when rejecting a swap", 400);

    swap.status          = "REJECTED_BY_MANAGER";
    swap.managerActionAt = new Date();
    swap.managerComment  = comment;
    swap.actionHistory.push({
      actorType: "MANAGER",
      actorId:   user.userId,
      actorName: user.name,
      action:    "REJECTED",
      comment,
      actionAt:  new Date(),
    });
    await swap.save();

    // Notify both A and B
    await _notifyBothOnFinalDecision(swap, "REJECTED", comment, user.name);
    return { message: "Swap request rejected", swap };
  }

  // ── APPROVE → update rosters ──────────────────────────────
  await _executeSwap(swap, user);

  swap.status          = "APPROVED";
  swap.managerActionAt = new Date();
  swap.managerComment  = comment;
  swap.rosterUpdated   = true;
  swap.rosterUpdatedAt = new Date();
  swap.actionHistory.push({
    actorType: "MANAGER",
    actorId:   user.userId,
    actorName: user.name,
    action:    "APPROVED",
    comment:   comment || null,
    actionAt:  new Date(),
  });
  await swap.save();

  await _notifyBothOnFinalDecision(swap, "APPROVED", comment, user.name);
  return { message: "Swap request approved — rosters updated", swap };
};

// ─── CANCEL (by A before B responds) ─────────────────────────
// PATCH /shift-swaps/:id/cancel
// Body: { reason? }
exports.cancelSwapRequest = async (id, payload, user) => {
  const swap = await ShiftSwapRequest.findOne({
    _id:        toObjId(id),
    org_id:     toObjId(user.orgId),
    company_id: toObjId(user.companyId),
    is_deleted: false,
  });
  if (!swap) throw new AppError("Swap request not found", 404);

  // Only requester can cancel
  if (swap.requesterUserId.toString() !== user.userId.toString()) {
    throw new AppError("Only the requester can cancel this swap request", 403);
  }

  if (!["PENDING_ACCEPTANCE", "PENDING_APPROVAL"].includes(swap.status)) {
    throw new AppError(`Cannot cancel — current status is ${swap.status}`, 400);
  }

  const reason = payload?.reason || "";
  swap.status              = "CANCELLED";
  swap.cancelledAt         = new Date();
  swap.cancelledBy         = user.userId;
  swap.cancellationReason  = reason;
  swap.actionHistory.push({
    actorType: "REQUESTER",
    actorId:   user.userId,
    actorName: user.name,
    action:    "CANCELLED",
    comment:   reason || null,
    actionAt:  new Date(),
  });
  await swap.save();

  return { message: "Swap request cancelled", swap };
};

// ─── LIST ────────────────────────────────────────────────────
// GET /shift-swaps?type=sent|received|pending_my_action&month=&status=
exports.listSwapRequests = async (query, user) => {
  const {
    type,           // "sent" | "received" | "pending_my_action" | "all"
    status,
    month,
    unit_id,
    page  = 1,
    limit = 20,
  } = query;

  const filter = {
    org_id:     toObjId(user.orgId),
    company_id: toObjId(user.companyId),
    is_deleted: false,
  };

  if (unit_id || user.unitId) filter.unit_id = toObjId(unit_id || user.unitId);
  if (status) filter.status = status;

  // Month filter
  if (month) {
    const [yr, mo]   = month.split("-").map(Number);
    const monthStart = new Date(yr, mo - 1, 1);
    const monthEnd   = new Date(yr, mo, 0);
    monthEnd.setHours(23, 59, 59, 999);
    filter.swapDate = { $gte: monthStart, $lte: monthEnd };
  }

  // Role-based filter
  if (user.roleSlug === "employee") {
    const employee = await Employee.findOne({
      userId:    toObjId(user.userId),
      org_id:    toObjId(user.orgId),
      isDeleted: false,
    }).select("_id").lean();

    if (type === "sent") {
      filter.requesterEmployeeId = employee._id;
    } else if (type === "received") {
      filter.requestedEmployeeId = employee._id;
    } else {
      // Default: show all involving this employee
      filter.$or = [
        { requesterEmployeeId: employee._id },
        { requestedEmployeeId: employee._id },
      ];
    }
  } else if (type === "pending_my_action") {
    // Manager sees swaps awaiting their action
    filter.managerId = toObjId(user.userId);
    filter.status    = "PENDING_APPROVAL";
  }
  // HR/Admin: no additional filter — sees all unit swaps

  const skip  = (Number(page) - 1) * Number(limit);
  const total = await ShiftSwapRequest.countDocuments(filter);

  const swaps = await ShiftSwapRequest.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .populate({ path: "requesterEmployeeId", select: "name employeeId email", model: "Employee" })
    .populate({ path: "requestedEmployeeId", select: "name employeeId email", model: "Employee" })
    .populate({ path: "requesterShiftId",    select: "name startTime endTime" })
    .populate({ path: "requestedShiftId",    select: "name startTime endTime" })
    .populate({ path: "managerId",           select: "name email" })
    .lean();

  return { swaps, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) };
};

// ─── GET BY ID ───────────────────────────────────────────────
exports.getSwapRequestById = async (id, user) => {
  const swap = await ShiftSwapRequest.findOne({
    _id:        toObjId(id),
    org_id:     toObjId(user.orgId),
    company_id: toObjId(user.companyId),
    is_deleted: false,
  })
    .populate({ path: "requesterEmployeeId", select: "name employeeId departmentId email", model: "Employee" })
    .populate({ path: "requestedEmployeeId", select: "name employeeId departmentId email", model: "Employee" })
    .populate({ path: "requesterShiftId",    select: "name startTime endTime shiftType" })
    .populate({ path: "requestedShiftId",    select: "name startTime endTime shiftType" })
    .populate({ path: "managerId",           select: "name email" })
    .lean();

  if (!swap) throw new AppError("Swap request not found", 404);
  return swap;
};

// ─── INTERNAL: Execute Swap (update rosters) ─────────────────
// On manager approval:
//   - A gets B's shift for swapDate (single-day roster override)
//   - B gets A's shift for swapDate (single-day roster override)
// If no roster exists for that day → create new single-day roster
// If roster exists → create 1-day override (existing roster untouched for other dates)
const _executeSwap = async (swap, user) => {
  const swapDate = toMidnight(swap.swapDate);
  const dayAfter = new Date(swapDate.getTime() + 24 * 60 * 60 * 1000 - 1); // end of swapDate

  // Re-resolve current shifts at time of approval (may differ from request time)
  const aCurrentShift = await resolveShiftForEmployee(
    swap.requesterEmployeeId, swap.unit_id, swap.org_id, swap.company_id, swapDate
  );
  const bCurrentShift = await resolveShiftForEmployee(
    swap.requestedEmployeeId, swap.unit_id, swap.org_id, swap.company_id, swapDate
  );

  const aShiftId = aCurrentShift?.shift?._id;
  const bShiftId = bCurrentShift?.shift?._id;

  // Create single-day roster for A with B's shift
  // (Revoke existing single-day roster for swapDate if any)
  await _revokeExistingSingleDayRoster(
    swap.requesterEmployeeId, swap.unit_id, swapDate
  );
  if (bShiftId) {
    await Roster.create({
      org_id:      swap.org_id,
      company_id:  swap.company_id,
      unit_id:     swap.unit_id,
      employee_id: swap.requesterEmployeeId,
      shift_id:    bShiftId,
      startDate:   swapDate,
      endDate:     swapDate,
      notes:       `Shift swap — approved by manager on ${new Date().toLocaleDateString("en-IN")}`,
      status:      "ACTIVE",
      createdBy:   user.userId,
    });
  }

  // Create single-day roster for B with A's shift
  await _revokeExistingSingleDayRoster(
    swap.requestedEmployeeId, swap.unit_id, swapDate
  );
  if (aShiftId) {
    await Roster.create({
      org_id:      swap.org_id,
      company_id:  swap.company_id,
      unit_id:     swap.unit_id,
      employee_id: swap.requestedEmployeeId,
      shift_id:    aShiftId,
      startDate:   swapDate,
      endDate:     swapDate,
      notes:       `Shift swap — approved by manager on ${new Date().toLocaleDateString("en-IN")}`,
      status:      "ACTIVE",
      createdBy:   user.userId,
    });
  }
};

// Revoke any existing single-day roster override for an employee on a date
const _revokeExistingSingleDayRoster = async (employeeId, unitId, date) => {
  const midnight = toMidnight(date);
  await Roster.updateMany(
    {
      employee_id: toObjId(employeeId),
      unit_id:     toObjId(unitId),
      startDate:   midnight,
      endDate:     midnight,
      status:      "ACTIVE",
      is_deleted:  false,
    },
    { $set: { status: "REVOKED", revokedAt: new Date() } }
  );
};

// ─── INTERNAL: Notify both A and B on final decision ─────────
const _notifyBothOnFinalDecision = async (swap, decision, comment, managerName) => {
  try {
    const [requesterUser, requestedUser] = await Promise.all([
      User.findById(swap.requesterUserId).select("name email").lean(),
      User.findById(swap.requestedUserId).select("name email").lean(),
    ]);

    const emailData = {
      status:      decision,
      byName:      managerName,
      swapDate:    fmtDate(swap.swapDate),
      comment,
    };

    if (requesterUser) {
      await sendEmail({
        to:      requesterUser.email,
        subject: `Shift Swap ${decision === "APPROVED" ? "Approved ✅" : "Rejected ❌"} — ${fmtDate(swap.swapDate)}`,
        html:    shiftSwapStatusEmailTemplate({ toName: requesterUser.name, ...emailData }),
      });
    }
    if (requestedUser) {
      await sendEmail({
        to:      requestedUser.email,
        subject: `Shift Swap ${decision === "APPROVED" ? "Approved ✅" : "Rejected ❌"} — ${fmtDate(swap.swapDate)}`,
        html:    shiftSwapStatusEmailTemplate({ toName: requestedUser.name, ...emailData }),
      });
    }
  } catch (_) {}
};

// ─── EMAIL TEMPLATES (inline — same pattern as leaveStatus.js) ──

const shiftSwapRequestEmailTemplate = ({
  toName, fromName, swapDate, fromShift, toShift, reason, swapRequestId,
}) => `
<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px">
  <div style="max-width:600px;margin:auto;background:#fff;border-radius:8px;padding:32px">
    <div style="background:#f59e0b;color:#fff;padding:16px 24px;border-radius:6px;margin-bottom:24px">
      <h2 style="margin:0">🔄 Shift Swap Request</h2>
    </div>
    <p>Hi <strong>${toName}</strong>,</p>
    <p><strong>${fromName}</strong> has requested to swap shifts with you on <strong>${swapDate}</strong>.</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0">
      <tr style="background:#f9fafb">
        <td style="padding:10px;border:1px solid #e5e7eb"><strong>Their Shift</strong></td>
        <td style="padding:10px;border:1px solid #e5e7eb">${fromShift}</td>
      </tr>
      <tr>
        <td style="padding:10px;border:1px solid #e5e7eb"><strong>Your Shift</strong></td>
        <td style="padding:10px;border:1px solid #e5e7eb">${toShift}</td>
      </tr>
      ${reason ? `<tr style="background:#f9fafb">
        <td style="padding:10px;border:1px solid #e5e7eb"><strong>Reason</strong></td>
        <td style="padding:10px;border:1px solid #e5e7eb">${reason}</td>
      </tr>` : ""}
    </table>
    <p>Please log in to the HRMS portal to accept or decline this request.</p>
    <p style="color:#6b7280;font-size:13px">Request ID: ${swapRequestId}</p>
  </div>
</body></html>`;

const shiftSwapApprovalEmailTemplate = ({
  toName, requesterName, requestedName, swapDate, fromShift, toShift, reason,
}) => `
<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px">
  <div style="max-width:600px;margin:auto;background:#fff;border-radius:8px;padding:32px">
    <div style="background:#3b82f6;color:#fff;padding:16px 24px;border-radius:6px;margin-bottom:24px">
      <h2 style="margin:0">⏳ Shift Swap — Approval Required</h2>
    </div>
    <p>Hi <strong>${toName}</strong>,</p>
    <p>A shift swap request between <strong>${requesterName}</strong> and
       <strong>${requestedName}</strong> requires your approval.</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0">
      <tr style="background:#f9fafb">
        <td style="padding:10px;border:1px solid #e5e7eb"><strong>Swap Date</strong></td>
        <td style="padding:10px;border:1px solid #e5e7eb">${swapDate}</td>
      </tr>
      <tr>
        <td style="padding:10px;border:1px solid #e5e7eb"><strong>${requesterName}'s Shift</strong></td>
        <td style="padding:10px;border:1px solid #e5e7eb">${fromShift}</td>
      </tr>
      <tr style="background:#f9fafb">
        <td style="padding:10px;border:1px solid #e5e7eb"><strong>${requestedName}'s Shift</strong></td>
        <td style="padding:10px;border:1px solid #e5e7eb">${toShift}</td>
      </tr>
      ${reason ? `<tr>
        <td style="padding:10px;border:1px solid #e5e7eb"><strong>Reason</strong></td>
        <td style="padding:10px;border:1px solid #e5e7eb">${reason}</td>
      </tr>` : ""}
    </table>
    <p>Please log in to the HRMS portal to approve or reject this swap.</p>
  </div>
</body></html>`;

const shiftSwapStatusEmailTemplate = ({
  toName, status, byName, swapDate, comment,
}) => `
<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px">
  <div style="max-width:600px;margin:auto;background:#fff;border-radius:8px;padding:32px">
    <div style="background:${status === "APPROVED" ? "#10b981" : status === "DECLINED" ? "#ef4444" : "#ef4444"};
                color:#fff;padding:16px 24px;border-radius:6px;margin-bottom:24px">
      <h2 style="margin:0">${status === "APPROVED" ? "✅ Shift Swap Approved" : "❌ Shift Swap " + (status === "DECLINED" ? "Declined" : "Rejected")}</h2>
    </div>
    <p>Hi <strong>${toName}</strong>,</p>
    <p>Your shift swap request for <strong>${swapDate}</strong> has been
       <strong>${status.toLowerCase()}</strong> by <strong>${byName}</strong>.</p>
    ${comment ? `<p><strong>Comment:</strong> ${comment}</p>` : ""}
    <p style="color:#6b7280;font-size:13px">This is an automated notification. Please do not reply.</p>
  </div>
</body></html>`;