// modules/search/search.service.js
// Global search business logic with permission gating and scope isolation

const mongoose = require('mongoose')
const SearchQueryBuilder = require('../../utils/searchQueryBuilder')
const config = require('./search.config')

// ─── Models ─────────────────────────────────────────────────────────────────
// Lazy-load models to avoid circular dependency issues
const getModels = () => ({
  Employee: require('../employee/models/employee.model'),
  LeaveRequest: require('../leave/models/leaveRequest.models'),
  Attendance: require('../attendance/models/attendance.model'),
  Department: require('../department/department.model'),
  Designation: require('../designation/designation.model'),
  Holiday: require('../holiday/models/holiday.models'),
  AuditLog: require('../auditLogs/auditLog.model'),
  Notification: require('../notification/notification.model'),
  Unit: require('../unit/models/unit.model'),
  Company: require('../company/models/company.model'),
  Role: require('../role/role.model'),
  Permission: require('../permission/permission.model'),
  Shift: require('../shift/models/shift.model'),
  Roster: require('../shift/models/roster.model'),
})

// ─── Permission Gate ───────────────────────────────────────────────────────
const canAccessModule = (module, permissions, role) => {
  const requiredPermission = config.MODULE_PERMISSION_MAP[module]
  
  // Super Admin bypasses all permission checks
  if (role === 'SUPER_ADMIN' || role === 'product_admin') {
    return true
  }
  
  // Platform modules (auth, role, permission) - admin only
  if (['auth', 'role', 'permission', 'user'].includes(module)) {
    return role === 'SUPER_ADMIN'
  }
  
  // No permission required for this module
  if (!requiredPermission) {
    return true
  }
  
  // Standard permission check
  return permissions.includes(requiredPermission)
}

// ─── Search Functions Per Module ────────────────────────────────────────────

const searchEmployees = async (query, scope, limit) => {
  try {
    const models = getModels()
    const builder = new SearchQueryBuilder(query, scope)
    const moduleConfig = config.MODULE_SEARCH_FIELDS.employees
    
    const filter = builder.buildFilter()
    const orCondition = builder.buildOrCondition(moduleConfig.fields)
    
    const results = await models.Employee.find({ ...filter, ...orCondition })
    .select(moduleConfig.select)
    .populate(moduleConfig.populate)
    .limit(limit)
    .lean()
    
    return results.map(item => ({
      _id: item._id,
      module: 'Employee',
      title: item.name,
      subtitle: item.employeeId,
      description: `${item.departmentId?.name || 'No Department'} • ${item.designationId?.name || 'No Designation'}`,
      avatar: item.profilePhoto,
      route: `/users/${item._id}/details/account`,
      score: calculateScore(query, item, moduleConfig.weights)
    }))
  } catch (error) {
    console.error('[Search] searchEmployees error:', error.message)
    return []
  }
}

const searchLeaveRequests = async (query, scope, limit) => {
  try {
    const models = getModels()
    const builder = new SearchQueryBuilder(query, scope)
    const moduleConfig = config.MODULE_SEARCH_FIELDS.leave
    
    // First, find employees matching the query
    const matchingEmployees = await models.Employee.find({
      ...builder.buildFilter(),
      name: { $regex: query, $options: 'i' }
    })
    .select('_id')
    .limit(50)
    .lean()
    
    const employeeIds = matchingEmployees.map(emp => emp._id)
    
    // Build OR condition: match in leave fields OR match by employee
  const orConditions = []
  
  // Add search in leave request fields
  if (moduleConfig.fields && moduleConfig.fields.length > 0) {
    const leaveFieldConditions = moduleConfig.fields.map(field => ({
      [field]: { $regex: query, $options: 'i' }
    }))
    orConditions.push(...leaveFieldConditions)
  }
  
  // Add search by matching employee IDs
  if (employeeIds.length > 0) {
    orConditions.push({ employeeId: { $in: employeeIds } })
  }
  
  // If no conditions, return empty
  if (orConditions.length === 0) {
    return []
  }
  
  const finalQuery = {
    ...builder.buildFilter(),
    $or: orConditions
  }
  
  const results = await models.LeaveRequest.find(finalQuery)
  .select(moduleConfig.select)
  .populate(moduleConfig.populate)
  .limit(limit)
  .sort({ createdAt: -1 })
  .lean()
  
  return results.map(item => ({
    _id: item._id,
    module: 'Leave Request',
    title: `${item.employeeId?.name || 'Unknown'} • ${item.leaveTypeId?.name || 'Leave'}`,
    subtitle: item.reason || 'No reason provided',
    description: `${item.status} • ${formatDate(item.startDate)}`,
    avatar: item.employeeId?.profilePhoto,
    route: `/leaves/${item._id}`,
    score: calculateScore(query, item, moduleConfig.weights)
  }))
  } catch (error) {
    console.error('[Search] searchLeaveRequests error:', error.message)
    return []
  }
}

