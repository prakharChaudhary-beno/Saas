// modules/delegation/delegation.service.js
//
// Delegation workflow — temporarily share your permissions with someone else
//
// Dynamic design:
//   - Sirf apni permissions delegate kar sakte ho (role mein honi chahiye)
//   - Permission scope check — unit level user org-level permission delegate nahi kar sakta
//   - startDate >= today, endDate > startDate
//   - maxDelegationDays: company config se (default 90 days)
//   - approvalRequired: company config se (default false — turant ACTIVE)
//   - Ek hi permission ek waqt mein ek person ko sirf ek baar
//   - Delegatee ko email on create, delegator ko email on revoke/expire
//   - Cron job (app.js mein register karna hai) roz expire karega

"use strict";

const Delegation = require("./models/delegation.model");
const Permission = require("../permission/permission.model");
const Role       = require("../role/role.model");
const User       = require("../auth/models/user.model");
const Employee   = require("../employee/models/employee.model");
const AppError   = require("../../utils/appError");
const { sendEmail } = require("../../utils/email/email");
const mongoose   = require("mongoose");

const toObjId    = (id) => new mongoose.Types.ObjectId(String(id));
const toMidnight = (d)  => { const dt = new Date(d); dt.setHours(0,0,0,0); return dt; };
const fmtDate    = (d)  => d
  ? new Date(d).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" })
  : "";

// ─── Max delegation days (default 90) ────────────────────────
// Future: read from company config
const MAX_DELEGATION_DAYS = 90;

// ─── Scope level hierarchy ────────────────────────────────────
const LEVEL_ORDER = { org: 3, company: 2, unit: 1 };

// ─── Helper: get delegator's role + permissions ───────────────
const getDelegatorRole = async (userId, orgId, companyId) => {
  const user = await User.findById(userId).select("roleId").lean();
  if (!user?.roleId) throw new AppError("User role not found", 404);

  const role = await Role.findById(user.roleId)
    .select("permissions level slug")
    .populate("permissions", "name slug scope label")
    .lean();

  if (!role) throw new AppError("Role not found", 404);
  return role;
};

// ─── Helper: resolve approverId ──────────────────────────────
// Delegator ke reporting manager → fallback unit hr_manager
const resolveApprover = async (delegatorUserId, unitId, orgId, companyId) => {
  // Try reporting manager via employee record
  const emp = await Employee.findOne({
    userId:    toObjId(delegatorUserId),
    org_id:    toObjId(orgId),
    isDeleted: false,
  }).select("reportingManagerId").lean();

  if (emp?.reportingManagerId) {
    const mgrEmp = await Employee.findById(emp.reportingManagerId)
      .select("userId").lean();
    if (mgrEmp?.userId) {
      const mgrUser = await User.findById(mgrEmp.userId)
        .select("_id name email").lean();
      if (mgrUser) return mgrUser;
    }
  }

  // Fallback: hr_manager in unit
  const hrRole = await Role.findOne({ slug: "hr_manager", isSystem: true })
    .select("_id").lean();
  if (hrRole) {
    const hrUser = await User.findOne({
      unit_id:   toObjId(unitId),
      org_id:    toObjId(orgId),
      roleId:    hrRole._id,
      isActive:  true,
    }).select("_id name email").lean();
    if (hrUser) return hrUser;
  }

  return null;
};

