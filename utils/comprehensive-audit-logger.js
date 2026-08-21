// Comprehensive Audit Logger Utility
// Ensures all API actions are logged to database
// Supports canonical action grouping

const AuditLog = require('../models/auditLog.model')

/**
 * Canonical Action Groups Mapping
 * Maps specific actions to canonical categories
 */
const CANONICAL_ACTION_MAP = {
  // Authentication
  LOGIN: 'authentication',
  LOGOUT: 'authentication',
  LOGIN_FAILED: 'authentication',
  LOGIN_ACTIVATED: 'authentication',
  PASSWORD_CHANGED: 'authentication',
  FORGOT_PASSWORD: 'authentication',
  RESET_PASSWORD: 'authentication',
  GOOGLE_CALLBACK: 'authentication',
  
  // Employee Management
  EMPLOYEE_CREATED: 'employee_management',
  EMPLOYEE_UPDATED: 'employee_management',
  EMPLOYEE_DELETED: 'employee_management',
  EMPLOYEE_PROFILE_VIEWED: 'employee_management',
  EMPLOYEE_PHOTO_UPDATED: 'employee_management',
  EMPLOYEE_STATUS_CHANGED: 'employee_management',
  
  // Leave Management
  LEAVE_APPLIED: 'leave_management',
  LEAVE_APPROVED: 'leave_management',
  LEAVE_REJECTED: 'leave_management',
  LEAVE_CANCELLED: 'leave_management',
  LEAVE_UPDATED: 'leave_management',
  LEAVE_BALANCE_CHECKED: 'leave_management',
  
  // Attendance Management
  ATTENDANCE_MARKED: 'attendance_management',
  ATTENDANCE_UPDATED: 'attendance_management',
  ATTENDANCE_REGULARIZED: 'attendance_management',
  ATTENDANCE_EXPORTED: 'attendance_management',
  ATTENDANCE_SYNCED: 'attendance_management',
  BIOMETRIC_SYNC: 'attendance_management',
  
  // Role Management
  ROLE_CREATED: 'role_management',
  ROLE_UPDATED: 'role_management',
  ROLE_DELETED: 'role_management',
  ROLE_ASSIGNED: 'role_management',
  ROLE_REVOKED: 'role_management',
  
  // Roster Management
  ROSTER_CREATED: 'roster_management',
  ROSTER_UPDATED: 'roster_management',
  ROSTER_DELETED: 'roster_management',
  ROSTER_BULK_CREATED: 'roster_management',
  ROSTER_REVOKED: 'roster_management',
  ROSTER_APPROVED: 'roster_management',
  ROSTER_REJECTED: 'roster_management',
  
  // Delegation Management
  DELEGATION_CREATED: 'delegation_management',
  DELEGATION_UPDATED: 'delegation_management',
  DELEGATION_CANCELLED: 'delegation_management',
  DELEGATION_REVOKED: 'delegation_management',
  DELEGATION_APPROVED: 'delegation_management',
  DELEGATION_REJECTED: 'delegation_management',
  
  // Policy Management
  POLICY_CREATED: 'policy_management',
  POLICY_UPDATED: 'policy_management',
  POLICY_DELETED: 'policy_management',
  POLICY_ACTIVATED: 'policy_management',
  POLICY_DEACTIVATED: 'policy_management',
  
  // Shift Management
  SHIFT_CREATED: 'shift_management',
  SHIFT_UPDATED: 'shift_management',
  SHIFT_DELETED: 'shift_management',
  SHIFT_ACTIVATED: 'shift_management',
  SHIFT_DEACTIVATED: 'shift_management'
}

/**
 * Log an audit event
 * @param {Object} params - Log parameters
 * @param {ObjectId} params.userId - User performing action
 * @param {String} params.action - Action type (e.g., 'EMPLOYEE_CREATED')
 * @param {String} params.module - Module name (e.g., 'employee')
 * @param {Object} params.target - Target entity { type, id, name }
 * @param {Object} params.changes - Changed fields { field: { from, to } }
 * @param {Object} params.metadata - Additional metadata
 * @param {Object} params.req - Express request object (for org/company/unit scoping)
 */
async function logAuditEvent({ userId, action, module, target, changes, metadata, req }) {
  try {
    // Get canonical action group
    const canonicalAction = CANONICAL_ACTION_MAP[action] || 'other'
    
    // Extract tenant context from request
    const orgId = req?.orgId || req?.user?.orgId
    const companyId = req?.companyId || req?.user?.companyId
    const unitId = req?.unitId || req?.user?.unitId
    
    // Get user information
    const user = req?.user || {}
    
    const auditLog = new AuditLog({
      userId,
      action,
      module,
      canonicalAction,
      target: {
        type: target?.type || module,
        id: target?.id,
        name: target?.name,
        employeeId: target?.employeeId
      },
      changes: changes || {},
      metadata: {
        ...metadata,
        ip: req?.ip || req?.headers?.['x-forwarded-for'] || req?.connection?.remoteAddress,
        userAgent: req?.headers?.['user-agent'],
        method: req?.method,
        path: req?.path,
        userRole: user.role,
        userName: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim()
      },
      orgId,
      companyId,
      unitId
    })
    
    await auditLog.save()
    
    console.log(`[AuditLog] ${action} by ${user.email || userId} - ${module}/${canonicalAction}`)
    
    return auditLog
  } catch (error) {
    console.error('[AuditLog Error]', error)
    // Don't throw - audit logging should not break the main operation
  }
}

/**
 * Middleware factory to automatically log CRUD operations
 * @param {String} module - Module name
 * @param {String} actionPrefix - Action prefix (e.g., 'EMPLOYEE')
 */
