"use strict";
const service = require("./attendanceRegularization.service");

exports.apply = async (req, res, next) => {
  try {
    const data = await service.applyRegularization(req.body, req.user);
    res.status(201).json({ success: true, message: "Regularization request submitted", data });
  } catch (e) { next(e); }
};

exports.getMyRequests = async (req, res, next) => {
  try {
    const data = await service.getMyRequests(req.query, req.user);
    res.status(200).json({ success: true, data });
  } catch (e) { next(e); }
};

exports.getPendingApprovals = async (req, res, next) => {
  try {
    const data = await service.getPendingApprovals(req.query, req.user);
    res.status(200).json({ success: true, data });
  } catch (e) { next(e); }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const data = await service.updateStatus(req.params.id, req.body, req.user);
    res.status(200).json({ success: true, message: "Request updated", data });
  } catch (e) { next(e); }
};

exports.cancelRequest = async (req, res, next) => {
  try {
    const data = await service.cancelRequest(req.params.id, req.user);
    res.status(200).json({ success: true, message: "Request cancelled", data });
  } catch (e) { next(e); }
};