// modules/tenant/tenant.service.js
// UPDATED — registration now uses module _id refs from plan.modules[]
// plan.modules is now ObjectId[] instead of String[]

const bcrypt        = require("bcryptjs");
const mongoose      = require("mongoose");
const AppError      = require("../../utils/appError");
const { sendEmail } = require("../../utils/email/email");
const { credentialsTemplate } = require("../../utils/email/templates/credentials");

const Plan         = require("../plan/models/plan.model");
const Customer     = require("../customer/models/customer.model");
const Organization = require("../organisation/models/organization.model");
const Subscription = require("../subscription/models/subscription.Models");
const OrgModule    = require("../orgModule/models/orgModule.model");
const Module       = require("../module/models/module.model");
const Role         = require("../role/role.model");
const User         = require("../auth/models/user.model");

const generateTempPassword = () => {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pwd = "";
  for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  return pwd;
};

const toSlug = (name) =>
  name.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

exports.registerOrg = async (payload) => {
  const {
    plan_id, business_name, contact_name, contact_email,
    contact_phone, org_name, industry, country, address,
  } = payload;

  // ── Pre-checks ────────────────────────────────────────────
  const plan = await Plan.findOne({ _id: plan_id, status: "Active", is_deleted: false })
    .populate("modules", "_id slug name");

  if (!plan) throw new AppError("Plan not found or inactive", 404);

  const existingCustomer = await Customer.findOne({
    contact_email: contact_email.toLowerCase().trim(),
    is_deleted: false,
  });
  if (existingCustomer) throw new AppError("An account already exists with this email", 409);

  const slug = toSlug(org_name || business_name);
  const existingOrg = await Organization.findOne({ slug });
  if (existingOrg) throw new AppError("Organisation with this name already exists.", 409);

  const orgAdminRole = await Role.findOne({ slug: "org_admin", org_id: null, isSystem: true });
  if (!orgAdminRole) throw new AppError("System role 'org_admin' not found. Run seedRoles() first.", 500);

  // ── Transaction ───────────────────────────────────────────
  const session = await mongoose.startSession();
  session.startTransaction();

  let tempPassword;

  try {
    const now        = new Date();
    const trialEndAt = new Date(+now + 14 * 24 * 60 * 60 * 1000);

    // STEP 1 — Customer
    const [customer] = await Customer.create([{
      business_name,
      contact_name,
      contact_email:  contact_email.toLowerCase().trim(),
      contact_phone,
      status:         "Active",
      is_first_login: true,
      is_deleted:     false,
      created_by:     "SELF",
    }], { session });

    // STEP 2 — Organization
    const [org] = await Organization.create([{
      customer_id:   customer._id,
      name:          org_name || business_name,
      slug,
      contact_email: contact_email.toLowerCase().trim(),
      contact_phone: contact_phone || null,
      industry:      industry || null,
      country:       country  || null,
      address:       address  || {},
      status:        "Active",
      is_deleted:    false,
    }], { session });

    // STEP 3 — Subscription
    // plan_snapshot.modules stores SLUGS for permission filtering
    const moduleSlugs = plan.modules.map(m => m.slug);

    await Subscription.create([{
      org_id:  org._id,
      plan_id: plan._id,
      plan_snapshot: {
        name:            plan.name,
        price_monthly:   plan.price_monthly,
        price_annual:    plan.price_annual,
        seat_limit:      plan.seat_limit,
        modules:         moduleSlugs,          // ← slugs for permission filter
        structure_level: plan.structure_level,
        package_type:    plan.package_type,
        features:        plan.features || [], // ← feature gates snapshot
      },
      status:          "Trial",
      billing_cycle:   "monthly",
      seats_purchased: plan.seat_limit,
      starts_at:       now,
      ends_at:         trialEndAt,
      grace_ends_at:   null,
      is_active:       true,
    }], { session });

    // STEP 4 — OrgModules (use ObjectIds from plan.modules)
    if (plan.modules.length) {
      const orgModuleDocs = plan.modules.map(mod => ({
        org_id:       org._id,
        module_id:    mod._id,   // ← already ObjectId
        is_active:    true,
        activated_at: now,
      }));
      await OrgModule.insertMany(orgModuleDocs, { session, ordered: false });
    }

    // STEP 5 — Org Admin User
const tempPassword = process.env.NODE_ENV === "development"
  ? "Test@1234"
  : generateTempPassword();   
   const hashedPassword = await bcrypt.hash(tempPassword, 10);

    await User.create([{
      org_id:          org._id,
      company_id:      null,
      unit_id:         null,
      name:            contact_name,
      email:           contact_email.toLowerCase().trim(),
      phone:           contact_phone || null,
      password:        hashedPassword,
      roleId:          orgAdminRole._id,
      status:          "ACTIVE",
      is_first_login:  true,
      isEmailVerified: false,
    }], { session });

    await session.commitTransaction();
    session.endSession();

    console.log(`✅ Registration complete — Org "${org.name}" (plan: ${plan.name})`);

    // STEP 6 — Send email (outside transaction)
    try {
      await sendEmail({
        to:      contact_email,
        subject: "Welcome to BenoSupport — Your login credentials",
        html:    credentialsTemplate({
          name:        contact_name,
          email:       contact_email,
          password:    tempPassword,
          companyName: org_name || business_name,
        }),
      });
    } catch (emailErr) {
      console.error("⚠️  Credentials email failed:", emailErr.message);
    }

    return {
      message:     "Registration successful. Check your email for login credentials.",
      org: { id: org._id, name: org.name, contact_email: org.contact_email },
      plan: {
        name:            plan.name,
        structure_level: plan.structure_level,
        trial_ends_at:   trialEndAt,
        days_left:       14,
      },
      admin_email: contact_email,
    };

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] || "field";
      throw new AppError(`Duplicate value for ${field}. Please try again.`, 409);
    }
    throw err;
  }
};

// ── Super Admin CRUD ──────────────────────────────────────────
exports.getCustomers = async () => {
  return await Customer.find({ is_deleted: false }).sort({ createdAt: -1 });
};

exports.getCustomerById = async (customerId) => {
  const customer = await Customer.findById(customerId);
  if (!customer) throw new AppError("Customer not found", 404);
  return customer;
};

exports.updateCustomer = async (customerId, data) => {
  const customer = await Customer.findById(customerId);
  if (!customer) throw new AppError("Customer not found", 404);
  ["contact_email", "created_by"].forEach(f => delete data[f]);
  Object.assign(customer, data);
  await customer.save();
  return customer;
};

exports.deleteCustomer = async (customerId) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const customer = await Customer.findOne({ _id: customerId, is_deleted: false });
    if (!customer) throw new AppError("Customer not found", 404);
    customer.is_deleted = true;
    await customer.save({ session });
    const orgs   = await Organization.find({ customer_id: customerId });
    const orgIds = orgs.map(o => o._id);
    await User.updateMany({ org_id: { $in: orgIds } }, { status: "INACTIVE" }, { session });
    await session.commitTransaction();
    session.endSession();
    return { message: "Customer deleted successfully" };
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};