"use strict";
const service = require("./payrollLock.service");

exports.lockPeriod    = async (req, res, next) => {
  try {
    const data = await service.lockPeriod(req.body, req.user);
    res.status(200).json({ success: true, message: "Payroll period locked", data });
  } catch (e) { next(e); }
};

exports.unlockPeriod  = async (req, res, next) => {
  try {
    const data = await service.unlockPeriod(req.body, req.user);
    res.status(200).json({ success: true, message: "Payroll period unlocked", data });
  } catch (e) { next(e); }
};

exports.getLockStatus = async (req, res, next) => {
  try {
    const data = await service.getLockStatus(req.params.month, req.user);
    res.status(200).json({ success: true, data });
  } catch (e) { next(e); }
};

exports.getAllLocks    = async (req, res, next) => {
  try {
    const data = await service.getAllLocks(req.query, req.user);
    res.status(200).json({ success: true, data });
  } catch (e) { next(e); }
};