// modules/superAdmin/superAdmin.controller.js
// UPDATED — updateTenantStatus added

const service = require("./superAdmin.service");

exports.getAllTenants = async (req, res, next) => {
  try {
    const data = await service.getAllTenants(req.query);
    res.status(200).json({ success: true, message: "Organisations fetched", data });
  } catch (err) { next(err); }
};
exports.getCustomerHierarchy = async (req, res, next) => {
  try {
    const data = await service.getCustomerHierarchy(req.query);
    res.json({ success: true, message: "Customer hierarchy fetched", data });
  } catch (err) { next(err); }
};
exports.getTenantById = async (req, res, next) => {
  try {
    const data = await service.getTenantById(req.params.id);
    res.status(200).json({ success: true, message: "Organisation fetched", data });
  } catch (err) { next(err); }
};

exports.overridePlan = async (req, res, next) => {
  try {
    const data = await service.overrideTenantPlan(
      req.params.id,
      req.body,
      req.user.email,
      req.ip
    );
    res.status(200).json({ success: true, message: "Plan updated successfully", data });
  } catch (err) { next(err); }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const data = await service.updateTenantStatus(
      req.params.id,
      req.body,
      req.user.email,
      req.ip
    );
    res.status(200).json({ success: true, message: "Status updated successfully", data });
  } catch (err) { next(err); }
};

exports.getAuditLog = async (req, res, next) => {
  try {
    const data = await service.getAuditLogs(req.query);
    res.status(200).json({ success: true, message: "Audit logs fetched", data });
  } catch (err) { next(err); }
};

// Create Customer
exports.createCustomer = async (req, res, next) => {
  try {
    const data = await service.createCustomer(req.body);
    res.status(201).json({ success: true, message: data.message, data });
  } catch (err) { next(err); }
};

// Customer creates their org
exports.createOrgForCustomer = async (req, res, next) => {
  try {
    const data = await service.createOrgForCustomer(req.body, req.customer);
    res.status(201).json({ success: true, message: data.message, data });
  } catch (err) { next(err); }
};