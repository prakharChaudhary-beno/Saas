// modules/payrollPolicy/payrollPolicy.service.js
// UPDATED — Policy Versioning: snapshot saved before every UPDATE / ACTIVATE /
//           DEACTIVATE / ARCHIVE / RESTORE. New exports: getVersionHistory,
//           getVersionSnapshot, restoreVersion.
// UPDATED — designation-level scope: conflict check + getResolvedPolicy scoring
//           + applicableFor.designations populate.

const PayrollPolicy = require("./models/payrollPolicy.model");
const AppError      = require("../../utils/appError");
const { invalidatePolicyCache } = require("../../utils/policyResolver");
const policyVersionService = require("../policyVersion/policyVersion.service");

const POLICY_TYPE = "PAYROLL";

// ─── Create Policy ────────────────────────────────────────────────────────────
exports.createPolicy = async (body, user) => {

  // Guard: duplicate name (case-insensitive) within tenant
  const nameExists = await PayrollPolicy.findOne({
org_id:     user.orgId,
    company_id: user.companyId,
    name:      { $regex: new RegExp(`^${body.name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
    isDeleted: false,
  });
  if (nameExists) {
    throw new AppError(
      `Payroll policy with name "${body.name}" already exists. Use a different name.`,
      409
    );
  }

  // Guard: only one ACTIVE policy can apply to the same scope
  if (body.status === "active") {
    await _checkScopeConflict(null, body, user.companyId);
  }

  // Auto-populate ptSlabs from ptState if PT is enabled
  if (body.taxCompliance?.ptEnabled && body.taxCompliance?.ptState) {
    try {
      const { PT_SLABS } = require("../../config/ptSlabs");
      const stateCode = body.taxCompliance.ptState;
      if (PT_SLABS[stateCode]?.slabs) {
        body.taxCompliance.ptSlabs = PT_SLABS[stateCode].slabs;
      }
    } catch (err) {
      console.error("Failed to auto-populate ptSlabs:", err.message);
    }
  }

  const policy = await PayrollPolicy.create({
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
  if (user.unitId) filter.unit_id = user.unitId;

  if (query.status)           filter.status = query.status;
  if (query.employmentType)   filter["applicableFor.employmentTypes"] = query.employmentType;
  if (query.department)       filter["applicableFor.departments"] = query.department;
  if (query.designation)      filter["applicableFor.designations"] = query.designation;

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
    PayrollPolicy.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("applicableFor.departments",  "name")
      .populate("applicableFor.designations", "name")
      .populate("createdBy",  "name email")
      .populate("updatedBy",  "name email"),
    PayrollPolicy.countDocuments(filter),
  ]);

  return {
    policies,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  };
};

// ─── Get Policy By ID ─────────────────────────────────────────────────────────
exports.getPolicyById = async (id, user) => {
  const policy = await PayrollPolicy.findOne({ _id: id, org_id: user.orgId, company_id: user.companyId })
    .populate("applicableFor.departments",  "name")
    .populate("applicableFor.designations", "name")
    .populate("createdBy",   "name email")
    .populate("updatedBy",   "name email")
    .populate("activatedBy", "name email")
    .populate("archivedBy",  "name email");

  if (!policy) throw new AppError("Payroll policy not found", 404);
  return policy;
};

// ─── Update Policy ────────────────────────────────────────────────────────────
exports.updatePolicy = async (id, body, user) => {
  const policy = await PayrollPolicy.findOne({ _id: id, org_id: user.orgId, company_id: user.companyId });
  if (!policy) throw new AppError("Payroll policy not found", 404);

  if (policy.status === "archived") {
    throw new AppError("Cannot update an archived policy. Create a new version instead.", 400);
  }

  // Scope conflict check if activating via update
  if (body.status === "active" && policy.status !== "active") {
    await _checkScopeConflict(id, body, user.companyId);
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

  // Deep-merge nested sections so partial PUTs don't wipe other fields
  const nestedSections = [
    "salaryCycle", "lop", "deductionPriority", "unpaidLeave",
    "overtimePay", "proRata", "payslipConfig", "taxCompliance", "arrear",
  ];

  for (const section of nestedSections) {
    if (body[section]) {
      const existing = policy[section]?.toObject?.() ?? policy[section] ?? {};
      policy[section] = { ...existing, ...body[section] };
    }
  }

  // Auto-populate ptSlabs from ptState if PT is enabled
  if (policy.taxCompliance?.ptEnabled && policy.taxCompliance?.ptState) {
    try {
      const { PT_SLABS } = require("../../config/ptSlabs");
      const stateCode = policy.taxCompliance.ptState;
      if (PT_SLABS[stateCode]?.slabs) {
        policy.taxCompliance.ptSlabs = PT_SLABS[stateCode].slabs;
      }
    } catch (err) {
      console.error("Failed to auto-populate ptSlabs:", err.message);
    }
  }

  // Scalar fields
  const scalarFields = ["name", "description", "status", "effectiveFrom", "effectiveTo", "applicableFor"];
  for (const f of scalarFields) {
    if (body[f] !== undefined) policy[f] = body[f];
  }

  policy.version   = policy.version + 1;
  policy.updatedBy = user.userId;

  await policy.save();
  invalidatePolicyCache("payroll", user.companyId.toString());
  return policy;
};

// ─── Activate Policy ──────────────────────────────────────────────────────────
exports.activatePolicy = async (id, user) => {
  const policy = await PayrollPolicy.findOne({ _id: id, org_id: user.orgId, company_id: user.companyId });
  if (!policy) throw new AppError("Payroll policy not found", 404);

  if (policy.status === "active")   throw new AppError("Policy is already active", 400);
  if (policy.status === "archived") throw new AppError("Cannot activate an archived policy", 400);

  // Check scope conflict before activating
  await _checkScopeConflict(id, policy, user.companyId);

  await policyVersionService.saveVersionSnapshot({
    policyType: POLICY_TYPE,
    policyDocBeforeChange: policy,
    action: "ACTIVATE",
    user,
    changeNote: "Policy activated",
  });

  policy.status      = "active";
  policy.activatedBy = user.userId;
  policy.activatedAt = new Date();
  policy.version     = policy.version + 1;
  policy.updatedBy   = user.userId;

  await policy.save();
  invalidatePolicyCache("payroll", user.companyId.toString());
  return policy;
};

// ─── Deactivate Policy ────────────────────────────────────────────────────────
exports.deactivatePolicy = async (id, user) => {
  const policy = await PayrollPolicy.findOne({ _id: id, org_id: user.orgId, company_id: user.companyId });
  if (!policy) throw new AppError("Payroll policy not found", 404);

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
  invalidatePolicyCache("payroll", user.companyId.toString());
  return policy;
};

// ─── Archive Policy ───────────────────────────────────────────────────────────
exports.archivePolicy = async (id, user) => {
  const policy = await PayrollPolicy.findOne({ _id: id, org_id: user.orgId, company_id: user.companyId });
  if (!policy) throw new AppError("Payroll policy not found", 404);

  if (policy.status === "archived") throw new AppError("Policy is already archived", 400);

  await policyVersionService.saveVersionSnapshot({
    policyType: POLICY_TYPE,
    policyDocBeforeChange: policy,
    action: "ARCHIVE",
    user,
    changeNote: "Policy archived",
  });

  policy.status     = "archived";
  policy.archivedBy = user.userId;
  policy.archivedAt = new Date();
  policy.version    = policy.version + 1;
  policy.updatedBy  = user.userId;

  await policy.save();
  invalidatePolicyCache("payroll", user.companyId.toString());
  return policy;
};

// ─── Delete Policy ────────────────────────────────────────────────────────────
exports.deletePolicy = async (id, user) => {
  const policy = await PayrollPolicy.findOne({ _id: id, org_id: user.orgId, company_id: user.companyId });
  if (!policy) throw new AppError("Payroll policy not found", 404);

  if (policy.status === "active") {
    throw new AppError("Cannot delete an active policy. Deactivate or archive it first.", 400);
  }

  policy.isDeleted = true;
  policy.updatedBy = user.userId;
  await policy.save();

  return { message: "Payroll policy deleted successfully" };
};

// ─── Get Resolved Policy for Employee ────────────────────────────────────────
// Payroll engine calls this — returns the best-matching active policy for an employee
// Match priority: department → designation → employmentType → location → role → global
exports.getResolvedPolicy = async (company_id, unit_id, employee) => {
  const activePolicies = await PayrollPolicy.find({
    company_id,
    status:    "active",
    isDeleted: false,
    effectiveFrom: { $lte: new Date() },
    $or: [{ effectiveTo: null }, { effectiveTo: { $gte: new Date() } }],
  }).lean();

  if (!activePolicies.length) return _getHardcodedDefaults();

  // Score each policy by how specifically it matches this employee
  const scored = activePolicies.map((p) => {
    let score = 0;
    const af  = p.applicableFor || {};

    if (af.departments?.some((d) => d.toString() === employee.departmentId?.toString()))   score += 40;
    if (af.designations?.some((d) => d.toString() === employee.designationId?.toString())) score += 35;
    if (af.employmentTypes?.includes(employee.employmentType)) score += 30;
    if (af.locations?.includes(employee.location))             score += 20;
    if (af.roles?.includes(employee.role))                     score += 10;

    // Global policy (no scope defined) = score 0 — lowest priority fallback
    return { policy: p, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].policy;
};

// ─── Internal: Scope Conflict Check ──────────────────────────────────────────
// Prevent two ACTIVE policies from having the same scope (would cause ambiguity in engine)
const _checkScopeConflict = async (excludeId, body, company_id) => {
  const conflictFilter = {
    company_id,
    status:    "active",
    isDeleted: false,
  };

  if (excludeId) conflictFilter._id = { $ne: excludeId };

  const af = body.applicableFor || {};
  const { departments = [], designations = [], employmentTypes = [], roles = [], locations = [] } = af;

  if (departments.length)     conflictFilter["applicableFor.departments"]     = { $in: departments };
  if (designations.length)    conflictFilter["applicableFor.designations"]    = { $in: designations };
  if (employmentTypes.length) conflictFilter["applicableFor.employmentTypes"] = { $in: employmentTypes };
  if (roles.length)           conflictFilter["applicableFor.roles"]           = { $in: roles };
  if (locations.length)       conflictFilter["applicableFor.locations"]       = { $in: locations };

  const conflict = await PayrollPolicy.findOne(conflictFilter);
  if (conflict) {
    throw new AppError(
      `Active policy "${conflict.name}" already covers an overlapping scope. Deactivate it first.`,
      409
    );
  }
};

// ─── Hard-coded Defaults ──────────────────────────────────────────────────────
// Returned when no active policy exists — engine never throws
const _getHardcodedDefaults = () => ({
  salaryCycle: {
    type:             "monthly",
    startDay:         1,
    endDay:           31,
    salaryDate:       1,
    payrollRunDate:   28,
    workingDaysCalc:  "actual",
    fixedWorkingDays: 26,
  },
  lop: {
    enabled:       true,
    calculation:   "per_day",
    perDayFormula: "monthly_salary/working_days",
    roundingRule:  "round2",
  },
  deductionPriority: {
    leaveDeductionPriority: ["CL", "SL", "EL"],
    autoDeductInOrder:      true,
  },
  unpaidLeave: {
    code:       "LWP",
    autoAssign: true,
  },
  proRata: {
    enabled:  true,
    basis:    "working_days",
    fixedDivisor: 26,
  },
  taxCompliance: {
    pfEnabled:       true,
    pfEmployeeRate:  12,
    pfEmployerRate:  12,
    pfCeilingAmount: 15000,
    esiEnabled:      true,
    esiEmployeeRate: 0.75,
    esiEmployerRate: 3.25,
    esiWageCeiling:  21000,
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// ─── VERSIONING ───────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

// ─── GET VERSION HISTORY ──────────────────────────────────────────────────
exports.getVersionHistory = async (id, user) => {
  const policy = await PayrollPolicy.findOne({ _id: id, org_id: user.orgId, company_id: user.companyId }).select("_id name version");
  if (!policy) throw new AppError("Payroll policy not found", 404);

  const history = await policyVersionService.getVersionHistory("PAYROLL", id, user);

  return {
    policyId:       policy._id,
    policyName:     policy.name,
    currentVersion: policy.version,
    history,
  };
};

// ─── GET ONE VERSION SNAPSHOT ──────────────────────────────────────────────
exports.getVersionSnapshot = async (id, version, user) => {
  const policy = await PayrollPolicy.findOne({ _id: id, org_id: user.orgId, company_id: user.companyId }).select("_id name");
  if (!policy) throw new AppError("Payroll policy not found", 404);

  return await policyVersionService.getVersionSnapshot("PAYROLL", id, version, user);
};

// ─── RESTORE A PREVIOUS VERSION ────────────────────────────────────────────
exports.restoreVersion = async (id, version, user) => {
  const policy = await PayrollPolicy.findOne({ _id: id, org_id: user.orgId, company_id: user.companyId });
  if (!policy) throw new AppError("Payroll policy not found", 404);
  if (policy.status === "archived") {
    throw new AppError("Cannot restore an archived policy. Activate or unarchive first.", 400);
  }

  const snapshot = await policyVersionService.prepareRestore("PAYROLL", id, version, user);

  // If restoring would activate this policy and create a scope conflict, block it
  if (policy.status === "active" && snapshot.applicableFor) {
    await _checkScopeConflict(id, { applicableFor: snapshot.applicableFor }, user.companyId);
  }

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
  invalidatePolicyCache("payroll", user.companyId.toString());
  return policy;
};
