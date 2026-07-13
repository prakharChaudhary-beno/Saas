// modules/unit/models/unit.model.js
//
// Unit sits under LOB.
// Employees and Unit Admins belong to a Unit.
// Cannot be deleted if active employees are linked.
//
// Hierarchy: Organization → Company → LOB → Unit

const mongoose = require("mongoose");

const unitSchema = new mongoose.Schema(
  {
    org_id: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Organization",
      required: true,
      index:    true,
    },

    company_id: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Company",
      required: true,
      index:    true,
    },

    lob_id: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "LOB",
      required: true,
      index:    true,
    },

    name: {
      type:     String,
      required: [true, "Unit name is required"],
      trim:     true,
    },

    description: {
      type:    String,
      trim:    true,
      default: "",
    },

    location: {
      type:    String,
      trim:    true,
      default: null,
    },

    // ─── GeoLocation for Attendance Validation ─────────────────
    geolocation: {
      latitude: {
        type:    Number,
        min:     -90,
        max:     90,
        default: null
      },
      longitude: {
        type:    Number,
        min:     -180,
        max:     180,
        default: null
      },
      radiusMeters: {
        type:    Number,
        min:     10,     // Min 10 meters
        max:     5000,   // Max 5km radius
        default: 200     // Default 200m
      },
      address: {
        formatted: { type: String, trim: true, default: null },
        street:    { type: String, trim: true, default: null },
        city:      { type: String, trim: true, default: null },
        state:     { type: String, trim: true, default: null },
        stateCode: { type: String, trim: true, default: null },
        country:   { type: String, trim: true, default: null },
        countryCode: { type: String, uppercase: true, default: null },
        pincode:   { type: String, trim: true, default: null }
      }
    },

    // ─── Location-based Settings ───────────────────────────────
    locationSettings: {
      geoFencingEnabled: {
        type:    Boolean,
        default: false   // Legacy units will have this false
      },
      allowOutsidePunch: {
        type:    Boolean,
        default: false   // If true, allow punch outside radius with warning
      },
      requireExactMatch: {
        type:    Boolean,
        default: false   // If true, strict radius check
      }
    },

    status: {
      type:    String,
      enum:    ["Active", "Inactive"],
      default: "Active",
    },

    is_deleted: {
      type:    Boolean,
      default: false,
    },

    // Company Admin who created
    created_by: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "User",
      default: null,
    },

    // T-09 — Tier 2 Config Overrides
    // null = use Company default; set value = override for this Unit
    config_override: {
      working_days: {
        type:    [String],
        enum:    ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
        default: null,
      },
      standard_hours_per_day:       { type: Number, default: null, min: 1, max: 24 },
      regularisation_window_days:   { type: Number, default: null, min: 1, max: 90 },
      default_fallback_shift:       { type: String, default: null, trim: true },
      // Enterprise only (P-14)
      payroll_cutoff_day:           { type: Number, default: null, min: 1, max: 28 },
      salary_day:                   { type: Number, default: null, min: 1, max: 28 },
    },
  },
  { timestamps: true }
);

unitSchema.index({ lob_id: 1, is_deleted: 1 });
unitSchema.index({ company_id: 1, is_deleted: 1 });

module.exports = mongoose.model("Unit", unitSchema);