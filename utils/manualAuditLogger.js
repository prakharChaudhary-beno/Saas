// utils/manualAuditLogger.js
// Manual audit logging for operations that can't use middleware
// Use this when req.user doesn't exist (like LOGIN) or for complex operations

const AuditLog = require('../models/auditLog.model');

/**
 * Log authentication operations
 */
exports.logAuth = {
  login: async (user, req) => {
    try {
      await AuditLog.create({
        action: 'LOGIN',
        module: 'auth',
        userId: user._id,
        target: {
          type: 'User',
          id: user._id,
          email: user.email,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim()
        },
        metadata: {
          loginMethod: 'email',
          ipAddress: req.ip || req.connection?.remoteAddress,
          userAgent: req.get?.('user-agent'),
          mfaUsed: false
        },
        orgId: user.org_id || user.orgId,
        companyId: user.company_id || user.companyId,
        unitId: user.unit_id || user.unitId
      });
      console.log('[AuditLog] LOGIN:', user.email);
    } catch (error) {
      console.error('[AuditLog] Failed to log LOGIN:', error.message);
    }
  },

  loginFailed: async (email, reason, req) => {
    try {
      await AuditLog.create({
        action: 'LOGIN_FAILED',
        module: 'auth',
        userId: null,
        target: {
          type: 'User',
          email: email
        },
        metadata: {
          reason: reason,
          ipAddress: req.ip || req.connection?.remoteAddress,
          userAgent: req.get?.('user-agent')
        }
      });
      console.log('[AuditLog] LOGIN_FAILED:', email);
    } catch (error) {
      console.error('[AuditLog] Failed to log LOGIN_FAILED:', error.message);
    }
  },

  logout: async (user) => {
    try {
      await AuditLog.create({
        action: 'LOGOUT',
        module: 'auth',
        userId: user._id,
        target: {
          type: 'User',
          id: user._id,
          email: user.email
        },
        metadata: {
          logoutTime: new Date()
        },
        orgId: user.org_id || user.orgId,
        companyId: user.company_id || user.companyId,
        unitId: user.unit_id || user.unitId
      });
      console.log('[AuditLog] LOGOUT:', user.email);
    } catch (error) {
      console.error('[AuditLog] Failed to log LOGOUT:', error.message);
    }
  },

  passwordChanged: async (user, req) => {
    try {
      await AuditLog.create({
        action: 'PASSWORD_CHANGED',
        module: 'auth',
        userId: user._id,
        target: {
          type: 'User',
          id: user._id,
          email: user.email
        },
        metadata: {
          changedAt: new Date(),
          ipAddress: req.ip || req.connection?.remoteAddress
        },
        orgId: user.org_id || user.orgId,
        companyId: user.company_id || user.companyId,
        unitId: user.unit_id || user.unitId
      });
      console.log('[AuditLog] PASSWORD_CHANGED:', user.email);
    } catch (error) {
      console.error('[AuditLog] Failed to log PASSWORD_CHANGED:', error.message);
    }
  },

  mfaEnabled: async (user) => {
    try {
      await AuditLog.create({
        action: 'MFA_ENABLED',
        module: 'auth',
        userId: user._id,
        target: {
          type: 'User',
          id: user._id,
          email: user.email
        },
        orgId: user.org_id || user.orgId,
        companyId: user.company_id || user.companyId,
        unitId: user.unit_id || user.unitId
      });
      console.log('[AuditLog] MFA_ENABLED:', user.email);
    } catch (error) {
      console.error('[AuditLog] Failed to log MFA_ENABLED:', error.message);
    }
  }
};

/**
 * Log employee operations
 */
exports.logEmployee = {
  photoUpdated: async (user, employee) => {
    try {
      await AuditLog.create({
        action: 'EMPLOYEE_PHOTO_UPDATED',
        module: 'employee',
        userId: user._id,
        target: {
          type: 'Employee',
          id: employee._id,
          name: `${employee.firstName} ${employee.lastName}`,
          employeeId: employee.employeeId
        },
        orgId: employee.org_id || employee.orgId,
        companyId: employee.company_id || employee.companyId,
        unitId: employee.unit_id || employee.unitId
      });
      console.log('[AuditLog] EMPLOYEE_PHOTO_UPDATED:', employee.employeeId);
    } catch (error) {
      console.error('[AuditLog] Failed to log EMPLOYEE_PHOTO_UPDATED:', error.message);
    }
  },

  profileViewed: async (user, employee) => {
    try {
      await AuditLog.create({
        action: 'EMPLOYEE_PROFILE_VIEWED',
        module: 'employee',
        userId: user._id,
        target: {
          type: 'Employee',
          id: employee._id,
          name: `${employee.firstName} ${employee.lastName}`,
          employeeId: employee.employeeId
        },
        orgId: employee.org_id || employee.orgId,
        companyId: employee.company_id || employee.companyId,
        unitId: employee.unit_id || employee.unitId
      });
      console.log('[AuditLog] EMPLOYEE_PROFILE_VIEWED:', employee.employeeId);
    } catch (error) {
      console.error('[AuditLog] Failed to log EMPLOYEE_PROFILE_VIEWED:', error.message);
    }
  },

  bulkImported: async (user, count) => {
    try {
      await AuditLog.create({
        action: 'EMPLOYEE_BULK_IMPORTED',
        module: 'employee',
        userId: user._id,
        target: {
          type: 'BulkOperation',
          count: count
        },
        metadata: {
          importedCount: count,
          importedAt: new Date()
        },
        orgId: user.org_id || user.orgId,
        companyId: user.company_id || user.companyId,
        unitId: user.unit_id || user.unitId
      });
      console.log('[AuditLog] EMPLOYEE_BULK_IMPORTED:', count, 'employees');
    } catch (error) {
      console.error('[AuditLog] Failed to log EMPLOYEE_BULK_IMPORTED:', error.message);
    }
  }
};

