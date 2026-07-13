// utils/sendNotification.js
// Unified notification sender - handles in-app, email, and push notifications
"use strict";

const Notification = require("../modules/notification/notification.model");
const { sendEmail } = require("./email/email");
const { sendPushNotification } = require("./firebase/firebaseAdmin");
const mongoose = require("mongoose");
const AppError = require("./appError");

const toObjId = (id) => {
  try { return new mongoose.Types.ObjectId(String(id)); }
  catch { return null; }
};

// ─── Notification Templates ─────────────────────────────────────────────────
const TEMPLATES = {
  // ─── Leave ────────────────────────────────────────────
  LEAVE_APPLIED: (data) => ({
    title: `Leave Request — ${data.employeeName}`,
    message: `${data.employeeName} has applied for ${data.leaveType} from ${data.startDate} to ${data.endDate} (${data.totalDays} day(s)). Please review.`,
    actionUrl: `/leave/requests/${data.leaveId}`,
    actionLabel: "Review Request",
    priority: "HIGH",
    icon: "tabler:calendar-plus"
  }),

  LEAVE_APPROVED: (data) => ({
    title: `Leave Approved ✅`,
    message: `Your ${data.leaveType} from ${data.startDate} to ${data.endDate} has been approved by ${data.approverName}.`,
    actionUrl: `/leave/my-requests`,
    actionLabel: "View Leave",
    priority: "MEDIUM",
    icon: "tabler:check"
  }),

  LEAVE_REJECTED: (data) => ({
    title: `Leave Rejected ❌`,
    message: `Your ${data.leaveType} from ${data.startDate} to ${data.endDate} has been rejected. ${data.comment ? `Reason: ${data.comment}` : ""}`,
    actionUrl: `/leave/my-requests`,
    actionLabel: "View Details",
    priority: "HIGH",
    icon: "tabler:x"
  }),

  LEAVE_CANCELLED: (data) => ({
    title: `Leave Cancelled`,
    message: `${data.employeeName}'s ${data.leaveType} request has been cancelled.`,
    actionUrl: `/leave/requests`,
    actionLabel: "View Leaves",
    priority: "LOW",
    icon: "tabler:calendar-minus"
  }),

  // ─── Attendance & Regularization ───────────────────────
  PUNCH_IN_REMINDER: (data) => ({
    title: `Punch-In Reminder ⏰`,
    message: `You haven't punched in yet. Please mark your attendance.`,
    actionUrl: `/attendance`,
    actionLabel: "Punch In",
    priority: "HIGH",
    icon: "tabler:clock"
  }),

  REGULARIZATION_APPLIED: (data) => ({
    title: `Regularization Request — ${data.employeeName}`,
    message: `${data.employeeName} requested attendance regularization for ${data.date}. Reason: ${data.reason}`,
    actionUrl: `/attendance/regularize/pending`,
    actionLabel: "Review Request",
    priority: "MEDIUM",
    icon: "tabler:calendar-check"
  }),

  REGULARIZATION_APPROVED: (data) => ({
    title: `Regularization Approved ✅`,
    message: `Your attendance regularization for ${data.date} has been approved.`,
    actionUrl: `/attendance/my`,
    actionLabel: "View Attendance",
    priority: "MEDIUM",
    icon: "tabler:check"
  }),

  REGULARIZATION_REJECTED: (data) => ({
    title: `Regularization Rejected ❌`,
    message: `Your attendance regularization for ${data.date} has been rejected. ${data.comment ? `Reason: ${data.comment}` : ""}`,
    actionUrl: `/attendance/regularize/my`,
    actionLabel: "View Request",
    priority: "HIGH",
    icon: "tabler:x"
  }),

  // ─── Payroll ───────────────────────────────────────────
  PAYSLIP_PUBLISHED: (data) => ({
    title: `Payslip Published — ${data.period}`,
    message: `Your payslip for ${data.period} is now available. Net Pay: ₹${data.netSalary?.toLocaleString("en-IN") || 'N/A'}.`,
    actionUrl: `/payroll/my-payslips`,
    actionLabel: "View Payslip",
    priority: "HIGH",
    icon: "tabler:file-invoice"
  }),

  PAYROLL_LOCKED: (data) => ({
    title: `Payroll Locked — ${data.period}`,
    message: `Payroll for ${data.period} has been locked by ${data.lockedBy}. No further changes allowed.`,
    actionUrl: `/payroll`,
    actionLabel: "View Payroll",
    priority: "HIGH",
    icon: "tabler:lock"
  }),

  PAYROLL_UNLOCKED: (data) => ({
    title: `Payroll Unlocked — ${data.period}`,
    message: `Payroll for ${data.period} has been unlocked. Changes now allowed.`,
    actionUrl: `/payroll`,
    actionLabel: "View Payroll",
    priority: "MEDIUM",
    icon: "tabler:lock-open"
  }),

  // ─── Employee ───────────────────────────────────────────
  SALARY_UPDATED: (data) => ({
    title: `Salary Updated`,
    message: `Your salary has been updated by HR. New Gross Salary: ₹${data.newGross?.toLocaleString("en-IN") || 'N/A'}.`,
    actionUrl: `/profile`,
    actionLabel: "View Profile",
    priority: "HIGH",
    icon: "tabler:currency-rupee"
  }),

  PROFILE_UPDATED: (data) => ({
    title: `Profile Updated`,
    message: `Your profile has been updated successfully.`,
    actionUrl: `/profile`,
    actionLabel: "View Profile",
    priority: "LOW",
    icon: "tabler:user"
  }),

  LOGIN_ACTIVATED: (data) => ({
    title: `Account Activated`,
    message: `Your account has been activated. You can now login to the system.`,
    actionUrl: `/login`,
    actionLabel: "Login",
    priority: "HIGH",
    icon: "tabler:user-check"
  }),

  // ─── Delegation ────────────────────────────────────────
  DELEGATION_RECEIVED: (data) => ({
    title: `Permission Delegated to You`,
    message: `${data.delegatorName} has delegated "${data.permissions}" permission to you from ${data.startDate} to ${data.endDate}.`,
    actionUrl: `/delegations/received`,
    actionLabel: "View Delegation",
    priority: "MEDIUM",
    icon: "tabler:users"
  }),

  DELEGATION_REVOKED: (data) => ({
    title: `Delegation Revoked`,
    message: `${data.delegatorName} has revoked the delegated permissions. Reason: ${data.reason || "Not specified"}.`,
    actionUrl: `/delegations/received`,
    actionLabel: "View Details",
    priority: "MEDIUM",
    icon: "tabler:user-minus"
  }),

  // ─── Shift & Roster ─────────────────────────────────────
  SHIFT_SWAP_REQUESTED: (data) => ({
    title: `Shift Swap Request`,
    message: `${data.requesterName} requested shift swap for ${data.date}. Please review.`,
    actionUrl: `/shift/swaps/pending`,
    actionLabel: "Review Request",
    priority: "HIGH",
    icon: "tabler:repeat"
  }),

  SHIFT_SWAP_APPROVED: (data) => ({
    title: `Shift Swap Approved ✅`,
    message: `Your shift swap request for ${data.date} has been approved.`,
    actionUrl: `/shift/swaps/my`,
    actionLabel: "View Request",
    priority: "MEDIUM",
    icon: "tabler:check"
  }),

  SHIFT_SWAP_REJECTED: (data) => ({
    title: `Shift Swap Rejected ❌`,
    message: `Your shift swap request for ${data.date} has been rejected. ${data.reason ? `Reason: ${data.reason}` : ""}`,
    actionUrl: `/shift/swaps/my`,
    actionLabel: "View Request",
    priority: "HIGH",
    icon: "tabler:x"
  }),

  // ─── System ─────────────────────────────────────────────
  POLICY_UPDATED: (data) => ({
    title: `Policy Updated`,
    message: `${data.policyName} has been updated. Please review the changes.`,
    actionUrl: `/policies`,
    actionLabel: "View Policies",
    priority: "MEDIUM",
    icon: "tabler:file-text"
  }),

  GENERAL: (data) => ({
    title: data.title || "Notification",
    message: data.message || "",
    actionUrl: data.actionUrl || null,
    actionLabel: data.actionLabel || null,
    priority: data.priority || "LOW",
    icon: data.icon || "tabler:bell"
  })
};

