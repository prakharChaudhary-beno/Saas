// modules/attendance/regularisationPolicy.service.js
// Enterprise-level Regularisation Policy Service

"use strict";

const RegularisationPolicy = require("./models/regularisationPolicy.model");
const AppError = require("../../utils/appError");
const mongoose = require("mongoose");

const toObjId = (id) => new mongoose.Types.ObjectId(String(id));

// ─── CREATE POLICY ──────────────────────────────────────────────
exports.createPolicy = async (payload, user) => {
  const {
    name,
    description,
    enabled,
    isDefault,
    allowedFor,
    maxRequestsPerMonth,
    requestWindow,
    approvalFlow,
    autoApproval,
    autoRejectAfterDays,
    documentRequired,
    escalation,
    applicableFor,
    effectiveFrom,
    effectiveTill,
    unit_id,
  } = payload;

  // Validate required fields
  if (!name) throw new AppError("Policy name is required", 400);
  if (!approvalFlow) throw new AppError("Approval flow is required", 400);

  // Check for duplicate name in same company
  const existing = await RegularisationPolicy.findOne({
    org_id: toObjId(user.orgId),
    company_id: toObjId(user.companyId),
    name: { $regex: new RegExp(`^${name}$`, "i") },
    isDeleted: false,
  });

  if (existing) {
    throw new AppError("Policy with this name already exists", 409);
  }

  const policy = await RegularisationPolicy.create({
    org_id: toObjId(user.orgId),
    company_id: toObjId(user.companyId),
    unit_id: unit_id ? toObjId(unit_id) : null,
    name,
    description: description || "",
    enabled: enabled !== undefined ? enabled : true,
    isDefault: isDefault || false,
    allowedFor: allowedFor || ["late", "absent", "missed_punch"],
    maxRequestsPerMonth: maxRequestsPerMonth || 3,
    requestWindow: {
      pastDaysAllowed: requestWindow?.pastDaysAllowed || 30,
      futureAllowed: requestWindow?.futureAllowed || false,
    },
    approvalFlow,
    autoApproval: {
      enabled: autoApproval?.enabled || false,
      conditions: autoApproval?.conditions || [],
    },
    autoRejectAfterDays: autoRejectAfterDays || 7,
    documentRequired: {
      enabled: documentRequired?.enabled || false,
      forTypes: documentRequired?.forTypes || [],
      maxSizeMB: documentRequired?.maxSizeMB || 5,
      allowedFormats: documentRequired?.allowedFormats || ["pdf", "jpg", "jpeg", "png"],
    },
    escalation: {
      enabled: escalation?.enabled || false,
      afterDays: escalation?.afterDays || 3,
      escalateTo: escalation?.escalateTo || "l2",
    },
    applicableFor: {
      departments: applicableFor?.departments?.map(toObjId) || [],
      designations: applicableFor?.designations?.map(toObjId) || [],
      roles: applicableFor?.roles?.map(toObjId) || [],
      employeeTypes: applicableFor?.employeeTypes || [],
    },
    effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : null,
    effectiveTill: effectiveTill ? new Date(effectiveTill) : null,
    status: "active",
    createdBy: toObjId(user.userId),
  });

  return policy;
};

// ─── GET ALL POLICIES ────────────────────────────────────────────
exports.getPolicies = async (query, user) => {
  const { page = 1, limit = 20, status, enabled, unit_id } = query;

  const filter = {
    org_id: toObjId(user.orgId),
    company_id: toObjId(user.companyId),
    isDeleted: false,
  };

  if (status) filter.status = status;
  if (enabled !== undefined) filter.enabled = enabled === "true";
  if (unit_id) filter.unit_id = toObjId(unit_id);

  const skip = (Number(page) - 1) * Number(limit);

  const [policies, total] = await Promise.all([
    RegularisationPolicy.find(filter)
      .populate("unit_id", "name")
      .populate("applicableFor.departments", "name")
      .populate("applicableFor.designations", "name")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    RegularisationPolicy.countDocuments(filter),
  ]);

  return {
    policies,
    total,
    page: Number(page),
    totalPages: Math.ceil(total / Number(limit)),
  };
};

