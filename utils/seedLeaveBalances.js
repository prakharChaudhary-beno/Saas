// utils/seedLeaveBalances.js
// T-17 — Auto leave balance initialization on employee create
// Reusable helper — called from employee.service.js after createEmployee

"use strict";

const LeaveType    = require("../modules/leave/models/leaveType.models");
const LeaveBalance = require("../modules/leave/models/leaveBalance.models");

/**
 * Seed leave balances for a newly created employee.
 * Called after Employee.create() in employee.service.js
 *
 * @param {ObjectId} employeeId
 * @param {ObjectId} org_id
 * @param {ObjectId} company_id
 * @param {ObjectId} unit_id
 * @param {ObjectId} createdBy
 * @param {number}   year  — defaults to current year
 */
exports.seedLeaveBalances = async (employeeId, org_id, company_id, unit_id, createdBy, year) => {
  const targetYear = year || new Date().getFullYear();

  try {
    // Fetch all active leave types for this company
    const leaveTypes = await LeaveType.find({
      company_id,
      isActive:  true,
      isDeleted: false,
    }).select("_id code defaultDaysPerYear isPaid");

    if (!leaveTypes.length) return;

    const ops = [];

    for (const lt of leaveTypes) {
      // Check if already initialized (idempotent)
      const exists = await LeaveBalance.findOne({
        employeeId,
        leaveTypeId: lt._id,
        year:        targetYear,
      });

      if (exists) continue;

      const allocated = lt.defaultDaysPerYear || 0;

      ops.push({
        org_id,
        company_id,
        unit_id:      unit_id || null,
        employeeId,
        leaveTypeId:  lt._id,
        year:         targetYear,
        totalAllocated: allocated,
        used:           0,
        pending:        0,
        remaining:      allocated,
        carryForward:   0,
        lapsed:         0,
        adjustmentHistory: [{
          days:       allocated,
          reason:     `Auto-initialized on employee onboarding (${targetYear})`,
          adjustedBy: createdBy,
          type:       "YEAR_INITIALIZATION",
        }],
      });
    }

    if (ops.length) {
      await LeaveBalance.insertMany(ops, { ordered: false });
      console.log(`✅ Leave balances seeded for employee ${employeeId} — ${ops.length} types`);
    }

  } catch (err) {
    // Non-fatal — log and continue
    console.error(`⚠️  seedLeaveBalances failed for ${employeeId}:`, err.message);
  }
};
