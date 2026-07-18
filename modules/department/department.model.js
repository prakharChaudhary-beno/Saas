// modules/department/department.model.js
// Departments are unit-level
// Hierarchy: Org → Company → LOB → Unit → Department

const mongoose = require("mongoose");

const departmentSchema = new mongoose.Schema(
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

    unit_id: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Unit",
      required: true,
      index:    true,
    },

    name: {
      type:     String,
      required: true,
      trim:     true,
    },

    status: {
      type:    String,
      enum:    ["active", "inactive"],
      default: "active",
    },

    isDeleted: {
      type:    Boolean,
      default: false,
    },

    created_by: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "User",
      default: null,
    },
  },
  { timestamps: true }
);

// Unique department name per unit
departmentSchema.index(
  { unit_id: 1, name: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);departmentSchema.index({ unit_id: 1, isDeleted: 1 });

module.exports = mongoose.model("Department", departmentSchema);