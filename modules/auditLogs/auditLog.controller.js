"use strict";
const service = require("./auditLog.service");

exports.getLogs = async (req, res, next) => {
  try {
    const data = await service.getLogs(req.query, req.user);
    res.status(200).json({ success: true, data });
  } catch (e) { next(e); }
};

exports.getEmployeeTimeline = async (req, res, next) => {
  try {
    const data = await service.getEmployeeTimeline(req.params.employeeId, req.user);
    res.status(200).json({ success: true, data });
  } catch (e) { next(e); }
};