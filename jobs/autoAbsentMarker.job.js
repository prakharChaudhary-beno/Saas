// jobs/autoAbsentMarker.job.js
// Runs every night at 11:55 PM
// Marks ABSENT for employees with no punch on working days
"use strict";

const Attendance = require("../modules/attendance/models/attendance.model");
const Employee   = require("../modules/employee/models/employee.model");

const DAY_MAP = ["SUN","MON","TUE","WED","THU","FRI","SAT"];
const isWorkingDay = (date) => ["MON","TUE","WED","THU","FRI"].includes(DAY_MAP[date.getDay()]);

exports.runAutoAbsentMarker = async () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Target = yesterday
  const targetDate = new Date(today);
  targetDate.setDate(targetDate.getDate() - 1);

  console.log(`[AutoAbsent] Running for: ${targetDate.toDateString()}`);

  if (!isWorkingDay(targetDate)) {
    console.log(`[AutoAbsent] Skipping — non-working day`);
    return { marked: 0, skipped: 0 };
  }

  const employees = await Employee.find({ status: "ACTIVE", isDeleted: false })
    .select("_id org_id company_id unit_id").lean();

  let marked = 0;
  let skipped = 0;

  for (const emp of employees) {
    try {
      const existing = await Attendance.findOne({ employeeId: emp._id, date: targetDate });
      if (existing) { skipped++; continue; }

      // Check approved leave
      const LeaveRequest = require("../modules/leave/models/leaveRequest.models");
      const onLeave = await LeaveRequest.findOne({
        employeeId: emp._id,
        startDate: { $lte: targetDate },
        endDate:   { $gte: targetDate },
        status:    "APPROVED",
        isDeleted: false,
      });

      await Attendance.create({
        org_id:         emp.org_id,
        company_id:     emp.company_id,
        unit_id:        emp.unit_id,
        employeeId:     emp._id,
        date:           targetDate,
        status:         onLeave ? "ON_LEAVE" : "ABSENT",
        leaveRequestId: onLeave?._id || null,
        checkIn:        null,
        checkOut:       null,
        workingHours:   0,
        remarks:        onLeave ? "Auto-marked: On approved leave" : "Auto-marked: No punch recorded",
      });

      onLeave ? skipped++ : marked++;
    } catch (err) {
      console.error(`[AutoAbsent] Error emp ${emp._id}:`, err.message);
    }
  }

  console.log(`[AutoAbsent] Done — Marked absent: ${marked}, Skipped: ${skipped}`);
  return { marked, skipped, date: targetDate };
};