const searchDepartments = async (query, scope, limit) => {
  const models = getModels()
  const builder = new SearchQueryBuilder(query, scope)
  const moduleConfig = config.MODULE_SEARCH_FIELDS.departments
  
  const results = await models.Department.find({
    ...builder.buildFilter(),
    ...builder.buildOrCondition(moduleConfig.fields)
  })
  .select(moduleConfig.select)
  .limit(limit)
  .lean()
  
  return results.map(item => ({
    _id: item._id,
    module: 'Department',
    title: item.name,
    subtitle: item.description || 'No description',
    description: '',
    avatar: null,
    route: `/department/${item._id}`,
    score: calculateScore(query, item, moduleConfig.weights)
  }))
}

const searchDesignations = async (query, scope, limit) => {
  const models = getModels()
  const builder = new SearchQueryBuilder(query, scope)
  const moduleConfig = config.MODULE_SEARCH_FIELDS.designations
  
  const results = await models.Designation.find({
    ...builder.buildFilter(),
    ...builder.buildOrCondition(moduleConfig.fields)
  })
  .select(moduleConfig.select)
  .limit(limit)
  .lean()
  
  return results.map(item => ({
    _id: item._id,
    module: 'Designation',
    title: item.name,
    subtitle: item.description || 'No description',
    description: '',
    avatar: null,
    route: `/designation/${item._id}`,
    score: calculateScore(query, item, moduleConfig.weights)
  }))
}

const searchHolidays = async (query, scope, limit) => {
  try {
    const models = getModels()
    const builder = new SearchQueryBuilder(query, scope)
    const moduleConfig = config.MODULE_SEARCH_FIELDS.holidays
    
    // ✅ HOLIDAYS: Scope-aware filtering with unit_id support
    // unit_id = null means org/company level (visible to all)
    // unit_id = ObjectId means unit-specific holiday
    const { level, orgId, companyId, unitId } = scope
    
    let scopeFilter = {
      org_id: builder.toObjectId(orgId),
      isDeleted: { $ne: true }
    }
    
    // Add company_id for company/unit level
    if (level === 'company' || level === 'unit') {
      scopeFilter.company_id = builder.toObjectId(companyId)
    }
    
    // Add unit_id filter for unit level
    // Match holidays where: unit_id matches OR unit_id is null (org/company level)
    if (level === 'unit') {
      scopeFilter.$or = [
        { unit_id: builder.toObjectId(unitId) },
        { unit_id: null } // Also show org/company level holidays
      ]
    }
    // Org/Company level: see all holidays in their scope
    
    const orCondition = builder.buildOrCondition(moduleConfig.fields)
    
    const results = await models.Holiday.find({ ...scopeFilter, ...orCondition })
    .select(moduleConfig.select)
    .limit(limit)
    .sort({ date: 1 })
    .lean()
    
    return results.map(item => ({
      _id: item._id,
      module: 'Holiday',
      title: item.name,
      subtitle: formatDate(item.date),
      description: item.description || '',
      avatar: null,
      route: `/holidays/${item._id}`,
      score: calculateScore(query, item, moduleConfig.weights)
    }))
  } catch (error) {
    console.error('[Search] searchHolidays error:', error.message)
    return []
  }
}

const searchAuditLogs = async (query, scope, limit) => {
  const models = getModels()
  const builder = new SearchQueryBuilder(query, scope)
  const moduleConfig = config.MODULE_SEARCH_FIELDS.auditLogs
  
  const results = await models.AuditLog.find({
    ...builder.getScopeFilter(), // Audit logs use same scope isolation
    ...builder.buildOrCondition(moduleConfig.fields)
  })
  .select(moduleConfig.select)
  .populate(moduleConfig.populate)
  .limit(limit)
  .sort({ createdAt: -1 })
  .lean()
  
  return results.map(item => ({
    _id: item._id,
    module: 'Audit Log',
    title: `${item.action} • ${item.module}`,
    subtitle: item.description || 'No details',
    description: `${item.employeeId?.name || item.userId?.firstName || 'System'} • ${formatDate(item.createdAt)}`,
    avatar: null,
    route: `/audit-logs/${item._id}`,
    score: calculateScore(query, item, moduleConfig.weights)
  }))
}

