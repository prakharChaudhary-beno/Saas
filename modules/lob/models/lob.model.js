// modules/lob/models/lob.model.js
//
// LOB = Line of Business
// Sits under Company. No separate LOB Admin.
// Company Admin creates and manages LOBs directly.
//
// Hierarchy: Organization → Company → LOB → Unit

const mongoose = require("mongoose");

const lobSchema = new mongoose.Schema(
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

    name: {
      type:     String,
      required: [true, "LOB name is required"],
      trim:     true,
    },

    description: {
      type:    String,
      trim:    true,
      default: "",
    },

    status: {
      type:    String,
      enum:    ["Active", "Inactive"],
      default: "Active",
    },
    code: {
      type:    String,
      trim:    true,
      default: "",
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
  },
  { timestamps: true }
);

lobSchema.index({ company_id: 1, is_deleted: 1 });

module.exports = mongoose.model("LOB", lobSchema);