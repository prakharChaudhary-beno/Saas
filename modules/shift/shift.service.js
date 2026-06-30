// modules/shift/shift.service.js
//
// Shift CRUD — Create, Read, Update, Delete + activate/deactivate
//
// Dynamic design:
//   - isDefault enforcement: sirf ek shift per unit default ho sakti hai
//     create/update dono pe check hota hai
//   - Scope: har query mein org_id + company_id + unit_id mandatory
//   - Delete block: agar kisi employee ka active roster is shift pe hai
//     toh delete nahi hoga
//   - HR Manager create kar sakta hai, Unit Admin activate/deactivate
//   - All times stored as "HH:MM" string — timezone handling frontend pe

"use strict";

const Shift    = require("./models/shift.model");
const Roster   = require("./models/roster.model");
const AppError = require("../../utils/appError");
const mongoose = require("mongoose");

const toObjId = (id) => new mongoose.Types.ObjectId(String(id));

// ─── Helper: build scope filter ──────────────────────────────
// Har query mein yeh filter mandatory — cross-unit data leak nahi hoga
const buildScope = (user, unitOverride = null) => ({
  org_id:     toObjId(user.orgId),
  company_id: toObjId(user.companyId),
  unit_id:    toObjId(unitOverride || user.unitId),
  is_deleted: false,
});

// ─── Helper: validate HH:MM format ───────────────────────────
const isValidTime = (t) => /^\d{2}:\d{2}$/.test(t);

// ─── Helper: check overlapping default ───────────────────────
// Ek unit mein sirf ek isDefault:true shift allowed
const enforceDefaultUniqueness = async (unit_id, org_id, company_id, excludeId = null) => {
  const query = {
    unit_id:    toObjId(unit_id),
    org_id:     toObjId(org_id),
    company_id: toObjId(company_id),
    isDefault:  true,
    is_deleted: false,
  };
  if (excludeId) query._id = { $ne: toObjId(excludeId) };

  const existing = await Shift.findOne(query).select("_id name").lean();
  if (existing) {
    throw new AppError(
      `Shift "${existing.name}" is already set as default for this unit. ` +
      `Please remove its default flag first before setting a new default.`,
      409
    );
  }
};

// ─── CREATE ──────────────────────────────────────────────────
// POST /shifts
// Allowed: hr_manager, unit_admin, company_admin, org_admin
exports.createShift = async (payload, user) => {
  const {
    name,
    startTime,
    endTime,
    isNextDay        = false,
    gracePeriodMinutes     = 15,
    halfDayThresholdMinutes = 240,
    workingMinutes         = 480,
    applicableDays         = ["MON", "TUE", "WED", "THU", "FRI"],
    shiftType              = "GENERAL",
    isDefault              = false,
    unit_id,
  } = payload;

  // unit_id — payload se ya user context se
  const targetUnitId = unit_id || user.unitId;
  if (!targetUnitId) throw new AppError("unit_id is required", 400);

  // Time format validate
  if (!isValidTime(startTime)) throw new AppError("startTime must be HH:MM format (e.g. '09:00')", 400);
  if (!isValidTime(endTime))   throw new AppError("endTime must be HH:MM format (e.g. '18:00')", 400);

  // Same name duplicate check in same unit
  const duplicate = await Shift.findOne({
    unit_id:    toObjId(targetUnitId),
    org_id:     toObjId(user.orgId),
    company_id: toObjId(user.companyId),
    name:       { $regex: new RegExp(`^${name.trim()}$`, "i") },
    is_deleted: false,
  });
  if (duplicate) throw new AppError(`Shift "${name}" already exists in this unit`, 409);

  // isDefault uniqueness check
  if (isDefault) {
    await enforceDefaultUniqueness(targetUnitId, user.orgId, user.companyId);
  }

  // workingMinutes validation — should make sense with startTime/endTime
  // (We store as configurable — HR sets it, we don't auto-calculate)
  if (workingMinutes < 60)  throw new AppError("workingMinutes must be at least 60 (1 hour)", 400);
  if (gracePeriodMinutes < 0 || gracePeriodMinutes > 120) {
    throw new AppError("gracePeriodMinutes must be between 0 and 120", 400);
  }
  if (halfDayThresholdMinutes < 60) {
    throw new AppError("halfDayThresholdMinutes must be at least 60 (1 hour)", 400);
  }

  const shift = await Shift.create({
    name:                    name.trim(),
    org_id:                  user.orgId,
    company_id:              user.companyId,
    unit_id:                 targetUnitId,
    startTime,
    endTime,
    isNextDay,
    gracePeriodMinutes,
    halfDayThresholdMinutes,
    workingMinutes,
    applicableDays,
    shiftType,
    isDefault,
    status:                  "ACTIVE",
    createdBy:               user.userId,
  });

  return shift;
};

