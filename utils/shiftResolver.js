// utils/shiftResolver.js
//
// Resolve shift timings for attendance marking
// Priority:
//   1. Active Roster's shift (highest priority - employee-specific)
//   2. Attendance Policy's shift_id reference
//   3. Attendance Policy's embedded shift timings (fallback)
//
// Used by: attendance.service.js on punch-in

const mongoose = require('mongoose')

/**
 * Resolve shift timings for an employee on a specific date
 * @param {ObjectId} employeeId - Employee ID
 * @param {ObjectId} unitId - Unit ID
 * @param {Date} date - Date to resolve shift for
 * @returns {Object} Shift timings {startTime, endTime, graceMinutes, source}
 */
const resolveShiftTimings = async (employeeId, unitId, date) => {
  const Roster = require('../modules/shift/models/roster.model')
  const Shift = require('../modules/shift/models/shift.model')
  const AttendancePolicy = require('../modules/attendancePolicy/models/attendancePolicy.model')

  // Normalize date to midnight for comparison
  const targetDate = new Date(date)
  targetDate.setHours(0, 0, 0, 0)

  // ── Priority 1: Active Roster's Shift ───────────────────────────────────────
  // Check if employee has an active roster assignment
  const roster = await Roster.findOne({
    employee_id: employeeId,
    unit_id: unitId,
    startDate: { $lte: targetDate },
    endDate: { $gte: targetDate },
    status: 'ACTIVE',
    is_deleted: false
  }).populate('shift_id')

  if (roster?.shift_id) {
    const shift = roster.shift_id
    return {
      startTime: shift.startTime,
      endTime: shift.endTime,
      graceMinutes: shift.gracePeriodMinutes,
      minimumHours: Math.floor(shift.workingMinutes / 60),
      halfDayMinHours: Math.floor(shift.halfDayThresholdMinutes / 60),
      isNextDay: shift.isNextDay || false,
      shiftId: shift._id,
      shiftName: shift.name,
      source: 'roster',
      sourceId: roster._id
    }
  }

  // ── Priority 2: Attendance Policy's shift_id reference ─────────────────────
  const policy = await AttendancePolicy.findOne({
    unit_id: unitId,
    status: 'active',
    isDeleted: false
  }).populate('shift_id')

  if (policy?.shift_id) {
    const shift = policy.shift_id
    return {
      startTime: shift.startTime,
      endTime: shift.endTime,
      graceMinutes: shift.gracePeriodMinutes,
      minimumHours: Math.floor(shift.workingMinutes / 60),
      halfDayMinHours: Math.floor(shift.halfDayThresholdMinutes / 60),
      isNextDay: shift.isNextDay || false,
      shiftId: shift._id,
      shiftName: shift.name,
      source: 'policy_shift_id',
      sourceId: policy._id
    }
  }

  // ── Priority 3: Attendance Policy's embedded shift timings ───────────────────
  if (policy?.shift) {
    return {
      startTime: policy.shift.start,
      endTime: policy.shift.end,
      graceMinutes: policy.shift.graceMinutes || 15,
      minimumHours: policy.shift.minimumHours || 8,
      halfDayMinHours: policy.shift.halfDayMinHours || 4,
      isNextDay: policy.shift.isNextDay || false,
      shiftId: null,
      shiftName: policy.shift.name || 'Default Shift',
      source: 'policy_embedded',
      sourceId: policy._id
    }
  }

  // ── No shift found ───────────────────────────────────────────────────────────
  throw new Error(`No shift timings found for employee ${employeeId} in unit ${unitId} on ${targetDate.toISOString().split('T')[0]}. Create a roster assignment or attendance policy.`)
}

/**
 * Get shift for default fallback (unit's default shift)
 * @param {ObjectId} unitId - Unit ID
 * @returns {Object} Shift timings
 */
const getDefaultShift = async (unitId) => {
  const Shift = require('../modules/shift/models/shift.model')
  
  const shift = await Shift.findOne({
    unit_id: unitId,
    isDefault: true,
    status: 'ACTIVE',
    is_deleted: false
  })

  if (!shift) {
    // Last resort: return first active shift in unit
    const anyShift = await Shift.findOne({
      unit_id: unitId,
      status: 'ACTIVE',
      is_deleted: false
    })
    
    if (!anyShift) {
      // Return hard-coded defaults
      return {
        startTime: '09:00',
        endTime: '18:00',
        graceMinutes: 15,
        minimumHours: 8,
        halfDayMinHours: 4,
        isNextDay: false,
        shiftId: null,
        shiftName: 'System Default',
        source: 'hardcoded_default'
      }
    }

    return {
      startTime: anyShift.startTime,
      endTime: anyShift.endTime,
      graceMinutes: anyShift.gracePeriodMinutes,
      minimumHours: Math.floor(anyShift.workingMinutes / 60),
      halfDayMinHours: Math.floor(anyShift.halfDayThresholdMinutes / 60),
      isNextDay: anyShift.isNextDay || false,
      shiftId: anyShift._id,
      shiftName: anyShift.name,
      source: 'unit_first_shift'
    }
  }

  return {
    startTime: shift.startTime,
    endTime: shift.endTime,
    graceMinutes: shift.gracePeriodMinutes,
    minimumHours: Math.floor(shift.workingMinutes / 60),
    halfDayMinHours: Math.floor(shift.halfDayThresholdMinutes / 60),
    isNextDay: shift.isNextDay || false,
    shiftId: shift._id,
    shiftName: shift.name,
    source: 'unit_default_shift'
  }
}

/**
 * Safe resolver with fallback - never throws, always returns shift timings
 * @param {ObjectId} employeeId
 * @param {ObjectId} unitId
 * @param {Date} date
 * @returns {Object} Shift timings (guaranteed to return)
 */
const resolveShiftTimingsSafe = async (employeeId, unitId, date) => {
  try {
    return await resolveShiftTimings(employeeId, unitId, date)
  } catch (err) {
    // Fallback to unit's default shift
    console.warn(`[ShiftResolver] Falling back to default shift: ${err.message}`)
    return await getDefaultShift(unitId)
  }
}

module.exports = {
  resolveShiftTimings,
  getDefaultShift,
  resolveShiftTimingsSafe
}