function createAuditMiddleware(module, actionPrefix) {
  return async (req, res, next) => {
    // Store original end function
    const originalEnd = res.end
    
    // Override end function to log after response
    res.end = function(...args) {
      // Determine action based on method and path
      let action = null
      const method = req.method
      const path = req.path
      
      if (method === 'POST') {
        if (path.includes('/bulk')) {
          action = `${actionPrefix}_BULK_CREATED`
        } else {
          action = `${actionPrefix}_CREATED`
        }
      } else if (method === 'PUT' || method === 'PATCH') {
        action = `${actionPrefix}_UPDATED`
      } else if (method === 'DELETE') {
        action = `${actionPrefix}_DELETED`
      }
      
      // Log if action identified and response is successful
      if (action && res.statusCode >= 200 && res.statusCode < 300) {
        logAuditEvent({
          userId: req.user?._id,
          action,
          module,
          target: {
            id: req.params?.id || req.body?._id,
            name: req.body?.name || req.body?.employeeId
          },
          changes: req.body?.changes || extractChanges(req.body),
          req
        })
      }
      
      // Call original end
      return originalEnd.apply(res, args)
    }
    
    next()
  }
}

/**
 * Extract changes from request body
 */
function extractChanges(body) {
  const changes = {}
  const excludeFields = ['_id', '__v', 'createdAt', 'updatedAt', 'password']
  
  Object.keys(body).forEach(key => {
    if (!excludeFields.includes(key) && body[key] !== undefined) {
      changes[key] = {
        to: body[key]
      }
    }
  })
  
  return changes
}

/**
 * Helper to log specific actions
 */
const AuditHelpers = {
  // Authentication
  logLogin: (req, userId, success = true) => logAuditEvent({
    userId,
    action: success ? 'LOGIN' : 'LOGIN_FAILED',
    module: 'auth',
    target: { id: userId },
    req
  }),
  
  logLogout: (req, userId) => logAuditEvent({
    userId,
    action: 'LOGOUT',
    module: 'auth',
    target: { id: userId },
    req
  }),
  
  // Employee
  logEmployeeCreate: (req, employeeData) => logAuditEvent({
    userId: req.user._id,
    action: 'EMPLOYEE_CREATED',
    module: 'employee',
    target: { id: employeeData._id, name: employeeData.name, employeeId: employeeData.employeeId },
    changes: extractChanges(employeeData),
    req
  }),
  
  logEmployeeUpdate: (req, employeeId, changes) => logAuditEvent({
    userId: req.user._id,
    action: 'EMPLOYEE_UPDATED',
    module: 'employee',
    target: { id: employeeId, name: req.body?.name },
    changes,
    req
  }),
  
  logEmployeeDelete: (req, employeeId, employeeName) => logAuditEvent({
    userId: req.user._id,
    action: 'EMPLOYEE_DELETED',
    module: 'employee',
    target: { id: employeeId, name: employeeName },
    req
  }),
  
  // Leave
  logLeaveApply: (req, leaveData) => logAuditEvent({
    userId: req.user._id,
    action: 'LEAVE_APPLIED',
    module: 'leave',
    target: { id: leaveData._id, type: 'Leave' },
    metadata: { leaveType: leaveData.leaveType, duration: leaveData.duration },
    req
  }),
  
  logLeaveApprove: (req, leaveId, employeeName) => logAuditEvent({
    userId: req.user._id,
    action: 'LEAVE_APPROVED',
    module: 'leave',
    target: { id: leaveId, name: employeeName, type: 'Leave' },
    req
  }),
  
  // Attendance
  logAttendanceMark: (req, attendanceData) => logAuditEvent({
    userId: req.user._id,
    action: 'ATTENDANCE_MARKED',
    module: 'attendance',
    target: { id: attendanceData._id, employeeId: attendanceData.employeeId },
    metadata: { date: attendanceData.date, status: attendanceData.status },
    req
  }),
  
  // Role
  logRoleCreate: (req, roleData) => logAuditEvent({
    userId: req.user._id,
    action: 'ROLE_CREATED',
    module: 'role',
    target: { id: roleData._id, name: roleData.name },
    changes: extractChanges(roleData),
    req
  }),
  
  // Roster
  logRosterCreate: (req, rosterData) => logAuditEvent({
    userId: req.user._id,
    action: 'ROSTER_CREATED',
    module: 'roster',
    target: { id: rosterData._id, employeeId: rosterData.employeeId },
    metadata: { shift: rosterData.shift, date: rosterData.date },
    req
  }),
  
  // Delegation
  logDelegationCreated: (req, delegationData) => logAuditEvent({
    userId: req.user._id,
    action: 'DELEGATION_CREATED',
    module: 'delegation',
    target: { id: delegationData._id },
    metadata: { 
      delegatedTo: delegationData.delegateTo,
      delegatedFrom: delegationData.delegatedFrom,
      duration: delegationData.duration
    },
    req
  }),
  
  // Policy
  logPolicyUpdate: (req, policyType) => logAuditEvent({
    userId: req.user._id,
    action: 'POLICY_UPDATED',
    module: 'policy',
    target: { type: 'Policy', name: policyType },
    changes: extractChanges(req.body),
    req
  }),
  
  // Shift
  logShiftCreate: (req, shiftData) => logAuditEvent({
    userId: req.user._id,
    action: 'SHIFT_CREATED',
    module: 'shift',
    target: { id: shiftData._id, name: shiftData.name },
    changes: extractChanges(shiftData),
    req
  })
}

module.exports = {
  logAuditEvent,
  createAuditMiddleware,
  AuditHelpers,
  CANONICAL_ACTION_MAP
}
