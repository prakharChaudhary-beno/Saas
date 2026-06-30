// modules/lob/lob.controller.js

const lobService = require("./lob.service");

exports.createLob = async (req, res, next) => {
  try {
    const lob = await lobService.createLob(req.body, req.user);
    return res.status(201).json({ success: true, message: "LOB created successfully", data: lob });
  } catch (err) { next(err); }
};

exports.getLobs = async (req, res, next) => {
  try {
    const result = await lobService.getLobs(req.user, req.query);
    return res.status(200).json({ success: true, ...result });
  } catch (err) { next(err); }
};

exports.getLobById = async (req, res, next) => {
  try {
    const lob = await lobService.getLobById(req.params.id, req.user);
    return res.status(200).json({ success: true, data: lob });
  } catch (err) { next(err); }
};

exports.updateLob = async (req, res, next) => {
  try {
    const lob = await lobService.updateLob(req.params.id, req.body, req.user);
    return res.status(200).json({ success: true, message: "LOB updated successfully", data: lob });
  } catch (err) { next(err); }
};

exports.deleteLob = async (req, res, next) => {
  try {
    const result = await lobService.deleteLob(req.params.id, req.user);
    return res.status(200).json({ success: true, ...result });
  } catch (err) { next(err); }
};