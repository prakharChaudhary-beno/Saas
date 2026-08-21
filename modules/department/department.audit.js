// Department Audit Logger
const AuditLog = require("../auditLogs/auditLog.model");

/**
 * Log department-related audit events
 */
async function logDepartmentAudit({
  action,
  org_id,
  company_id,
  unit_id,
  actor,
  department,
  changes = {},
  metadata = {}
}) {
  try {
    const auditLog = new AuditLog({
      org_id,
      company_id,
      unit_id,
      action,
      module: "department",
      actor: {
        userId: actor.userId,
        name: actor.name,
        role: actor.role,
        email: actor.email
      },
      target: {
        model: "Department",
        id: department._id,
        name: department.name
      },
      description: generateDescription(action, department, changes),
      changes,
      metadata: {
        ...metadata,
        departmentCode: department.departmentCode,
        parentId: department.parentId,
        departmentHeadId: department.departmentHeadId
      }
    });

    await auditLog.save();
  } catch (error) {
    console.error("Audit log error:", error);
    // Don't throw - audit logging shouldn't break operations
  }
}

/**
 * Generate human-readable description
 */
function generateDescription(action, department, changes) {
  const descriptions = {
    DEPARTMENT_CREATED: `Created department "${department.name}"`,
    DEPARTMENT_UPDATED: `Updated department "${department.name}"`,
    DEPARTMENT_DELETED: `Deleted department "${department.name}"`,
    DEPARTMENT_HEAD_ASSIGNED: `Assigned ${changes.newHeadName || 'employee'} as head of "${department.name}"`,
    DEPARTMENT_HEAD_REMOVED: `Removed department head from "${department.name}"`
  };

  return descriptions[action] || `Department action: ${action}`;
}

module.exports = {
  logDepartmentAudit
};
