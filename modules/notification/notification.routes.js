"use strict";
const express = require("express");
const router  = express.Router();
const ctrl    = require("./notification.controller");
const { authenticate } = require("../../middlewares/auth.middleware");

router.get("/",              authenticate, ctrl.getMyNotifications);
router.get("/unread-count",  authenticate, ctrl.getUnreadCount);
router.patch("/read-all",    authenticate, ctrl.markAllAsRead);
router.patch("/:id/read",    authenticate, ctrl.markAsRead);
router.delete("/:id",        authenticate, ctrl.deleteNotification);

module.exports = router;