// ─── CREATE DELEGATION ───────────────────────────────────────
// POST /delegations
// Body: { delegatee_id, permissions: [permissionId], startDate, endDate, reason, unit_id? }
exports.createDelegation = async (payload, user) => {
  const {
    delegatee_id,
    permissions: permissionIds,
    startDate,
    endDate,
    reason,
    unit_id,
  } = payload;

  const targetUnitId = unit_id || user.unitId;
  if (!targetUnitId) throw new AppError("unit_id is required", 400);

  // Cannot delegate to self
  if (delegatee_id.toString() === user.userId.toString()) {
    throw new AppError("You cannot delegate permissions to yourself", 400);
  }

  // Date validation
  const start = toMidnight(startDate);
  const end   = toMidnight(endDate);
  const today = toMidnight(new Date());

  if (isNaN(start.getTime())) throw new AppError("Invalid startDate", 400);
  if (isNaN(end.getTime()))   throw new AppError("Invalid endDate", 400);
  if (start < today)          throw new AppError("startDate cannot be in the past", 400);
  if (end <= start)           throw new AppError("endDate must be after startDate", 400);

  // Max duration check
  const durationDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  if (durationDays > MAX_DELEGATION_DAYS) {
    throw new AppError(
      `Delegation cannot exceed ${MAX_DELEGATION_DAYS} days. Requested: ${durationDays} days.`,
      400
    );
  }

  // Delegatee exists
  const delegateeUser = await User.findOne({
    _id:      toObjId(delegatee_id),
    org_id:   toObjId(user.orgId),
    status:   "ACTIVE",
    
  }).select("_id name email").lean();
  if (!delegateeUser) throw new AppError("Delegatee user not found or inactive", 404);

  // Get delegator's role + permissions
  const delegatorRole = await getDelegatorRole(user.userId, user.orgId, user.companyId);
  const delegatorPermIds = new Set(
    (delegatorRole.permissions || []).map((p) => p._id.toString())
  );
  const delegatorLevel = delegatorRole.level || "unit";

  // Validate requested permissions
  if (!Array.isArray(permissionIds) || permissionIds.length === 0) {
    throw new AppError("At least one permission is required", 400);
  }

  const permDocs = await Permission.find({
    _id:       { $in: permissionIds.map(toObjId) },
    is_active: true,
  }).lean();

  if (permDocs.length !== permissionIds.length) {
    throw new AppError("One or more permissions not found or inactive", 404);
  }

  // Rule 1: Can only delegate permissions you have
  const invalidPerms = permDocs.filter(
    (p) => !delegatorPermIds.has(p._id.toString())
  );
  if (invalidPerms.length > 0) {
    throw new AppError(
      `You cannot delegate permission(s) you don't have: ${invalidPerms.map((p) => p.slug).join(", ")}`,
      403
    );
  }

  // Rule 2: Permission scope must be within delegator's level
  const myLevelOrder = LEVEL_ORDER[delegatorLevel] || 1;
  const outOfScope = permDocs.filter((p) => {
    const permMinLevel = Math.min(...(p.scope || ["unit"]).map((s) => LEVEL_ORDER[s] || 1));
    return permMinLevel > myLevelOrder;
  });
  if (outOfScope.length > 0) {
    throw new AppError(
      `Permission(s) out of your scope level: ${outOfScope.map((p) => p.slug).join(", ")}`,
      403
    );
  }

  // Duplicate check: same delegatee already has one of these permissions delegated + ACTIVE
  const overlap = await Delegation.findOne({
    delegator_id: toObjId(user.userId),
    delegatee_id: toObjId(delegatee_id),
    permissions:  { $in: permissionIds.map(toObjId) },
    status:       { $in: ["ACTIVE", "PENDING"] },
    startDate:    { $lte: end },
    endDate:      { $gte: start },
    is_deleted:   false,
  }).lean();
  if (overlap) {
    throw new AppError(
      "An active or pending delegation already exists for one or more of these permissions " +
      "with this user in the overlapping date range",
      409
    );
  }

  // approvalRequired — default false (future: company config)
  const approvalRequired = false;
  const initialStatus    = approvalRequired ? "PENDING" : "ACTIVE";

  // Resolve approver if needed
  let approverId = null;
  if (approvalRequired) {
    const approver = await resolveApprover(user.userId, targetUnitId, user.orgId, user.companyId);
    approverId = approver?._id || null;
  }

  const delegation = await Delegation.create({
    org_id:          user.orgId,
    company_id:      user.companyId,
    unit_id:         targetUnitId,
    delegator_id:    toObjId(user.userId),
    delegatee_id:    toObjId(delegatee_id),
    permissions:     permDocs.map((p) => p._id),
    permissionSlugs: permDocs.map((p) => p.slug),
    startDate:       start,
    endDate:         end,
    reason,
    approvalRequired,
    approverId:      approverId || null,
    status:          initialStatus,
    notifiedAt:      null,
    actionHistory: [{
      actorType: "DELEGATOR",
      actorId:   user.userId,
      actorName: user.name,
      action:    "CREATED",
      comment:   reason || null,
      actionAt:  new Date(),
    }],
    createdBy: user.userId,
  });

  // Email to delegatee
  try {
    await sendEmail({
      to:      delegateeUser.email,
      subject: `Permissions Delegated to You — ${fmtDate(start)} to ${fmtDate(end)}`,
      html:    delegationCreatedEmailTemplate({
        toName:     delegateeUser.name,
        fromName:   user.name,
        permissions: permDocs.map((p) => p.label || p.slug),
        startDate:  fmtDate(start),
        endDate:    fmtDate(end),
        reason,
      }),
    });

    await Delegation.findByIdAndUpdate(delegation._id, { notifiedAt: new Date() });
  } catch (_) {
    // Non-fatal
  }

  return delegation;
};

