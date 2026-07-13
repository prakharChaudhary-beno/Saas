// modules/payrollPolicy/models/investmentDeclaration.model.js
// Employee Investment Declarations for Tax Planning
// Supports 80C, 80D, 80E, HRA, LTA, etc.

"use strict";

const mongoose = require("mongoose");
const { Schema } = mongoose;

// ─── Individual Investment Item ────────────────────────────────────────────────
const investmentItemSchema = new Schema({
  section: {
    type: String,
    required: true,
    enum: [
      '80C', '80CCD', '80D', '80DD', '80DDB', '80E', '80EE', '80EEA', '80EEB',
      '80G', '80GG', '80TTA', '80U', 'HRA', 'LTA', 'OTHER'
    ],
  },
  
  subcategory: {
    type: String,
    required: true,
    // Examples:
    // 80C: PF, PPF, NSC, TAX_SAVING_FD, ELSS, INSURANCE_PREMIUM, CHILD_TUITION, HOME_LOAN_PRINCIPAL, SUKANYA_SAMRIDDHI, NPS_80C
    // 80D: SELF_HEALTH_INSURANCE, PARENT_HEALTH_INSURANCE, SELF_MEDICAL, PARENT_MEDICAL
    // 80E: EDUCATION_LOAN_INTEREST
    // HRA: RENT_PAID, RENT_RECEIPTS
    // LTA: TRAVEL_EXPENSE, TRAVEL_BILLS
  },

  declaredAmount: {
    type: Number,
    required: true,
    min: 0,
  },

  approvedAmount: {
    type: Number,
    default: 0,
    min: 0,
  },

  // Proof submission
  proofDocuments: [{
    filename: { type: String },
    url: { type: String },
    uploadedAt: { type: Date, default: Date.now },
    verifiedAt: { type: Date },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    remark: { type: String },
    _id: false,
  }],

  proofSubmitted: {
    type: Boolean,
    default: false,
  },

  proofVerified: {
    type: Boolean,
    default: false,
  },

  remark: {
    type: String,
    trim: true,
  },

  _id: false,
});

// ─── Main Investment Declaration Schema ───────────────────────────────────────
const investmentDeclarationSchema = new Schema({
  // ── Scope ───────────────────────────────────────────────────────────────────
  org_id: {
    type: Schema.Types.ObjectId,
    ref: "Organization",
    required: true,
    index: true,
  },

  company_id: {
    type: Schema.Types.ObjectId,
    ref: "Company",
    required: true,
    index: true,
  },

  employee_id: {
    type: Schema.Types.ObjectId,
    ref: "Employee",
    required: true,
    index: true,
  },

  // ── Financial Year ─────────────────────────────────────────────────────────
  financialYear: {
    type: String,
    required: true,
    // Format: "2026-27", "2025-26"
  },

  // ── Tax Regime Selection ────────────────────────────────────────────────────
  taxRegime: {
    type: String,
    enum: ['old', 'new'],
    default: 'new',
    required: true,
  },

  regimeDeclaredAt: {
    type: Date,
    default: null,
  },

  // ── Investment Items ────────────────────────────────────────────────────────
  investments: [investmentItemSchema],

  // ── Summary (calculated) ───────────────────────────────────────────────────
  totalDeclared: {
    type: Number,
    default: 0,
  },

  totalApproved: {
    type: Number,
    default: 0,
  },

  totalRejected: {
    type: Number,
    default: 0,
  },

  // ── HRA Exemption ───────────────────────────────────────────────────────────
  hraExemption: {
    declared: {
      monthlyRent: { type: Number, default: 0 },
      rentReceipts: { type: Boolean, default: false },
      landlordPan: { type: String },
      landlordName: { type: String },
      landlordAddress: { type: String },
    },
    calculated: {
      exemptAmount: { type: Number, default: 0 },
      method: { type: String, enum: ['actual', 'standard', 'formula'] },
    },
    _id: false,
  },

  // ── LTA (Leave Travel Allowance) ───────────────────────────────────────────
  ltaClaims: [{
    travelDate: { type: Date },
    travelMode: { type: String, enum: ['AIR', 'RAIL', 'ROAD', 'SHIP'] },
    fromCity: { type: String },
    toCity: { type: String },
    declaredAmount: { type: Number },
    approvedAmount: { type: Number, default: 0 },
    bills: [{ type: String }], // URLs
    familyMembers: [{ type: String }], // who traveled
    _id: false,
  }],

  // ── Status ────────────────────────────────────────────────────────────────
  status: {
    type: String,
    enum: ['DRAFT', 'DECLARED', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'],
    default: 'DRAFT',
    index: true,
  },

  submittedAt: {
    type: Date,
    default: null,
  },

  reviewedAt: {
    type: Date,
    default: null,
  },

  reviewedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },

  // ── Lock (after final submission) ───────────────────────────────────────────
  lockedAt: {
    type: Date,
    default: null,
  },

  isLocked: {
    type: Boolean,
    default: false,
  },

  // ── Audit ──────────────────────────────────────────────────────────────────
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },

  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// ─── Indexes ──────────────────────────────────────────────────────────────────
investmentDeclarationSchema.index(
  { org_id: 1, company_id: 1, employee_id: 1, financialYear: 1 },
  { unique: true }
);

investmentDeclarationSchema.index({ status: 1, financialYear: 1 });

// ─── Pre-save: Calculate totals ────────────────────────────────────────────────
// Mongoose 9.x: Don't call next() - just let function complete
investmentDeclarationSchema.pre('save', function(next) {
  // Calculate total declared
  this.totalDeclared = this.investments.reduce((sum, inv) => sum + (inv.declaredAmount || 0), 0);
  
  // Calculate total approved
  this.totalApproved = this.investments.reduce((sum, inv) => sum + (inv.approvedAmount || 0), 0);
  
  // Calculate total rejected
  this.totalRejected = this.totalDeclared - this.totalApproved;
  
  // Mongoose 9.x: Call next() exists, otherwise just return
  if (typeof next === 'function') {
    next();
  }
});

// ─── Methods ─────────────────────────────────────────────────────────────────
investmentDeclarationSchema.methods.calculateTaxExemption = function() {
  const exemptions = {
    total80C: 0,
    total80CCD: 0,
    total80D: 0,
    total80E: 0,
    total80EEA: 0,
    total80TTA: 0,
    totalOther: 0,
    hraExemption: this.hraExemption?.calculated?.exemptAmount || 0,
    ltaExemption: this.ltaClaims.reduce((sum, c) => sum + (c.approvedAmount || 0), 0),
  };
  
  for (const inv of this.investments) {
    const approved = inv.approvedAmount || 0;
    switch(inv.section) {
      case '80C':
        exemptions.total80C += approved;
        break;
      case '80CCD':
        exemptions.total80CCD += approved;
        break;
      case '80D':
        exemptions.total80D += approved;
        break;
      case '80E':
        exemptions.total80E += approved;
        break;
      case '80EEA':
        exemptions.total80EEA += approved;
        break;
      case '80TTA':
        exemptions.total80TTA += approved;
        break;
      default:
        exemptions.totalOther += approved;
    }
  }
  
  return exemptions;
};

module.exports = mongoose.models.InvestmentDeclaration ||
  mongoose.model("InvestmentDeclaration", investmentDeclarationSchema);
