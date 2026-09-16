// modules/companyConfig/companyConfig.service.js
// UPDATED — tenantId → company_id

const CompanyConfig = require("./models/companyConfig.model");
const Company       = require("../company/models/company.model");
const Unit          = require("../unit/models/unit.model");
const AppError      = require("../../utils/appError");

const isValidTimezone = (tz) => {
  try { Intl.DateTimeFormat(undefined, { timeZone: tz }); return true; }
  catch { return false; }
};

const resolveScope = async (user, query = {}) => {
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

  const orgId = user.role === "SUPER_ADMIN" ? requestedOrgId : user.orgId;
  const companyId = user.companyId || requestedCompanyId;
  const unitId = user.unitId || requestedUnitId;

  if (!orgId) throw new AppError("orgId is required", 400);
  if (!companyId) throw new AppError("companyId is required", 400);

  const companyExists = await Company.exists({ _id: companyId, org_id: orgId, is_deleted: false });
  if (!companyExists) throw new AppError("Company not found in selected organization", 404);

  if (unitId) {
    const unitExists = await Unit.exists({
      _id: unitId,
      org_id: orgId,
      company_id: companyId,
      is_deleted: false,
    });
    if (!unitExists) throw new AppError("Unit not found in selected organization and company", 404);
  }

  return { orgId, companyId };
};

exports.getConfig = async (user, query = {}) => {
  const { orgId, companyId } = await resolveScope(user, query);
  return await CompanyConfig.findOne({ org_id: orgId, company_id: companyId });
};

exports.upsertConfig = async (body, user, query = {}) => {
  const { orgId, companyId } = await resolveScope(user, query);

  if (body.timezone && !isValidTimezone(body.timezone)) {
    throw new AppError("Invalid IANA timezone. Example: Asia/Kolkata, America/New_York", 400);
  }

  if (body.currency && !/^[A-Z]{3}$/.test(body.currency.toUpperCase())) {
    throw new AppError("Invalid currency code. Must be 3 uppercase letters. Example: INR, USD", 400);
  }

  if (body.currency) body.currency = body.currency.toUpperCase();

  const config = await CompanyConfig.findOneAndUpdate(
    { org_id: orgId, company_id: companyId },
    {
      ...body,
      org_id: orgId,
      company_id: companyId,
      updatedBy: user.userId,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  if (!config.createdBy) {
    config.createdBy = user.userId;
    await config.save();
  }

  return config;
};