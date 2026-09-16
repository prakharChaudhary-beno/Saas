// modules/designation/designation.service.js
// Designations are unit-level

const Designation = require("./designation.model");
const Employee     = require("../employee/models/employee.model");
const Unit         = require("../unit/models/unit.model");
const AppError    = require("../../utils/appError");

// Scope filter — unit level
const buildFilter = (user, query = {}) => {
  const requestedOrgId = query.orgId;
  const requestedCompanyId = query.companyId;
  const requestedUnitId = query.unit_id;

  if (user.role !== "SUPER_ADMIN" && requestedOrgId && String(requestedOrgId) !== String(user.orgId)) {
    throw new AppError("Organization access denied", 403);
  }
  if (user.companyId && requestedCompanyId && String(requestedCompanyId) !== String(user.companyId)) {
    throw new AppError("Company access denied", 403);
  }
  if (user.unitId && requestedUnitId && String(requestedUnitId) !== String(user.unitId)) {
    throw new AppError("Unit access denied", 403);
  }

  const filter = {};
  const orgId = user.role === "SUPER_ADMIN" ? requestedOrgId : user.orgId;
  const companyId = user.companyId || requestedCompanyId;
  const unitId = user.unitId || requestedUnitId;

  if (orgId) filter.org_id = orgId;
  if (companyId) filter.company_id = companyId;
  if (unitId) filter.unit_id = unitId;
  return filter;
};

exports.createDesignation = async (data, user, query = {}) => {
  const scope = buildFilter(user, query);
  if (!scope.org_id) throw new AppError("orgId is required", 400);
  if (!scope.company_id) throw new AppError("companyId is required", 400);
  if (!scope.unit_id) throw new AppError("unit_id is required", 400);

  const unit = await Unit.findOne({
    _id: scope.unit_id,
    org_id: scope.org_id,
    company_id: scope.company_id,
    is_deleted: false,
  }).select("_id");
  if (!unit) throw new AppError("Unit not found in selected organization and company", 404);

  // Duplicate check within same unit
  const existing = await Designation.findOne({
    ...scope,
    name:      { $regex: `^${data.name}$`, $options: "i" },
    isDeleted: false,
  });
  if (existing) throw new AppError("Designation with this name already exists in this unit", 409);

  return await Designation.create({
    ...scope,
    name:       data.name,
    created_by: user.userId,
  });
};

exports.getDesignations = async (user, query = {}) => {
  const { search } = query;
  const filter = { isDeleted: false, ...buildFilter(user, query) };

  if (search) filter.name = { $regex: search, $options: "i" };

  return await Designation.find(filter)
    .populate("unit_id", "name")
    .sort({ createdAt: -1 });
};

exports.getDesignationById = async (id, user, query = {}) => {
  const filter = { _id: id, isDeleted: false, ...buildFilter(user, query) };
  const designation = await Designation.findOne(filter).populate("unit_id", "name");
  if (!designation) throw new AppError("Designation not found", 404);
  return designation;
};

exports.updateDesignation = async (id, data, user, query = {}) => {
  const filter = { _id: id, isDeleted: false, ...buildFilter(user, query) };
  const designation = await Designation.findOne(filter);
  if (!designation) throw new AppError("Designation not found", 404);

  if (data.name)   designation.name   = data.name;
  if (data.status) designation.status = data.status;

  await designation.save();
  return designation;
};

exports.deleteDesignation = async (id, user, query = {}) => {
  const filter = { _id: id, isDeleted: false, ...buildFilter(user, query) };
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