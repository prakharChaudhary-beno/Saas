// modules/delegation/models/delegation.model.js
//
// Delegation = ek user temporarily apni specific permissions
//              kisi doosre user ko de sakta hai.
//
// Real world example:
//   Rahul (Manager) 2 hafte leave pe ja raha hai.
//   Woh Priya ko temporarily "leave.approve" aur "attendance.approve"
//   permissions deta hai for Jun 15 - Jun 30.
//   Priya ke apne role mein yeh permissions nahi hain —
//   lekin is duration mein permission.middleware.js
//   active delegation bhi check karega.
//
// Dynamic design:
//   - Koi bhi permission delegate ho sakti hai (role ke scope ke andar)
//   - startDate + endDate fully configurable — koi min/max nahi
//   - approvalRequired: true → manager ki delegation ko uske upar ka
//     approve karna pad sakta hai (configurable per org)
//   - maxDelegationDays: company config se aayega, model mein hardcode nahi
//   - Ek user ek saath multiple delegations de sakta hai
//   - Ek user multiple delegations receive kar sakta hai
//   - Same permission ek hi waqt mein ek hi person ko sirf ek baar
//     delegate ho sakti hai (service layer enforce karega)
//
// permission.middleware.js Layer 3 mein kaise use hoga:
//   if (!roleHasPermission) {
//     const delegation = await Delegation.findOne({
//       delegatee_id: req.user.userId,
//       permissions:  { $in: [permission._id] },
//       status:       "ACTIVE",
//       startDate:    { $lte: now },
//       endDate:      { $gte: now },
//       is_deleted:   false,
//     });
//     if (delegation) return next();
//   }
//
// Status flow:
//   PENDING  → approvalRequired:true mein, upar wale ka wait
//   ACTIVE   → startDate aa gayi, in effect
//   EXPIRED  → endDate guzar gayi (cron set karega)
//   REVOKED  → delegator ne wapas liya before endDate
//   REJECTED → approver ne reject kiya

const mongoose = require("mongoose");
const { Schema } = mongoose;

