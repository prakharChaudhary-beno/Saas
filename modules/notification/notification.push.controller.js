// modules/notification/notification.push.controller.js
// Push notification token management
"use strict";

const User = require("../auth/models/user.model");
const { subscribeToTopic, unsubscribeFromTopic } = require("../../utils/firebase/firebaseAdmin");
const AppError = require("../../utils/appError");
const mongoose = require("mongoose");

const toObjId = (id) => {
  try { return new mongoose.Types.ObjectId(String(id)); }
  catch { return null; }
};

// ─── Register FCM Token ────────────────────────────────────────────────────
exports.registerFCMToken = async (req, res, next) => {
  try {
    const { token, deviceType = "web", deviceId = null } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "FCM token is required"
      });
    }

    const userId = req.user.userId;

    // Check if token already exists
    const existingUser = await User.findOne({
      _id: toObjId(userId),
      "fcmTokens.token": token
    });

    if (existingUser) {
      // Update lastUsed timestamp
      await User.updateOne(
        { _id: toObjId(userId), "fcmTokens.token": token },
        { $set: { "fcmTokens.$.lastUsed": new Date() } }
      );

      return res.status(200).json({
        success: true,
        message: "Token updated successfully"
      });
    }

    // Add new token (max 5 devices per user)
    const user = await User.findById(toObjId(userId));
    
    if (user.fcmTokens.length >= 5) {
      // Remove oldest token
      user.fcmTokens.sort((a, b) => a.lastUsed - b.lastUsed);
      user.fcmTokens.shift();
    }

    user.fcmTokens.push({
      token,
      deviceType,
      deviceId,
      lastUsed: new Date(),
      createdAt: new Date()
    });

    await user.save();

    // Subscribe to org and company topics for broadcast notifications
    if (req.user.orgId) {
      await subscribeToTopic([token], `org_${req.user.orgId}`);
    }
    if (req.user.companyId) {
      await subscribeToTopic([token], `company_${req.user.companyId}`);
    }
    if (req.user.unitId) {
      await subscribeToTopic([token], `unit_${req.user.unitId}`);
    }

    return res.status(200).json({
      success: true,
      message: "Token registered successfully",
      data: {
        deviceCount: user.fcmTokens.length
      }
    });

  } catch (error) {
    console.error("[Push] Register token failed:", error.message);
    next(error);
  }
};

// ─── Unregister FCM Token ───────────────────────────────────────────────────
exports.unregisterFCMToken = async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "FCM token is required"
      });
    }

    const userId = req.user.userId;

    // Unsubscribe from topics
    const user = await User.findById(toObjId(userId)).lean();
    
    if (user) {
      if (user.org_id) {
        await unsubscribeFromTopic([token], `org_${user.org_id}`);
      }
      if (user.company_id) {
        await unsubscribeFromTopic([token], `company_${user.company_id}`);
      }
      if (user.unit_id) {
        await unsubscribeFromTopic([token], `unit_${user.unit_id}`);
      }
    }

    // Remove token from user
    await User.findByIdAndUpdate(toObjId(userId), {
      $pull: { fcmTokens: { token } }
    });

    return res.status(200).json({
      success: true,
      message: "Token unregistered successfully"
    });

  } catch (error) {
    console.error("[Push] Unregister token failed:", error.message);
    next(error);
  }
};

// ─── Get User's Registered Devices ─────────────────────────────────────────
exports.getMyDevices = async (req, res, next) => {
  try {
    const user = await User.findById(toObjId(req.user.userId))
      .select("fcmTokens")
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const devices = user.fcmTokens.map(t => ({
      deviceType: t.deviceType,
      deviceId: t.deviceId,
      lastUsed: t.lastUsed,
      createdAt: t.createdAt
    }));

    return res.status(200).json({
      success: true,
      data: devices
    });

  } catch (error) {
    next(error);
  }
};

// ─── Test Push Notification ────────────────────────────────────────────────
exports.testPushNotification = async (req, res, next) => {
  try {
    const { title, message } = req.body;

    const sendNotification = require("../../utils/sendNotification").sendNotification;

    const result = await sendNotification({
      type: "GENERAL",
      userId: req.user.userId,
      org_id: req.user.orgId,
      unit_id: req.user.unitId,
      data: {
        title: title || "Test Notification",
        message: message || "This is a test push notification from HRMS"
      },
      inApp: true,
      push: true,
      email: false
    });

    return res.status(200).json({
      success: true,
      message: "Test notification sent",
      data: result
    });

  } catch (error) {
    console.error("[Push] Test failed:", error.message);
    next(error);
  }
};