/**
 * Log biometric operations
 */
exports.logBiometric = {
  syncStarted: async (user) => {
    try {
      await AuditLog.create({
        action: 'BIOMETRIC_SYNC_STARTED',
        module: 'attendance',
        userId: user._id,
        target: {
          type: 'BiometricSync'
        },
        metadata: {
          startedAt: new Date()
        },
        orgId: user.org_id || user.orgId,
        companyId: user.company_id || user.companyId,
        unitId: user.unit_id || user.unitId
      });
      console.log('[AuditLog] BIOMETRIC_SYNC_STARTED');
    } catch (error) {
      console.error('[AuditLog] Failed to log BIOMETRIC_SYNC_STARTED:', error.message);
    }
  },

  syncCompleted: async (user, stats) => {
    try {
      await AuditLog.create({
        action: 'BIOMETRIC_SYNC_COMPLETED',
        module: 'attendance',
        userId: user._id,
        target: {
          type: 'BiometricSync'
        },
        metadata: {
          ...stats,
          completedAt: new Date()
        },
        org_id: user.org_id || user.orgId,
        company_id: user.company_id || user.companyId,
        unit_id: user.unit_id || user.unitId
      });
      console.log('[AuditLog] BIOMETRIC_SYNC_COMPLETED:', stats);
    } catch (error) {
      console.error('[AuditLog] Failed to log BIOMETRIC_SYNC_COMPLETED:', error.message);
    }
  },

  syncFailed: async (user, reason) => {
    try {
      await AuditLog.create({
        action: 'BIOMETRIC_SYNC_FAILED',
        module: 'attendance',
        userId: user._id,
        target: {
          type: 'BiometricSync'
        },
        metadata: {
          reason: reason,
          failedAt: new Date()
        },
        org_id: user.org_id || user.orgId,
        company_id: user.company_id || user.companyId,
        unit_id: user.unit_id || user.unitId
      });
      console.log('[AuditLog] BIOMETRIC_SYNC_FAILED:', reason);
    } catch (error) {
      console.error('[AuditLog] Failed to log BIOMETRIC_SYNC_FAILED:', error.message);
    }
  }
};

/**
 * Log payroll operations
 */
exports.logPayroll = {
  runStarted: async (user, payrollData) => {
    try {
      await AuditLog.create({
        action: 'PAYROLL_RUN_STARTED',
        module: 'payroll',
        userId: user._id,
        target: {
          type: 'PayrollRun',
          id: payrollData._id
        },
        metadata: {
          month: payrollData.month,
          year: payrollData.year,
          startedAt: new Date()
        },
        org_id: user.org_id || user.orgId,
        company_id: user.company_id || user.companyId,
        unit_id: user.unit_id || user.unitId
      });
      console.log('[AuditLog] PAYROLL_RUN_STARTED:', payrollData.month, payrollData.year);
    } catch (error) {
      console.error('[AuditLog] Failed to log PAYROLL_RUN_STARTED:', error.message);
    }
  },

  payslipViewed: async (user, payslip) => {
    try {
      await AuditLog.create({
        action: 'PAYSLIP_VIEWED',
        module: 'payroll',
        userId: user._id,
        target: {
          type: 'Payslip',
          id: payslip._id,
          name: payslip.employee?.name,
          employeeId: payslip.employeeId
        },
        metadata: {
          month: payslip.month,
          year: payslip.year,
          viewedAt: new Date()
        },
        org_id: payslip.org_id || payslip.orgId,
        company_id: payslip.company_id || payslip.companyId,
        unit_id: payslip.unit_id || payslip.unitId
      });
      console.log('[AuditLog] PAYSLIP_VIEWED:', payslip.employeeId);
    } catch (error) {
      console.error('[AuditLog] Failed to log PAYSLIP_VIEWED:', error.message);
    }
  }
};

/**
 * Generic helper to log any action
 */
exports.log = async ({ action, module, user, target, metadata = {}, changes = null }) => {
  try {
    await AuditLog.create({
      action,
      module,
      userId: user._id,
      target: target || { type: 'Unknown' },
      metadata,
      changes,
      org_id: user.org_id || user.orgId,
      company_id: user.company_id || user.companyId,
      unit_id: user.unit_id || user.unitId
    });
    console.log(`[AuditLog] ${action}:`, target?.name || target?.id || 'No target');
  } catch (error) {
    console.error(`[AuditLog] Failed to log ${action}:`, error.message);
  }
};
