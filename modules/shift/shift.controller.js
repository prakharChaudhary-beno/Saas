// modules/shift/shift.controller.js

"use strict";

const shiftService = require("./shift.service");

exports.createShift = async (req, res, next) => {
  try {
    const result = await shiftService.createShift(req.body, req.user);
    res.status(201).json({ success: true, data: result });
  } catch (e) { next(e); }
};

exports.getAllShifts = async (req, res, next) => {
  try {
    const result = await shiftService.getAllShifts(req.query, req.user);
    res.status(200).json({ success: true, data: result });
  } catch (e) { next(e); }
};

exports.getShiftById = async (req, res, next) => {
  try {
    const result = await shiftService.getShiftById(req.params.id, req.user);
    res.status(200).json({ success: true, data: result });
  } catch (e) { next(e); }
};

exports.updateShift = async (req, res, next) => {
  try {
    const result = await shiftService.updateShift(req.params.id, req.body, req.user);
    res.status(200).json({ success: true, data: result });
  } catch (e) { next(e); }
};

exports.activateShift = async (req, res, next) => {
  try {
    const result = await shiftService.activateShift(req.params.id, req.user);
    res.status(200).json({ success: true, data: result });
  } catch (e) { next(e); }
};

exports.deactivateShift = async (req, res, next) => {
  try {
    const result = await shiftService.deactivateShift(req.params.id, req.user);
    res.status(200).json({ success: true, data: result });
  } catch (e) { next(e); }
};

exports.deleteShift = async (req, res, next) => {
  try {
    const result = await shiftService.deleteShift(req.params.id, req.user);
    res.status(200).json({ success: true, data: result });
  } catch (e) { next(e); }
};
