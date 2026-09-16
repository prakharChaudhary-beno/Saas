// modules/auditLog/auditLog.service.js
"use strict";

const AuditLog = require("./auditLog.model");
const mongoose = require("mongoose");
const Organization = require("../organisation/models/organization.model");
const Company = require("../company/models/company.model");
const Unit = require("../unit/models/unit.model");
const Employee = require("../employee/models/employee.model");
const AppError = require("../../utils/appError");

const toObjId = (id) => {
  try { return new mongoose.Types.ObjectId(String(id)); }
  catch { return null; }
};

const applyHierarchyFilter = (filter, field, requestedId) => {
  if (!requestedId) return;

  const objectId = toObjId(requestedId);
  if (!objectId) {
    throw new AppError(`Invalid ${field}`, 400);
  }

  if (filter[field] && String(filter[field]) !== String(objectId)) {
    throw new AppError(`Requested ${field} is outside your permitted scope`, 403);
  }

  filter[field] = objectId;
};

// ─── Helper: Enrich logs with employee data for profile photos ───────────────
async function enrichWithEmployeeData(logs) {
  // Collect all userIds that might map to Employee records
  const userIds = new Set();
  
  logs.forEach(log => {
    // Check actor.userId
    if (log.actor?.userId?._id) userIds.add(log.actor.userId._id.toString());
    else if (log.actor?.userId) userIds.add(log.actor.userId.toString());
    
    // Check target.id
    if (log.target?.id?._id) userIds.add(log.target.id._id.toString());
    else if (log.target?.id) userIds.add(log.target.id.toString());
    
    // Check legacy userId
    if (log.userId?._id) userIds.add(log.userId._id.toString());
    else if (log.userId) userIds.add(log.userId.toString());
  });
  
  if (userIds.size === 0) return {};
  
  // Fetch employee data
  try {
    const employees = await Employee.find({
      userId: { $in: Array.from(users).map(id => toObjId(id)) }
    })
    .select('userId name email employeeId profilePhoto')
    .lean();
    
    const employeeMap = {};
    employees.forEach(emp => {
      if (emp.userId) {
        employeeMap[emp.userId.toString()] = emp;
      }
    });
    
    return employeeMap;
  } catch (error) {
    console.error('[AuditLog] Error fetching employee data:', error.message);
    return {};
  }
}

// ─── Core log function ────────────────────────────────────────
// Call this from anywhere to create an audit log
exports.log = async ({
  action,
  module,
  actor,          // { userId, name, role, email }
  target,         // { type, id, name, employeeId }
  changes,        // { field: { from, to } }
  description,
  metadata,       // { ip, userAgent }
  org_id,
  company_id,
  unit_id,
}) => {
  try {
    await AuditLog.create({
      org_id:     org_id     ? toObjId(org_id)     : null,
      company_id: company_id ? toObjId(company_id) : null,
      unit_id:    unit_id    ? toObjId(unit_id)    : null,
      action,
      module,
      actor: {
        userId: actor?.userId ? toObjId(actor.userId) : null,
        name:   actor?.name   || null,
        role:   actor?.role   || null,
        email:  actor?.email  || null,
      },
      target: {
        type:       target?.type       || null,
        id:         target?.id ? toObjId(target.id) : null,
        name:       target?.name       || null,
        employeeId: target?.employeeId || null,
      },
      changes:     changes     || null,
      description: description || null,
      metadata:    metadata    || null,
    });
  } catch (err) {
    // Audit log failure should never break the main flow
    console.error("[AuditLog] Failed to create log:", err.message);
  }
};

// ─── Helper: build diff between old and new object ───────────
exports.buildDiff = (oldObj, newObj, fields) => {
  const changes = {};
  for (const field of fields) {
    const oldVal = field.split(".").reduce((o, k) => o?.[k], oldObj);
    const newVal = field.split(".").reduce((o, k) => o?.[k], newObj);
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes[field] = { from: oldVal ?? null, to: newVal ?? null };
    }
  }
  return Object.keys(changes).length > 0 ? changes : null;
};

