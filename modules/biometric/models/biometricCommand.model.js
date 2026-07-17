// modules/biometric/models/biometricCommand.model.js
// Async Command Tracking for Biometric Operations
//
// All eSSL write operations (AddEmployee, DeleteUser, Enroll, etc.)
// are asynchronous — they return a CommandId immediately, but the
// actual operation happens later (device may be offline).
//
// This model tracks those commands and their resolution status.

const mongoose = require('mongoose');
const { Schema } = mongoose;

// ─── Command Schema ────────────────────────────────────────────────────
const biometricCommandSchema = new Schema({
  // ─── Multi-Tenant Scope ─────────────────────────────────────────────
  org_id: {
    type:     Schema.Types.ObjectId,
    ref:      'Organization',
    required: true,
    index:    true
  },
  company_id: {
    type:     Schema.Types.ObjectId,
    ref:      'Company',
    required: true,
    index:    true
  },
  unit_id: {
    type:     Schema.Types.ObjectId,
    ref:      'Unit',
    required: true,
    index:    true
  },

  // ─── Command Identity ────────────────────────────────────────────────
  commandId: {
    type:     String,
    required: true,
    unique:   true,
    index:    true
    // eSSL returns this — trace back to check status
  },

  // ─── Command Type ────────────────────────────────────────────────────
  type: {
    type:    String,
    enum:    [
      'ADD_EMPLOYEE',
      'ADD_MULTIPLE_EMPLOYEES',
      'DELETE_EMPLOYEE',
      'BLOCK_USER',
      'UNBLOCK_USER',
      'ENROLL_FINGERPRINT',
      'ENROLL_FACE',
      'PUSH_LEAVE_ENTRIES',
      'PUSH_HOLIDAYS'
    ],
    required: true,
    index:   true
  },

  // ─── Employee Reference ──────────────────────────────────────────────
  employeeId: {
    type:     Schema.Types.ObjectId,
    ref:      'Employee',
    index:    true
  },
  
  biometricCode: {
    type:     Number, // Device-scoped numeric ID
    index:    true
  },

  // ─── Device Reference ───────────────────────────────────────────────┐
  deviceSerialNumber: {
    type:     String,
    required: true,
    index:    true
  },

  // ─── Status Tracking ─────────────────────────────────────────────────
  status: {
    type:    String,
    enum:    ['PENDING', 'SUCCESS', 'FAILED', 'TIMEOUT'],
    default: 'PENDING',
    index:   true
  },

  // ─── Polling Tracking ─────────────────────────────────────────────────
  attempts: {
    type:    Number,
    default: 0,
    min:     0
  },
  maxAttempts: {
    type:    Number,
    default: 10,
    min:     1,
    max:     50
  },
  lastPolledAt: {
    type:    Date,
    default: null
  },

  // ─── Resolution ──────────────────────────────────────────────────────
  resolvedAt: {
    type:    Date,
    default: null
  },
  error: {
    type:    String,
    default: null
  },
  responseData: {
    type:    Schema.Types.Mixed, // Store raw response for debugging
    default: null
  },

  // ─── Timestamps ──────────────────────────────────────────────────────
  createdAt: {
    type:     Date,
    default:  Date.now,
    index:    true
  },
  updatedAt: {
    type:     Date,
    default:  Date.now
  }

}, {
  timestamps: true,
  toJSON:   { virtuals: true },
  toObject: { virtuals: true }
});

// ─── Indexes ────────────────────────────────────────────────────────────
biometricCommandSchema.index({ org_id: 1, company_id: 1, unit_id: 1, createdAt: -1 });
biometricCommandSchema.index({ status: 1, createdAt: 1 }); // For pending poller
biometricCommandSchema.index({ employeeId: 1, type: 1, createdAt: -1 });

// ─── Virtual: Is Pending ───────────────────────────────────────────────
biometricCommandSchema.virtual('isPending').get(function() {
  return this.status === 'PENDING';
});

// ─── Virtual: Time Elapsed ─────────────────────────────────────────────
biometricCommandSchema.virtual('elapsedMinutes').get(function() {
  if (!this.createdAt) return 0;
  const end = this.resolvedAt || new Date();
  return Math.floor((end - this.createdAt) / (1000 * 60));
});

// ─── Pre-Save Hook: Auto-increment attempts ────────────────────────────
biometricCommandSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status !== 'PENDING') {
    this.resolvedAt = new Date();
  }
  // updatedAt is handled by timestamps option, no need to set manually
  next();
});

// ─── Instance Method: Mark Success ────────────────────────────────────
biometricCommandSchema.methods.markSuccess = function(responseData) {
  this.status      = 'SUCCESS';
  this.resolvedAt  = new Date();
  this.responseData = responseData;
  return this.save();
};

// ─── Instance Method: Mark Failed ──────────────────────────────────────
biometricCommandSchema.methods.markFailed = function(error) {
  this.status      = 'FAILED';
  this.resolvedAt  = new Date();
  this.error       = error;
  return this.save();
};

// ─── Instance Method: Increment Attempt ───────────────────────────────
biometricCommandSchema.methods.incrementAttempt = function() {
  this.attempts += 1;
  this.lastPolledAt = new Date();
  
  // Auto-timeout if max attempts reached
  if (this.attempts >= this.maxAttempts && this.status === 'PENDING') {
    this.status     = 'TIMEOUT';
    this.resolvedAt = new Date();
    this.error      = `Command timed out after ${this.maxAttempts} polling attempts`;
  }
  
  return this.save();
};

// ─── Static: Find Pending Commands ────────────────────────────────────
biometricCommandSchema.statics.findPending = function() {
  return this.find({
    status:   'PENDING',
    attempts: { $lt: 10 } // Max 10 attempts
  }).sort({ createdAt: 1 });
};

// ─── Static: Find by Employee ─────────────────────────────────────────
biometricCommandSchema.statics.findByEmployee = function(employeeId) {
  return this.find({ employeeId })
    .sort({ createdAt: -1 });
};

// ─── Static: Find by Device ───────────────────────────────────────────
biometricCommandSchema.statics.findByDevice = function(serialNumber) {
  return this.find({
    'deviceSerialNumber': serialNumber
  }).sort({ createdAt: -1 });
};

// ─── Static: Recent Commands Stats ────────────────────────────────────
biometricCommandSchema.statics.getStats = function(unitId, days = 7) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  return this.aggregate([
    {
      $match: {
        unit_id:    mongoose.Types.ObjectId(unitId),
        createdAt:  { $gte: since }
      }
    },
    {
      $group: {
        _id:      '$status',
        count:    { $sum: 1 }
      }
    }
  ]);
};

// ─── Export ──────────────────────────────────────────────────────────
module.exports = mongoose.models.BiometricCommand || 
                 mongoose.model('BiometricCommand', biometricCommandSchema);
