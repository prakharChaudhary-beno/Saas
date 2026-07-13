// modules/holiday/holiday.controller.js
// UPDATED — tenantId → org_id + company_id

const holidayService = require("./holiday.service");

exports.createHoliday = async (req, res, next) => {
  try {
    const holiday = await holidayService.createHoliday(req.body, req.user);
    res.status(201).json({ success: true, message: "Holiday created successfully", data: holiday });
  } catch (err) { next(err); }
};

exports.listHolidays = async (req, res, next) => {
  try {
    const holidays = await holidayService.listHolidays(req.query, req.user);
    res.status(200).json({ success: true, data: holidays, count: holidays.length });
  } catch (err) { next(err); }
};

exports.getHoliday = async (req, res, next) => {
  try {
    const holiday = await holidayService.getHoliday(req.params.id, req.user);
    res.status(200).json({ success: true, data: holiday });
  } catch (err) { next(err); }
};

exports.updateHoliday = async (req, res, next) => {
  try {
    const holiday = await holidayService.updateHoliday(req.params.id, req.body, req.user);
    res.status(200).json({ success: true, message: "Holiday updated successfully", data: holiday });
  } catch (err) { next(err); }
};

exports.deleteHoliday = async (req, res, next) => {
  try {
    const result = await holidayService.deleteHoliday(req.params.id, req.user);
    res.status(200).json({ success: true, ...result });
  } catch (err) { next(err); }
};

exports.toggleHoliday = async (req, res, next) => {
  try {
    const result = await holidayService.toggleHoliday(req.params.id, req.user);
    res.status(200).json({ success: true, ...result });
  } catch (err) { next(err); }
};

exports.getMasterHolidays = async (req, res, next) => {
  try {
    const holidays = await holidayService.getMasterHolidays(req.query);
    res.status(200).json({ success: true, data: holidays, count: holidays.length });
  } catch (err) { next(err); }
};

exports.createMasterHoliday = async (req, res, next) => {
  try {
    const holiday = await holidayService.createMasterHoliday(req.body);
    res.status(201).json({ success: true, message: "Master holiday created", data: holiday });
  } catch (err) { next(err); }
};

exports.updateMasterHoliday = async (req, res, next) => {
  try {
    const holiday = await holidayService.updateMasterHoliday(req.params.id, req.body);
    res.status(200).json({ success: true, message: "Master holiday updated", data: holiday });
  } catch (err) { next(err); }
};

exports.toggleMasterHoliday = async (req, res, next) => {
  try {
    const result = await holidayService.toggleMasterHoliday(req.params.id);
    res.status(200).json({ success: true, ...result });
  } catch (err) { next(err); }
};

exports.deleteMasterHoliday = async (req, res, next) => {
  try {
    const result = await holidayService.deleteMasterHoliday(req.params.id);
    res.status(200).json({ success: true, ...result });
  } catch (err) { next(err); }
};

exports.importHolidays = async (req, res, next) => {
  try {
    const result = await holidayService.importHolidays(req.body, req.user);
    res.status(200).json({ success: true, ...result });
  } catch (err) { next(err); }
};