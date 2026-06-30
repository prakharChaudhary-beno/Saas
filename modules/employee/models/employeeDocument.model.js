// modules/employee/models/employeeDocument.model.js
// UPDATED — tenantId → org_id + company_id

const mongoose = require("mongoose");
const { Schema } = mongoose;

const employeeDocumentSchema = new mongoose.Schema({

  org_id: {
    type:     Schema.Types.ObjectId,
    ref:      "Organization",
    required: true,
    index:    true,
  },

  company_id: {
    type:     Schema.Types.ObjectId,
    ref:      "Company",
    required: true,
    index:    true,
  },

  employeeId: {
    type:     Schema.Types.ObjectId,
    ref:      "Employee",
    required: true,
    index:    true,
  },
unit_id: {
  type:  Schema.Types.ObjectId,
  ref:   "Unit",
  index: true,
},
  documentType: {
    type: String,
    enum: [
      "AADHAR", "PAN", "PASSPORT", "DRIVING_LICENSE",
      "EXPERIENCE_LETTER", "RELIEVING_LETTER", "SALARY_SLIP", "PREVIOUS_APPOINTMENT_LETTER",
      "OFFER_LETTER", "APPOINTMENT_LETTER", "INCREMENT_LETTER", "PROMOTION_LETTER",
      "EDUCATION_CERTIFICATE", "MARKSHEET", "DEGREE_CERTIFICATE",
      "OTHER"
    ],
    required: true,
  },

  category: {
    type:     String,
    enum:     ["IDENTITY", "PREVIOUS_EMPLOYMENT", "CURRENT_EMPLOYMENT", "EDUCATION", "OTHER"],
    required: true,
  },

  name:     { type: String, required: true },
  url:      { type: String, required: true },
  fileSize: { type: Number },
  fileType: { type: String },

  isVerified: { type: Boolean, default: false },
  verifiedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  verifiedAt: { type: Date },

  isDeleted:  { type: Boolean, default: false },
  uploadedBy: { type: Schema.Types.ObjectId, ref: "User" },

}, { timestamps: true });

employeeDocumentSchema.index({ org_id: 1, company_id: 1, unit_id: 1, employeeId: 1 });
employeeDocumentSchema.index({ company_id: 1, documentType: 1 });

module.exports = mongoose.model("EmployeeDocument", employeeDocumentSchema);