// modules/shift/models/shiftSwapRequest.model.js
//
// ShiftSwapRequest = Employee A apni shift Employee B se swap karna chahta hai
// for a specific date.
//
// Flow:
//   Employee A → raises swap request (selects B + date)
//   Employee B → notified, accepts or declines
//   Manager    → final approve/reject (agar B ne accept kiya)
//   On approve → dono ke roster/attendance update hote hain
//
// Dynamic design:
//   - approvalType configurable — sirf manager, ya B acceptance + manager dono
//   - Koi bhi shift hard-reference nahi — shiftA/shiftB roster se resolve hote hain
//   - comment mandatory on rejection (configurable in service)
//   - Full approvalHistory maintained (audit trail)
//
// Status flow:
//   PENDING_ACCEPTANCE  → B ne abhi accept/decline nahi kiya
//   PENDING_APPROVAL    → B ne accept kiya, manager ke paas hai
//   APPROVED            → Manager ne approve kiya, rosters updated
//   REJECTED_BY_B       → B ne decline kiya
//   REJECTED_BY_MANAGER → Manager ne reject kiya
//   CANCELLED           → A ne khud cancel kiya (before B action)
//   EXPIRED             → requestedDate guzar gayi, no action taken

const mongoose = require("mongoose");
const { Schema } = mongoose;