// ─── GET ALL ─────────────────────────────────────────────────
// GET /shifts?unit_id=&status=&shiftType=&page=&limit=
exports.getAllShifts = async (query, user) => {
  const {
    page      = 1,
    limit     = 20,
    status,
    shiftType,
    unit_id,
    isDefault,
    search,
  } = query;

  const targetUnitId = unit_id || user.unitId;
  if (!targetUnitId) throw new AppError("unit_id is required", 400);

  const filter = buildScope(user, targetUnitId);

  if (status)    filter.status    = status;
  if (shiftType) filter.shiftType = shiftType;
  if (isDefault !== undefined) filter.isDefault = isDefault === "true";

  if (search) {
    filter.name = { $regex: search, $options: "i" };
  }

  const skip  = (Number(page) - 1) * Number(limit);
  const total = await Shift.countDocuments(filter);
  const shifts = await Shift.find(filter)
    .sort({ isDefault: -1, createdAt: -1 }) // default shift pehle
    .skip(skip)
    .limit(Number(limit))
    .populate("createdBy", "name email")
    .lean();

  return {
    shifts,
    total,
    page:       Number(page),
    totalPages: Math.ceil(total / Number(limit)),
  };
};

// ─── GET BY ID ───────────────────────────────────────────────
// GET /shifts/:id
exports.getShiftById = async (id, user) => {
  const shift = await Shift.findOne({
    _id:        toObjId(id),
    org_id:     toObjId(user.orgId),
    company_id: toObjId(user.companyId),
    is_deleted: false,
  })
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email")
    .lean();

  if (!shift) throw new AppError("Shift not found", 404);
  return shift;
};

// ─── UPDATE ──────────────────────────────────────────────────
// PUT /shifts/:id
// Allowed: hr_manager, unit_admin, company_admin, org_admin
exports.updateShift = async (id, payload, user) => {
  const shift = await Shift.findOne({
    _id:        toObjId(id),
    org_id:     toObjId(user.orgId),
    company_id: toObjId(user.companyId),
    is_deleted: false,
  });
  if (!shift) throw new AppError("Shift not found", 404);

  const {
    name,
    startTime,
    endTime,
    isNextDay,
    gracePeriodMinutes,
    halfDayThresholdMinutes,
    workingMinutes,
    applicableDays,
    shiftType,
    isDefault,
  } = payload;

  // Time format validate if provided
  if (startTime && !isValidTime(startTime)) throw new AppError("startTime must be HH:MM format", 400);
  if (endTime   && !isValidTime(endTime))   throw new AppError("endTime must be HH:MM format", 400);

  // Name duplicate check (excluding self)
  if (name && name.trim() !== shift.name) {
    const duplicate = await Shift.findOne({
      unit_id:    shift.unit_id,
      org_id:     toObjId(user.orgId),
      company_id: toObjId(user.companyId),
      name:       { $regex: new RegExp(`^${name.trim()}$`, "i") },
      is_deleted: false,
      _id:        { $ne: toObjId(id) },
    });
    if (duplicate) throw new AppError(`Shift "${name}" already exists in this unit`, 409);
  }

  // isDefault uniqueness — only if switching TO default
  if (isDefault === true && !shift.isDefault) {
    await enforceDefaultUniqueness(shift.unit_id, user.orgId, user.companyId, id);
  }

  // Validation if values provided
  if (workingMinutes !== undefined && workingMinutes < 60) {
    throw new AppError("workingMinutes must be at least 60", 400);
  }
  if (gracePeriodMinutes !== undefined && (gracePeriodMinutes < 0 || gracePeriodMinutes > 120)) {
    throw new AppError("gracePeriodMinutes must be between 0 and 120", 400);
  }
  if (halfDayThresholdMinutes !== undefined && halfDayThresholdMinutes < 60) {
    throw new AppError("halfDayThresholdMinutes must be at least 60", 400);
  }

  // Apply only provided fields
  if (name                    !== undefined) shift.name                    = name.trim();
  if (startTime               !== undefined) shift.startTime               = startTime;
  if (endTime                 !== undefined) shift.endTime                 = endTime;
  if (isNextDay               !== undefined) shift.isNextDay               = isNextDay;
  if (gracePeriodMinutes      !== undefined) shift.gracePeriodMinutes      = gracePeriodMinutes;
  if (halfDayThresholdMinutes !== undefined) shift.halfDayThresholdMinutes = halfDayThresholdMinutes;
  if (workingMinutes          !== undefined) shift.workingMinutes          = workingMinutes;
  if (applicableDays          !== undefined) shift.applicableDays          = applicableDays;
  if (shiftType               !== undefined) shift.shiftType               = shiftType;
  if (isDefault               !== undefined) shift.isDefault               = isDefault;

  shift.updatedBy = user.userId;
  await shift.save();

  return shift;
};

