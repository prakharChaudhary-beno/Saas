// modules/biometric/models/biometricSyncLog.model.js
// Attendance Sync Audit Log
//
// Every scheduled pull from device creates a log entry here.
// This provides complete audit trail of:
// - Which device was synced
// - What time range was fetched
// - How many records processed
// - Success/failure status
// - Any errors encountered

const mongoose = require('mongoose');
const { Schema } = mongoose;

// ─── Sync Log Schema ───────────────────────────────────────────────────
const biometricSyncLogSchema = new Schema({
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

  // ─── Device Reference ───────────────────────────────────────────────┐
  deviceSerialNumber: {
    type:     String,
    required: true,
    index:    true
  },

  // ─── Sync Type ───────────────────────────────────────────────────────
  syncType: {
    type:    String,
    enum:    ['SCHEDULED', 'MANUAL', 'INITIAL'],
    default: 'SCHEDULED'
  },

  // ─── Time Range ──────────────────────────────────────────────────────
  startedAt: {
    type:     Date,
    required: true,
    default:  Date.now,
    index:    true
  },
  completedAt: {
    type:    Date,
    default: null
  },

  // ─── Status ──────────────────────────────────────────────────────────
  status: {
    type:    String,
    enum:    ['RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED'],
    default: 'RUNNING',
    index:   true
  },

  // ─── Record Counts ────────────────────────────────────────────────────
  recordsFetched: {
    type:    Number,
    default: 0,
    min:     0
  },
  recordsProcessed: {
    type:    Number,
    default: 0,
    min:     0
  },
  recordsMatched: {
    type:    Number,   // Successfully matched to employees
    default: 0,
    min:     0
  },
  recordsUnmatched: {
    type:    Number,   // Couldn't find matching biometricCode
    default: 0,
    min:     0
  },
  recordsSkipped: {
    type:    Number,   // Duplicates, invalid data, etc.
    default: 0,
    min:     0
  },

  // ─── Error Tracking ──────────────────────────────────────────────────
  errorMessage: {
    type:    String,
    default: null
  },
  errorStack: {
    type:    String,
    default: null
  },

  // ─── Response Details ───────────────────────────────────────────────
  lastRecordId: {
    type:    String,    // For pagination/resume
    default: null
  },
  responseTimeMs: {
    type:    Number,    // Total sync duration
    default: 0,
    min:     0
  },
  bandwidthKB: {
    type:    Number,    // Approximate data transfer size
    default: 0,
    min:     0
  },

  // ─── Unmatched Records for Audit ────────────────────────────────────
  unmatchedRecords: [{
    employeeCode: String,  // Raw from device
    punchTime:    Date,
    punchType:    String,
    message:      String
  }],

  // ─── Triggered By ────────────────────────────────────────────────────
  triggeredBy: {
    type:     Schema.Types.ObjectId,
    ref:      'User',
    default:  null // null for scheduled, userId for manual
  },

  // ─── Device Connection Info ──────────────────────────────────────────
  deviceOnlineAtStart: {
    type:    Boolean,
    default: false
  },
  deviceOnlineAtEnd: {
    type:    Boolean,
    default: false
  }

}, {
  timestamps: true,
  toJSON:   { virtuals: true },
  toObject: { virtuals: true }
});

// ─── Indexes ────────────────────────────────────────────────────────────
biometricSyncLogSchema.index({ org_id: 1, company_id: 1, unit_id: 1, startedAt: -1 });
biometricSyncLogSchema.index({ deviceSerialNumber: 1, startedAt: -1 });
biometricSyncLogSchema.index({ status: 1, startedAt: -1 });

// ─── Virtual: Duration ─────────────────────────────────────────────────
biometricSyncLogSchema.virtual('durationSeconds').get(function() {
  if (!this.completedAt) return null;
  return Math.floor((this.completedAt - this.startedAt) / 1000);
});

// ─── Virtual: Success Rate ───────────────────────────────────────────-
biometricSyncLogSchema.virtual('successRate').get(function() {
  if (this.recordsFetched === 0) return 100;
  return Math.round((this.recordsMatched / this.recordsFetched) * 100);
});

