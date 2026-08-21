// models/auditLog.model.js
// Enterprise Audit Log Model

const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: [true, 'Action is required'],
    index: true
  },
  module: {
    type: String,
    required: [true, 'Module is required'],
    index: true
  },
  canonicalAction: {
    type: String,
    index: true,
    description: 'Canonical action group (e.g., authentication, employee_management)'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  orgId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    index: true
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    index: true
  },
  unitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Unit',
    index: true
  },
  target: {
    type: {
      type: String,
      required: [true, 'Target type is required']
    },
    id: {
      type: mongoose.Schema.Types.ObjectId
    },
    name: {
      type: String
    },
    employeeId: {
      type: String
    }
  },
  changes: {
    before: mongoose.Schema.Types.Mixed,
    after: mongoose.Schema.Types.Mixed
  },
  metadata: {
    ipAddress: String,
    userAgent: String,
    location: String,
    device: String,
    browser: String,
    os: String
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 365 * 24 * 60 * 60 // Auto-delete after 1 year (TTL index)
  }
}, {
  timestamps: false, // Using timestamp field instead
  collection: 'auditlogs'
});

// Compound indexes for common queries
auditLogSchema.index({ orgId: 1, timestamp: -1 });
auditLogSchema.index({ orgId: 1, module: 1, timestamp: -1 });
auditLogSchema.index({ orgId: 1, userId: 1, timestamp: -1 });
auditLogSchema.index({ companyId: 1, timestamp: -1 });
auditLogSchema.index({ unitId: 1, timestamp: -1 });
auditLogSchema.index({ 'target.id': 1, timestamp: -1 });

// TTL index for auto-deletion
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 }); // 1 year

// Prevent "Cannot overwrite model once compiled" error in development
module.exports = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