// ─── GET POLICY BY ID ────────────────────────────────────────────
exports.getPolicyById = async (policyId, user) => {
  const policy = await RegularisationPolicy.findOne({
    _id: toObjId(policyId),
    org_id: toObjId(user.orgId),
    isDeleted: false,
  })
    .populate("unit_id", "name")
    .populate("applicableFor.departments", "name")
    .populate("applicableFor.designations", "name")
    .populate("applicableFor.roles", "name")
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email")
    .lean();

  if (!policy) {
    throw new AppError("Policy not found", 404);
  }

  return policy;
};

// ─── UPDATE POLICY ──────────────────────────────────────────────
exports.updatePolicy = async (policyId, payload, user) => {
  const policy = await RegularisationPolicy.findOne({
    _id: toObjId(policyId),
    org_id: toObjId(user.orgId),
    isDeleted: false,
  });

  if (!policy) {
    throw new AppError("Policy not found", 404);
  }

  // Check for duplicate name if name is being changed
  if (payload.name && payload.name !== policy.name) {
    const existing = await RegularisationPolicy.findOne({
      org_id: toObjId(user.orgId),
      company_id: toObjId(user.companyId),
      name: { $regex: new RegExp(`^${payload.name}$`, "i") },
      _id: { $ne: policy._id },
      isDeleted: false,
    });

    if (existing) {
      throw new AppError("Policy with this name already exists", 409);
    }
  }

  // Update fields
  const updateFields = [
    "name", "description", "enabled", "isDefault", "allowedFor",
    "maxRequestsPerMonth", "approvalFlow", "autoRejectAfterDays",
    "status", "effectiveFrom", "effectiveTill",
  ];

  updateFields.forEach((field) => {
    if (payload[field] !== undefined) {
      policy[field] = payload[field];
    }
  });

  // Update nested objects
  if (payload.requestWindow) {
    policy.requestWindow = {
      ...policy.requestWindow.toObject(),
      ...payload.requestWindow,
    };
  }

  if (payload.autoApproval) {
    policy.autoApproval = {
      ...policy.autoApproval.toObject(),
      ...payload.autoApproval,
    };
  }

  if (payload.documentRequired) {
    policy.documentRequired = {
      ...policy.documentRequired.toObject(),
      ...payload.documentRequired,
    };
  }

  if (payload.escalation) {
    policy.escalation = {
      ...policy.escalation.toObject(),
      ...payload.escalation,
    };
  }

  if (payload.applicableFor) {
    policy.applicableFor = {
      departments: payload.applicableFor.departments?.map(toObjId) || policy.applicableFor.departments,
      designations: payload.applicableFor.designations?.map(toObjId) || policy.applicableFor.designations,
      roles: payload.applicableFor.roles?.map(toObjId) || policy.applicableFor.roles,
      employeeTypes: payload.applicableFor.employeeTypes || policy.applicableFor.employeeTypes,
    };
  }

  policy.updatedBy = toObjId(user.userId);
  await policy.save();

  return policy;
};

// ─── DELETE POLICY ──────────────────────────────────────────────
exports.deletePolicy = async (policyId, user) => {
  const policy = await RegularisationPolicy.findOne({
    _id: toObjId(policyId),
    org_id: toObjId(user.orgId),
    isDeleted: false,
  });

  if (!policy) {
    throw new AppError("Policy not found", 404);
  }

  // Soft delete
  policy.isDeleted = true;
  policy.status = "archived";
  policy.updatedBy = toObjId(user.userId);
  await policy.save();

  return { message: "Policy deleted successfully" };
};

