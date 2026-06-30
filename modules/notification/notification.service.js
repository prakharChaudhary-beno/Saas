// modules/notification/notification.service.js
"use strict";

const Notification = require("./notification.model");
const { sendEmail } = require("../../utils/email/email");
const mongoose = require("mongoose");
const AppError  = require("../../utils/appError");

const toObjId = (id) => {
  try { return new mongoose.Types.ObjectId(String(id)); }
  catch { return null; }
};

// ─── TEMPLATES ───────────────────────────────────────────────
const TEMPLATES = {
  LEAVE_APPLIED: (data) => ({
    title:   `Leave Request — ${data.employeeName}`,
    message: `${data.employeeName} has applied for ${data.leaveType} from ${data.startDate} to ${data.endDate} (${data.totalDays} day(s)). Please review.`,
    actionUrl:   `/leave/requests/${data.leaveId}`,
    actionLabel: "Review Request",
    priority:    "HIGH",
  }),

  LEAVE_APPROVED: (data) => ({
    title:   `Leave Approved ✅`,
    message: `Your ${data.leaveType} from ${data.startDate} to ${data.endDate} has been approved by ${data.approverName}.`,
    actionUrl:   `/leave/my-requests`,
    actionLabel: "View Leave",
    priority:    "MEDIUM",
  }),

  LEAVE_REJECTED: (data) => ({
    title:   `Leave Rejected ❌`,
    message: `Your ${data.leaveType} from ${data.startDate} to ${data.endDate} has been rejected. ${data.comment ? `Reason: ${data.comment}` : ""}`,
    actionUrl:   `/leave/my-requests`,
    actionLabel: "View Details",
    priority:    "HIGH",
  }),

  LEAVE_CANCELLED: (data) => ({
    title:   `Leave Cancelled`,
    message: `${data.employeeName}'s ${data.leaveType} request has been cancelled.`,
    actionUrl:   `/leave/requests`,
    actionLabel: "View Leaves",
    priority:    "LOW",
  }),

  PAYSLIP_PUBLISHED: (data) => ({
    title:   `Payslip Published — ${data.period}`,
    message: `Your payslip for ${data.period} is now available. Net Pay: ₹${data.netSalary?.toLocaleString("en-IN")}.`,
    actionUrl:   `/payroll/my-payslips`,
    actionLabel: "View Payslip",
    priority:    "HIGH",
  }),

  SALARY_UPDATED: (data) => ({
    title:   `Salary Updated`,
    message: `Your salary has been updated by HR. New Gross Salary: ₹${data.newGross?.toLocaleString("en-IN")}.`,
    actionUrl:   `/profile`,
    actionLabel: "View Profile",
    priority:    "HIGH",
  }),

  REGULARIZATION_APPLIED: (data) => ({
    title:   `Regularization Request — ${data.employeeName}`,
    message: `${data.employeeName} has submitted an attendance regularization request for ${data.date}. Reason: ${data.reason}`,
    actionUrl:   `/attendance/regularize/pending`,
    actionLabel: "Review Request",
    priority:    "MEDIUM",
  }),

  REGULARIZATION_APPROVED: (data) => ({
    title:   `Regularization Approved ✅`,
    message: `Your attendance regularization for ${data.date} has been approved. Attendance has been updated.`,
    actionUrl:   `/attendance/my`,
    actionLabel: "View Attendance",
    priority:    "MEDIUM",
  }),

  REGULARIZATION_REJECTED: (data) => ({
    title:   `Regularization Rejected ❌`,
    message: `Your attendance regularization for ${data.date} has been rejected. ${data.comment ? `Reason: ${data.comment}` : ""}`,
    actionUrl:   `/attendance/regularize/my`,
    actionLabel: "View Request",
    priority:    "MEDIUM",
  }),

  DELEGATION_RECEIVED: (data) => ({
    title:   `Permission Delegated to You`,
    message: `${data.delegatorName} has delegated "${data.permissions}" permission to you from ${data.startDate} to ${data.endDate}.`,
    actionUrl:   `/delegations/received`,
    actionLabel: "View Delegation",
    priority:    "MEDIUM",
  }),

  DELEGATION_REVOKED: (data) => ({
    title:   `Delegation Revoked`,
    message: `${data.delegatorName} has revoked the delegated permissions. Reason: ${data.reason || "Not specified"}.`,
    actionUrl:   `/delegations/received`,
    actionLabel: "View Details",
    priority:    "MEDIUM",
  }),

  PAYROLL_LOCKED: (data) => ({
    title:   `Payroll Locked — ${data.period}`,
    message: `Payroll for ${data.period} has been locked by ${data.lockedBy}. No further changes allowed.`,
    actionUrl:   `/payroll`,
    actionLabel: "View Payroll",
    priority:    "HIGH",
  }),

  GENERAL: (data) => ({
    title:   data.title   || "Notification",
    message: data.message || "",
    priority: data.priority || "LOW",
  }),
};

