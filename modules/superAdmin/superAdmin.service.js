// modules/superAdmin/superAdmin.service.js
// UPDATED — tenantId → org_id scope
// Tenant model fields: companyName, companyEmail, companyPhone, plan, status, isDeleted

"use strict";

const Tenant   = require("../tenant/tenant.models");
const Employee = require("../employee/models/employee.model");
const User     = require("../auth/models/user.model");
const Plan     = require("../plan/models/plan.model");
const AuditLog = require("./models/auditLog.models");
const AppError = require("../../utils/appError");
const Customer = require("../customer/models/customer.model");
const bcrypt       = require("bcryptjs");
const mongoose     = require("mongoose");
const Organization = require("../organisation/models/organization.model");
const Subscription = require("../subscription/models/subscription.Models");
const OrgModule    = require("../orgModule/models/orgModule.model");
const Role         = require("../role/role.model");
const { sendEmail }           = require("../../utils/email/email");
const { credentialsTemplate } = require("../../utils/email/templates/credentials");

const toSlug = (str) =>
  str.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const generateTempPassword = () =>
  Math.random().toString(36).slice(-8) + "A1@";
// ─────────────────────────────────────────────────────────────────────────────
// GET ALL TENANTS (Organisations)
// GET /api/v1/super-admin/tenants
// ─────────────────────────────────────────────────────────────────────────────

