// modules/lob/lob.service.js

const LOB      = require("./models/lob.model");
const Unit     = require("../unit/models/unit.model");
const Company  = require("../company/models/company.model");
const AppError = require("../../utils/appError");

// ─── Scope guard helper ───────────────────────────────────────
// Company Admin can only manage LOBs under companies they belong to
const verifyCompanyScope = async (companyId, reqUser) => {
  const company = await Company.findOne({
    _id:        companyId,
    org_id:     reqUser.orgId,
    is_deleted: false,
  });
  if (!company) throw new AppError("Company not found", 404);
  // Company Admin: must match their own company_id
  if (reqUser.level === "company" && reqUser.companyId?.toString() !== companyId.toString()) {
    throw new AppError("Access denied — not your company", 403);
  }
  return company;
};

// ─── CREATE ───────────────────────────────────────────────────
exports.createLob = async (payload, reqUser) => {
  const { name, description,code } = payload;
    const company_id = payload.company_id || reqUser.companyId;


  await verifyCompanyScope(company_id, reqUser);

  // Duplicate name check within same company
  const existing = await LOB.findOne({
    company_id,
    name:       { $regex: `^${name}$`, $options: "i" },
    is_deleted: false,
  });
  if (existing) throw new AppError("A LOB with this name already exists in this company", 409);

  const lob = await LOB.create({
    org_id:     reqUser.orgId,
    company_id,
    name,
    code: code || "",
    description: description || "",
    created_by:  reqUser.userId,
  });

  return lob;
};

// ─── GET ALL ──────────────────────────────────────────────────
exports.getLobs = async (reqUser, query = {}) => {
  const { company_id, status, search, page = 1, limit = 20 } = query;

  const filter = {
    org_id:     reqUser.orgId,
    is_deleted: false,
  };

  // Company Admin: auto-scope to their company
  if (reqUser.level === "company") {
    filter.company_id = reqUser.companyId;
  } else if (company_id) {
    filter.company_id = company_id;
  }

  if (status) filter.status = status;
  if (search) filter.name = { $regex: search, $options: "i" };

  const skip  = (Number(page) - 1) * Number(limit);
  const total = await LOB.countDocuments(filter);
  const lobs  = await LOB.find(filter)
    .populate("company_id", "company_name company_code")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean();

  return {
    lobs,
    pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) },
  };
};

// ─── GET ONE ──────────────────────────────────────────────────
exports.getLobById = async (lobId, reqUser) => {
  const filter = { _id: lobId, org_id: reqUser.orgId, is_deleted: false };
  if (reqUser.level === "company") filter.company_id = reqUser.companyId;

  const lob = await LOB.findOne(filter).populate("company_id", "company_name");
  if (!lob) throw new AppError("LOB not found", 404);
  return lob;
};

// ─── UPDATE ───────────────────────────────────────────────────
exports.updateLob = async (lobId, payload, reqUser) => {
  delete payload.org_id;
  delete payload.company_id;

  const filter = { _id: lobId, org_id: reqUser.orgId, is_deleted: false };
  if (reqUser.level === "company") filter.company_id = reqUser.companyId;

  const lob = await LOB.findOneAndUpdate(filter, payload, { new: true, runValidators: true });
  if (!lob) throw new AppError("LOB not found", 404);
  return lob;
};

// ─── SOFT DELETE ──────────────────────────────────────────────
// Block if active units are still linked
exports.deleteLob = async (lobId, reqUser) => {
  const filter = { _id: lobId, org_id: reqUser.orgId, is_deleted: false };
  if (reqUser.level === "company") filter.company_id = reqUser.companyId;

  const lob = await LOB.findOne(filter);
  if (!lob) throw new AppError("LOB not found", 404);

  // Block delete if active units exist under this LOB
  const activeUnits = await Unit.countDocuments({ lob_id: lobId, is_deleted: false });
  if (activeUnits > 0) {
    throw new AppError(
      `Cannot delete LOB — ${activeUnits} unit(s) are still linked. Remove units first.`,
      400
    );
  }

  lob.is_deleted = true;
  lob.status     = "Inactive";
  await lob.save();

  return { message: "LOB deleted successfully" };
};