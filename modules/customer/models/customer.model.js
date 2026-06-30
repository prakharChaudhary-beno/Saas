// modules/customer/customer.model.js
//
// NEW — not in original task sheet, added from role_management_concept.xlsx
//
// Customer = the business entity that purchases the Beno HRMS product.
// Sits between Product Admin (Beno team) and Org Admin (client's group admin).
//
// Hierarchy:
//   Product Admin (Beno)
//     └── Customer           ← THIS MODEL
//           └── Organization
//                 └── Company
//                       └── LOB → Unit → Department
//
// Flow:
//   1. Customer signs up (self-register or Product Admin creates them)
//   2. Customer purchases a plan → Subscription created
//   3. Customer creates an Organization → Org Admin user auto-created
//
// One Customer can own multiple Organizations (e.g. a holding company
// that manages Tata Group AND Birla Group under one Beno account).
//
// Billing fields (GST, payment method) live here — NOT on Organization.
// Organization is the HR entity. Customer is the commercial entity.

const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
  {
    // ─── Identity ─────────────────────────────────────────────
    // Business/company name of the customer
    // e.g. "Tata Consultancy Services Ltd"
    business_name: {
      type: String,
      required: [true, "Business name is required"],
      trim: true,
    },

    // Primary contact person's name
    contact_name: {
      type: String,
      required: [true, "Contact name is required"],
      trim: true,
    },

    contact_email: {
      type: String,
      required: [true, "Contact email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },

    contact_phone: {
      type: String,
      required: [true, "Contact phone is required"],
      trim: true,
    },
    plan_id: {
  type:    mongoose.Schema.Types.ObjectId,
  ref:     "Plan",
  default: null,
},

    // ─── Billing Address ──────────────────────────────────────
    billing_address: {
      street:  { type: String, trim: true },
      city:    { type: String, trim: true },
      state:   { type: String, trim: true },
      country: { type: String, trim: true },
      pincode: { type: String, trim: true },
    },

    // ─── Tax & Compliance ─────────────────────────────────────
    // Indian GST number — 15 char alphanumeric
    gst_number: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
      // Optional — not all customers are GST registered
    },

    // PAN card number — for TDS and compliance
    pan_number: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    // ─── Payment Method ───────────────────────────────────────
    // Stores only non-sensitive payment reference info.
    // Never store raw card numbers — use payment gateway tokens.
    payment_method: {
      type: {
        type: String,
        enum: ["card", "upi", "bank_transfer", "cheque", "none"],
        default: "none",
      },
      // Gateway token (Razorpay/Stripe customer ID)
      // Used to charge without re-entering card details
      gateway_customer_id: {
        type: String,
        default: null,
        select: false, // sensitive — not returned in normal queries
      },
      // Last 4 digits of card — for display only
      card_last4: {
        type: String,
        default: null,
      },
      // UPI ID — e.g. "tcs@hdfcbank"
      upi_id: {
        type: String,
        default: null,
      },
    },

    // ─── Status ───────────────────────────────────────────────
    status: {
      type: String,
      enum: ["Active", "Suspended", "Inactive"],
      default: "Active",
    },

    // ─── Auth ─────────────────────────────────────────────────
    // Customer logs into a separate portal (not the HRMS app)
    // to manage billing, plans, and organizations
    password: {
      type: String,
      required: false,
      select: false,
    },

    is_first_login: {
      type: Boolean,
      default: true,
      // Must change temp password on first login
    },

    // ─── Soft Delete ──────────────────────────────────────────
    is_deleted: {
      type: Boolean,
      default: false,
    },

    // ─── Meta ─────────────────────────────────────────────────
    // Product Admin who created this customer
    created_by: {
      type: String, // Super Admin email or "SELF" if self-registered
      default: "SELF",
    },
  },
  {
    timestamps: true,
  }
);

// ─── Indexes ──────────────────────────────────────────────────
customerSchema.index({ status: 1, is_deleted: 1 });
// contact_email already unique via schema definition

module.exports = mongoose.model("Customer", customerSchema);