// ─── GET MY DELEGATIONS (sent) ───────────────────────────────
// GET /delegations?status=&page=&limit=
exports.getMyDelegations = async (query, user) => {
  const { status, page = 1, limit = 20 } = query;

  const filter = {
    delegator_id: toObjId(user.userId),
    is_deleted:   false,
  };
  if (status) filter.status = status;

  const skip  = (Number(page) - 1) * Number(limit);
  const total = await Delegation.countDocuments(filter);

  const delegations = await Delegation.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .populate("delegatee_id",  "name email")
    .populate("permissions",   "slug label module")
    .lean();

  return { delegations, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) };
};

// ─── GET RECEIVED DELEGATIONS ────────────────────────────────
// GET /delegations/received?status=&page=&limit=
exports.getReceivedDelegations = async (query, user) => {
  const { status, page = 1, limit = 20 } = query;

  const now = new Date();
  const filter = {
    delegatee_id: toObjId(user.userId),
    is_deleted:   false,
  };

  if (status) {
    filter.status = status;
  } else {
    // Default: show active + in-effect only
    filter.status    = "ACTIVE";
    filter.startDate = { $lte: now };
    filter.endDate   = { $gte: now };
  }

  const skip  = (Number(page) - 1) * Number(limit);
  const total = await Delegation.countDocuments(filter);

  const delegations = await Delegation.find(filter)
    .sort({ endDate: 1 }) // soonest expiring first
    .skip(skip)
    .limit(Number(limit))
    .populate("delegator_id", "name email")
    .populate("permissions",  "slug label module")
    .lean();

  return { delegations, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) };
};

// ─── GET BY ID ───────────────────────────────────────────────
exports.getDelegationById = async (id, user) => {
  const delegation = await Delegation.findOne({
    _id:        toObjId(id),
    org_id:     toObjId(user.orgId),
    is_deleted: false,
  })
    .populate("delegator_id", "name email")
    .populate("delegatee_id", "name email")
    .populate("permissions",  "slug label module scope")
    .populate("approverId",   "name email")
    .lean();

  if (!delegation) throw new AppError("Delegation not found", 404);

  // Scope check — only delegator, delegatee, approver, or HR+ can view
  const allowedIds = [
    delegation.delegator_id?._id?.toString(),
    delegation.delegatee_id?._id?.toString(),
    delegation.approverId?._id?.toString(),
  ].filter(Boolean);

  const isHR = ["hr_manager","company_hr_manager","unit_admin","company_admin","org_admin"]
    .includes(user.roleSlug);

  if (!isHR && !allowedIds.includes(user.userId.toString())) {
    throw new AppError("You are not authorized to view this delegation", 403);
  }

  return delegation;
};

