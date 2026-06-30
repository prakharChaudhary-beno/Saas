// modules/attendancePolicy/attendancePolicy.service.js
// UPDATED — Policy Versioning: snapshot saved before every UPDATE / ACTIVATE /
//           DEACTIVATE / ARCHIVE / RESTORE. New exports: getVersionHistory,
//           getVersionSnapshot, restoreVersion.
// UPDATED — applicableFor.designations populate added.

const AttendancePolicy = require("./models/attendancePolicy.model");
const AppError          = require("../../utils/appError");
const { invalidatePolicyCache } = require("../../utils/policyResolver");
const policyVersionService = require("../policyVersion/policyVersion.service");

const POLICY_TYPE = "ATTENDANCE";

// ─── Create Policy ────────────────────────────────────────────────────────────
exports.createPolicy = async (body, user) => {

  // ── Guard 1: same name (case-insensitive) already exists for this tenant ───
  const nameExists = await AttendancePolicy.findOne({
    org_id:     user.orgId,
    company_id: user.companyId,
    unit_id:    user.unitId || null,
    name:      { $regex: new RegExp(`^${body.name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
    isDeleted: false,
  });
  if (nameExists) {
    throw new AppError(
      `Attendance policy with name "${body.name}" already exists. Use a different name.`,
      409
    );
  }

  // ── Guard 2: same shift (start+end) + same applicableFor scope already exists
  // Regardless of status — even two drafts with identical shift+scope is meaningless
  const shiftAndScopeFilter = {
    org_id:            user.orgId,
    company_id:        user.companyId,
    isDeleted:         false,
    "shift.start":     body.shift.start,
    "shift.end":       body.shift.end,
  };

  if (body.applicableFor) {
    const { departments = [], designations = [], roles = [], locations = [], employmentTypes = [] } = body.applicableFor;
    if (departments.length)     shiftAndScopeFilter["applicableFor.departments"]     = { $all: departments, $size: departments.length };
    if (designations.length)    shiftAndScopeFilter["applicableFor.designations"]    = { $all: designations, $size: designations.length };
    if (roles.length)           shiftAndScopeFilter["applicableFor.roles"]           = { $all: roles,       $size: roles.length };
    if (locations.length)       shiftAndScopeFilter["applicableFor.locations"]       = { $all: locations,   $size: locations.length };
    if (employmentTypes.length) shiftAndScopeFilter["applicableFor.employmentTypes"] = { $all: employmentTypes, $size: employmentTypes.length };
  }

  const scopeConflict = await AttendancePolicy.findOne(shiftAndScopeFilter);
  if (scopeConflict) {
    throw new AppError(
      `A policy "${scopeConflict.name}" with the same shift timings and scope already exists (status: ${scopeConflict.status}).`,
      409
    );
  }

  const policy = await AttendancePolicy.create({
    ...body,
    org_id:     user.orgId,
    company_id: user.companyId,
    unit_id:    user.unitId || null,
    version:   1,
    createdBy: user.userId,
    updatedBy: user.userId,
  });

  // Version 1 snapshot — captures the initial state
  await policyVersionService.saveVersionSnapshot({
    policyType: POLICY_TYPE,
    policyDocBeforeChange: policy,
    action: "CREATE",
    user,
    changeNote: "Policy created",
  });

  return policy;
};

// ─── Get All Policies ─────────────────────────────────────────────────────────
exports.getPolicies = async (user, query = {}) => {
  const filter = { org_id: user.orgId, company_id: user.companyId };

  if (query.status) filter.status = query.status;

  if (query.search) {
    filter.name = {
      $regex:   query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      $options: "i",
    };
  }

  const page  = parseInt(query.page)  || 1;
  const limit = parseInt(query.limit) || 20;
  const skip  = (page - 1) * limit;

  const [policies, total] = await Promise.all([
    AttendancePolicy.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("applicableFor.departments",  "name")
      .populate("applicableFor.designations", "name")
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email"),
    AttendancePolicy.countDocuments(filter),
  ]);

  return {
    policies,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  };
};

// ─── Get Policy By ID ─────────────────────────────────────────────────────────
exports.getPolicyById = async (id, user) => {
  const policy = await AttendancePolicy.findOne({
    _id:      id,
    org_id:     user.orgId,
    company_id: user.companyId,
    unit_id:    user.unitId || null,
  })
    .populate("applicableFor.departments",  "name")
    .populate("applicableFor.designations", "name")
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email");

  if (!policy) throw new AppError("Attendance policy not found", 404);
  return policy;
};

// ─── Update Policy ────────────────────────────────────────────────────────────
exports.updatePolicy = async (id, body, user) => {
  const policy = await AttendancePolicy.findOne({
    _id:      id,
    org_id:     user.orgId,
    company_id: user.companyId,
    unit_id:    user.unitId || null,
  });

  if (!policy) throw new AppError("Attendance policy not found", 404);

  if (policy.status === "archived") {
    throw new AppError(
      "Cannot update an archived policy. Create a new one instead.",
      400
    );
  }

  // ── Save snapshot of CURRENT state BEFORE applying changes ────────────────
  await policyVersionService.saveVersionSnapshot({
    policyType: POLICY_TYPE,
    policyDocBeforeChange: policy,
    action: "UPDATE",
    user,
    changeNote: body.changeNote || "Policy updated",
    incomingChanges: body,
  });

  // Deep-merge nested objects so partial updates work correctly
  // e.g. PUT with only { lateMark: { enabled: false } } must not wipe other lateMark fields
  const mergeNested = (existing, incoming) => {
    if (!incoming || typeof incoming !== "object") return existing;
    return { ...existing.toObject?.() ?? existing, ...incoming };
  };

  if (body.shift)        policy.shift        = mergeNested(policy.shift, body.shift);
  if (body.lateMark)     policy.lateMark     = mergeNested(policy.lateMark, body.lateMark);
  if (body.sandwichRule) policy.sandwichRule = mergeNested(policy.sandwichRule, body.sandwichRule);
  if (body.overtime)     policy.overtime     = mergeNested(policy.overtime, body.overtime);

  // Scalar / top-level fields
  if (body.name          !== undefined) policy.name          = body.name;
  if (body.description   !== undefined) policy.description   = body.description;
  if (body.applicableFor !== undefined) policy.applicableFor = body.applicableFor;

  policy.version   = policy.version + 1;
  policy.updatedBy = user.userId;

  await policy.save();
  invalidatePolicyCache("attendance", user.companyId.toString());
  return policy;
};
// ─── Activate Policy ──────────────────────────────────────────────────────────
exports.activatePolicy = async (id, user) => {
  const policy = await AttendancePolicy.findOne({ _id: id, org_id: user.orgId, company_id: user.companyId });
  if (!policy) throw new AppError("Attendance policy not found", 404);
  if (policy.status === "active")   throw new AppError("Policy is already active", 400);
  if (policy.status === "archived") throw new AppError("Cannot activate an archived policy", 400);

  await policyVersionService.saveVersionSnapshot({
    policyType: POLICY_TYPE,
    policyDocBeforeChange: policy,
    action: "ACTIVATE",
    user,
    changeNote: "Policy activated",
  });

  policy.status    = "active";
  policy.version   = policy.version + 1;
  policy.updatedBy = user.userId;

  await policy.save();
  invalidatePolicyCache("attendance", user.companyId.toString());
  return policy;
};

// ─── Deactivate Policy ────────────────────────────────────────────────────────
exports.deactivatePolicy = async (id, user) => {
  const policy = await AttendancePolicy.findOne({ _id: id, org_id: user.orgId, company_id: user.companyId });
  if (!policy) throw new AppError("Attendance policy not found", 404);
  if (policy.status === "inactive") throw new AppError("Policy is already inactive", 400);
  if (policy.status === "archived") throw new AppError("Cannot deactivate an archived policy", 400);
  if (policy.status === "draft")    throw new AppError("Cannot deactivate a draft — delete it instead", 400);

  await policyVersionService.saveVersionSnapshot({
    policyType: POLICY_TYPE,
    policyDocBeforeChange: policy,
    action: "DEACTIVATE",
    user,
    changeNote: "Policy deactivated",
  });

  policy.status    = "inactive";
  policy.version   = policy.version + 1;
  policy.updatedBy = user.userId;

  await policy.save();
  invalidatePolicyCache("attendance", user.companyId.toString());
  return policy;
};

// ─── Archive Policy ───────────────────────────────────────────────────────────
exports.archivePolicy = async (id, user) => {
  const policy = await AttendancePolicy.findOne({ _id: id, org_id: user.orgId, company_id: user.companyId });
  if (!policy) throw new AppError("Attendance policy not found", 404);
  if (policy.status === "archived") throw new AppError("Policy is already archived", 400);

  await policyVersionService.saveVersionSnapshot({
    policyType: POLICY_TYPE,
    policyDocBeforeChange: policy,
    action: "ARCHIVE",
    user,
    changeNote: "Policy archived",
  });

  policy.status    = "archived";
  policy.version   = policy.version + 1;
  policy.updatedBy = user.userId;

  await policy.save();
  invalidatePolicyCache("attendance", user.companyId.toString());
  return policy;
};

// ─── Delete Policy ────────────────────────────────────────────────────────────
exports.deletePolicy = async (id, user) => {
  const policy = await AttendancePolicy.findOne({ _id: id, org_id: user.orgId, company_id: user.companyId });
  if (!policy) throw new AppError("Attendance policy not found", 404);
  if (policy.status === "active") {
    throw new AppError("Cannot delete an active policy. Archive it first.", 400);
  }

  policy.isDeleted = true;
  policy.updatedBy = user.userId;
  await policy.save();

  return { message: "Policy deleted successfully" };
};

// ═══════════════════════════════════════════════════════════════════════════
// ─── VERSIONING ───────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

// ─── GET VERSION HISTORY ──────────────────────────────────────────────────
exports.getVersionHistory = async (id, user) => {
  const policy = await AttendancePolicy.findOne({ _id: id, org_id: user.orgId, company_id: user.companyId }).select("_id name version");
  if (!policy) throw new AppError("Attendance policy not found", 404);

  const history = await policyVersionService.getVersionHistory(POLICY_TYPE, id, user);

  return {
    policyId:       policy._id,
    policyName:     policy.name,
    currentVersion: policy.version,
    history,
  };
};

// ─── GET ONE VERSION SNAPSHOT ──────────────────────────────────────────────
exports.getVersionSnapshot = async (id, version, user) => {
  const policy = await AttendancePolicy.findOne({ _id: id, org_id: user.orgId, company_id: user.companyId }).select("_id name");
  if (!policy) throw new AppError("Attendance policy not found", 404);

  return await policyVersionService.getVersionSnapshot(POLICY_TYPE, id, version, user);
};

// ─── RESTORE A PREVIOUS VERSION ────────────────────────────────────────────
exports.restoreVersion = async (id, version, user) => {
  const policy = await AttendancePolicy.findOne({ _id: id, org_id: user.orgId, company_id: user.companyId });
  if (!policy) throw new AppError("Attendance policy not found", 404);
  if (policy.status === "archived") {
    throw new AppError("Cannot restore an archived policy. Activate or unarchive first.", 400);
  }

  const snapshot = await policyVersionService.prepareRestore(POLICY_TYPE, id, version, user);

  await policyVersionService.saveVersionSnapshot({
    policyType: POLICY_TYPE,
    policyDocBeforeChange: policy,
    action: "RESTORE",
    user,
    changeNote: `Restored from version ${version}`,
  });

 const PROTECTED_FIELDS = new Set([
  "_id", "org_id", "company_id", "unit_id",
  "status", "isDeleted",
  "activatedBy", "activatedAt", "archivedBy", "archivedAt",
  "createdBy", "createdAt", "updatedAt", "version",
  "isActive", "id",
]);

const allConfigFields = Object.keys(policy.toObject())
  .filter(k => !PROTECTED_FIELDS.has(k));

for (const key of allConfigFields) {
  if (!PROTECTED_FIELDS.has(key)) {
    policy[key] = key in snapshot ? snapshot[key] : null;
  }
}

  policy.version   = policy.version + 1;
  policy.updatedBy = user.userId;

  await policy.save();
  invalidatePolicyCache("attendance", user.companyId.toString());
  return policy;
};
