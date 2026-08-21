// Department Audit Service
const AuditLog = require("../auditLogs/auditLog.model");

/**
 * Get audit logs for a specific department
 */
exports.getDepartmentAuditLogs = async (departmentId, user, query = {}) => {
  const { page = 1, limit = 20 } = query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const filter = {
    "target.id": departmentId,
    module: "department"
  };

  // Apply scope filter
  if (user.role !== "SUPER_ADMIN") {
    filter.org_id = user.orgId;
    if (user.companyId) filter.company_id = user.companyId;
    if (user.unitId) filter.unit_id = user.unitId;
  }

  const logs = await AuditLog.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

  const total = await AuditLog.countDocuments(filter);

  return {
    logs,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    }
  };
};