// ─── REVOKE ──────────────────────────────────────────────────
// PATCH /delegations/:id/revoke
// Body: { reason? }
// Only delegator or HR+ can revoke
exports.revokeDelegation = async (id, payload, user) => {
  const delegation = await Delegation.findOne({
    _id:        toObjId(id),
    org_id:     toObjId(user.orgId),
    is_deleted: false,
  });
  if (!delegation) throw new AppError("Delegation not found", 404);

  // Auth check
  const isHR = ["hr_manager","company_hr_manager","unit_admin","company_admin","org_admin"]
    .includes(user.roleSlug);
  const isDelegator = delegation.delegator_id.toString() === user.userId.toString();

  if (!isHR && !isDelegator) {
    throw new AppError("Only the delegator or an HR admin can revoke this delegation", 403);
  }

  if (["EXPIRED","REVOKED"].includes(delegation.status)) {
    throw new AppError(`Delegation is already ${delegation.status.toLowerCase()}`, 400);
  }

  const reason = payload?.reason || "";

  delegation.status           = "REVOKED";
  delegation.revokedAt        = new Date();
  delegation.revokedBy        = toObjId(user.userId);
  delegation.revocationReason = reason;
  delegation.updatedBy        = user.userId;
  delegation.actionHistory.push({
    actorType: isHR && !isDelegator ? "APPROVER" : "DELEGATOR",
    actorId:   user.userId,
    actorName: user.name,
    action:    "REVOKED",
    comment:   reason || null,
    actionAt:  new Date(),
  });

  await delegation.save();

  // Notify delegatee
  try {
    const delegateeUser = await User.findById(delegation.delegatee_id)
      .select("name email").lean();
    const delegatorUser = await User.findById(delegation.delegator_id)
      .select("name").lean();

    if (delegateeUser) {
      await sendEmail({
        to:      delegateeUser.email,
        subject: "Delegated Permissions Revoked",
        html:    delegationRevokedEmailTemplate({
          toName:       delegateeUser.name,
          fromName:     delegatorUser?.name || "Your manager",
          permissions:  delegation.permissionSlugs,
          revokedAt:    fmtDate(new Date()),
          reason,
        }),
      });
    }
  } catch (_) {}

  return { message: "Delegation revoked successfully", delegation };
};

// ─── APPROVE (if approvalRequired: true) ─────────────────────
// PATCH /delegations/:id/approve
exports.approveDelegation = async (id, payload, user) => {
  const delegation = await Delegation.findOne({
    _id:        toObjId(id),
    org_id:     toObjId(user.orgId),
    is_deleted: false,
  });
  if (!delegation) throw new AppError("Delegation not found", 404);
  if (delegation.status !== "PENDING") {
    throw new AppError(`Cannot approve — current status is ${delegation.status}`, 400);
  }

  // Only approver or HR+ can approve
  const isApprover = delegation.approverId?.toString() === user.userId.toString();
  const isHR = ["hr_manager","company_hr_manager","unit_admin","company_admin","org_admin"]
    .includes(user.roleSlug);
  if (!isApprover && !isHR) {
    throw new AppError("You are not authorized to approve this delegation", 403);
  }

  delegation.status     = "ACTIVE";
  delegation.approvedAt = new Date();
  delegation.approvedBy = toObjId(user.userId);
  delegation.updatedBy  = user.userId;
  delegation.actionHistory.push({
    actorType: "APPROVER",
    actorId:   user.userId,
    actorName: user.name,
    action:    "APPROVED",
    comment:   payload?.comment || null,
    actionAt:  new Date(),
  });

  await delegation.save();

  // Notify delegatee
  try {
    const delegateeUser = await User.findById(delegation.delegatee_id)
      .select("name email").lean();
    if (delegateeUser) {
      await sendEmail({
        to:      delegateeUser.email,
        subject: "Delegated Permissions Now Active",
        html:    delegationApprovedEmailTemplate({
          toName:      delegateeUser.name,
          permissions: delegation.permissionSlugs,
          startDate:   fmtDate(delegation.startDate),
          endDate:     fmtDate(delegation.endDate),
        }),
      });
    }
  } catch (_) {}

  return { message: "Delegation approved and now active", delegation };
};