// ─── GET LOGS (with filters + role-based access) ─────────────
exports.getLogs = async (query, user) => {
  const {
    page      = 1,
    limit     = 20,
    module,
    action,
    canonicalAction,
    actorId,
    targetId,
    from,
    to,
    employeeId,
    org_id,
    company_id,
    unit_id,
  } = query;

  const filter = {};

  // ═══════════════════════════════════════════════════════════
  // CRITICAL: ROLE-BASED SCOPE ISOLATION
  // ═══════════════════════════════════════════════════════════
  // Each admin level sees ONLY their scope and below
  // ────────────────────────────────────────────────────────────
  
  if (user.role === "SUPER_ADMIN" || user.role === "super_admin") {
    // Super Admin sees EVERYTHING - no filter
    console.log('[AuditLog] SUPER_ADMIN - showing all logs');
  }
  // ── ORG LEVEL ───────────────────────────────────────────────
  else if (user.role === "org_admin" || user.role === "org_head" || user.role === "org_auditor") {
    // Org Admin sees logs from entire organization
    if (!user.orgId) {
      throw new Error("orgId required for org_admin role");
    }
    filter.org_id = toObjId(user.orgId);
    console.log('[AuditLog] org_admin - filtering by org_id:', user.orgId);
  }
  // ── COMPANY LEVEL ────────────────────────────────────────────
  else if (user.role === "company_admin" || user.role === "company_hr_manager") {
    // Company Admin sees logs from their company ONLY
    if (!user.companyId) {
      throw new Error("companyId required for company_admin role");
    }
    filter.company_id = toObjId(user.companyId);
    console.log('[AuditLog] company_admin - filtering by company_id:', user.companyId);
  }
  // ── UNIT LEVEL ───────────────────────────────────────────────
  else if (user.role === "unit_admin" || user.role === "hr_manager") {
    // Unit Admin sees logs from their unit ONLY
    if (!user.unitId) {
      throw new Error("unitId required for unit_admin role");
    }
    filter.unit_id = toObjId(user.unitId);
    console.log('[AuditLog] unit_admin - filtering by unit_id:', user.unitId);
  }
  // ── MANAGER LEVEL ────────────────────────────────────────────
  else if (user.role === "manager") {
    // Manager sees only their team + their own actions
    filter.org_id = toObjId(user.orgId);
    filter.$or = [
      { "actor.userId": toObjId(user.userId) },
      { "target.id":    toObjId(user.userId) },
    ];
    console.log('[AuditLog] manager - filtering by actor/target userId:', user.userId);
  }
  // ── EMPLOYEE LEVEL ───────────────────────────────────────────
  else if (user.role === "employee") {
    // Employee sees only their own timeline
    filter.org_id = toObjId(user.orgId);
    filter["target.id"] = toObjId(user.userId);
    console.log('[AuditLog] employee - filtering by target.id:', user.userId);
  }
  // ── DEFAULT: FALLBACK TO ORG ─────────────────────────────────
  else {
    filter.org_id = toObjId(user.orgId);
    console.log('[AuditLog] default - filtering by org_id:', user.orgId);
  }

  // Hierarchy selections may only narrow the role-enforced scope above.
  applyHierarchyFilter(filter, "org_id", org_id);
  applyHierarchyFilter(filter, "company_id", company_id);
  applyHierarchyFilter(filter, "unit_id", unit_id);

  // ── Additional filters ────────────────────────────────────
  if (module)     filter.module         = module;
  if (action)     filter.action         = action;
  if (canonicalAction) filter.canonicalAction = canonicalAction;
  if (actorId)    filter["actor.userId"] = toObjId(actorId);
  if (targetId)   filter["target.id"]   = toObjId(targetId);
  if (employeeId) filter["target.employeeId"] = employeeId;

  // ── Date range filter ───────────────────────────────────────
  // Handle both 'from'/'to' and 'fromDate'/'toDate' parameter names
  const fromDate = query.from || query.fromDate;
  const toDate = query.to || query.toDate;
  
  if (fromDate || toDate) {
    filter.createdAt = {};
    if (fromDate) {
      const startDate = new Date(fromDate);
      startDate.setHours(0, 0, 0, 0);
      filter.createdAt.$gte = startDate;
    }
    if (toDate) {
      const endDate = new Date(toDate);
      endDate.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = endDate;
    }
  }

  const skip  = (Number(page) - 1) * Number(limit);
  const total = await AuditLog.countDocuments(filter);
  const logs  = await AuditLog.find(filter)
    .populate("org_id", "name")
    .populate("company_id", "company_name brand_name")
    .populate("unit_id", "name")
    // Populate actor.userId (correct structure)
    .populate({
      path: "actor.userId",
      select: "name email roleId profilePhoto",
      populate: {
        path: "roleId",
        select: "name slug level"
      }
    })
    // Populate target.id (fallback)
    .populate({
      path: "target.id",
      select: "name email employeeId roleId profilePhoto",
      populate: {
        path: "roleId",
        select: "name slug level"
      }
    })
    // Populate legacy userId at root level (for old LOGIN logs)
    .populate({
      path: "userId",
      select: "name email roleId profilePhoto",
      populate: {
        path: "roleId",
        select: "name slug level"
      }
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean();

  // Enrich with employee profile photos
  const employeeMap = await enrichWithEmployeeData(logs);
  
  // Format logs for better UX with detailed user information
  // Handles three cases:
  // 1. actor.userId exists (correct structure for new logs)
  // 2. userId at root level exists (legacy LOGIN logs)
  // 3. target.id exists (fallback for LOGIN where actor = target)
  const formattedLogs = logs.map(log => {
    // Get the best available user reference and extract userId string
    const userRef = log.actor?.userId || log.userId || log.target?.id;
    const userObj = userRef?._id ? userRef : null;
    
    // Get userId string for employee lookup
    const userIdStr = log.actor?.userId?._id?.toString() || 
                       log.actor?.userId?.toString() ||
                       log.userId?._id?.toString() || 
                       log.userId?.toString() ||
                       log.target?.id?._id?.toString() ||
                       log.target?.id?.toString();
    const employeeData = userIdStr ? employeeMap[userIdStr] : null;
    
    // Get target userId string for employee lookup
    const targetIdStr = log.target?.id?._id?.toString() || log.target?.id?.toString();
    const targetEmployeeData = targetIdStr ? employeeMap[targetIdStr] : null;
    
    // Format target to show readable info instead of MongoDB ID
    const targetDisplay = log.target?.id ? {
      type: log.target.type,
      id: log.target.id._id || log.target.id,
      name: targetEmployeeData?.name || log.target.id.name || log.target.name || 'Unknown',
      email: targetEmployeeData?.email || log.target.id.email || log.target.email || 'N/A',
      employeeId: targetEmployeeData?.employeeId || log.target.id.employeeId || log.target.employeeId || 'N/A',
      profilePhoto: targetEmployeeData?.profilePhoto || log.target.id.profilePhoto || null
    } : log.target?.name ? {
      type: log.target.type,
      id: log.target.id,
      name: log.target.name,
      email: log.target.email || 'N/A',
      employeeId: log.target.employeeId || 'N/A',
      profilePhoto: null
    } : { type: 'Unknown', id: null, name: 'Unknown', email: 'N/A', employeeId: 'N/A', profilePhoto: null };
    
    return {
      ...log,
      user: {
        id: userObj?._id || log.actor?.userId || log.userId || log.target?.id,
        name: employeeData?.name || userObj?.name || log.actor?.name || log.target?.name || 'Unknown User',
        email: employeeData?.email || userObj?.email || log.actor?.email || log.target?.email || 'N/A',
        role: userObj?.roleId ? {
          name: userObj.roleId.name,
          slug: userObj.roleId.slug,
          level: userObj.roleId.level
        } : {
          name: log.actor?.role || 'Unknown Role',
          slug: (log.actor?.role)?.toLowerCase().replace(/\s+/g, '_') || 'unknown',
          level: 'unit'
        },
        profilePhoto: employeeData?.profilePhoto || userObj?.profilePhoto || log.actor?.userId?.profilePhoto || null
      },
      target: targetDisplay,
      organization: {
        id: log.org_id?._id || log.org_id,
        name: log.org_id?.name || 'Unknown Organization'
      },
      company: {
        id: log.company_id?._id || log.company_id,
        name: log.company_id?.company_name || log.company_id?.brand_name || 'N/A'
      },
      unit: {
        id: log.unit_id?._id || log.unit_id,
        name: log.unit_id?.name || 'N/A'
      }
    };
  });

  // Fetch dropdown filter data based on user role - CRITICAL FOR ISOLATION
  let dropdownFilters = {};
  
  try {
    // Get organizations based on user role - ENFORCED ISOLATION
    let organizations = [];
    if (user.role === 'SUPER_ADMIN' || user.role === 'super_admin' || user.role === 'platform_admin') {
      // Super admin sees all organizations
      organizations = await Organization.find({}, '_id name').lean();
    } else {
      // All other roles see ONLY their own organization
      if (user.orgId) {
        organizations = await Organization.find({ _id: toObjId(user.orgId) }, '_id name').lean();
      }
    }
    dropdownFilters.organizations = organizations;
    
    // Get companies based on user role
    let companies = [];
    if (user.role === 'SUPER_ADMIN' || user.role === 'super_admin' || user.role === 'platform_admin') {
      companies = await Company.find({}, '_id company_name brand_name org_id').lean();
    } else if (user.role === 'org_admin' || user.role === 'org_head' || user.role === 'org_auditor') {
      companies = await Company.find({ org_id: toObjId(user.orgId) }, '_id company_name brand_name org_id').lean();
    } else if (user.role === 'company_admin' || user.role === 'company_hr_manager') {
      companies = await Company.find({ _id: toObjId(user.companyId) }, '_id company_name brand_name org_id').lean();
    } else if (user.role === 'unit_admin' || user.role === 'hr_manager') {
      if (user.companyId) {
        companies = await Company.find({ _id: toObjId(user.companyId) }, '_id company_name brand_name org_id').lean();
      }
    } else if (user.companyId) {
      // Fallback - user's company
      companies = await Company.find({ _id: toObjId(user.companyId) }, '_id company_name brand_name org_id').lean();
    }
    dropdownFilters.companies = companies;
    
    // Get units based on user role
    let units = [];
    if (user.role === 'SUPER_ADMIN' || user.role === 'super_admin' || user.role === 'platform_admin') {
      units = await Unit.find({}, '_id name company_id').lean();
    } else if (user.role === 'org_admin' || user.role === 'org_head') {
      const companyIds = companies.map(c => c._id);
      units = await Unit.find({ company_id: { $in: companyIds } }, '_id name company_id').lean();
    } else if (user.role === 'company_admin' || user.role === 'company_hr_manager') {
      units = await Unit.find({ company_id: toObjId(user.companyId) }, '_id name company_id').lean();
    } else if (user.role === 'unit_admin' || user.role === 'hr_manager') {
      units = await Unit.find({ _id: toObjId(user.unitId) }, '_id name company_id').lean();
    } else if (user.unitId) {
      // Fallback - user's unit
      units = await Unit.find({ _id: toObjId(user.unitId) }, '_id name company_id').lean();
    }
    dropdownFilters.units = units;
  } catch (error) {
    console.error('[AuditLog] Error fetching dropdown filters:', error.message);
    // Don't fail the request, just return empty filters
    dropdownFilters = { organizations: [], companies: [], units: [] };
  }

  return {
    logs: formattedLogs,
    total,
    page:       Number(page),
    totalPages: Math.ceil(total / Number(limit)),
    dropdownFilters
  };
};

// ─── GET EMPLOYEE TIMELINE ────────────────────────────────────
exports.getEmployeeTimeline = async (employeeId, user) => {
  const filter = {
    org_id:              toObjId(user.orgId),
    "target.employeeId": employeeId,
  };

  const logs = await AuditLog.find(filter)
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  return logs;
};

// ─── HR EMPLOYEE LOGS (Employee-level actions for HR) ───────────────────────
// Returns filtered audit logs for HR personnel containing specific employee actions:
// LOGIN, LOGOUT, PUNCH_IN, PUNCH_OUT, LEAVE_APPLIED, EMPLOYEE_UPDATED, PASSWORD_RESET
exports.getHREmployeeLogs = async (query, user) => {
  const {
    page      = 1,
    limit     = 50,
    action,   // Optional: filter by specific action
    employeeId, // Optional: filter by employee ID
    from,
    to,
  } = query;

  // ═══════════════════════════════════════════════════════════
  // HR-SPECIFIC ACTIONS FILTER
  // Only employee-level actions relevant to HR operations
  // ═══════════════════════════════════════════════════════════
  
  const HR_ACTIONS = [
    'LOGIN',
    'LOGOUT', 
    'LOGIN_FAILED',
    'PUNCH_IN',
    'PUNCH_OUT',
    'LEAVE_APPLIED',
    'LEAVE_APPROVED_L1',
    'LEAVE_APPROVED_L2',
    'LEAVE_REJECTED',
    'EMPLOYEE_CREATED',
    'EMPLOYEE_UPDATED',
    'EMPLOYEE_PHOTO_UPDATED',
    'PASSWORD_CHANGED',
    'PASSWORD_RESET',
    'PASSWORD_RESET_REQUEST',
    'PROFILE_VIEWED'
  ];

  const HR_MODULES = [
    'auth',
    'attendance', 
    'leave',
    'employee'
  ];

  const filter = {
    $or: [
      { action: { $in: HR_ACTIONS } },
      { module: { $in: HR_MODULES } }
    ]
  };

  // ═══════════════════════════════════════════════════════════
  // ROLE-BASED SCOPE ISOLATION FOR HR
  // ═══════════════════════════════════════════════════════════
  
  // HR Manager at company level - sees all employees in company
  if (user.role === "company_hr_manager" || user.role === "company_admin") {
    if (!user.companyId) {
      throw new Error("companyId required for HR role");
    }
    filter.company_id = toObjId(user.companyId);
    console.log('[AuditLog HR] company_hr - filtering by company_id:', user.companyId);
  }
  // HR Manager at unit level - sees all employees in unit
  else if (user.role === "hr_manager" || user.role === "unit_admin") {
    if (!user.unitId) {
      throw new Error("unitId required for hr_manager role");
    }
    filter.unit_id = toObjId(user.unitId);
    console.log('[AuditLog HR] hr_manager - filtering by unit_id:', user.unitId);
  }
  // Fallback to org scope
  else if (user.role === "hr") {
    if (!user.orgId) {
      throw new Error("orgId required for hr role");
    }
    filter.org_id = toObjId(user.orgId);
    console.log('[AuditLog HR] hr - filtering by org_id:', user.orgId);
  }

  // ── Additional filters ────────────────────────────────────
  if (action && HR_ACTIONS.includes(action)) {
    filter.action = action;
  }
  
  if (employeeId) {
    filter.$or = [
      { "target.employeeId": employeeId },
      { "target.id": toObjId(employeeId) }
    ];
  }

  // ── Date range filter ───────────────────────────────────────
  const fromDate = query.from || query.fromDate;
  const toDate = query.to || query.toDate;
  
  if (fromDate || toDate) {
    filter.createdAt = {};
    if (fromDate) {
      const startDate = new Date(fromDate);
      startDate.setHours(0, 0, 0, 0);
      filter.createdAt.$gte = startDate;
    }
    if (toDate) {
      const endDate = new Date(toDate);
      endDate.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = endDate;
    }
  }

  const skip  = (Number(page) - 1) * Number(limit);
  const total = await AuditLog.countDocuments(filter);
  const logs  = await AuditLog.find(filter)
    .populate("org_id", "name")
    .populate("company_id", "company_name brand_name")
    .populate("unit_id", "name")
    // Populate actor.userId (correct structure)
    .populate({
      path: "actor.userId",
      select: "name email roleId profilePhoto",
      populate: {
        path: "roleId",
        select: "name slug level"
      }
    })
    // Populate target.id (fallback)
    .populate({
      path: "target.id",
      select: "name email employeeId roleId profilePhoto",
      populate: {
        path: "roleId",
        select: "name slug level"
      }
    })
    // Populate legacy userId at root level (for old LOGIN logs)
    .populate({
      path: "userId",
      select: "name email roleId profilePhoto",
      populate: {
        path: "roleId",
        select: "name slug level"
      }
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean();

  // Format logs for better UX with detailed user information
  // Handles three cases:
  // 1. actor.userId exists (correct structure for new logs)
  // 2. userId at root level exists (legacy LOGIN logs)
  // 3. target.id exists (fallback for LOGIN where actor = target)
  
  // Enrich with employee profile photos
  const employeeMap = await enrichWithEmployeeData(logs);
  
  const formattedLogs = logs.map(log => {
    // Get the best available user reference and extract userId string
    const userRef = log.actor?.userId || log.userId || log.target?.id;
    const userObj = userRef?._id ? userRef : null;
    
    // Get userId string for employee lookup
    const userIdStr = log.actor?.userId?._id?.toString() || 
                       log.actor?.userId?.toString() ||
                       log.userId?._id?.toString() || 
                       log.userId?.toString() ||
                       log.target?.id?._id?.toString() ||
                       log.target?.id?.toString();
    const employeeData = userIdStr ? employeeMap[userIdStr] : null;
    
    // Get target userId string for employee lookup
    const targetIdStr = log.target?.id?._id?.toString() || log.target?.id?.toString();
    const targetEmployeeData = targetIdStr ? employeeMap[targetIdStr] : null;
    
    // Format target to show readable info instead of MongoDB ID
    const targetDisplay = log.target?.id ? {
      type: log.target.type,
      id: log.target.id._id || log.target.id,
      name: targetEmployeeData?.name || log.target.id.name || log.target.name || 'Unknown',
      email: targetEmployeeData?.email || log.target.id.email || log.target.email || 'N/A',
      employeeId: targetEmployeeData?.employeeId || log.target.id.employeeId || log.target.employeeId || 'N/A',
      profilePhoto: targetEmployeeData?.profilePhoto || log.target.id.profilePhoto || null
    } : log.target?.name ? {
      type: log.target.type,
      id: log.target.id,
      name: log.target.name,
      email: log.target.email || 'N/A',
      employeeId: log.target.employeeId || 'N/A',
      profilePhoto: null
    } : { type: 'Unknown', id: null, name: 'Unknown', email: 'N/A', employeeId: 'N/A', profilePhoto: null };
    
    return {
      ...log,
      user: {
        id: userObj?._id || log.actor?.userId || log.userId || log.target?.id,
        name: employeeData?.name || userObj?.name || log.actor?.name || log.target?.name || 'Unknown User',
        email: employeeData?.email || userObj?.email || log.actor?.email || log.target?.email || 'N/A',
        role: userObj?.roleId ? {
          name: userObj.roleId.name,
          slug: userObj.roleId.slug,
          level: userObj.roleId.level
        } : {
          name: log.actor?.role || 'Unknown Role',
          slug: (log.actor?.role)?.toLowerCase().replace(/\s+/g, '_') || 'unknown',
          level: 'unit'
        },
        profilePhoto: employeeData?.profilePhoto || userObj?.profilePhoto || log.actor?.userId?.profilePhoto || null
      },
      target: targetDisplay,
      organization: {
        id: log.org_id?._id || log.org_id,
        name: log.org_id?.name || 'Unknown Organization'
      },
      company: {
        id: log.company_id?._id || log.company_id,
        name: log.company_id?.company_name || log.company_id?.brand_name || 'N/A'
      },
      unit: {
        id: log.unit_id?._id || log.unit_id,
        name: log.unit_id?.name || 'N/A'
      }
    };
  });

  // Fetch dropdown filter data based on HR user role
  let dropdownFilters = {};
  
  try {
    // For HR users, get companies and units based on their scope
    let companies = [];
    let units = [];
    
    if (user.role === 'company_hr_manager' || user.role === 'company_admin') {
      companies = await Company.find({ _id: toObjId(user.companyId) }, '_id name org_id').lean();
      units = await Unit.find({ company_id: toObjId(user.companyId) }, '_id name company_id').lean();
    } else if (user.role === 'hr_manager' || user.role === 'unit_admin') {
      units = await Unit.find({ _id: toObjId(user.unitId) }, '_id name company_id').lean();
      if (units.length > 0) {
        const companyId = units[0].company_id;
        companies = await Company.find({ _id: companyId }, '_id name org_id').lean();
      }
    } else if (user.role === 'hr') {
      const orgCompanies = await Company.find({ org_id: toObjId(user.orgId) }, '_id name org_id').lean();
      companies = orgCompanies;
      const companyIds = orgCompanies.map(c => c._id);
      units = await Unit.find({ company_id: { $in: companyIds } }, '_id name company_id').lean();
    }
    
    dropdownFilters = {
      companies,
      units
    };
  } catch (error) {
    console.error('[AuditLog HR] Error fetching dropdown filters:', error.message);
    dropdownFilters = { companies: [], units: [] };
  }

  return {
    logs: formattedLogs,
    total,
    page:       Number(page),
    totalPages: Math.ceil(total / Number(limit)),
    filters: {
      actions: HR_ACTIONS,
      modules: HR_MODULES
    },
    dropdownFilters
  };
};