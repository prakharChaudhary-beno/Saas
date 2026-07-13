// modules/organization/organization.model.js
//
// Task 3 — NEW (updated to add customer_id link)
//
// Organization = the HR group entity owned by a Customer.
// e.g. Customer "TCS Ltd" owns Organization "Tata Group"
// One Customer can own multiple Organizations.
//
// Hierarchy:
//   Customer → Organization → Company → LOB → Unit → Department
//
// org_id flows into: Company, User, Role, Subscription, OrgModule

const mongoose = require("mongoose");

const organizationSchema = new mongoose.Schema(
  {
    // ─── Owner ────────────────────────────────────────────────
    // Customer who owns this org — strong relation
    // Cannot create org without a Customer
    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: [true, "customer_id is required"],
      index: true,
    },

    // ─── Identity ─────────────────────────────────────────────
    name: {
      type: String,
      required: [true, "Organization name is required"],
      trim: true,
    },

    // Auto-generated from name on create
    // e.g. "Tata Group" → "tata-group"
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },

    // ─── Business Info ────────────────────────────────────────
    industry: {
      type: String,
      trim: true,
    },

    country: {
      type: String,
      trim: true,
    },

    // ─── Contact ──────────────────────────────────────────────
    contact_email: {
      type: String,
      required: [true, "Contact email is required"],
      lowercase: true,
      trim: true,
    },

    contact_phone: {
      type: String,
      trim: true,
    },

    logo_url: {
      type: String,
      default: null,
    },

    // ─── Address (Optional) ───────────────────────────────────
    address: {
      country:  { type: String, default: null },
      state:    { type: String, default: null },
      city:     { type: String, default: null },
      pincode:  { type: String, default: null },
      street:   { type: String, default: null },
    },

    // ─── Organization-wide Settings (Optional) ───────────────
    // Can be overridden at company level if needed
    timezone: {
      type: String,
      default: null,
      trim: true,
    },

    currency: {
      type: String,
      default: null,
      uppercase: true,
      trim: true,
      maxlength: 3,
    },

    fiscalYearStart: {
      type: Number,
      default: null,
      min: 1,
      max: 12,
    },

    // ─── Status ───────────────────────────────────────────────
    status: {
      type: String,
      enum: ["Active", "Suspended", "Closed"],
      default: "Active",
    },

    // ─── Soft Delete ──────────────────────────────────────────
    is_deleted: {
      type: Boolean,
      default: false,
    },

    // ─── Meta ─────────────────────────────────────────────────
    created_by: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ─── Indexes ──────────────────────────────────────────────────
organizationSchema.index({ customer_id: 1, is_deleted: 1 });
organizationSchema.index({ status: 1, is_deleted: 1 });

// ─── Pre-save — auto-generate slug ────────────────────────────
organizationSchema.pre("save", function (next) {
  if (this.isNew && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  }
  // next();
});

module.exports = mongoose.model("Organization", organizationSchema);