// ─── REJECT ──────────────────────────────────────────────────
// PATCH /delegations/:id/reject
// Body: { reason } — mandatory
exports.rejectDelegation = async (id, payload, user) => {
  const delegation = await Delegation.findOne({
    _id:        toObjId(id),
    org_id:     toObjId(user.orgId),
    is_deleted: false,
  });
  if (!delegation) throw new AppError("Delegation not found", 404);
  if (delegation.status !== "PENDING") {
    throw new AppError(`Cannot reject — current status is ${delegation.status}`, 400);
  }

  const isApprover = delegation.approverId?.toString() === user.userId.toString();
  const isHR = ["hr_manager","company_hr_manager","unit_admin","company_admin","org_admin"]
    .includes(user.roleSlug);
  if (!isApprover && !isHR) {
    throw new AppError("You are not authorized to reject this delegation", 403);
  }

  if (!payload?.reason) throw new AppError("Reason is required when rejecting", 400);

  delegation.status      = "REJECTED";
  delegation.rejectedAt  = new Date();
  delegation.rejectedBy  = toObjId(user.userId);
  delegation.updatedBy   = user.userId;
  delegation.actionHistory.push({
    actorType: "APPROVER",
    actorId:   user.userId,
    actorName: user.name,
    action:    "REJECTED",
    comment:   payload.reason,
    actionAt:  new Date(),
  });

  await delegation.save();

  // Notify delegator
  try {
    const delegatorUser = await User.findById(delegation.delegator_id)
      .select("name email").lean();
    if (delegatorUser) {
      await sendEmail({
        to:      delegatorUser.email,
        subject: "Your Delegation Request Was Rejected",
        html:    delegationRejectedEmailTemplate({
          toName:      delegatorUser.name,
          permissions: delegation.permissionSlugs,
          reason:      payload.reason,
          rejectedBy:  user.name,
        }),
      });
    }
  } catch (_) {}

  return { message: "Delegation rejected", delegation };
};

// ─── EXPIRE CRON (called by app.js scheduler) ────────────────
// Runs daily — marks all past-endDate ACTIVE delegations as EXPIRED
exports.expireOldDelegations = async () => {
  const now = new Date();

  const result = await Delegation.updateMany(
    {
      status:     "ACTIVE",
      endDate:    { $lt: now },
      is_deleted: false,
    },
    {
      $set: {
        status: "EXPIRED",
      },
      $push: {
        actionHistory: {
          actorType: "SYSTEM",
          actorId:   new mongoose.Types.ObjectId("000000000000000000000000"),
          action:    "EXPIRED",
          comment:   "Auto-expired by system scheduler",
          actionAt:  now,
        },
      },
    }
  );

  return { expired: result.modifiedCount };
};

// ─── EMAIL TEMPLATES ─────────────────────────────────────────