// ─── Action History Sub-Schema ───────────────────────────────
// Har change log hoga — same pattern as leaveRequest + shiftSwap
const delegationActionSchema = new Schema(
  {
    // "DELEGATOR" | "APPROVER" | "SYSTEM"
    actorType: {
      type:     String,
      required: true,
    },

    actorId: {
      type:     Schema.Types.ObjectId,
      ref:      "User",
      required: true,
    },

    actorName: { type: String, default: null },
    actorRole: { type: String, default: null },

    action: {
      type:     String,
      enum:     ["CREATED", "APPROVED", "REJECTED", "REVOKED", "EXPIRED", "MODIFIED"],
      required: true,
    },

    comment:  { type: String, trim: true, maxlength: 500, default: null },
    actionAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

// ─── Main Schema ─────────────────────────────────────────────
const delegationSchema = new Schema(
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

    // Jo permissions de raha hai
    delegator_id: {
      type:     Schema.Types.ObjectId,
      ref:      "User",
      required: true,
      index:    true,
    },

    // Jisko permissions mil rahi hain
    delegatee_id: {
      type:     Schema.Types.ObjectId,
      ref:      "User",
      required: true,
      index:    true,
    },

    // ─── Permissions ───────────────────────────────────────
    // Kaunsi specific permissions delegate ho rahi hain
    // Array of Permission ObjectIds
    // Service validate karega:
    //   1. Permission exists + is_active
    //   2. Delegator ke role mein yeh permission hai
    //      (sirf apni permissions hi delegate kar sakte ho)
    //   3. Permission ka scope delegator ke level ke andar hai
    permissions: {
      type:     [Schema.Types.ObjectId],
      ref:      "Permission",
      required: [true, "At least one permission is required"],
      validate: {
        validator: (arr) => arr && arr.length > 0,
        message:   "permissions array cannot be empty",
      },
    },

    // Denormalized slugs for quick display (e.g. ["leave.approve", "attendance.approve"])
    // Set at creation time, not updated later
    permissionSlugs: {
      type:    [String],
      default: [],
    },

    // ─── Duration ──────────────────────────────────────────
    startDate: {
      type:     Date,
      required: [true, "startDate is required"],
      // Service validate: startDate >= today
    },

    endDate: {
      type:     Date,
      required: [true, "endDate is required"],
      // Service validate: endDate > startDate
      // Service also checks vs maxDelegationDays from company config
    },

    // ─── Reason ────────────────────────────────────────────
    reason: {
      type:      String,
      required:  [true, "Reason for delegation is required"],
      trim:      true,
      minlength: [5,   "Reason must be at least 5 characters"],
      maxlength: [500, "Reason cannot exceed 500 characters"],
      // e.g. "Going on annual leave Jun 15-30, Priya will handle approvals"
    },

    // ─── Approval (optional) ───────────────────────────────
    // If company config has requireDelegationApproval: true,
    // delegator ke upar wale (manager/HR) ko approve karna padega.
    // Default false — delegation turant active ho jaati hai.
    approvalRequired: {
      type:    Boolean,
      default: false,
    },

    // Who needs to approve this delegation
    // Resolved from delegator's reportingManagerId or unit hr_manager
    approverId: {
      type:    Schema.Types.ObjectId,
      ref:     "User",
      default: null,
    },

    approvedAt:     { type: Date,   default: null },
    approvedBy:     { type: Schema.Types.ObjectId, ref: "User", default: null },
    rejectedAt:     { type: Date,   default: null },
    rejectedBy:     { type: Schema.Types.ObjectId, ref: "User", default: null },
    rejectionReason:{ type: String, trim: true, maxlength: 500, default: null },

    // ─── Status ────────────────────────────────────────────
    status: {
      type:  String,
      enum:  [
        "PENDING",   // approvalRequired:true, waiting for approver
        "ACTIVE",    // in effect — permission.middleware checks this
        "EXPIRED",   // endDate guzar gayi — cron sets this
        "REVOKED",   // delegator ne manually wapas liya
        "REJECTED",  // approver ne reject kiya
      ],
      default: "ACTIVE", // default ACTIVE kyunki approvalRequired default false hai
      index:   true,
    },

    // ─── Revocation ────────────────────────────────────────
    revokedAt:      { type: Date,   default: null },
    revokedBy:      { type: Schema.Types.ObjectId, ref: "User", default: null },
    revocationReason: { type: String, trim: true, maxlength: 500, default: null },

    // ─── Notification Tracking ─────────────────────────────
    // Delegatee ko email gayi ya nahi
    notifiedAt: {
      type:    Date,
      default: null,
    },

    // Expiry reminder sent (1 day before endDate)
    expiryReminderSentAt: {
      type:    Date,
      default: null,
    },

    // ─── Full Audit Trail ──────────────────────────────────
    actionHistory: {
      type:    [delegationActionSchema],
      default: [],
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

// Is delegation currently in effect?
delegationSchema.virtual("isInEffect").get(function () {
  if (this.status !== "ACTIVE") return false;
  const now = new Date();
  return now >= this.startDate && now <= this.endDate;
});

// Days remaining
delegationSchema.virtual("daysRemaining").get(function () {
  if (this.status !== "ACTIVE") return 0;
  const diff = new Date(this.endDate) - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
});

// ─── Indexes ─────────────────────────────────────────────────

// CRITICAL — permission.middleware.js Layer 3 use karega yeh index
// "Is delegatee ke liye koi active delegation hai for this permission?"
delegationSchema.index({
  delegatee_id: 1,
  permissions:  1,
  status:       1,
  startDate:    1,
  endDate:      1,
  is_deleted:   1,
});

// Delegator — "maine kya delegate kiya hai"
delegationSchema.index({
  delegator_id: 1,
  status:       1,
  is_deleted:   1,
});

// Approver dashboard — pending delegations for approval
delegationSchema.index({
  approverId:   1,
  status:       1,
  is_deleted:   1,
});

// Cron job — expire karo jo delegations end ho gayi hain
delegationSchema.index({
  status:     1,
  endDate:    1,
  is_deleted: 1,
});

// Unit-level HR view
delegationSchema.index({
  unit_id:    1,
  status:     1,
  is_deleted: 1,
});

module.exports = mongoose.model("Delegation", delegationSchema);