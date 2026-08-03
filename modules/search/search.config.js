// modules/search/search.config.js
// Search configuration — module priorities, field mappings, icons

module.exports = {
  // ─── Module Permissions Map ──────────────────────────────────────────────
  // Maps search modules to required permission slugs
  MODULE_PERMISSION_MAP: {
    employees: 'employee.read',
    leave: 'leave.read',
    attendance: 'attendance.read',
    departments: 'department.read',
    designations: 'designation.read',
    holidays: 'holiday.read',
    auditLogs: 'auditLog.read',
    notifications: 'notification.read',
    payroll: 'payroll.read',
    shifts: 'shift.read',
    rosters: 'roster.read',
    biometric: 'biometric.read',
    units: 'unit.read',
    companies: 'company.read',
    roles: 'role.read',
    permissions: 'permission.read',
    policies: 'policy.read',
  },

  // ─── Searchable Fields Per Module ────────────────────────────────────────
  MODULE_SEARCH_FIELDS: {
    employees: {
      fields: ['name', 'employeeId', 'email', 'phone'],
      select: 'name employeeId email phone departmentId designationId profilePhoto org_id company_id unit_id',
      populate: [
        { path: 'departmentId', select: 'name' },
        { path: 'designationId', select: 'name' }
      ],
      weights: {
        name: 10,
        employeeId: 8,
        email: 5,
        phone: 4
      }
    },
    leave: {
      fields: ['reason', 'status'],
      select: 'leaveTypeId reason status employeeId startDate endDate createdAt',
      populate: [
        { path: 'employeeId', select: 'name employeeId profilePhoto' },
        { path: 'leaveTypeId', select: 'name' }
      ],
      weights: {
        reason: 5,
        status: 3
      }
    },
    attendance: {
      fields: ['status', 'employeeId.name', 'employeeId.employeeId'],
      select: 'date status employeeId checkIn checkOut',
      populate: [
        { path: 'employeeId', select: 'name employeeId profilePhoto' }
      ],
      weights: {
        status: 5
      }
    },
    departments: {
      fields: ['name', 'description'],
      select: 'name description org_id company_id unit_id',
      populate: [],
      weights: {
        name: 8,
        description: 3
      }
    },
    designations: {
      fields: ['name', 'description'],
      select: 'name description org_id company_id unit_id',
      populate: [],
      weights: {
        name: 8,
        description: 3
      }
    },
    holidays: {
      fields: ['name', 'description'],
      select: 'name description date org_id company_id unit_id',
      populate: [],
      weights: {
        name: 8,
        description: 4
      }
    },
    auditLogs: {
      fields: ['action', 'module', 'description'],
      select: 'action module description userId employeeId createdAt metadata',
      populate: [
        { path: 'userId', select: 'firstName email' },
        { path: 'employeeId', select: 'name employeeId' }
      ],
      weights: {
        action: 7,
        module: 5,
        description: 4
      }
    },
    notifications: {
      fields: ['title', 'message'],
      select: 'title message type createdAt isRead',
      populate: [],
      weights: {
        title: 7,
        message: 5
      }
    },
    shifts: {
      fields: ['name'],
      select: 'name startTime endTime isNextDay org_id company_id unit_id',
      populate: [],
      weights: {
        name: 10
      }
    },
    rosters: {
      fields: ['name', 'description'],
      select: 'name description org_id company_id unit_id',
      populate: [],
      weights: {
        name: 8,
        description: 4
      }
    },
    units: {
      fields: ['name', 'code'],
      select: 'name code org_id company_id',
      populate: [],
      weights: {
        name: 9,
        code: 7
      }
    },
    companies: {
      fields: ['name', 'email', 'phone'],
      select: 'name email phone org_id',
      populate: [],
      weights: {
        name: 10,
        email: 6,
        phone: 5
      }
    },
    roles: {
      fields: ['name', 'description'],
      select: 'name description org_id',
      populate: [],
      weights: {
        name: 9,
        description: 4
      }
    }
  },

  // ─── Result Ranking Scores ────────────────────────────────────────────────
  RESULT_RANKING: {
    exactMatch: 100,
    startsWith: 80,
    contains: 60,
    fuzzyMatch: 40
  },

  // ─── Search Limits ───────────────────────────────────────────────────────
  DEFAULT_LIMIT: 5,
  MAX_LIMIT: 20,
  MIN_QUERY_LENGTH: 2,
  MAX_QUERY_LENGTH: 100,

  // ─── Cache Settings ───────────────────────────────────────────────────────
  CACHE_TTL: 300, // 5 minutes
  CACHE_PREFIX: 'search:'
}
