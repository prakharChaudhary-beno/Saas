// modules/module/module.model.js

const mongoose = require("mongoose");

const moduleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Module name is required"],
      trim: true,
    },

    slug: {
      type: String,
      required: [true, "Module slug is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    is_active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Module", moduleSchema);