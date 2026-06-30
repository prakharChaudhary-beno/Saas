const service = require("./payrollPolicy.service");

// ─── POST /hrms/payroll-policies ──────────────────────────────────────────────
exports.createPolicy = async (req, res, next) => {
  try {
    const data = await service.createPolicy(req.body, req.user);
    res.status(201).json({ success: true, message: "Payroll policy created", data });
  } catch (err) { next(err); }
};

// ─── GET /hrms/payroll-policies ───────────────────────────────────────────────
exports.getPolicies = async (req, res, next) => {
  try {
    const data = await service.getPolicies(req.user, req.query);
    res.json({ success: true, message: "Payroll policies fetched", data });
  } catch (err) { next(err); }
};

// ─── GET /hrms/payroll-policies/:id ──────────────────────────────────────────
exports.getPolicyById = async (req, res, next) => {
  try {
    const data = await service.getPolicyById(req.params.id, req.user);
    res.json({ success: true, message: "Payroll policy fetched", data });
  } catch (err) { next(err); }
};

// ─── PUT /hrms/payroll-policies/:id ──────────────────────────────────────────
exports.updatePolicy = async (req, res, next) => {
  try {
    const data = await service.updatePolicy(req.params.id, req.body, req.user);
    res.json({ success: true, message: "Payroll policy updated", data });
  } catch (err) { next(err); }
};

// ─── PATCH /hrms/payroll-policies/:id/activate ───────────────────────────────
exports.activatePolicy = async (req, res, next) => {
  try {
    const data = await service.activatePolicy(req.params.id, req.user);
    res.json({ success: true, message: "Payroll policy activated", data });
  } catch (err) { next(err); }
};

// ─── PATCH /hrms/payroll-policies/:id/deactivate ─────────────────────────────
exports.deactivatePolicy = async (req, res, next) => {
  try {
    const data = await service.deactivatePolicy(req.params.id, req.user);
    res.json({ success: true, message: "Payroll policy deactivated", data });
  } catch (err) { next(err); }
};

// ─── PATCH /hrms/payroll-policies/:id/archive ────────────────────────────────
exports.archivePolicy = async (req, res, next) => {
  try {
    const data = await service.archivePolicy(req.params.id, req.user);
    res.json({ success: true, message: "Payroll policy archived", data });
  } catch (err) { next(err); }
};

// ─── DELETE /hrms/payroll-policies/:id ───────────────────────────────────────
exports.deletePolicy = async (req, res, next) => {
  try {
    const data = await service.deletePolicy(req.params.id, req.user);
    res.json({ success: true, message: "Payroll policy deleted", data });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════════════════
// ─── VERSIONING ───────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

// GET /hrms/payroll-policies/:id/versions
exports.getVersionHistory = async (req, res, next) => {
  try {
    const data = await service.getVersionHistory(req.params.id, req.user);
    res.json({ success: true, message: "Version history fetched", data });
  } catch (err) { next(err); }
};

// GET /hrms/payroll-policies/:id/versions/:version
exports.getVersionSnapshot = async (req, res, next) => {
  try {
    const data = await service.getVersionSnapshot(req.params.id, req.params.version, req.user);
    res.json({ success: true, message: "Version snapshot fetched", data });
  } catch (err) { next(err); }
};

// POST /hrms/payroll-policies/:id/restore/:version
exports.restoreVersion = async (req, res, next) => {
  try {
    const data = await service.restoreVersion(req.params.id, req.params.version, req.user);
    res.json({ success: true, message: `Policy restored to version ${req.params.version}`, data });
  } catch (err) { next(err); }
};
