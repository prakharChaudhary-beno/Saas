// modules/unit/unit.controller.js

const unitService = require("./unit.service");

exports.createUnit = async (req, res, next) => {
  try {
    const unit = await unitService.createUnit(req.body, req.user);
    return res.status(201).json({ success: true, message: "Unit created successfully", data: unit });
  } catch (err) { next(err); }
};

exports.getUnits = async (req, res, next) => {
  try {
    const result = await unitService.getUnits(req.user, req.query);
    return res.status(200).json({ success: true, ...result });
  } catch (err) { next(err); }
};

exports.getUnitById = async (req, res, next) => {
  try {
    const unit = await unitService.getUnitById(req.params.id, req.user);
    return res.status(200).json({ success: true, data: unit });
  } catch (err) { next(err); }
};

exports.updateUnit = async (req, res, next) => {
  try {
    const unit = await unitService.updateUnit(req.params.id, req.body, req.user);
    return res.status(200).json({ success: true, message: "Unit updated successfully", data: unit });
  } catch (err) { next(err); }
};

exports.deleteUnit = async (req, res, next) => {
  try {
    const result = await unitService.deleteUnit(req.params.id, req.user);
    return res.status(200).json({ success: true, ...result });
  } catch (err) { next(err); }
};