// ─── Approval Action Sub-Schema ──────────────────────────────
// Same pattern as leaveRequest.models.js → approvalActionSchema
const swapActionSchema = new Schema(
  {
    // "REQUESTER" | "REQUESTED_EMPLOYEE" | "MANAGER" | "HR"
    actorType: {
      type:     String,
      required: true,
    },

    actorId: {
      type:     Schema.Types.ObjectId,
      ref:      "User",
      required: true,
    },

    actorName: { type: String },
    actorRole: { type: String },

    action: {
      type:     String,
      enum:     ["RAISED", "ACCEPTED", "DECLINED", "APPROVED", "REJECTED", "CANCELLED"],
      required: true,
    },

    comment:  { type: String, trim: true, maxlength: 500 },
    actionAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

// ─── Main Schema ─────────────────────────────────────────────
const shiftSwapRequestSchema = new Schema(
  {
    // ─── Scope ─────────────────────────────────────────────
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

    unit_id: {
      type:     Schema.Types.ObjectId,
      ref:      "Unit",
      required: true,
      index:    true,
    },

    // ─── Parties ───────────────────────────────────────────

    // Employee jo swap maang raha hai
    requesterEmployeeId: {
      type:     Schema.Types.ObjectId,
      ref:      "Employee",
      required: true,
      index:    true,
    },

    requesterUserId: {
      type:     Schema.Types.ObjectId,
      ref:      "User",
      required: true,
    },

    // Employee jisse swap maanga gaya hai
    requestedEmployeeId: {
      type:     Schema.Types.ObjectId,
      ref:      "Employee",
      required: true,
      index:    true,
    },

    requestedUserId: {
      type:     Schema.Types.ObjectId,
      ref:      "User",
      required: true,
    },

    // ─── Shift Details ─────────────────────────────────────
    // Swap date — sirf ek din ke liye (multi-day swap alag request se)
    swapDate: {
      type:     Date,
      required: [true, "swapDate is required"],
      index:    true,
      // Service validate karega: swapDate >= today
    },

    // Requester ki shift on swapDate (roster se resolve karke save)
    // Denormalized for display — roster change pe yeh stale ho sakta hai
    // Service always re-checks roster on approval
    requesterShiftId: {
      type:    Schema.Types.ObjectId,
      ref:     "Shift",
      default: null,
      // null allowed — agar requester ka koi roster nahi, default shift assume hogi
    },

    requesterShiftName: {
      type:    String,
      default: null,
      // Snapshot at request time for display (e.g. "Morning Shift 09:00-18:00")
    },

    // Requested employee ki shift on swapDate
    requestedShiftId: {
      type:    Schema.Types.ObjectId,
      ref:     "Shift",
      default: null,
    },

    requestedShiftName: {
      type:    String,
      default: null,
    },

    // ─── Reason ────────────────────────────────────────────
    reason: {
      type:      String,
      trim:      true,
      maxlength: 500,
      default:   "",
      // Optional — HR/manager ke liye context
    },

    // ─── Approval Config ───────────────────────────────────
    // Who needs to approve this swap?
    // "MANAGER_ONLY"       → sirf manager approve/reject kare
    // "EMPLOYEE_THEN_MANAGER" → pehle B accept kare, phir manager
    // Set by service based on unit's attendance policy / company config
    approvalType: {
      type:    String,
      enum:    ["MANAGER_ONLY", "EMPLOYEE_THEN_MANAGER"],
      default: "EMPLOYEE_THEN_MANAGER",
    },

    // Manager who will approve (reporting manager of requester)
    managerId: {
      type:    Schema.Types.ObjectId,
      ref:     "User",
      default: null,
      // Resolved at request creation time from employee.reportingManagerId
      // Fallback: hr_manager of unit
    },

    // ─── Status ────────────────────────────────────────────
    status: {
      type:  String,
      enum:  [
        "PENDING_ACCEPTANCE",   // B ne abhi response nahi diya
        "PENDING_APPROVAL",     // B ne accept kiya, manager ke paas
        "APPROVED",             // Swap complete, rosters updated
        "REJECTED_BY_B",        // B ne decline kiya
        "REJECTED_BY_MANAGER",  // Manager ne reject kiya
        "CANCELLED",            // A ne cancel kiya
        "EXPIRED",              // swapDate guzar gayi
      ],
      default: "PENDING_ACCEPTANCE",
      index:   true,
    },

    // ─── B's Response ──────────────────────────────────────
    bAcceptedAt:  { type: Date,   default: null },
    bDeclinedAt:  { type: Date,   default: null },
    bComment:     { type: String, trim: true, maxlength: 500, default: null },

    // ─── Manager's Response ────────────────────────────────
    managerActionAt: { type: Date,   default: null },
    managerComment:  { type: String, trim: true, maxlength: 500, default: null },

    // ─── Cancellation ──────────────────────────────────────
    cancelledAt:     { type: Date,   default: null },
    cancelledBy:     { type: Schema.Types.ObjectId, ref: "User", default: null },
    cancellationReason: { type: String, trim: true, maxlength: 500, default: null },

    // ─── Roster Update Tracking ────────────────────────────
    // On APPROVED — service updates both employees' rosters
    // Track whether roster was actually updated
    rosterUpdated: {
      type:    Boolean,
      default: false,
    },

    rosterUpdatedAt: {
      type:    Date,
      default: null,
    },

    // ─── Full Audit Trail ──────────────────────────────────
    // Every action logged here — same as leaveRequest approvalHistory
    actionHistory: {
      type:    [swapActionSchema],
      default: [],
    },

    // ─── Expiry ────────────────────────────────────────────
    // Auto-expire if no action taken before swapDate
    // Cron job sets status → EXPIRED
    expiresAt: {
      type:  Date,
      // Set to swapDate - 1 day at creation (configurable)
      // Ensures no pending swap on the day itself
    },

    // ─── Meta ──────────────────────────────────────────────
    is_deleted: {
      type:    Boolean,
      default: false,
      index:   true,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref:  "User",
    },

    updatedBy: {
      type: Schema.Types.ObjectId,
      ref:  "User",
    },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Virtuals ────────────────────────────────────────────────

// Is this request still actionable?
shiftSwapRequestSchema.virtual("isActionable").get(function () {
  return ["PENDING_ACCEPTANCE", "PENDING_APPROVAL"].includes(this.status);
});

// Is swap date in the past?
shiftSwapRequestSchema.virtual("isPast").get(function () {
  return this.swapDate && new Date(this.swapDate) < new Date();
});

// ─── Indexes ─────────────────────────────────────────────────

// Manager dashboard — pending approvals
shiftSwapRequestSchema.index({
  managerId:  1,
  status:     1,
  is_deleted: 1,
});

// Employee A — apni requests dekhe
shiftSwapRequestSchema.index({
  requesterEmployeeId: 1,
  status:              1,
  is_deleted:          1,
});

// Employee B — requests received
shiftSwapRequestSchema.index({
  requestedEmployeeId: 1,
  status:              1,
  is_deleted:          1,
});

// Unit-level listing for HR
shiftSwapRequestSchema.index({
  unit_id:    1,
  swapDate:   1,
  is_deleted: 1,
});

// Expiry cron — find all pending requests past swapDate
shiftSwapRequestSchema.index({
  status:     1,
  expiresAt:  1,
  is_deleted: 1,
});

module.exports = mongoose.model("ShiftSwapRequest", shiftSwapRequestSchema);