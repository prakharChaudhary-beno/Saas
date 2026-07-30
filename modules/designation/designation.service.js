// modules/designation/designation.service.js
// Designations are unit-level

const Designation = require("./designation.model");
const Employee     = require("../employee/models/employee.model");
const AppError    = require("../../utils/appError");

// Scope filter — unit level
const buildFilter = (user) => {
  if (user.role === "SUPER_ADMIN") return {};
  const filter = { org_id: user.orgId };
  if (user.companyId) filter.company_id = user.companyId;
  if (user.unitId)    filter.unit_id    = user.unitId;
  return filter;
};

exports.createDesignation = async (data, user) => {
  const unitId = data.unit_id || user.unitId;
  if (!unitId) throw new AppError("unit_id is required", 400);

  // Duplicate check within same unit
  const existing = await Designation.findOne({
    unit_id:   unitId,
    name:      { $regex: `^${data.name}$`, $options: "i" },
    isDeleted: false,
  });
  if (existing) throw new AppError("Designation with this name already exists in this unit", 409);

  return await Designation.create({
    org_id:     user.orgId,
    company_id: data.company_id || user.companyId,
    unit_id:    unitId,
    name:       data.name,
    created_by: user.userId,
  });
};

exports.getDesignations = async (user, query = {}) => {
  const { unit_id, search } = query;
  const filter = { isDeleted: false, ...buildFilter(user) };

  if (unit_id && !user.unitId) filter.unit_id = unit_id;
  if (search) filter.name = { $regex: search, $options: "i" };

  return await Designation.find(filter)
    .populate("unit_id", "name")
    .sort({ createdAt: -1 });
};

exports.getDesignationById = async (id, user) => {
  const filter = { _id: id, isDeleted: false, ...buildFilter(user) };
  const designation = await Designation.findOne(filter).populate("unit_id", "name");
  if (!designation) throw new AppError("Designation not found", 404);
  return designation;
};

exports.updateDesignation = async (id, data, user) => {
  const filter = { _id: id, isDeleted: false, ...buildFilter(user) };
  const designation = await Designation.findOne(filter);
  if (!designation) throw new AppError("Designation not found", 404);

  if (data.name)   designation.name   = data.name;
  if (data.status) designation.status = data.status;

  await designation.save();
  return designation;
};

exports.deleteDesignation = async (id, user) => {
  const filter = { _id: id, isDeleted: false, ...buildFilter(user) };
  const designation = await Designation.findOne(filter);
  if (!designation) throw new AppError("Designation not found", 404);

  // Block deletion if any active employee is still assigned to this
  // designation — deleting it out from under them would orphan their
  // record / break anything that reads designationId downstream.
  const assignedCount = await Employee.countDocuments({
    designationId: id,
    isDeleted:     false,
    status:        { $ne: "TERMINATED" },
  });

  if (assignedCount > 0) {
    throw new AppError(
      `Cannot delete designation — ${assignedCount} employee(s) are still assigned to it. Reassign them first.`,
      409
    );
  }

  designation.isDeleted = true;
  await designation.save();
  return { message: "Designation deleted successfully" };
};