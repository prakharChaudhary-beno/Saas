// models/permissionAudit.model.js
//
// Enterprise Permission Audit Trail
// Logs every permission check for compliance and security
//
// Usage:
//   await PermissionAudit.logAccess(userId, '/payroll/run', 'payroll.run', true)
//   await PermissionAudit.logDenied(userId, '/payroll/run', 'payroll.run')

const mongoose = require('mongoose')

const permissionAuditSchema = new mongoose.Schema({
  // ─── User Context ───────────────────────────────────────
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  user_email: {
    type: String,
    required: true,
    index: true
  },
  
  role_slug: {
    type: String,
    required: true,
    index: true
  },
  
  // ─── Action Details ─────────────────────────────────────
  action_type: {
    type: String,
    enum: [
      'PAGE_ACCESS',
      'PAGE_DENIED',
      'BUTTON_CLICK',
      'API_CALL', 
      'API_DENIED',
      'PERMISSION_CHECK',
      'ROLE_CHECK',
      'SUBSCRIPTION_CHECK',
      'FEATURE_GATE'
    ],
    required: true,
    index: true
  },
  
  resource: {
    type: String,
    required: true,
    index: true
    // Examples: '/payroll/run', 'btn_delete_employee', 'POST /api/v1/payroll/run'
  },
  
  permission: {
    type: String,
    index: true
    // Permission slug checked, e.g., 'payroll.run'
  },
  
  result: {
    type: String,
    enum: ['GRANTED', 'DENIED', 'ERROR'],
    required: true,
    index: true
  },
  
  // ─── Additional Context ─────────────────────────────────
  request_method: {
    type: String,
    enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']
  },
  
  ip_address: {
    type: String
  },
  
  user_agent: {
    type: String
  },
  
  // subscription details at time of check
  subscription_status: {
    type: String,
    enum: ['Trial', 'Active', 'PastDue', 'Cancelled', 'Expired']
  },
  
  plan_name: {
    type: String
  },
  
  // ─── Metadata ───────────────────────────────────────────
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
    // Store additional context: query params, request body (sanitized), etc.
  },
  
  error_message: {
    type: String
  },
  
  // ─── Timestamp ───────────────────────────────────────────
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
    expires: 90 * 24 * 60 * 60 // TTL: 90 days (auto-delete)
  }
})

// ─── Compound Indexes for Common Queries ──────────────────────────────

permissionAuditSchema.index({ userId: 1, timestamp: -1 })
permissionAuditSchema.index({ action_type: 1, result: 1, timestamp: -1 })
permissionAuditSchema.index({ resource: 1, timestamp: -1 })
permissionAuditSchema.index({ role_slug: 1, result: 1, timestamp: -1 })

// ─── Static Methods ────────────────────────────────────────────────────

/**
 * Log successful permission grant
 */
permissionAuditSchema.statics.logAccess = async function(
  userId,
  userEmail,
  roleSlug,
  resource,
  permission,
  metadata = {}
) {
  return this.create({
    userId,
    user_email: userEmail,
    role_slug: roleSlug,
    action_type: 'PAGE_ACCESS',
    resource,
    permission,
    result: 'GRANTED',
    ...metadata
  })
}

/**
 * Log permission denial
 */
permissionAuditSchema.statics.logDenied = async function(
  userId,
  userEmail,
  roleSlug,
  resource,
  permission,
  metadata = {}
) {
  return this.create({
    userId,
    user_email: userEmail,
    role_slug: roleSlug,
    action_type: 'PAGE_DENIED',
    resource,
    permission,
    result: 'DENIED',
    ...metadata
  })
}

/**
 * Log API call
 */
permissionAuditSchema.statics.logApiCall = async function(
  userId,
  userEmail,
  roleSlug,
  method,
  endpoint,
  permission,
  result,
  metadata = {}
) {
  return this.create({
    userId,
    user_email: userEmail,
    role_slug: roleSlug,
    action_type: 'API_CALL',
    request_method: method,
    resource: endpoint,
    permission,
    result,
    ...metadata
  })
}

/**
 * Get user access history
 */
permissionAuditSchema.statics.getUserHistory = async function(userId, limit = 100) {
  return this.find({ userId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean()
}

/**
 * Get permission denials for analysis
 */
permissionAuditSchema.statics.getDenials = async function(filters = {}, limit = 100) {
  return this.find({ 
    result: 'DENIED',
    ...filters
  })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('userId', 'name email')
    .lean()
}

/**
 * Get resource access stats
 */
permissionAuditSchema.statics.getResourceStats = async function(resource, days = 30) {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  
  return this.aggregate([
    {
      $match: {
        resource,
        timestamp: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          action_type: '$action_type',
          result: '$result'
        },
        count: { $sum: 1 },
        unique_users: { $addToSet: '$userId' }
      }
    },
    {
      $project: {
        action_type: '$_id.action_type',
        result: '$_id.result',
        count: 1,
        unique_user_count: { $size: '$unique_users' }
      }
    }
  ])
}

// ─── Create Model ──────────────────────────────────────────────────────

const PermissionAudit = mongoose.model('PermissionAudit', permissionAuditSchema)

module.exports = PermissionAudit