// ─── ACTIVATE ────────────────────────────────────────────────
// PATCH /shifts/:id/activate — unit_admin only
exports.activateShift = async (id, user) => {
  const shift = await Shift.findOne({
    _id:        toObjId(id),
    org_id:     toObjId(user.orgId),
    company_id: toObjId(user.companyId),
    is_deleted: false,
  });
  if (!shift) throw new AppError("Shift not found", 404);
  if (shift.status === "ACTIVE") throw new AppError("Shift is already active", 400);

  shift.status    = "ACTIVE";
  shift.updatedBy = user.userId;
  await shift.save();
  return shift;
};

// ─── DEACTIVATE ──────────────────────────────────────────────
// PATCH /shifts/:id/deactivate — unit_admin only
exports.deactivateShift = async (id, user) => {
  const shift = await Shift.findOne({
    _id:        toObjId(id),
    org_id:     toObjId(user.orgId),
    company_id: toObjId(user.companyId),
    is_deleted: false,
  });
  if (!shift) throw new AppError("Shift not found", 404);
  if (shift.status === "INACTIVE") throw new AppError("Shift is already inactive", 400);

  // Default shift deactivate nahi ho sakti — pehle kisi aur ko default banao
  if (shift.isDefault) {
    throw new AppError(
      "Cannot deactivate the default shift. Please assign another shift as default first.",
      400
    );
  }

  // Active rosters check — kisi employee ka roster iss shift pe hai?
  const activeRosterCount = await Roster.countDocuments({
    shift_id:   toObjId(id),
    status:     "ACTIVE",
    endDate:    { $gte: new Date() },
    is_deleted: false,
  });
  if (activeRosterCount > 0) {
    throw new AppError(
      `Cannot deactivate — ${activeRosterCount} employee(s) have active rosters on this shift. ` +
      `Reassign them first.`,
      400
    );
  }

  shift.status    = "INACTIVE";
  shift.updatedBy = user.userId;
  await shift.save();
  return shift;
};

// ─── DELETE (soft) ───────────────────────────────────────────
// DELETE /shifts/:id — unit_admin, company_admin, org_admin
exports.deleteShift = async (id, user) => {
  const shift = await Shift.findOne({
    _id:        toObjId(id),
    org_id:     toObjId(user.orgId),
    company_id: toObjId(user.companyId),
    is_deleted: false,
  });
  if (!shift) throw new AppError("Shift not found", 404);

  // Default shift delete nahi ho sakti
  if (shift.isDefault) {
    throw new AppError(
      "Cannot delete the default shift. Please assign another shift as default first.",
      400
    );
  }

  // Active rosters check
  const activeRosterCount = await Roster.countDocuments({
    shift_id:   toObjId(id),
    status:     "ACTIVE",
    endDate:    { $gte: new Date() },
    is_deleted: false,
  });
  if (activeRosterCount > 0) {
    throw new AppError(
      `Cannot delete — ${activeRosterCount} employee(s) have active rosters on this shift. ` +
      `Reassign them first.`,
      400
    );
  }

  shift.is_deleted = true;
  shift.isDefault  = false; // default flag bhi clear karo
  shift.updatedBy  = user.userId;
  await shift.save();

  return { message: "Shift deleted successfully" };
};

// ─── GET DEFAULT SHIFT FOR UNIT ──────────────────────────────
// attendance.service.js use karega yeh function
// Returns the default shift for a unit, or null if none set
exports.getDefaultShift = async (unit_id, org_id, company_id) => {
  return await Shift.findOne({
    unit_id:    toObjId(unit_id),
    org_id:     toObjId(org_id),
    company_id: toObjId(company_id),
    isDefault:  true,
    status:     "ACTIVE",
    is_deleted: false,
  }).lean();
};

// ─── RESOLVE SHIFT FOR EMPLOYEE (used by attendance.service.js) ──
// Priority:
//   1. Employee ka active roster for today → us shift ka data
//   2. Unit ka isDefault:true ACTIVE shift
//   3. null → AttendancePolicy fallback (caller handles)
exports.resolveShiftForEmployee = async (employeeId, unitId, orgId, companyId, date = new Date()) => {
  const today = new Date(date);
  today.setHours(0, 0, 0, 0);

  // 1. Active roster check
  const roster = await Roster.findOne({
    employee_id: toObjId(employeeId),
    unit_id:     toObjId(unitId),
    org_id:      toObjId(orgId),
    company_id:  toObjId(companyId),
    startDate:   { $lte: today },
    endDate:     { $gte: today },
    status:      "ACTIVE",
    is_deleted:  false,
  })
    .populate("shift_id")
    .lean();

  if (roster?.shift_id && roster.shift_id.status === "ACTIVE") {
    return {
      source: "roster",         // where did we get this shift from
      roster_id: roster._id,
      shift:  roster.shift_id,
    };
  }

  // 2. Unit default shift
  const defaultShift = await exports.getDefaultShift(unitId, orgId, companyId);
  if (defaultShift) {
    return {
      source: "default",
      roster_id: null,
      shift:  defaultShift,
    };
  }

  // 3. No shift found — caller falls back to AttendancePolicy
  return null;
};