const searchNotifications = async (query, scope, limit) => {
  const models = getModels()
  const builder = new SearchQueryBuilder(query, scope)
  const moduleConfig = config.MODULE_SEARCH_FIELDS.notifications
  
  // Notifications are user-specific, filter by userId
  const results = await models.Notification.find({
    userId: scope.userId,
    ...builder.buildOrCondition(moduleConfig.fields)
  })
  .select(moduleConfig.select)
  .limit(limit)
  .sort({ createdAt: -1 })
  .lean()
  
  return results.map(item => ({
    _id: item._id,
    module: 'Notification',
    title: item.title,
    subtitle: item.message,
    description: `${item.type} • ${item.isRead ? 'Read' : 'Unread'}`,
    avatar: null,
    route: `/notifications/${item._id}`,
    score: calculateScore(query, item, moduleConfig.weights)
  }))
}

const searchShifts = async (query, scope, limit) => {
  try {
    const models = getModels()
    const builder = new SearchQueryBuilder(query, scope)
    const moduleConfig = config.MODULE_SEARCH_FIELDS.shifts
    
    const results = await models.Shift.find({
      ...builder.buildFilter(),
      name: { $regex: query, $options: 'i' }
    })
    .select(moduleConfig.select)
    .limit(limit)
    .lean()
    
    return results.map(item => ({
      _id: item._id,
      module: 'Shift',
      title: item.name,
      subtitle: `${item.startTime} - ${item.endTime}${item.isNextDay ? ' (+1)' : ''}`,
      description: 'Shift Schedule',
      avatar: null,
      route: `/shifts/${item._id}`,
      score: calculateScore(query, item, moduleConfig.weights)
    }))
  } catch (error) {
    console.error('[Search] searchShifts error:', error.message)
    return []
  }
}

const searchRosters = async (query, scope, limit) => {
  try {
    const models = getModels()
    const builder = new SearchQueryBuilder(query, scope)
    const moduleConfig = config.MODULE_SEARCH_FIELDS.rosters
    
    const results = await models.Roster.find({
      ...builder.buildFilter(),
      ...builder.buildOrCondition(moduleConfig.fields)
    })
    .select(moduleConfig.select)
    .limit(limit)
    .lean()
    
    return results.map(item => ({
      _id: item._id,
      module: 'Roster',
      title: item.name,
      subtitle: item.description || 'Roster Schedule',
      description: '',
      avatar: null,
      route: `/rosters/${item._id}`,
      score: calculateScore(query, item, moduleConfig.weights)
    }))
  } catch (error) {
    console.error('[Search] searchRosters error:', error.message)
    return []
  }
}

const searchUnits = async (query, scope, limit) => {
  try {
    const models = getModels()
    const builder = new SearchQueryBuilder(query, scope)
    const moduleConfig = config.MODULE_SEARCH_FIELDS.units
    
    const results = await models.Unit.find({
      ...builder.buildFilter(),
      ...builder.buildOrCondition(moduleConfig.fields)
    })
    .select(moduleConfig.select)
    .limit(limit)
    .lean()
    
    return results.map(item => ({
      _id: item._id,
      module: 'Unit',
      title: item.name,
      subtitle: item.code || 'No Code',
      description: '',
      avatar: null,
      route: `/units/${item._id}`,
      score: calculateScore(query, item, moduleConfig.weights)
    }))
  } catch (error) {
    console.error('[Search] searchUnits error:', error.message)
    return []
  }
}

const searchCompanies = async (query, scope, limit) => {
  try {
    const models = getModels()
    const builder = new SearchQueryBuilder(query, scope)
    const moduleConfig = config.MODULE_SEARCH_FIELDS.companies
    
    const results = await models.Company.find({
      ...builder.buildFilter(),
      ...builder.buildOrCondition(moduleConfig.fields)
    })
    .select(moduleConfig.select)
    .limit(limit)
    .lean()
    
    return results.map(item => ({
      _id: item._id,
      module: 'Company',
      title: item.name,
      subtitle: item.email || item.phone || 'Company',
      description: `${item.email || ''} ${item.phone || ''}`.trim(),
      avatar: null,
      route: `/companies/${item._id}`,
      score: calculateScore(query, item, moduleConfig.weights)
    }))
  } catch (error) {
    console.error('[Search] searchCompanies error:', error.message)
    return []
  }
}

