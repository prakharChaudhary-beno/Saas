// modules/policyVersion/policyVersion.service.js
//
// Generic versioning helper — used by leavePolicy / attendancePolicy /
// payrollPolicy services. Keeps version-snapshot logic in ONE place.

const PolicyVersion = require("./models/policyVersion.model");
const AppError      = require("../../utils/appError");

// Fields that should NEVER be part of a snapshot / restored from a snapshot —
// these are document-identity / bookkeeping fields, not "policy config".
const EXCLUDED_FIELDS = [
  "_id", "__v", "createdAt", "updatedAt",
  "version", "isDeleted",
  "createdBy", "updatedBy",
  "activatedBy", "activatedAt",
  "archivedBy", "archivedAt",
];

// ─── Strip a mongoose doc down to a plain "config" snapshot ───────────────────
const _toSnapshot = (policyDoc) => {
  const obj = policyDoc.toObject ? policyDoc.toObject() : { ...policyDoc };
  const snapshot = {};
  for (const key of Object.keys(obj)) {
    if (!EXCLUDED_FIELDS.includes(key)) snapshot[key] = obj[key];
  }
  return snapshot;
};

// ─── Compute top-level changed field names (for quick UI display) ─────────────
const _diffFields = (oldSnapshot, newSnapshot) => {
  const changed = new Set();
  const keys = new Set([...Object.keys(oldSnapshot || {}), ...Object.keys(newSnapshot || {})]);
  for (const key of keys) {
    const a = JSON.stringify(oldSnapshot?.[key]);
    const b = JSON.stringify(newSnapshot?.[key]);
    if (a !== b) changed.add(key);
  }
  return [...changed];
};

// ─── Save a version snapshot ───────────────────────────────────────────────────
// Call this BEFORE applying changes to the policy document.
// `policyDocBeforeChange` = the policy as it currently is (pre-update).
// `incomingChanges`       = the new data being applied (for diff display) — optional
exports.saveVersionSnapshot = async ({
  policyType,       // "LEAVE" | "ATTENDANCE" | "PAYROLL"
  policyDocBeforeChange,
  action,           // "CREATE" | "UPDATE" | "ACTIVATE" | "DEACTIVATE" | "ARCHIVE" | "RESTORE"
  user,
  changeNote = null,
  incomingChanges = null,
}) => {
  const snapshot = _toSnapshot(policyDocBeforeChange);

  let changedFields = [];
  if (incomingChanges) {
    changedFields = _diffFields(snapshot, { ...snapshot, ...incomingChanges });
  }

  await PolicyVersion.create({
    policyType,
    policyId:   policyDocBeforeChange._id,
    org_id:     policyDocBeforeChange.org_id,
    company_id: policyDocBeforeChange.company_id,
    unit_id:    policyDocBeforeChange.unit_id || null,
    version:    policyDocBeforeChange.version,
    snapshot,
    action,
    changeNote,
    changedFields,
    changedBy:  user.userId,
    changedAt:  new Date(),
  });
};

// ─── Get version history (list) ────────────────────────────────────────────────
exports.getVersionHistory = async (policyType, policyId, user) => {
  const filter = {
    policyType,
    policyId,
    org_id:     user.orgId,
    company_id: user.companyId,
  };
  if (user.unitId) filter.unit_id = { $in: [user.unitId, null] };

  const versions = await PolicyVersion.find(filter)
    .sort({ version: -1 })
    .select("version action changeNote changedFields changedBy changedAt")
    .populate("changedBy", "name email")
    .lean();

  return versions;
};

// ─── Get one specific version snapshot ─────────────────────────────────────────
exports.getVersionSnapshot = async (policyType, policyId, version, user) => {
  const record = await PolicyVersion.findOne({
    policyType,
    policyId,
    version:    parseInt(version),
    org_id:     user.orgId,
    company_id: user.companyId,
  })
    .populate("changedBy", "name email")
    .lean();

  if (!record) {
    throw new AppError(`Version ${version} not found for this policy`, 404);
  }
  return record;
};

// ─── Restore a previous version ────────────────────────────────────────────────
// Returns the snapshot data to be merged back onto the live policy document.
// The CALLER (leavePolicy/attendancePolicy/payrollPolicy service) is
// responsible for:
//   1. Saving a new version snapshot of the CURRENT state (action: "RESTORE")
//   2. Applying the returned `snapshot` fields onto the live document
//   3. Bumping `policy.version += 1`
//   4. Saving
exports.prepareRestore = async (policyType, policyId, version, user) => {
  const record = await PolicyVersion.findOne({
    policyType,
    policyId,
    version:    parseInt(version),
    org_id:     user.orgId,
    company_id: user.companyId,
  }).lean();

  if (!record) {
    throw new AppError(`Version ${version} not found for this policy`, 404);
  }

  return record.snapshot;
};

// Exported for reuse if a service needs to build its own snapshot
exports._toSnapshot = _toSnapshot;
