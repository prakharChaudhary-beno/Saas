const Company = require("../company/models/company.model");
const Unit = require("../unit/models/unit.model");
const AppError = require("../../utils/appError");

/**
 * Resolves URL and user scope to the company-owned Leave Type catalog.
 * Unit scope inherits the catalog of its parent company.
 */
exports.resolveLeaveTypeScope = async (user, query = {}, requireCompany = false) => {
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

  let orgId = user.role === "SUPER_ADMIN" ? requestedOrgId : user.orgId;
  let companyId = user.companyId || requestedCompanyId;
  const unitId = user.unitId || requestedUnitId;

  if (unitId) {
    const unit = await Unit.findOne({
      _id: unitId,
      ...(orgId && { org_id: orgId }),
      ...(companyId && { company_id: companyId }),
    }).select("org_id company_id").lean();
    if (!unit) throw new AppError("Unit is outside the selected organization or company", 403);
    orgId = unit.org_id;
    companyId = unit.company_id;
  }

  if (companyId) {
    const company = await Company.findOne({
      _id: companyId,
      ...(orgId && { org_id: orgId }),
    }).select("org_id").lean();
    if (!company) throw new AppError("Company is outside the selected organization", 403);
    orgId = company.org_id;
  }

  if (requireCompany && !companyId) {
    throw new AppError("Select a company before managing leave types", 400);
  }

  const filter = {};
  if (orgId) filter.org_id = orgId;
  if (companyId) filter.company_id = companyId;
  return filter;
};