const searchRoles = async (query, scope, limit) => {
  try {
    const models = getModels()
    const builder = new SearchQueryBuilder(query, scope)
    const moduleConfig = config.MODULE_SEARCH_FIELDS.roles
    
    const results = await models.Role.find({
      ...builder.buildFilter(),
      ...builder.buildOrCondition(moduleConfig.fields)
    })
    .select(moduleConfig.select)
    .limit(limit)
    .lean()
    
    return results.map(item => ({
      _id: item._id,
      module: 'Role',
      title: item.name,
      subtitle: item.description || 'Role',
      description: '',
      avatar: null,
      route: `/roles/${item._id}`,
      score: calculateScore(query, item, moduleConfig.weights)
    }))
  } catch (error) {
    console.error('[Search] searchRoles error:', error.message)
    return []
  }
}

// ─── Helper: Calculate Search Score ────────────────────────────────────────
const calculateScore = (query, item, weights) => {
  let score = 0
  const queryLower = query.toLowerCase()
  
  Object.keys(weights).forEach(field => {
    const value = getNestedValue(item, field)
    if (value) {
      const valueLower = value.toString().toLowerCase()
      
      if (valueLower === queryLower) {
        score += weights[field] * 10 // Exact match
      } else if (valueLower.startsWith(queryLower)) {
        score += weights[field] * 5 // Starts with
      } else if (valueLower.includes(queryLower)) {
        score += weights[field] // Contains
      }
    }
  })
  
  return score
}

// ─── Helper: Get Nested Object Value ────────────────────────────────────────
const getNestedValue = (obj, path) => {
  return path.split('.').reduce((current, key) => current?.[key], obj)
}

// ─── Helper: Format Date ───────────────────────────────────────────────────
const formatDate = (date) => {
  if (!date) return ''
  const d = new Date(date)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ─── Main Global Search Function ───────────────────────────────────────────
const globalSearch = async (params) => {
  const { query, userScope, userPermissions, userRole, requestedModules, limit = config.DEFAULT_LIMIT } = params
  
  // ─── Fetch permissions if not provided ──────────────────────────────────
  let permissions = userPermissions
  if (!permissions || permissions.length === 0) {
    try {
      const models = getModels()
      const role = await models.Role.findById(userScope.roleId)
        .populate('permissions', 'slug')
        .lean()
      
      if (role && role.permissions) {
        permissions = role.permissions.map(p => p.slug)
      }
    } catch (err) {
      console.error('[Search] Failed to fetch permissions:', err.message)
    }
  }
  
  // Validate query length
  if (!query || query.length < config.MIN_QUERY_LENGTH) {
    return {}
  }
  
  const results = {}
  const modules = requestedModules || Object.keys(config.MODULE_PERMISSION_MAP)
  
  // Permission-gated parallel search
  const searchPromises = []
  
  for (const module of modules) {
    // ✅ CRITICAL: Permission Gate - Skip if user lacks permission
    if (!canAccessModule(module, permissions, userRole)) {
      continue
    }
    
    // Define search function based on module
    let searchFn = null
    switch(module) {
      case 'employees':
        searchFn = searchEmployees
        break
      case 'leave':
        searchFn = searchLeaveRequests
        break
      case 'departments':
        searchFn = searchDepartments
        break
      case 'designations':
        searchFn = searchDesignations
        break
      case 'holidays':
        searchFn = searchHolidays
        break
      case 'auditLogs':
        searchFn = searchAuditLogs
        break
      case 'notifications':
        searchFn = searchNotifications
        break
      case 'shifts':
        searchFn = searchShifts
        break
      case 'rosters':
        searchFn = searchRosters
        break
      case 'units':
        searchFn = searchUnits
        break
      case 'companies':
        searchFn = searchCompanies
        break
      case 'roles':
        searchFn = searchRoles
        break
      default:
        continue
    }
    
    if (searchFn) {
      searchPromises.push(
        searchFn(query, userScope, limit)
          .then(moduleResults => {
            if (moduleResults.length > 0) {
              results[module] = moduleResults
            }
          })
          .catch(err => {
            console.error(`[Search] Error searching ${module}:`, err.message)
            // Continue even if one module fails
          })
      )
    }
  }
  
  // Execute all searches in parallel
  await Promise.all(searchPromises)
  
  // Sort each module's results by score
  Object.keys(results).forEach(module => {
    results[module].sort((a, b) => b.score - a.score)
  })
  
  return results
}

module.exports = {
  globalSearch,
  canAccessModule
}
