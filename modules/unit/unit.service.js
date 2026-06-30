// modules/unit/unit.service.js

const mongoose      = require("mongoose");
const Unit          = require("./models/unit.model");
const LOB           = require("../lob/models/lob.model");
const Role          = require("../role/role.model");
const User          = require("../auth/models/user.model");
const AppError      = require("../../utils/appError");

// ─── Helper ───────────────────────────────────────────────────
const generateTempPassword = () => {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pwd = "";
  for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  return pwd;
};

// ─── Scope guard ──────────────────────────────────────────────
const verifyLobScope = async (lob_id, reqUser) => {
  const filter = { _id: lob_id, org_id: reqUser.orgId, is_deleted: false };
  if (reqUser.level === "company") filter.company_id = reqUser.companyId;

  const lob = await LOB.findOne(filter);
  if (!lob) throw new AppError("LOB not found or access denied", 404);
  return lob;
};

// ─── CREATE ───────────────────────────────────────────────────
// Flow:
//   1. Unit create karo
//   2. Unit Admin user create karo (is_first_login: true)
//   3. Credentials email bhejo
// All in one DB transaction. Email is outside transaction.
//
// admin_email is separate from unit — Unit Admin ka email
// (different from LOB/Company email)
exports.createUnit = async (payload, reqUser) => {
  const {
    lob_id, name, description, location,
  } = payload;
 
  const lob = await verifyLobScope(lob_id, reqUser);
 
  // Duplicate unit name check within same LOB
  const existing = await Unit.findOne({
    lob_id,
    name:       { $regex: `^${name}$`, $options: "i" },
    is_deleted: false,
  });
  if (existing) throw new AppError("A unit with this name already exists in this LOB", 409);
 
  const session = await mongoose.startSession();
  session.startTransaction();
 
  try {
    const [unit] = await Unit.create([{
      org_id:      reqUser.orgId,
      company_id:  lob.company_id,
      lob_id,
      name,
      description: description || "",
      location:    location    || null,
      created_by:  reqUser.userId,
    }], { session });
 
    await session.commitTransaction();
    session.endSession();
 
    // Fresh query — avoid circular JSON from session
    const createdUnit = await Unit.findById(unit._id).lean();
 
    return {
      unit: createdUnit,
      message: "Unit created successfully.",
    };
 
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] || "field";
      throw new AppError(`Duplicate value for ${field}. Please try again.`, 409);
    }
    throw err;
  }
};

// ─── GET ALL ──────────────────────────────────────────────────
exports.getUnits = async (reqUser, query = {}) => {
  const { lob_id, company_id, status, search, page = 1, limit = 20 } = query;

  const filter = { org_id: reqUser.orgId, is_deleted: false };

  if (reqUser.level === "company") filter.company_id = reqUser.companyId;
  else if (company_id)            filter.company_id  = company_id;

  if (lob_id) filter.lob_id = lob_id;
  if (status) filter.status = status;
  if (search) filter.name   = { $regex: search, $options: "i" };

  const skip  = (Number(page) - 1) * Number(limit);
  const total = await Unit.countDocuments(filter);
  const units = await Unit.find(filter)
    .populate("lob_id",     "name")
    .populate("company_id", "company_name company_code")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean();

  return {
    units,
    pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) },
  };
};

// ─── GET ONE ──────────────────────────────────────────────────
exports.getUnitById = async (unitId, reqUser) => {
  const filter = { _id: unitId, org_id: reqUser.orgId, is_deleted: false };
  if (reqUser.level === "company") filter.company_id = reqUser.companyId;

  const unit = await Unit.findOne(filter)
    .populate("lob_id",     "name")
    .populate("company_id", "company_name");
  if (!unit) throw new AppError("Unit not found", 404);
  return unit;
};

// ─── UPDATE ───────────────────────────────────────────────────
exports.updateUnit = async (unitId, payload, reqUser) => {
  // Prevent changing scope fields
  delete payload.org_id;
  delete payload.company_id;
  delete payload.lob_id;

  const filter = { _id: unitId, org_id: reqUser.orgId, is_deleted: false };
  if (reqUser.level === "company") filter.company_id = reqUser.companyId;

  const unit = await Unit.findOneAndUpdate(filter, payload, { new: true, runValidators: true });
  if (!unit) throw new AppError("Unit not found", 404);
  return unit;
};

// ─── SOFT DELETE ──────────────────────────────────────────────
// Block if active employees are linked
exports.deleteUnit = async (unitId, reqUser) => {
  const filter = { _id: unitId, org_id: reqUser.orgId, is_deleted: false };
  if (reqUser.level === "company") filter.company_id = reqUser.companyId;

  const unit = await Unit.findOne(filter);
  if (!unit) throw new AppError("Unit not found", 404);

  // Block if active employees exist (lazy require — Phase 2)
  let activeEmployees = 0;
  try {
    const Employee = require("../employee/models/employee.model");
    activeEmployees = await Employee.countDocuments({
      unit_id:   unitId,
  isDeleted: false,   // ← correct field name
    });
  } catch (_) {}

  if (activeEmployees > 0) {
    throw new AppError(
      `Cannot delete unit — ${activeEmployees} active employee(s) assigned. Reassign them first.`,
      400
    );
  }

  unit.is_deleted = true;
  unit.status     = "Inactive";
  await unit.save();

  return { message: "Unit deleted successfully" };
};