exports.getAllTenants = async (query) => {
  const { plan, status, search, page = 1, limit = 20 } = query;

  const filter = { isDeleted: false };

  if (plan)   filter.plan   = plan;
  if (status) filter.status = status;

  if (search) {
    filter.$or = [
      { companyName:  { $regex: search, $options: "i" } },
      { companyEmail: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [tenants, total] = await Promise.all([
    Tenant.find(filter)
      .select("companyName companyEmail companyPhone plan status isTrial trialEndsAt isTrialExpired isOnboardingComplete createdAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Tenant.countDocuments(filter),
  ]);

  // Employee count per org — org_id scope
  const orgIds = tenants.map((t) => t._id);

  const employeeCounts = await Employee.aggregate([
    {
      $match: {
        org_id:    { $in: orgIds },
        isDeleted: false,
      },
    },
    {
      $group: {
        _id:   "$org_id",
        count: { $sum: 1 },
      },
    },
  ]);

  const countMap = {};
  employeeCounts.forEach((e) => {
    countMap[e._id.toString()] = e.count;
  });

  // User count per org
  const userCounts = await User.aggregate([
    {
      $match: {
        org_id:     { $in: orgIds },
        is_deleted: false,
      },
    },
    {
      $group: {
        _id:   "$org_id",
        count: { $sum: 1 },
      },
    },
  ]);

  const userCountMap = {};
  userCounts.forEach((u) => {
    userCountMap[u._id.toString()] = u.count;
  });

  const data = tenants.map((t) => ({
    id:                   t._id,
    name:                 t.companyName  || "—",
    email:                t.companyEmail,
    phone:                t.companyPhone || "—",
    plan:                 t.plan,
    status:               t.status,
    employeeCount:        countMap[t._id.toString()]  || 0,
    userCount:            userCountMap[t._id.toString()] || 0,
    isTrial:              t.isTrial || false,
    trialEndsAt:          t.trialEndsAt,
    isTrialExpired:       t.isTrialExpired,
    isOnboardingComplete: t.isOnboardingComplete,
    joinedAt:             t.createdAt,
  }));

  return {
    tenants: data,
    pagination: {
      total,
      page:       Number(page),
      limit:      Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  };
};
exports.getCustomerHierarchy = async (query) => {
  const { search, page = 1, limit = 20 } = query;

  const filter = { is_deleted: false };
  if (search) {
    filter.$or = [
      { name:  { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [customers, total] = await Promise.all([
    Customer.find(filter)
      .select("name email phone industry country createdAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Customer.countDocuments(filter),
  ]);

  const hierarchy = await Promise.all(
    customers.map(async (customer) => {
      const orgs = await Tenant.find({
        customer_id: customer._id,
        isDeleted:   false,
      }).select("companyName companyEmail plan status isTrial trialEndsAt isOnboardingComplete createdAt").lean();

      const orgsWithCompanies = await Promise.all(
        orgs.map(async (org) => {
          const Company = require("../company/models/company.model");
          const companies = await Company.find({
            org_id:     org._id,
            is_deleted: false,
          }).select("company_name company_email company_code createdAt").lean();

          const empCount = await Employee.countDocuments({
            org_id:    org._id,
            isDeleted: false,
          });

          return {
            id:                   org._id,
            name:                 org.companyName,
            email:                org.companyEmail,
            plan:                 org.plan,
            status:               org.status,
            isTrial:              org.isTrial,
            trialEndsAt:          org.trialEndsAt,
            isOnboardingComplete: org.isOnboardingComplete,
            employeeCount:        empCount,
            joinedAt:             org.createdAt,
            companies,
          };
        })
      );

      return {
        customer: {
          id:       customer._id,
          name:     customer.name,
          email:    customer.email,
          phone:    customer.phone,
          industry: customer.industry,
          country:  customer.country,
          joinedAt: customer.createdAt,
          orgCount: orgs.length,
        },
        organisations: orgsWithCompanies,
      };
    })
  );

  return {
    hierarchy,
    pagination: {
      total,
      page:       Number(page),
      limit:      Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  };
};
// ─────────────────────────────────────────────────────────────────────────────
// GET SINGLE TENANT DETAIL
// GET /api/v1/super-admin/tenants/:id
// ─────────────────────────────────────────────────────────────────────────────

exports.getTenantById = async (tenantId) => {
  const tenant = await Tenant.findOne({
    _id:       tenantId,
    isDeleted: false,
  });

  if (!tenant) throw new AppError("Organisation not found", 404);

  const [totalEmployees, employeeBreakdown, totalUsers] = await Promise.all([
    Employee.countDocuments({ org_id: tenant._id, isDeleted: false }),

    Employee.aggregate([
      { $match: { org_id: tenant._id, isDeleted: false } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),

    User.countDocuments({ org_id: tenant._id, is_deleted: false }),
  ]);

  const byStatus = {};
  employeeBreakdown.forEach((e) => { byStatus[e._id] = e.count; });

  return {
    id:                   tenant._id,
    tenantCode:           tenant.tenantCode,
    name:                 tenant.companyName,
    email:                tenant.companyEmail,
    phone:                tenant.companyPhone,
    plan:                 tenant.plan,
    status:               tenant.status,
    isTrial:              tenant.isTrial || false,
    trialEndsAt:          tenant.trialEndsAt,
    isTrialExpired:       tenant.isTrialExpired,
    isOnboardingComplete: tenant.isOnboardingComplete,
    onboardingStep:       tenant.onboardingStep,
    companySize:          tenant.companySize,
    address:              tenant.address,
    joinedAt:             tenant.createdAt,
    updatedAt:            tenant.updatedAt,
    usage: {
      totalEmployees,
      totalUsers,
      byStatus,
    },
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// OVERRIDE TENANT PLAN
// POST /api/v1/super-admin/tenants/:id/plan
// ─────────────────────────────────────────────────────────────────────────────

exports.overrideTenantPlan = async (tenantId, { planId, reason }, adminEmail, ipAddress) => {
  const tenant = await Tenant.findOne({ _id: tenantId, isDeleted: false });
  if (!tenant) throw new AppError("Organisation not found", 404);

  const plan = await Plan.findById(planId);
  if (!plan) throw new AppError("Plan not found", 404);

  const previousPlan = tenant.plan;

  tenant.plan = plan.name;

  // Trial logic
  if (plan.name === "TRIAL") {
    tenant.trialEndsAt    = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    tenant.isTrialExpired = false;
  } else if (previousPlan === "TRIAL") {
    tenant.isTrialExpired = false;
  }

  await tenant.save();

  await AuditLog.create({
    actorEmail:     adminEmail,
    action:         "PLAN_OVERRIDE",
    targetTenantId: tenantId,
    details: {
      from:   previousPlan,
      to:     plan.name,
      reason: reason || "No reason provided",
    },
    ipAddress,
  });

  return {
    id:          tenant._id,
    name:        tenant.companyName,
    plan:        tenant.plan,
    trialEndsAt: tenant.trialEndsAt,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE TENANT STATUS (Suspend / Activate)
// PATCH /api/v1/super-admin/tenants/:id/status
// ─────────────────────────────────────────────────────────────────────────────

exports.updateTenantStatus = async (tenantId, { status, reason }, adminEmail, ipAddress) => {
  const allowed = ["ACTIVE", "SUSPENDED", "INACTIVE"];
  if (!allowed.includes(status)) {
    throw new AppError(`Invalid status. Allowed: ${allowed.join(", ")}`, 400);
  }

  const tenant = await Tenant.findOne({ _id: tenantId, isDeleted: false });
  if (!tenant) throw new AppError("Organisation not found", 404);

  const previousStatus = tenant.status;
  tenant.status = status;
  await tenant.save();

  await AuditLog.create({
    actorEmail:     adminEmail,
    action:         "STATUS_CHANGE",
    targetTenantId: tenantId,
    details: {
      from:   previousStatus,
      to:     status,
      reason: reason || "No reason provided",
    },
    ipAddress,
  });

  return {
    id:     tenant._id,
    name:   tenant.companyName,
    status: tenant.status,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT LOGS
// GET /api/v1/super-admin/audit-log
// ─────────────────────────────────────────────────────────────────────────────

exports.getAuditLogs = async (query) => {
  const { actor, action, from, to, page = 1, limit = 20 } = query;

  const filter = {};

  if (actor)  filter.actorEmail = actor;
  if (action) filter.action     = action;

  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to)   filter.createdAt.$lte = new Date(to);
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .populate("targetTenantId", "companyName companyEmail")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    AuditLog.countDocuments(filter),
  ]);

  return {
    logs: logs.map((l) => ({
      id:        l._id,
      action:    l.action,
      actor:     l.actorEmail,
      org:       l.targetTenantId?.companyName || "—",
      details:   l.details,
      ipAddress: l.ipAddress,
      timestamp: l.createdAt,
    })),
    pagination: {
      total,
      page:       Number(page),
      limit:      Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// CREATE CUSTOMER — Super Admin creates customer + assigns plan
// POST /api/v1/super-admin/customers
// ─────────────────────────────────────────────────────────────────────────────
exports.createCustomer = async (payload) => {
  const {
    business_name, contact_name, contact_email,
    contact_phone, plan_id, country, industry,
  } = payload;

  const existing = await Customer.findOne({
    contact_email: contact_email.toLowerCase().trim(),
    is_deleted:    false,
  });
  if (existing) throw new AppError("Customer already exists with this email", 409);

  const plan = await Plan.findOne({ _id: plan_id, status: "Active", is_deleted: false })
    .populate("modules", "_id slug name");
  if (!plan) throw new AppError("Plan not found or inactive", 404);

  const tempPassword   = process.env.NODE_ENV === "development" ? "Test@1234" : generateTempPassword();
  const hashedPassword = await bcrypt.hash(tempPassword, 10);

  const customer = await Customer.create({
    business_name,
    contact_name,
    contact_email:  contact_email.toLowerCase().trim(),
    contact_phone:  contact_phone || null,
    country:        country       || null,
    industry:       industry      || null,
    plan_id:        plan._id,
    password:       hashedPassword,
    status:         "Active",
    is_first_login: true,
    is_deleted:     false,
    created_by:     "SUPER_ADMIN",
  });

  try {
    await sendEmail({
      to:      contact_email,
      subject: "Welcome to BenoSupport — Your Login Credentials",
      html:    credentialsTemplate({
        name:        contact_name,
        email:       contact_email,
        password:    tempPassword,
        companyName: business_name,
      }),
    });
  } catch (e) {
    console.error("⚠️ Customer credentials email failed:", e.message);
  }

  return {
    message:  "Customer created. Credentials sent via email.",
    customer: {
      id:            customer._id,
      business_name: customer.business_name,
      contact_email: customer.contact_email,
      plan_id,
      plan_name:     plan.name,
    },
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// CREATE ORG FOR CUSTOMER — Customer apni org banata hai login ke baad
// POST /api/v1/super-admin/customers/create-org
// Auth: customer token
// ─────────────────────────────────────────────────────────────────────────────
exports.createOrgForCustomer = async (payload, customer) => {
  const {
    org_name, contact_phone,
    industry, country, address,
  } = payload;

  const plan_id = customer.plan_id; // auto from customer record
  if (!plan_id) throw new AppError("No plan assigned to this customer. Contact support.", 400);

  const plan = await Plan.findOne({ _id: plan_id, status: "Active", is_deleted: false })
    .populate("modules", "_id slug name");
  if (!plan) throw new AppError("Plan not found or inactive", 404);

  const slug = toSlug(org_name);
  const existingOrg = await Organization.findOne({ slug });
  if (existingOrg) throw new AppError("Organisation with this name already exists", 409);

  const orgAdminRole = await Role.findOne({ slug: "org_admin", org_id: null, isSystem: true });
  if (!orgAdminRole) throw new AppError("System role org_admin not found. Run seedRoles() first.", 500);

  const session = await mongoose.startSession();
  session.startTransaction();

  let tempPassword;

  try {
    const now        = new Date();
    const trialEndAt = new Date(+now + 14 * 24 * 60 * 60 * 1000);

    // STEP 1 — Organization
    const [org] = await Organization.create([{
      customer_id:   customer._id,
      name:          org_name,
      slug,
      contact_email: customer.contact_email,
      contact_phone: contact_phone || customer.contact_phone || null,
      industry:      industry || customer.industry || null,
      country:       country  || customer.country  || null,
      address:       address  || {},
      status:        "Active",
      is_deleted:    false,
    }], { session });

    // STEP 2 — Subscription
    const moduleSlugs = plan.modules.map(m => m.slug);
    await Subscription.create([{
      org_id:  org._id,
      plan_id: plan._id,
      plan_snapshot: {
        name:            plan.name,
  price_monthly:   plan.price_monthly,
  price_annual:    plan.price_annual,
  seat_limit:      plan.seat_limit,
  modules:         moduleSlugs,
  features:        plan.features || [],
  structure_level: plan.structure_level,
  package_type:    plan.package_type,
      },
      status:          "Trial",
      billing_cycle:   "monthly",
      starts_at:       now,
      ends_at:         trialEndAt,
      is_active:       true,
    }], { session });

    // STEP 3 — OrgModules
    if (plan.modules.length) {
      const orgModuleDocs = plan.modules.map(mod => ({
        org_id:       org._id,
        module_id:    mod._id,
        is_active:    true,
        activated_at: now,
      }));
      await OrgModule.insertMany(orgModuleDocs, { session, ordered: false });
    }

    // STEP 4 — Org Admin User
    tempPassword = process.env.NODE_ENV === "development" ? "Test@1234" : generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    await User.create([{
      org_id:          org._id,
      company_id:      null,
      unit_id:         null,
      name:            customer.contact_name,
      email:           customer.contact_email,
      phone:           contact_phone || customer.contact_phone || null,
      password:        hashedPassword,
      roleId:          orgAdminRole._id,
      status:          "ACTIVE",
      is_first_login:  true,
      isEmailVerified: false,
    }], { session });

    await session.commitTransaction();
    session.endSession();

    // Email org admin credentials
    try {
      await sendEmail({
        to:      customer.contact_email,
        subject: "Your HRMS Organisation is Ready — Login Credentials",
        html:    credentialsTemplate({
          name:        customer.contact_name,
          email:       customer.contact_email,
          password:    tempPassword,
          companyName: org_name,
        }),
      });
    } catch (e) {
      console.error("⚠️ Org credentials email failed:", e.message);
    }

    return {
      message: "Organisation created successfully.",
      org: {
        id:            org._id,
        name:          org.name,
        contact_email: org.contact_email,
        plan:          plan.name,
        trial_ends_at: trialEndAt,
        days_left:     14,
      },
      admin_email: customer.contact_email,
    };

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    if (err.code === 11000) throw new AppError("Duplicate value. Try again.", 409);
    throw err;
  }
};