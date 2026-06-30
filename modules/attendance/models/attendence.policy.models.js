const mongoose = require("mongoose");

const attendancePolicySchema = new mongoose.Schema(
  {
    org_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },

    // ─────────────────────────────────────────────
    // WORK SCHEDULE CONFIG
    // ─────────────────────────────────────────────
    workingDaysPerWeek: {
      type: Number,
      enum: [5, 6],
      default: 5,
    },

    weeklyOffs: {
      type: [String], // ["Saturday", "Sunday"]
      default: ["Saturday", "Sunday"],
    },

    shift: {
      startTime: { type: String, required: true }, // "09:00"
      endTime: { type: String, required: true },   // "18:00"
    },

    // ─────────────────────────────────────────────
    // WORK HOURS CONFIG
    // ─────────────────────────────────────────────
    standardHoursPerDay: {
      type: Number,
      default: 8,
      min: 1,
      max: 24,
    },

    minHoursForFullDay: {
      type: Number,
      default: 7,
    },

    halfDayThresholdHours: {
      type: Number,
      default: 4,
      min: 1,
    },

    // ─────────────────────────────────────────────
    // LATE / EARLY RULES
    // ─────────────────────────────────────────────
    graceMinutes: {
      type: Number,
      default: 10,
      min: 0,
    },

    lateThresholdMinutes: {
      type: Number,
      default: 15,
      min: 0,
    },

    earlyLogoutThresholdMinutes: {
      type: Number,
      default: 30,
      min: 0,
    },

    // ─────────────────────────────────────────────
    // LATE PENALTY RULES
    // ─────────────────────────────────────────────
    lateMarkPolicy: {
      enabled: { type: Boolean, default: true },

      lateCountForHalfDay: {
        type: Number,
        default: 3, // 3 late = 1 half day
      },

      lateCountForAbsent: {
        type: Number,
        default: 6, // 6 late = 1 absent
      },
    },

    // ─────────────────────────────────────────────
    // OVERTIME CONFIG
    // ─────────────────────────────────────────────
    overtime: {
      enabled: { type: Boolean, default: false },

      thresholdHours: {
        type: Number,
        default: 9,
      },

      maxOvertimeHoursPerDay: {
        type: Number,
        default: 4,
      },

      multiplier: {
        type: Number,
        default: 1.5, // 1.5x pay
      },
    },

    // ─────────────────────────────────────────────
    // CHECK-IN RULES
    // ─────────────────────────────────────────────
    checkInPolicy: {
      allowMultipleCheckIn: {
        type: Boolean,
        default: false,
      },

      allowEarlyCheckIn: {
        type: Boolean,
        default: true,
      },

      allowLateCheckOut: {
        type: Boolean,
        default: true,
      },
    },

    // ─────────────────────────────────────────────
    // AUTO ACTION RULES
    // ─────────────────────────────────────────────
    autoActions: {
      autoMarkAbsentIfNoCheckIn: {
        type: Boolean,
        default: true,
      },

      autoMarkHalfDayIfLessHours: {
        type: Boolean,
        default: true,
      },
    },

    // ─────────────────────────────────────────────
    // HOLIDAY & CALENDAR LINKING
    // ─────────────────────────────────────────────
    holidayCalendarId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HolidayCalendar",
    },

    // ─────────────────────────────────────────────
    // AUDIT
    // ─────────────────────────────────────────────
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// ⚠️  This is the OLD attendance-policy model (pre-Task-1 refactor).
// It has been superseded by modules/attendancePolicy/models/attendancePolicy.model.js
// Renamed to "AttendancePolicyLegacy" to prevent Mongoose "Cannot overwrite model" crash.
// Do NOT use this model in new code. It will be deleted after data migration is complete.
module.exports = mongoose.model("AttendancePolicyLegacy", attendancePolicySchema);