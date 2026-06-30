const service = require("./leavePolicy.service");

exports.createPolicy = async (req, res, next) => {
  try {
    const data = await service.createPolicy(req.body, req.user);
    res.status(201).json({ success: true, message: "Leave policy created", data });
  } catch (err) { next(err); }
};

exports.getPolicies = async (req, res, next) => {
  try {
    const data = await service.getPolicies(req.user, req.query);
    res.json({ success: true, message: "Leave policies fetched", data });
  } catch (err) { next(err); }
};

exports.getPolicyById = async (req, res, next) => {
  try {
    const data = await service.getPolicyById(req.params.id, req.user);
    res.json({ success: true, message: "Leave policy fetched", data });
  } catch (err) { next(err); }
};

exports.updatePolicy = async (req, res, next) => {
  try {
    const data = await service.updatePolicy(req.params.id, req.body, req.user);
    res.json({ success: true, message: "Leave policy updated", data });
  } catch (err) { next(err); }
};

exports.updateLeaveTypes = async (req, res, next) => {
  try {
    const data = await service.updateLeaveTypes(req.params.id, req.body.leaveTypes, req.user);
    res.json({ success: true, message: "Leave types updated", data });
  } catch (err) { next(err); }
};

// Returns seeded LeaveTypes for HR to pick while building policy
exports.getAvailableLeaveTypes = async (req, res, next) => {
  try {
    const data = await service.getAvailableLeaveTypes(req.user);
    res.json({ success: true, message: "Available leave types fetched", data });
  } catch (err) { next(err); }
};

exports.activatePolicy = async (req, res, next) => {
  try {
    const data = await service.activatePolicy(req.params.id, req.user);
    res.json({ success: true, message: "Leave policy activated", data });
  } catch (err) { next(err); }
};

exports.archivePolicy = async (req, res, next) => {
  try {
    const data = await service.archivePolicy(req.params.id, req.user);
    res.json({ success: true, message: "Leave policy archived", data });
  } catch (err) { next(err); }
};

exports.deletePolicy = async (req, res, next) => {
  try {
    const data = await service.deletePolicy(req.params.id, req.user);
    res.json({ success: true, message: "Leave policy deleted", data });
  } catch (err) { next(err); }
};

exports.deactivatePolicy = async (req, res, next) => {
  try {
    const data = await service.deactivatePolicy(req.params.id, req.user);
    res.json({ success: true, message: "Leave policy deactivated", data });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════════════════
// ─── VERSIONING ───────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

// GET /leave-policies/:id/versions — list version history
exports.getVersionHistory = async (req, res, next) => {
  try {
    const data = await service.getVersionHistory(req.params.id, req.user);
    res.json({ success: true, message: "Version history fetched", data });
  } catch (err) { next(err); }
};

// GET /leave-policies/:id/versions/:version — view a specific snapshot
exports.getVersionSnapshot = async (req, res, next) => {
  try {
    const data = await service.getVersionSnapshot(req.params.id, req.params.version, req.user);
    res.json({ success: true, message: "Version snapshot fetched", data });
  } catch (err) { next(err); }
};

// POST /leave-policies/:id/restore/:version — rollback to a previous version
exports.restoreVersion = async (req, res, next) => {
  try {
    const data = await service.restoreVersion(req.params.id, req.params.version, req.user);
    res.json({ success: true, message: `Policy restored to version ${req.params.version}`, data });
  } catch (err) { next(err); }
};
