// modules/auditLog/auditLog.service.js
"use strict";

const AuditLog = require("./auditLog.model");
const mongoose = require("mongoose");

const toObjId = (id) => {
  try { return new mongoose.Types.ObjectId(String(id)); }
  catch { return null; }
};

// ─── Core log function ────────────────────────────────────────
// Call this from anywhere to create an audit log
exports.log = async ({
  action,
  module,
  actor,          // { userId, name, role, email }
  target,         // { type, id, name, employeeId }
  changes,        // { field: { from, to } }
  description,
  metadata,       // { ip, userAgent }
  org_id,
  company_id,
  unit_id,
}) => {
  try {
    await AuditLog.create({
      org_id:     org_id     ? toObjId(org_id)     : null,
      company_id: company_id ? toObjId(company_id) : null,
      unit_id:    unit_id    ? toObjId(unit_id)    : null,
      action,
      module,
      actor: {
        userId: actor?.userId ? toObjId(actor.userId) : null,
        name:   actor?.name   || null,
        role:   actor?.role   || null,
        email:  actor?.email  || null,
      },
      target: {
        type:       target?.type       || null,
        id:         target?.id ? toObjId(target.id) : null,
        name:       target?.name       || null,
        employeeId: target?.employeeId || null,
      },
      changes:     changes     || null,
      description: description || null,
      metadata:    metadata    || null,
    });
  } catch (err) {
    // Audit log failure should never break the main flow
    console.error("[AuditLog] Failed to create log:", err.message);
  }
};

// ─── Helper: build diff between old and new object ───────────
exports.buildDiff = (oldObj, newObj, fields) => {
  const changes = {};
  for (const field of fields) {
    const oldVal = field.split(".").reduce((o, k) => o?.[k], oldObj);
    const newVal = field.split(".").reduce((o, k) => o?.[k], newObj);
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes[field] = { from: oldVal ?? null, to: newVal ?? null };
    }
  }
  return Object.keys(changes).length > 0 ? changes : null;
};

// ─── GET LOGS (with filters + role-based access) ─────────────
exports.getLogs = async (query, user) => {
  const {
    page      = 1,
    limit     = 20,
    module,
    action,
    actorId,
    targetId,
    from,
    to,
    employeeId,
  } = query;

  const filter = {};

  // ── Role-based scope ──────────────────────────────────────
  if (user.role === "SUPER_ADMIN") {
    // No filter — sees everything
  } else if (["unit_admin", "hr_manager"].includes(user.role)) {
    filter.org_id = toObjId(user.orgId);
    filter.unit_id = toObjId(user.unitId);
  } else if (user.role === "manager") {
    // Manager sees only their team + their own actions
    filter.org_id = toObjId(user.orgId);
    filter.$or = [
      { "actor.userId": toObjId(user.userId) },
      { "target.id":    toObjId(user.userId) },
    ];
  } else if (user.role === "employee") {
    // Employee sees only their own timeline
    filter.org_id = toObjId(user.orgId);
    filter["target.id"] = toObjId(user.userId);
  } else {
    filter.org_id = toObjId(user.orgId);
  }

  // ── Additional filters ────────────────────────────────────
  if (module)     filter.module         = module;
  if (action)     filter.action         = action;
  if (actorId)    filter["actor.userId"] = toObjId(actorId);
  if (targetId)   filter["target.id"]   = toObjId(targetId);
  if (employeeId) filter["target.employeeId"] = employeeId;

  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to)   filter.createdAt.$lte = new Date(to);
  }

  const skip  = (Number(page) - 1) * Number(limit);
  const total = await AuditLog.countDocuments(filter);
  const logs  = await AuditLog.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean();

  return {
    logs,
    total,
    page:       Number(page),
    totalPages: Math.ceil(total / Number(limit)),
  };
};

// ─── GET EMPLOYEE TIMELINE ────────────────────────────────────
exports.getEmployeeTimeline = async (employeeId, user) => {
  const filter = {
    org_id:              toObjId(user.orgId),
    "target.employeeId": employeeId,
  };

  const logs = await AuditLog.find(filter)
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  return logs;
};