const delegationCreatedEmailTemplate = ({ toName, fromName, permissions, startDate, endDate, reason }) => `
<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px">
  <div style="max-width:600px;margin:auto;background:#fff;border-radius:8px;padding:32px">
    <div style="background:#7c3aed;color:#fff;padding:16px 24px;border-radius:6px;margin-bottom:24px">
      <h2 style="margin:0">🔑 Permissions Delegated to You</h2>
    </div>
    <p>Hi <strong>${toName}</strong>,</p>
    <p><strong>${fromName}</strong> has delegated the following permissions to you:</p>
    <ul style="margin:16px 0;padding-left:20px">
      ${permissions.map((p) => `<li style="margin-bottom:6px">${p}</li>`).join("")}
    </ul>
    <table style="width:100%;border-collapse:collapse;margin:20px 0">
      <tr style="background:#f9fafb">
        <td style="padding:10px;border:1px solid #e5e7eb"><strong>Valid From</strong></td>
        <td style="padding:10px;border:1px solid #e5e7eb">${startDate}</td>
      </tr>
      <tr>
        <td style="padding:10px;border:1px solid #e5e7eb"><strong>Valid Until</strong></td>
        <td style="padding:10px;border:1px solid #e5e7eb">${endDate}</td>
      </tr>
      ${reason ? `<tr style="background:#f9fafb">
        <td style="padding:10px;border:1px solid #e5e7eb"><strong>Reason</strong></td>
        <td style="padding:10px;border:1px solid #e5e7eb">${reason}</td>
      </tr>` : ""}
    </table>
    <p>These permissions will be automatically removed after <strong>${endDate}</strong>.</p>
    <p style="color:#6b7280;font-size:13px">This is an automated notification.</p>
  </div>
</body></html>`;

const delegationRevokedEmailTemplate = ({ toName, fromName, permissions, revokedAt, reason }) => `
<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px">
  <div style="max-width:600px;margin:auto;background:#fff;border-radius:8px;padding:32px">
    <div style="background:#dc2626;color:#fff;padding:16px 24px;border-radius:6px;margin-bottom:24px">
      <h2 style="margin:0">🔒 Delegated Permissions Revoked</h2>
    </div>
    <p>Hi <strong>${toName}</strong>,</p>
    <p>The following permissions delegated by <strong>${fromName}</strong> have been revoked:</p>
    <ul style="margin:16px 0;padding-left:20px">
      ${permissions.map((p) => `<li style="margin-bottom:6px">${p}</li>`).join("")}
    </ul>
    ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
    <p style="color:#6b7280;font-size:13px">Revoked on: ${revokedAt}</p>
  </div>
</body></html>`;

const delegationApprovedEmailTemplate = ({ toName, permissions, startDate, endDate }) => `
<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px">
  <div style="max-width:600px;margin:auto;background:#fff;border-radius:8px;padding:32px">
    <div style="background:#10b981;color:#fff;padding:16px 24px;border-radius:6px;margin-bottom:24px">
      <h2 style="margin:0">✅ Delegated Permissions Now Active</h2>
    </div>
    <p>Hi <strong>${toName}</strong>,</p>
    <p>Your delegated permissions have been approved and are now active:</p>
    <ul style="margin:16px 0;padding-left:20px">
      ${permissions.map((p) => `<li style="margin-bottom:6px">${p}</li>`).join("")}
    </ul>
    <p><strong>Valid:</strong> ${startDate} — ${endDate}</p>
  </div>
</body></html>`;

const delegationRejectedEmailTemplate = ({ toName, permissions, reason, rejectedBy }) => `
<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px">
  <div style="max-width:600px;margin:auto;background:#fff;border-radius:8px;padding:32px">
    <div style="background:#f59e0b;color:#fff;padding:16px 24px;border-radius:6px;margin-bottom:24px">
      <h2 style="margin:0">❌ Delegation Request Rejected</h2>
    </div>
    <p>Hi <strong>${toName}</strong>,</p>
    <p>Your delegation request for the following permissions was rejected by <strong>${rejectedBy}</strong>:</p>
    <ul style="margin:16px 0;padding-left:20px">
      ${permissions.map((p) => `<li style="margin-bottom:6px">${p}</li>`).join("")}
    </ul>
    <p><strong>Reason:</strong> ${reason}</p>
  </div>
</body></html>`;