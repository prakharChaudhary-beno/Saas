// modules/holiday/holiday.service.js
// UPDATED — tenantId → org_id + company_id
// Holidays are company-level

const HolidayCalendar = require("./models/holiday.models");
const AppError        = require("../../utils/appError");

// ── Scope filter ──────────────────────────────────────────
const buildFilter = (user) => {
  const filter = { org_id: user.orgId };
  if (user.companyId) filter.company_id = user.companyId;
  return filter;
};

// ── Year calculate from date + yearType ───────────────────
const calculateYear = (date, yearType = "CALENDAR") => {
  const d = new Date(date);
  if (yearType === "FINANCIAL") {
    // April-March cycle: April 2025 - March 2026 = FY 2025
    return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  }
  return d.getFullYear(); // Calendar year
};

// ─── CREATE ───────────────────────────────────────────────
exports.createHoliday = async (payload, user) => {
  const { name, date, type, yearType = "CALENDAR", isRecurring = false } = payload;

  const year = calculateYear(date, yearType);

  // Duplicate check — same company + same date
  const existing = await HolidayCalendar.findOne({
    company_id: user.companyId,
    date:       new Date(date),
    isDeleted:  false,
  });
  if (existing) {
    throw new AppError(`A holiday already exists on this date: ${existing.name}`, 409);
  }

  const holiday = await HolidayCalendar.create({
    org_id:     user.orgId,
    company_id: user.companyId,
    name,
    date:       new Date(date),
    type,
    yearType,
    year,
    isRecurring,
    isActive:   true,
    createdBy:  user.userId,
  });

  return holiday;
};

// ─── LIST ─────────────────────────────────────────────────
exports.listHolidays = async (query, user) => {
  const { year, type, isActive, search } = query;

  const filter = {
    isDeleted: false,
    ...buildFilter(user),
  };

  if (year)     filter.year     = Number(year);
  if (type)     filter.type     = type;
  if (isActive !== undefined) filter.isActive = isActive === "true";

  if (search) {
    filter.name = { $regex: search, $options: "i" };
  }

  return await HolidayCalendar.find(filter)
    .sort({ date: 1 })
    .select("-__v");
};

// ─── GET ONE ──────────────────────────────────────────────
exports.getHoliday = async (id, user) => {
  const filter = { _id: id, isDeleted: false, ...buildFilter(user) };
  const holiday = await HolidayCalendar.findOne(filter);
  if (!holiday) throw new AppError("Holiday not found", 404);
  return holiday;
};

// ─── UPDATE ───────────────────────────────────────────────
exports.updateHoliday = async (id, payload, user) => {
  const filter = { _id: id, isDeleted: false, ...buildFilter(user) };
  const holiday = await HolidayCalendar.findOne(filter);
  if (!holiday) throw new AppError("Holiday not found", 404);

  // Recalculate year if date changed
  if (payload.date) {
    payload.year = calculateYear(payload.date, payload.yearType || holiday.yearType);
    payload.date = new Date(payload.date);

    // Duplicate check on new date
    const existing = await HolidayCalendar.findOne({
      company_id: user.companyId,
      date:       payload.date,
      isDeleted:  false,
      _id:        { $ne: id },
    });
    if (existing) {
      throw new AppError(`A holiday already exists on this date: ${existing.name}`, 409);
    }
  }

  // Restricted fields
  delete payload.org_id;
  delete payload.company_id;
  delete payload.createdBy;

  Object.assign(holiday, { ...payload, updatedBy: user.userId });
  await holiday.save();
  return holiday;
};

// ─── DELETE ───────────────────────────────────────────────
exports.deleteHoliday = async (id, user) => {
  const filter = { _id: id, isDeleted: false, ...buildFilter(user) };
  const holiday = await HolidayCalendar.findOne(filter);
  if (!holiday) throw new AppError("Holiday not found", 404);

  holiday.isDeleted  = true;
  holiday.updatedBy  = user.userId;
  await holiday.save();

  return { message: "Holiday deleted successfully" };
};

// ─── TOGGLE STATUS ────────────────────────────────────────
exports.toggleHoliday = async (id, user) => {
  const filter = { _id: id, isDeleted: false, ...buildFilter(user) };
  const holiday = await HolidayCalendar.findOne(filter);
  if (!holiday) throw new AppError("Holiday not found", 404);

  holiday.isActive   = !holiday.isActive;
  holiday.updatedBy  = user.userId;
  await holiday.save();

  return {
    message:  `Holiday ${holiday.isActive ? "activated" : "deactivated"} successfully`,
    isActive: holiday.isActive,
  };
};

// ─── GET MASTER LIST ──────────────────────────────────────
exports.getMasterHolidays = async (query) => {
  const { year, country = "IN" } = query;

  const filter = { isActive: true, country };
  if (year) filter.year = Number(year);

  const HolidayMaster = require("./models/holidayMaster.model");
  return await HolidayMaster.find(filter).sort({ date: 1 });
};

// ─── IMPORT FROM MASTER ───────────────────────────────────
exports.importHolidays = async (payload, user) => {
  const { holiday_ids, yearType = "CALENDAR" } = payload;

  if (!holiday_ids || !holiday_ids.length) {
    throw new AppError("holiday_ids array is required", 400);
  }

  const HolidayMaster = require("./models/holidayMaster.model");
  const masterHolidays = await HolidayMaster.find({
    _id:      { $in: holiday_ids },
    isActive: true,
  });

  if (!masterHolidays.length) {
    throw new AppError("No valid holidays found to import", 404);
  }

  const results = { imported: 0, skipped: 0, errors: [] };

  for (const master of masterHolidays) {
    try {
      // Check duplicate
      const existing = await HolidayCalendar.findOne({
        company_id: user.companyId,
        date:       master.date,
        isDeleted:  false,
      });

      if (existing) {
        results.skipped++;
        continue;
      }

      const year = calculateYear(master.date, yearType);

      await HolidayCalendar.create({
        org_id:     user.orgId,
        company_id: user.companyId,
        name:       master.name,
        date:       master.date,
        type:       master.type,
        yearType,
        year,
        isRecurring: master.isRecurring,
        isActive:    true,
        createdBy:   user.userId,
      });

      results.imported++;
    } catch (err) {
      results.errors.push({ name: master.name, error: err.message });
    }
  }

  return {
    message:  `${results.imported} holidays imported, ${results.skipped} skipped (already exist)`,
    ...results,
  };
};