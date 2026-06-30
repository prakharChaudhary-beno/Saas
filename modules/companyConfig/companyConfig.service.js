// modules/companyConfig/companyConfig.service.js
// UPDATED — tenantId → company_id

const CompanyConfig = require("./models/companyConfig.model");
const AppError      = require("../../utils/appError");

const isValidTimezone = (tz) => {
  try { Intl.DateTimeFormat(undefined, { timeZone: tz }); return true; }
  catch { return false; }
};

exports.getConfig = async (user) => {
  return await CompanyConfig.findOne({ company_id: user.companyId });
};

exports.upsertConfig = async (body, user) => {
  if (body.timezone && !isValidTimezone(body.timezone)) {
    throw new AppError("Invalid IANA timezone. Example: Asia/Kolkata, America/New_York", 400);
  }

  if (body.currency && !/^[A-Z]{3}$/.test(body.currency.toUpperCase())) {
    throw new AppError("Invalid currency code. Must be 3 uppercase letters. Example: INR, USD", 400);
  }

  if (body.currency) body.currency = body.currency.toUpperCase();

  const config = await CompanyConfig.findOneAndUpdate(
    { company_id: user.companyId },
    {
      ...body,
      org_id:    user.orgId,
      company_id: user.companyId,
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