// modules/employee/models/counter.model.js
// UPDATED — tenantId → org_id + company_id

const mongoose = require("mongoose");
const { Schema } = mongoose;

const counterSchema = new mongoose.Schema({
  org_id:     { type: Schema.Types.ObjectId, required: true },
  company_id: { type: Schema.Types.ObjectId, required: true },
  key:        { type: String, required: true },
  seq:        { type: Number, default: 0 },
});

counterSchema.index({ org_id: 1, company_id: 1, key: 1 }, { unique: true });

module.exports = mongoose.model("Counter", counterSchema);