// ─── Main Notification Sender ────────────────────────────────────────────────
exports.sendNotification = async ({
  type,                    // Notification type (from TEMPLATES keys)
  userId,                  // Recipient user ID
  org_id,
  unit_id = null,
  data = {},               // Template data
  referenceId = null,
  referenceType = null,
  
  // Channel flags
  inApp = true,            // In-app notification (default: true)
  email = false,           // Email notification (default: false)
  push = true,             // Push notification (default: true)
  
  // Email options (if email = true)
  toEmail = null,          // Override recipient email
  emailSubject = null,
  emailHtml = null,
  
  // Push options
  pushData = {}            // Additional push notification data
}) => {
  try {
    // Validate required fields
    if (!type || !userId || !org_id) {
      throw new Error("Missing required fields: type, userId, org_id");
    }

    // Get user with FCM tokens
    const User = require("../modules/auth/models/user.model");
    const user = await User.findById(toObjId(userId)).select('email fcmTokens').lean();

    if (!user) {
      console.error(`[Notification] User not found: ${userId}`);
      return { success: false };
    }

    // Get template
    const template = TEMPLATES[type] ? TEMPLATES[type](data) : TEMPLATES.GENERAL(data);
    
    const results = {
      inApp: null,
      email: null,
      push: null,
      notificationId: null
    };

    // ─── 1. In-App Notification ───────────────────────────────
    if (inApp) {
      try {
        const notification = await Notification.create({
          org_id: toObjId(org_id),
          unit_id: unit_id ? toObjId(unit_id) : null,
          userId: toObjId(userId),
          type: type,
          title: template.title,
          message: template.message,
          actionUrl: template.actionUrl || null,
          actionLabel: template.actionLabel || null,
          priority: template.priority || "MEDIUM",
          referenceId: referenceId ? toObjId(referenceId) : null,
          referenceType: referenceType || null
        });

        results.notificationId = notification._id;
        results.inApp = { success: true, id: notification._id };
      } catch (err) {
        console.error("[Notification] In-app failed:", err.message);
        results.inApp = { success: false, error: err.message };
      }
    }

    // ─── 2. Email Notification ─────────────────────────────────
    if (email) {
      try {
        const recipientEmail = toEmail || user.email;
        const subject = emailSubject || template.title;
        const html = emailHtml || `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #7c3aed;">${template.title}</h2>
            <p style="font-size: 16px; color: #333;">${template.message}</p>
            ${template.actionUrl ? `<a href="${process.env.FRONTEND_URL}${template.actionUrl}" style="display: inline-block; margin-top: 20px; padding: 12px 24px; background: #7c3aed; color: white; text-decoration: none; border-radius: 6px;">${template.actionLabel || 'View Details'}</a>` : ''}
          </div>
        `;

        await sendEmail({ to: recipientEmail, subject, html });
        results.email = { success: true };

        // Update notification record if exists
        if (results.notificationId) {
          await Notification.findByIdAndUpdate(results.notificationId, {
            emailSent: true,
            emailSentAt: new Date()
          });
        }
      } catch (err) {
        console.error("[Notification] Email failed:", err.message);
        results.email = { success: false, error: err.message };
      }
    }

    // ─── 3. Push Notification (FCM) ────────────────────────────
    if (push && user.fcmTokens && user.fcmTokens.length > 0) {
      try {
        const tokens = user.fcmTokens.map(t => t.token).filter(t => t);
        
        if (tokens.length > 0) {
          const pushResult = await sendPushNotification({
            fcmTokens: tokens,
            title: template.title,
            body: template.message,
            data: {
              type: type,
              actionUrl: template.actionUrl || "/",
              actionLabel: template.actionLabel || "Open",
              referenceId: referenceId ? String(referenceId) : "",
              referenceType: referenceType || "",
              ...pushData
            },
            priority: template.priority === "HIGH" ? "high" : "normal",
            notificationId: results.notificationId ? String(results.notificationId) : null
          });

          results.push = pushResult;

          // Clean up invalid tokens
          if (pushResult.failedTokens && pushResult.failedTokens.length > 0) {
            await User.findByIdAndUpdate(userId, {
              $pull: { fcmTokens: { token: { $in: pushResult.failedTokens } } }
            });
            console.log(`[Notification] Removed ${pushResult.failedTokens.length} invalid tokens`);
          }
        } else {
          results.push = { success: false, message: "No valid FCM tokens" };
        }
      } catch (err) {
        console.error("[Notification] Push failed:", err.message);
        results.push = { success: false, error: err.message };
      }
    } else if (push) {
      results.push = { success: false, message: "User has no FCM tokens registered" };
    }

    return {
      success: true,
      results
    };

  } catch (error) {
    console.error("[Notification] Send failed:", error.message);
    return { success: false, error: error.message };
  }
};

// ─── Bulk Notification Sender ───────────────────────────────────────────────
exports.sendBulkNotifications = async (userIds, payload) => {
  const results = await Promise.allSettled(
    userIds.map(userId => exports.sendNotification({ ...payload, userId }))
  );

  const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
  const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;

  return {
    total: userIds.length,
    successful,
    failed
  };
};

module.exports.TEMPLATES = TEMPLATES;
