// modules/permission/permission.model.js
//
// MODIFIED — added fields:
//   + slug      — same as name, used for lookups (e.g. "attendance.approve")
//   + label     — human readable string shown in UI (e.g. "Approve Attendance")
//   + scope     — which role levels can use this permission
//   + is_active — Product Admin can disable globally
//
// Existing fields kept as-is: name, module, action, description

const mongoose = require("mongoose");

const permissionSchema = new mongoose.Schema(
  {
    // e.g. "attendance.approve"
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    // Same as name — used for fast slug-based lookups
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    // Which module this belongs to — e.g. "attendance"
    module: {
      type: String,
      required: true,
      trim: true,
    },

    // Atomic action — e.g. "approve"
    action: {
      type: String,
      required: true,
      enum: ["create", "read", "update", "delete", "approve", "run"],
      trim: true,
    },

    // Human readable label shown in Role Management UI
    // e.g. "Approve Attendance", "Run Payroll", "Add Employee"
    label: {
      type: String,
      required: true,
      trim: true,
    },

    // Which role levels can use this permission
    // org   → Org Admin level roles can use
    // company → Company Admin level roles can use
    // unit  → Unit level roles (HR, Manager) can use
    // A permission can be available at multiple levels
    scope: {
      type: [String],
      enum: ["org", "company", "unit"],
      default: ["unit"],
    },

    // T-02 — Category for privilege master list grouping (file 07)
    category: {
      type: String,
      enum: ["HR Operations", "Payroll", "Organisation", "Self-Service", "Configuration"],
      default: "HR Operations",
    },

    // T-02 — FR tracker reference (e.g. "L-05", "AT-08")
    frRef: {
      type: String,
      default: null,
      trim:  true,
    },

    description: {
      type: String,
      default: "",
    },

    // Product Admin can disable a permission globally
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Fast lookup indexes
// permissionSchema.index({ module: 1 });
// permissionSchema.index({ slug: 1 });

module.exports = mongoose.model("Permission", permissionSchema);