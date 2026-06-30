// modules/notification/notification.model.js
// In-app notification center
"use strict";

const mongoose = require("mongoose");
const { Schema } = mongoose;

const notificationSchema = new Schema({

  // ─── Scope ───────────────────────────────────────────────────
  org_id:    { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
  unit_id:   { type: Schema.Types.ObjectId, ref: "Unit",         index: true },

  // ─── Recipient ───────────────────────────────────────────────
  userId:    { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

  // ─── Notification Type ───────────────────────────────────────
  type: {
    type: String,
    required: true,
    index: true,
    enum: [
      // Leave
      "LEAVE_APPLIED",
      "LEAVE_APPROVED",
      "LEAVE_REJECTED",
      "LEAVE_CANCELLED",

      // Attendance
      "PUNCH_IN_REMINDER",
      "REGULARIZATION_APPLIED",
      "REGULARIZATION_APPROVED",
      "REGULARIZATION_REJECTED",

      // Payroll
      "PAYSLIP_PUBLISHED",
      "PAYROLL_LOCKED",
      "PAYROLL_UNLOCKED",

      // Employee
      "SALARY_UPDATED",
      "PROFILE_UPDATED",
      "LOGIN_ACTIVATED",

      // System
      "DELEGATION_RECEIVED",
      "DELEGATION_REVOKED",
      "POLICY_UPDATED",
      "GENERAL",
    ]
  },

  // ─── Content ─────────────────────────────────────────────────
  title:   { type: String, required: true, trim: true, maxlength: 200 },
  message: { type: String, required: true, trim: true, maxlength: 1000 },

  // ─── Action Link ─────────────────────────────────────────────
  // Frontend routing — e.g. "/leave/requests/xxx"
  actionUrl:  { type: String, default: null },
  actionLabel:{ type: String, default: null }, // "View Payslip"

  // ─── Reference ───────────────────────────────────────────────
  referenceId:   { type: Schema.Types.ObjectId, default: null },
  referenceType: { type: String, default: null }, // "LeaveRequest", "Payslip", etc.

  // ─── Read Status ─────────────────────────────────────────────
  isRead:  { type: Boolean, default: false, index: true },
  readAt:  { type: Date,    default: null },

  // ─── Delivery ────────────────────────────────────────────────
  emailSent:  { type: Boolean, default: false },
  emailSentAt:{ type: Date,    default: null },

  // ─── Priority ────────────────────────────────────────────────
  priority: {
    type: String,
    enum: ["LOW", "MEDIUM", "HIGH"],
    default: "MEDIUM",
  },

  isDeleted: { type: Boolean, default: false },

}, {
  timestamps: true,
  toJSON:   { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ org_id: 1, userId: 1, createdAt: -1 });

module.exports = mongoose.models.Notification ||
  mongoose.model("Notification", notificationSchema);