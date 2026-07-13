// modules/superAdmin/superAdmin.service.js
// UPDATED — Query Customer model instead of Tenant model
// Tenant functionality now uses Customer + Organization models

"use strict";

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
// GET ALL TENANTS (Customers)
// GET /api/v1/super-admin/tenants
// FIXED: Query Customer model instead of Tenant model
// ─────────────────────────────────────────────────────────────────────────────

exports.getAllTenants = async (query) => {
  const { status, search, page = 1, limit = 20 } = query;

  const filter = { is_deleted: false };

  if (status) filter.status = status;

  if (search) {
    filter.$or = [
      { business_name:  { $regex: search, $options: "i" } },
      { contact_email: { $regex: search, $options: "i" } },
      { contact_name:  { $regex: search, $options: "i" } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [customers, total] = await Promise.all([
    Customer.find(filter)
      .populate("plan_id", "name")
      .select("business_name contact_name contact_email contact_phone plan_id status payment_method created_by createdAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Customer.countDocuments(filter),
  ]);

  // Get organizations for each customer to count employees/users
  const customerIds = customers.map((c) => c._id);
  
  const organizations = await Organization.find({
    customer_id: { $in: customerIds },
    is_deleted: false
  }).select("_id customer_id");

  const orgIds = organizations.map((o) => o._id);
  const customerOrgMap = {};
  organizations.forEach((o) => {
    customerOrgMap[o.customer_id.toString()] = o._id;
  });

  // Employee count per org
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

  // Get subscription info for each customer's org
  const subscriptions = await Subscription.find({
    org_id: { $in: orgIds },
    is_active: true
    }).select("org_id status plan_snapshot.name plan_snapshot.package_type").lean();

  const subscriptionMap = {};
  subscriptions.forEach((s) => {
    subscriptionMap[s.org_id.toString()] = s;
  });

  const data = customers.map((c) => {
    const orgId = customerOrgMap[c._id.toString()];
    const subscription = orgId ? subscriptionMap[orgId.toString()] : null;

    return {
      id:                   c._id,
      name:                 c.business_name  || "—",
      contactName:          c.contact_name   || "—",
      email:                c.contact_email,
      phone:                c.contact_phone  || "—",
      plan:                 c.plan_id?.name || subscription?.plan_snapshot?.name || "—",
      planId:               c.plan_id?._id || null,
      packageType:          subscription?.plan_snapshot?.package_type || null,
      status:               c.status,
      employeeCount:        orgId ? (countMap[orgId.toString()]  || 0) : 0,
      userCount:            orgId ? (userCountMap[orgId.toString()] || 0) : 0,
      subscriptionStatus:   subscription?.status || null,
      paymentMethod:        c.payment_method || null,
      created:              c.created_by || "SELF",
      joinedAt:             c.createdAt,
    };
  });

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
      const orgs = await Organization.find({
        customer_id: customer._id,
        is_deleted:  false,
      }).select("name slug email status is_active createdAt").lean();

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
            id:            org._id,
            name:          org.name,
            slug:          org.slug,
            email:         org.email,
            status:        org.status,
            isActive:      org.is_active,
            employeeCount: empCount,
            joinedAt:      org.createdAt,
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
// FIXED: Query Customer model instead of Tenant model
// ─────────────────────────────────────────────────────────────────────────────

exports.getTenantById = async (tenantId) => {
  const customer = await Customer.findOne({
    _id:        tenantId,
    is_deleted: false,
  }).populate("plan_id", "name package_type");

  if (!customer) throw new AppError("Customer not found", 404);

  // Get organization for this customer
  const organization = await Organization.findOne({
    customer_id: customer._id,
    is_deleted: false
  });

  let employeeData = null;
  let userData = null;
  let subscriptionData = null;

  if (organization) {
    const [totalEmployees, employeeBreakdown, totalUsers] = await Promise.all([
      Employee.countDocuments({ org_id: organization._id, isDeleted: false }),
      
      Employee.aggregate([
        { $match: { org_id: organization._id, isDeleted: false } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),

      User.countDocuments({ org_id: organization._id, is_deleted: false }),
    ]);

    const byStatus = {};
    employeeBreakdown.forEach((e) => { byStatus[e._id] = e.count; });

    employeeData = { totalEmployees, byStatus };
    userData = totalUsers;

    // Get subscription
    subscriptionData = await Subscription.findOne({
      org_id: organization._id,
      is_active: true
    }).select("status plan_snapshot billing_cycle ends_at createdAt");
  }

  return {
    id:                   customer._id,
    name:                 customer.business_name,
    contactName:          customer.contact_name,
    email:                customer.contact_email,
    phone:                customer.contact_phone,
    plan:                 customer.plan_id?.name || "—",
    planId:               customer.plan_id?._id || null,
    packageType:          customer.plan_id?.package_type || null,
    status:               customer.status,
    paymentMethod:        customer.payment_method || null,
    gstNumber:            customer.gst_number || null,
    panNumber:            customer.pan_number || null,
    billingAddress:       customer.billing_address || null,
    organization:         organization ? {
      id:                 organization._id,
      name:               organization.name,
      slug:               organization.slug,
    } : null,
    subscription:         subscriptionData ? {
      status:             subscriptionData.status,
      planName:           subscriptionData.plan_snapshot?.name,
      billingCycle:       subscriptionData.billing_cycle,
      endsAt:             subscriptionData.ends_at,
    } : null,
    usage: {
      totalEmployees:     employeeData?.totalEmployees || 0,
      totalUsers:         userData || 0,
      byStatus:           employeeData?.byStatus || {},
    },
    created:              customer.created_by,
    joinedAt:             customer.createdAt,
    updatedAt:            customer.updatedAt,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// OVERRIDE TENANT PLAN
// POST /api/v1/super-admin/tenants/:id/plan
// FIXED: Use Customer model and Subscription instead
// ─────────────────────────────────────────────────────────────────────────────

exports.overrideTenantPlan = async (tenantId, { planId, reason }, adminEmail, ipAddress) => {
  const customer = await Customer.findOne({ _id: tenantId, is_deleted: false });
  if (!customer) throw new AppError("Customer not found", 404);

  const plan = await Plan.findById(planId);
  if (!plan) throw new AppError("Plan not found", 404);

  const previousPlanId = customer.plan_id;
  const previousPlanName = customer.plan_id?.name || "—";

  // Update customer's plan
  customer.plan_id = planId;
  await customer.save();

  // Get organization for this customer
  const organization = await Organization.findOne({
    customer_id: customer._id,
    is_deleted: false
  });

  // Update subscription if org exists
  if (organization) {
    await Subscription.findOneAndUpdate(
      { org_id: organization._id, is_active: true },
      {
        plan_id: planId,
        plan_snapshot: {
          name: plan.name,
          package_type: plan.package_type,
          price_monthly: plan.price_monthly,
          price_annual: plan.price_annual,
          seat_limit: plan.seat_limit,
          modules: plan.modules,
          features: plan.features,
        },
      }
    );
  }

  await AuditLog.create({
    actorEmail:     adminEmail,
    action:         "PLAN_OVERRIDE",
    targetTenantId: tenantId,
    details: {
      from:   previousPlanName,
      to:     plan.name,
      reason: reason || "No reason provided",
    },
    ipAddress,
  });

  return {
    id:          customer._id,
    name:        customer.business_name,
    plan:        plan.name,
    planId:      planId,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE TENANT STATUS (Suspend / Activate)
// PATCH /api/v1/super-admin/tenants/:id/status
// ─────────────────────────────────────────────────────────────────────────────

exports.updateTenantStatus = async (tenantId, { status, reason }, adminEmail, ipAddress) => {
  const allowed = ["Active", "Inactive", "Suspended"];
  if (!allowed.includes(status)) {
    throw new AppError(`Invalid status. Allowed: ${allowed.join(", ")}`, 400);
  }

  const customer = await Customer.findOne({ _id: tenantId, is_deleted: false });
  if (!customer) throw new AppError("Customer not found", 404);

  const previousStatus = customer.status;
  customer.status = status;
  await customer.save();

  // If suspending, also suspend organization
  if (status === "Suspended") {
    await Organization.updateOne(
      { customer_id: customer._id },
      { is_active: false }
    );
  } else if (status === "Active") {
    await Organization.updateOne(
      { customer_id: customer._id },
      { is_active: true }
    );
  }

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
    id:     customer._id,
    name:   customer.business_name,
    status: customer.status,
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