// ─── TOGGLE POLICY STATUS ────────────────────────────────────────
exports.togglePolicy = async (policyId, user) => {
  const policy = await RegularisationPolicy.findOne({
    _id: toObjId(policyId),
    org_id: toObjId(user.orgId),
    isDeleted: false,
  });

  if (!policy) {
    throw new AppError("Policy not found", 404);
  }

  policy.enabled = !policy.enabled;
  policy.status = policy.enabled ? "active" : "inactive";
  policy.updatedBy = toObjId(user.userId);
  await policy.save();

  return policy;
};

// ─── GET EFFECTIVE POLICY FOR EMPLOYEE ────────────────────────────
exports.getEffectivePolicy = async (employee, user) => {
  // Priority: Unit-specific > Department-specific > Company-wide Default
  const query = {
    org_id: toObjId(user.orgId),
    company_id: toObjId(user.companyId),
    enabled: true,
    status: "active",
    isDeleted: false,
    $or: [
      // Unit-specific
      { unit_id: toObjId(employee.unit_id) },
      // Department-specific
      { "applicableFor.departments": toObjId(employee.departmentId) },
      // Designation-specific
      { "applicableFor.designations": toObjId(employee.designationId) },
      // Company-wide default
      { isDefault: true, unit_id: null },
      // No applicability (applies to all)
      { unit_id: null, "applicableFor.departments": { $size: 0 }, "applicableFor.designations": { $size: 0 } },
    ],
  };

  const policies = await RegularisationPolicy.find(query)
    .sort({ isDefault: 1, unit_id: -1 }) // Prefer specific over default
    .limit(1)
    .lean();

  return policies[0] || null;
};

// ─── VALIDATE REGULARISATION REQUEST AGAINST POLICY ──────────────
exports.validateRequestAgainstPolicy = async (policy, requestData, monthlyCount) => {
  const errors = [];

  // Check if regularisation type is allowed
  if (!policy.allowedFor.includes(requestData.type)) {
    errors.push(`Regularisation for '${requestData.type}' is not permitted under this policy`);
  }

  // Check monthly quota
  if (policy.maxRequestsPerMonth && monthlyCount >= policy.maxRequestsPerMonth) {
    errors.push(`Monthly regularisation limit (${policy.maxRequestsPerMonth}) reached`);
  }

  // Check request window
  const requestDate = new Date(requestData.date);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const diffDays = Math.floor((today - requestDate) / (1000 * 60 * 60 * 24));

  if (diffDays > policy.requestWindow.pastDaysAllowed) {
    errors.push(`Cannot regularize attendance older than ${policy.requestWindow.pastDaysAllowed} days`);
  }

  if (!policy.requestWindow.futureAllowed && requestDate > today) {
    errors.push("Future date regularisation is not allowed under this policy");
  }

  // Check document requirement
  if (policy.documentRequired.enabled && policy.documentRequired.forTypes.includes(requestData.type)) {
    if (!requestData.attachments || requestData.attachments.length === 0) {
      errors.push(`Document is mandatory for '${requestData.type}' regularisation`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

// ─── AUTO-APPROVAL CHECK ────────────────────────────────────────────
exports.checkAutoApproval = (policy, requestData, monthlyCount) => {
  if (!policy.autoApproval.enabled) {
    return { autoApprove: false };
  }

  for (const condition of policy.autoApproval.conditions) {
    switch (condition.type) {
      case "first_request":
        if (monthlyCount === 0) {
          return { autoApprove: true, reason: "First request auto-approved" };
        }
        break;

      case "frequency_based":
        if (monthlyCount < condition.value) {
          return { autoApprove: true, reason: `Request ${monthlyCount + 1} auto-approved (limit: ${condition.value})` };
        }
        break;

      case "type_based":
        if (condition.value.includes(requestData.type)) {
          return { autoApprove: true, reason: `Type '${requestData.type}' auto-approved` };
        }
        break;

      case "hours_threshold":
        // For late arrivals or early exits
        if (requestData.correctionHours && requestData.correctionHours <= condition.value) {
          return { autoApprove: true, reason: `Correction within ${condition.value} hours auto-approved` };
        }
        break;
    }
  }

  return { autoApprove: false };
};
