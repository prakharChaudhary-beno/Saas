// modules/auditLog/auditLog.model.js
"use strict";

const mongoose = require("mongoose");
const { Schema } = mongoose;

const auditLogSchema = new Schema({

  // ─── Scope ───────────────────────────────────────────────────
  org_id:     { type: Schema.Types.ObjectId, ref: "Organization", index: true },
  company_id: { type: Schema.Types.ObjectId, ref: "Company",      index: true },
  unit_id:    { type: Schema.Types.ObjectId, ref: "Unit",         index: true },

  // ─── Action ──────────────────────────────────────────────────
  action: {
    type: String,
    required: true,
    index: true,
    enum: [
      // Auth
      "LOGIN", "LOGOUT", "PASSWORD_CHANGED", "LOGIN_FAILED",
      "LOGIN_ACTIVATED",

      // Employee
      "EMPLOYEE_CREATED", "EMPLOYEE_UPDATED", "EMPLOYEE_DELETED",
      "SALARY_UPDATED", "STATUS_CHANGED", "REPORTING_MANAGER_CHANGED",

      // Leave
      "LEAVE_APPLIED", "LEAVE_APPROVED_L1", "LEAVE_APPROVED_L2",
      "LEAVE_REJECTED", "LEAVE_CANCELLED", "LEAVE_BALANCE_ADJUSTED",

      // Attendance
      "PUNCH_IN", "PUNCH_OUT",
      "REGULARIZATION_APPLIED", "REGULARIZATION_APPROVED_L1",
      "REGULARIZATION_APPROVED_L2", "REGULARIZATION_REJECTED",
      "REGULARIZATION_CANCELLED",

      // Payroll
      "PAYROLL_RUN", "PAYSLIP_PUBLISHED", "PAYSLIP_DELETED",

      // Shift/Roster
      "SHIFT_CREATED", "SHIFT_UPDATED", "SHIFT_DELETED",
      "ROSTER_ASSIGNED", "ROSTER_REVOKED",

      // Role/Permission
      "ROLE_CREATED", "ROLE_UPDATED", "ROLE_DELETED",
      "DELEGATION_CREATED", "DELEGATION_REVOKED",

      // Policy
      "ATTENDANCE_POLICY_CREATED", "ATTENDANCE_POLICY_UPDATED",
      "ATTENDANCE_POLICY_ACTIVATED", "ATTENDANCE_POLICY_DEACTIVATED",
      "LEAVE_POLICY_CREATED", "LEAVE_POLICY_UPDATED",
      "LEAVE_POLICY_ACTIVATED", "LEAVE_POLICY_DEACTIVATED",
      "PAYROLL_POLICY_CREATED", "PAYROLL_POLICY_UPDATED",
      "PAYROLL_POLICY_ACTIVATED",
    ]
  },

  // ─── Module ──────────────────────────────────────────────────
  module: {
    type: String,
    required: true,
    index: true,
    enum: ["auth", "employee", "leave", "attendance", "payroll",
           "shift", "roster", "role", "delegation", "policy"],
  },

  // ─── Actor (who did it) ──────────────────────────────────────
  actor: {
    userId:   { type: Schema.Types.ObjectId, ref: "User", index: true },
    name:     { type: String },
    role:     { type: String },
    email:    { type: String },
  },

  // ─── Target (what was affected) ──────────────────────────────
  target: {
    type:       { type: String },   // "Employee", "LeaveRequest", etc.
    id:         { type: Schema.Types.ObjectId, index: true },
    name:       { type: String },
    employeeId: { type: String },   // EMP0001 etc.
  },

  // ─── Field-level Changes (old vs new) ────────────────────────
  // Only for update actions
  changes: {
    type: Schema.Types.Mixed,
    default: null,
  },
  // Example:
  // { "salary.basic": { from: 40000, to: 50000 }, "status": { from: "INACTIVE", to: "ACTIVE" } }

  // ─── Extra Context ───────────────────────────────────────────
  description: { type: String },   // Human readable summary
  metadata: {
    ip:        { type: String },
    userAgent: { type: String },
    requestId: { type: String },
  },

  // ─── Timestamp ───────────────────────────────────────────────
  // createdAt from timestamps: true

}, {
  timestamps: true,
  toJSON:   { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes
auditLogSchema.index({ org_id: 1, createdAt: -1 });
auditLogSchema.index({ org_id: 1, module: 1, createdAt: -1 });
auditLogSchema.index({ org_id: 1, "actor.userId": 1, createdAt: -1 });
auditLogSchema.index({ org_id: 1, "target.id": 1, createdAt: -1 });
auditLogSchema.index({ org_id: 1, action: 1, createdAt: -1 });

module.exports = mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);