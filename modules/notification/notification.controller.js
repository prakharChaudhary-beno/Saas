"use strict";
const service = require("./notification.service");

exports.getMyNotifications = async (req, res, next) => {
  try {
    const data = await service.getMyNotifications(req.query, req.user);
    res.status(200).json({ success: true, data });
  } catch (e) { next(e); }
};

exports.markAsRead = async (req, res, next) => {
  try {
    const data = await service.markAsRead(req.params.id, req.user);
    res.status(200).json({ success: true, message: "Marked as read", data });
  } catch (e) { next(e); }
};

exports.markAllAsRead = async (req, res, next) => {
  try {
    const data = await service.markAllAsRead(req.user);
    res.status(200).json({ success: true, message: "All marked as read", data });
  } catch (e) { next(e); }
};

exports.getUnreadCount = async (req, res, next) => {
  try {
    const data = await service.getUnreadCount(req.user);
    res.status(200).json({ success: true, data });
  } catch (e) { next(e); }
};

exports.deleteNotification = async (req, res, next) => {
  try {
    const data = await service.deleteNotification(req.params.id, req.user);
    res.status(200).json({ success: true, data });
  } catch (e) { next(e); }
};