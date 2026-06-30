// modules/shift/roster.controller.js

"use strict";

const rosterService = require("./roster.service");

exports.createRoster = async (req, res, next) => {
  try {
    const result = await rosterService.createRoster(req.body, req.user);
    res.status(201).json({ success: true, data: result });
  } catch (e) { next(e); }
};

exports.bulkAssignRoster = async (req, res, next) => {
  try {
    const result = await rosterService.bulkAssignRoster(req.body, req.user);
    res.status(200).json({ success: true, data: result });
  } catch (e) { next(e); }
};

exports.getEmployeeRosters = async (req, res, next) => {
  try {
    const result = await rosterService.getEmployeeRosters(req.query, req.user);
    res.status(200).json({ success: true, data: result });
  } catch (e) { next(e); }
};

exports.getRosterCalendar = async (req, res, next) => {
  try {
    const result = await rosterService.getRosterCalendar(req.query, req.user);
    res.status(200).json({ success: true, data: result });
  } catch (e) { next(e); }
};

exports.getRosterById = async (req, res, next) => {
  try {
    const result = await rosterService.getRosterById(req.params.id, req.user);
    res.status(200).json({ success: true, data: result });
  } catch (e) { next(e); }
};

exports.updateRoster = async (req, res, next) => {
  try {
    const result = await rosterService.updateRoster(req.params.id, req.body, req.user);
    res.status(200).json({ success: true, data: result });
  } catch (e) { next(e); }
};

exports.revokeRoster = async (req, res, next) => {
  try {
    const result = await rosterService.revokeRoster(req.params.id, req.body, req.user);
    res.status(200).json({ success: true, data: result });
  } catch (e) { next(e); }
};