// ─── Pre-Save Hook ────────────────────────────────────────────────────
biometricSyncLogSchema.pre('save', function(next) {
  // Calculate response time if completed
  if (this.completedAt && this.startedAt) {
    this.responseTimeMs = this.completedAt.getTime() - this.startedAt.getTime();
  }
  
  // Update status based on results
  if (this.status === 'RUNNING') return next();
  
  if (this.recordsFetched === 0 && !this.errorMessage) {
    this.status = 'SUCCESS'; // Empty sync is still success
  } else if (this.recordsMatched === this.recordsFetched) {
    this.status = 'SUCCESS';
  } else if (this.recordsMatched > 0) {
    this.status = 'PARTIAL';
  } else if (this.errorMessage) {
    this.status = 'FAILED';
  }
  
  next();
});

// ─── Instance Method: Complete Log ───────────────────────────────────
biometricSyncLogSchema.methods.complete = function(data = {}) {
  this.completedAt = new Date();
  Object.assign(this, data);
  return this.save();
};

// ─── Instance Method: Add Error ───────────────────────────────────────
biometricSyncLogSchema.methods.addError = function(error) {
  this.status       = 'FAILED';
  this.errorMessage = error.message || String(error);
  this.errorStack   = error.stack;
  this.completedAt  = new Date();
  return this.save();
};

// ─── Instance Method: Add Unmatched Record ─────────────────────────────
biometricSyncLogSchema.methods.addUnmatched = function(record, message) {
  this.unmatchedRecords.push({
    employeeCode: record.employeeCode,
    punchTime:    record.punchTime,
    punchType:    record.punchType,
    message:      message
  });
  this.recordsUnmatched += 1;
  return this;
};

// ─── Static: Find Recent Logs for Unit ────────────────────────────────
biometricSyncLogSchema.statics.findRecentByUnit = function(unitId, limit = 20) {
  return this.find({ unit_id: unitId })
    .sort({ startedAt: -1 })
    .limit(limit);
};

// ─── Static: Find Logs by Device ─────────────────────────────────────
biometricSyncLogSchema.statics.findByDevice = function(serialNumber, limit = 20) {
  return this.find({ deviceSerialNumber: serialNumber })
    .sort({ startedAt: -1 })
    .limit(limit);
};

// ─── Static: Get Unit Summary ───────────────────────────────────────-
biometricSyncLogSchema.statics.getUnitSummary = async function(unitId, days = 7) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const result = await this.aggregate([
    {
      $match: {
        unit_id:    mongoose.Types.ObjectId(unitId),
        startedAt:  { $gte: since }
      }
    },
    {
      $group: {
        _id:               null,
        totalSyncs:        { $sum: 1 },
        successfulSyncs: {
          $sum: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, 1, 0] }
        },
        totalRecords:      { $sum: '$recordsFetched' },
        matchedRecords:    { $sum: '$recordsMatched' },
        unmatchedRecords:  { $sum: '$recordsUnmatched' },
        avgResponseTime:   { $avg: '$responseTimeMs' },
        lastSyncAt:        { $max: '$startedAt' }
      }
    }
  ]);

  return result[0] || {
    totalSyncs:        0,
    successfulSyncs:   0,
    totalRecords:      0,
    matchedRecords:    0,
    unmatchedRecords:  0,
    avgResponseTime:   0,
    lastSyncAt:        null
  };
};

// ─── Static: Get Device Status ───────────────────────────────────────
biometricSyncLogSchema.statics.getDeviceStatus = async function(serialNumber) {
  const lastLog = await this.findOne({ 
    deviceSerialNumber: serialNumber 
  }).sort({ startedAt: -1 });

  if (!lastLog) return { status: 'UNKNOWN', lastSync: null };
  
  return {
    status:    lastLog.status,
    lastSync:  lastLog.startedAt,
    records:   lastLog.recordsFetched
  };
};

// ─── Export ─────────────────────────────────────────────────────────
module.exports = mongoose.models.BiometricSyncLog || 
                 mongoose.model('BiometricSyncLog', biometricSyncLogSchema);
