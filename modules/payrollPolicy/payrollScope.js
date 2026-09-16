"use strict";

const mongoose = require("mongoose");

const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));

/**
 * Builds the tenant filter for payroll documents visible to a user.
 * @param {object} user Authenticated user context.
 * @returns {object} Mongoose tenant filter.
 */
const buildPayrollScope = (user) => {
  const scope = { isDeleted: false };

  if (user.role === "SUPER_ADMIN" || user.role === "super_admin") return scope;
  if (user.orgId) scope.org_id = toObjectId(user.orgId);

  if (["org_admin", "org_auditor"].includes(user.role)) return scope;
  if (user.companyId) scope.company_id = toObjectId(user.companyId);

  if (["company_admin", "company_hr_manager"].includes(user.role)) return scope;
  if (user.unitId) scope.unit_id = toObjectId(user.unitId);

  return scope;
};

module.exports = { buildPayrollScope };