// ─── CORE: Create notification ────────────────────────────────
exports.createNotification = async ({
  type,
  userId,
  org_id,
  unit_id,
  data = {},
  referenceId,
  referenceType,
  sendEmailTo,    // email address to send email
  emailSubject,
  emailHtml,
}) => {
  try {
    const template = TEMPLATES[type] ? TEMPLATES[type](data) : TEMPLATES.GENERAL(data);

    // Create in-app notification
    const notification = await Notification.create({
      org_id:        toObjId(org_id),
      unit_id:       unit_id ? toObjId(unit_id) : null,
      userId:        toObjId(userId),
      type,
      title:         template.title,
      message:       template.message,
      actionUrl:     template.actionUrl   || null,
      actionLabel:   template.actionLabel || null,
      priority:      template.priority    || "MEDIUM",
      referenceId:   referenceId   ? toObjId(referenceId)   : null,
      referenceType: referenceType || null,
    });

    // Send email if requested
    if (sendEmailTo && emailSubject && emailHtml) {
      try {
        await sendEmail({ to: sendEmailTo, subject: emailSubject, html: emailHtml });
        notification.emailSent   = true;
        notification.emailSentAt = new Date();
        await notification.save();
      } catch (emailErr) {
        console.error("[Notification] Email failed:", emailErr.message);
      }
    }

    return notification;
  } catch (err) {
    console.error("[Notification] Failed:", err.message);
  }
};

// ─── Bulk notify multiple users ───────────────────────────────
exports.notifyMany = async (userIds, payload) => {
  await Promise.allSettled(
    userIds.map(userId => exports.createNotification({ ...payload, userId }))
  );
};

// ─── GET MY NOTIFICATIONS ─────────────────────────────────────
exports.getMyNotifications = async (query, user) => {
  const { page = 1, limit = 20, isRead, type } = query;

  const filter = {
    userId:    toObjId(user.userId),
    org_id:    toObjId(user.orgId),
    isDeleted: false,
  };

  if (isRead !== undefined) filter.isRead = isRead === "true";
  if (type)  filter.type = type;

  const skip  = (Number(page) - 1) * Number(limit);
  const total = await Notification.countDocuments(filter);
  const unreadCount = await Notification.countDocuments({ ...filter, isRead: false });

  const notifications = await Notification.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean();

  return {
    notifications,
    unreadCount,
    total,
    page:       Number(page),
    totalPages: Math.ceil(total / Number(limit)),
  };
};

// ─── MARK AS READ ─────────────────────────────────────────────
exports.markAsRead = async (notificationId, user) => {
  const notification = await Notification.findOne({
    _id:    toObjId(notificationId),
    userId: toObjId(user.userId),
  });
  if (!notification) throw new AppError("Notification not found", 404);

  notification.isRead = true;
  notification.readAt = new Date();
  await notification.save();
  return notification;
};

// ─── MARK ALL AS READ ─────────────────────────────────────────
exports.markAllAsRead = async (user) => {
  const result = await Notification.updateMany(
    { userId: toObjId(user.userId), org_id: toObjId(user.orgId), isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
  return { updated: result.modifiedCount };
};

// ─── UNREAD COUNT ─────────────────────────────────────────────
exports.getUnreadCount = async (user) => {
  const count = await Notification.countDocuments({
    userId:    toObjId(user.userId),
    org_id:    toObjId(user.orgId),
    isRead:    false,
    isDeleted: false,
  });
  return { unreadCount: count };
};

// ─── DELETE notification ──────────────────────────────────────
exports.deleteNotification = async (notificationId, user) => {
  const notification = await Notification.findOne({
    _id:    toObjId(notificationId),
    userId: toObjId(user.userId),
  });
  if (!notification) throw new AppError("Notification not found", 404);
  notification.isDeleted = true;
  await notification.save();
  return { message: "Notification deleted" };
};