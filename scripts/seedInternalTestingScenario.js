const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

require("dotenv").config();

const Company = require("../modules/company/models/company.model");
const CompanyModule = require("../modules/company/models/companyModule.model");
const Customer = require("../modules/customer/models/customer.model");
const Department = require("../modules/department/department.model");
const Designation = require("../modules/designation/designation.model");
const Employee = require("../modules/employee/models/employee.model");
const LOB = require("../modules/lob/models/lob.model");
const Module = require("../modules/module/models/module.model");
const Organization = require("../modules/organisation/models/organization.model");
const OrgModule = require("../modules/orgModule/models/orgModule.model");
const Plan = require("../modules/plan/models/plan.model");
const Role = require("../modules/role/role.model");
const Subscription = require("../modules/subscription/models/subscription.Models");
const Unit = require("../modules/unit/models/unit.model");
const User = require("../modules/auth/models/user.model");

const TEST_PASSWORD = "Test@1234";
const ORGANIZATION_SLUG = "the-search-house";
const TEST_EMAIL_DOMAIN = "the-search-house.example.com";
const LEGACY_TEST_EMAIL_DOMAIN = "the-search-house.test";

const ALL_FEATURES = [
  "shift",
  "roster",
  "shift_roster",
  "bulk_import_export",
  "leave_encashment",
  "sandwich_rule",
  "leave_liability_report",
  "custom_roles",
  "horizontal_delegation",
  "delegation_approval_flow",
  "payslip_pdf_download",
  "saml_sso",
  "ip_allowlisting",
  "session_activity_log",
  "biometric_integration",
  "bu_site_structure",
  "bu_independent_payroll",
  "advanced_reports",
  "feature_gate_matrix",
];

const PEOPLE = [
  {
    key: "abinesh",
    name: "Abinesh Pratap Singh",
    email: `abinesh.pratap.singh@${TEST_EMAIL_DOMAIN}`,
    phone: "9000000001",
    role: "org_admin",
    employeeId: "TSH-BT-001",
    department: "Executive Leadership",
    jobRole: "Managing Director",
    reportsTo: null,
  },
  {
    key: "pavan",
    name: "Pavan Sengar",
    email: `pavan.sengar@${TEST_EMAIL_DOMAIN}`,
    phone: "9000000002",
    role: "company_admin",
    employeeId: "TSH-BT-002",
    department: "Executive Leadership",
    jobRole: "Group CEO",
    reportsTo: "abinesh",
  },
  {
    key: "lawrance",
    name: "Lawrance Lucus",
    email: `lawrance.lucus@${TEST_EMAIL_DOMAIN}`,
    phone: "9000000003",
    role: "unit_admin",
    employeeId: "TSH-BT-003",
    department: "Administration",
    jobRole: "Unit Administrator",
    reportsTo: "pavan",
  },
  {
    key: "chetan",
    name: "Chetan",
    email: `chetan@${TEST_EMAIL_DOMAIN}`,
    phone: "9000000004",
    role: "hr_manager",
    employeeId: "TSH-BT-004",
    department: "Human Resources",
    jobRole: "HR Manager",
    reportsTo: "lawrance",
  },
  {
    key: "rajat",
    name: "Rajat",
    email: `rajat@${TEST_EMAIL_DOMAIN}`,
    phone: "9000000005",
    role: "manager",
    employeeId: "TSH-BT-005",
    department: "Information Technology",
    jobRole: "IT Manager",
    reportsTo: "lawrance",
  },
  {
    key: "vibhav",
    name: "Vibhav",
    email: `vibhav@${TEST_EMAIL_DOMAIN}`,
    phone: "9000000006",
    role: "employee",
    employeeId: "TSH-BT-006",
    department: "Information Technology",
    jobRole: "Software Engineer",
    reportsTo: "rajat",
  },
  {
    key: "prakhar",
    name: "Prakhar Shukla",
    email: `prakhar@${TEST_EMAIL_DOMAIN}`,
    phone: "9000000007",
    role: "employee",
    employeeId: "TSH-BT-007",
    department: "Information Technology",
    jobRole: "Intern",
    reportsTo: "rajat",
    employmentType: "INTERN",
  },
  {
    key: "manoj",
    name: "Manoj",
    email: `manoj@${TEST_EMAIL_DOMAIN}`,
    phone: "9000000008",
    role: "manager",
    employeeId: "TSH-BT-008",
    department: "Marketing",
    jobRole: "Marketing Head",
    reportsTo: "lawrance",
  },
  {
    key: "neeraj",
    name: "Neeraj Kumar",
    email: `neeraj.kumar@${TEST_EMAIL_DOMAIN}`,
    phone: "9000000009",
    role: "employee",
    employeeId: "TSH-BT-009",
    department: "Business Development",
    jobRole: "Senior Bid Executive",
    reportsTo: "manoj",
  },
  {
    key: "himanshu",
    name: "Himanshu Rastogi",
    email: `himanshu.rastogi@${TEST_EMAIL_DOMAIN}`,
    phone: "9000000010",
    role: "employee",
    employeeId: "TSH-BT-010",
    department: "Finance & Accounts",
    jobRole: "Accountant",
    reportsTo: "lawrance",
  },
  {
    key: "akshay",
    name: "Akshay",
    email: `akshay@${TEST_EMAIL_DOMAIN}`,
    phone: "9000000011",
    role: "employee",
    employeeId: "TSH-BT-011",
    department: "Marketing",
    jobRole: "Graphic Designer",
    reportsTo: "manoj",
  },
  {
    key: "prakharChaudhry",
    name: "Prakhar Chaudhry",
    email: `prakhar.chaudhry@${TEST_EMAIL_DOMAIN}`,
    phone: "9000000012",
    role: "employee",
    employeeId: "TSH-BT-012",
    department: "Information Technology",
    jobRole: "Backend Developer",
    reportsTo: "rajat",
  },
];

async function findOrCreate(Model, filter, values) {
  const existing = await Model.findOne(filter);
  if (existing) {
    Object.assign(existing, values);
    return existing.save();
  }

  return Model.create({ ...filter, ...values });
}

async function seedInternalTestingScenario() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is required");
  }

  await mongoose.connect(process.env.MONGO_URI);

  const [modules, systemRoles] = await Promise.all([
    Module.find({ is_active: { $ne: false } }).sort({ slug: 1 }),
    Role.find({
      slug: { $in: PEOPLE.map((person) => person.role) },
      org_id: null,
      isSystem: true,
    }),
  ]);

  if (!modules.length) {
    throw new Error("No active modules found. Run the module seeder first.");
  }

  const rolesBySlug = new Map(systemRoles.map((role) => [role.slug, role]));
  const missingRoles = [...new Set(PEOPLE.map((person) => person.role))]
    .filter((roleSlug) => !rolesBySlug.has(roleSlug));
  if (missingRoles.length) {
    throw new Error(`Missing system roles: ${missingRoles.join(", ")}`);
  }

  const plan = await findOrCreate(
    Plan,
    { name: "Custom", is_deleted: false },
    {
      package_type: "enterprise",
      structure_level: "enterprise",
      price_monthly: null,
      price_annual: null,
      seat_limit: null,
      modules: modules.map((module) => module._id),
      features: ALL_FEATURES,
      status: "Active",
      is_custom: true,
      is_public: false,
      version: 1,
    }
  );

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
  const customer = await findOrCreate(
    Customer,
    { business_name: "THE SEARCH HOUSE", created_by: "INTERNAL_TEST_SEED" },
    {
      business_name: "THE SEARCH HOUSE",
      contact_name: "Abinesh Pratap Singh",
      contact_phone: "9000000001",
      work_email: `abinesh.pratap.singh@${TEST_EMAIL_DOMAIN}`,
      same_email: true,
      org_name: "THE SEARCH HOUSE",
      plan_id: plan._id,
      password: passwordHash,
      status: "Active",
      country: "India",
      industry: "IT & Consulting",
      is_first_login: false,
      is_deleted: false,
      created_by: "INTERNAL_TEST_SEED",
    }
  );

  const organization = await findOrCreate(
    Organization,
    { slug: ORGANIZATION_SLUG },
    {
      customer_id: customer._id,
      name: "THE SEARCH HOUSE",
      contact_email: `abinesh.pratap.singh@${TEST_EMAIL_DOMAIN}`,
      contact_phone: "9000000001",
      industry: "IT & Consulting",
      country: "India",
      timezone: "Asia/Kolkata",
      currency: "INR",
      fiscalYearStart: 4,
      status: "Active",
      is_deleted: false,
      created_by: "INTERNAL_TEST_SEED",
    }
  );

  await Promise.all(PEOPLE.flatMap((person) => {
    const legacyEmail = person.email.replace(TEST_EMAIL_DOMAIN, LEGACY_TEST_EMAIL_DOMAIN);
    return [
      User.updateOne({ org_id: organization._id, email: legacyEmail }, { $set: { email: person.email } }),
      Employee.updateOne({ org_id: organization._id, email: legacyEmail }, { $set: { email: person.email } }),
    ];
  }));

  await Subscription.updateMany(
    { org_id: organization._id, is_active: true },
    { $set: { is_active: false, status: "Cancelled", cancelled_at: new Date() } }
  );

  const now = new Date();
  const subscriptionEndsAt = new Date(now);
  subscriptionEndsAt.setFullYear(subscriptionEndsAt.getFullYear() + 1);
  await Subscription.findOneAndUpdate(
    { org_id: organization._id, plan_id: plan._id },
    {
      $set: {
        plan_snapshot: {
          name: plan.name,
          price_monthly: plan.price_monthly,
          price_annual: plan.price_annual,
          seat_limit: plan.seat_limit,
          modules: modules.map((module) => module.slug),
          structure_level: plan.structure_level,
          package_type: plan.package_type,
          features: plan.features,
        },
        status: "Active",
        billing_cycle: "annual",
        seats_purchased: null,
        starts_at: now,
        ends_at: subscriptionEndsAt,
        grace_ends_at: null,
        cancelled_at: null,
        is_active: true,
      },
      $setOnInsert: { org_id: organization._id, plan_id: plan._id },
    },
    { upsert: true, returnDocument: "after", runValidators: true }
  );

  await Promise.all(modules.map((module) => OrgModule.updateOne(
    { org_id: organization._id, module_id: module._id },
    {
      $set: { is_active: true, activated_at: now },
      $setOnInsert: { org_id: organization._id, module_id: module._id },
    },
    { upsert: true }
  )));

  const orgAdminRole = rolesBySlug.get("org_admin");
  const orgAdmin = await findOrCreate(
    User,
    { email: PEOPLE[0].email, org_id: organization._id },
    {
      name: PEOPLE[0].name,
      phone: PEOPLE[0].phone,
      password: passwordHash,
      roleId: orgAdminRole._id,
      company_id: null,
      unit_id: null,
      status: "ACTIVE",
      is_first_login: false,
      isEmailVerified: true,
      is_deleted: false,
    }
  );

  const company = await findOrCreate(
    Company,
    { org_id: organization._id, company_code: "TSH-001", is_deleted: false },
    {
      company_code: "TSH-001",
      company_name: "THE SEARCH HOUSE",
      company_phone: "9000000002",
      brand_name: "THE SEARCH HOUSE",
      industry: "IT & Consulting",
      company_size: "11-50",
      address: { country: "India" },
      status: "Active",
      created_by: orgAdmin._id,
    }
  );

  await Promise.all(modules.map((module) => CompanyModule.updateOne(
    { company_id: company._id, module_id: module._id },
    {
      $set: { org_id: organization._id, is_active: true, created_by: orgAdmin._id },
      $setOnInsert: { company_id: company._id, module_id: module._id },
    },
    { upsert: true }
  )));

  const lob = await findOrCreate(
    LOB,
    { org_id: organization._id, company_id: company._id, name: "IT & Consulting", is_deleted: false },
    {
      code: "ITC",
      description: "Information technology and consulting services",
      status: "Active",
      created_by: orgAdmin._id,
    }
  );

  const benoTechnology = await findOrCreate(
    Unit,
    { org_id: organization._id, company_id: company._id, lob_id: lob._id, name: "Beno Technology", is_deleted: false },
    {
      description: "Primary unit used for internal HRMS testing",
      location: "India",
      status: "Active",
      created_by: orgAdmin._id,
    }
  );

  const cloudThink = await findOrCreate(
    Unit,
    { org_id: organization._id, company_id: company._id, lob_id: lob._id, name: "Cloud Think", is_deleted: false },
    {
      description: "Cloud consulting unit",
      location: "India",
      status: "Active",
      created_by: orgAdmin._id,
    }
  );

  const departmentNames = [...new Set(PEOPLE.map((person) => person.department))];
  const jobRoleNames = [...new Set(PEOPLE.map((person) => person.jobRole))];
  const departments = new Map();
  const jobRoles = new Map();

  for (const name of departmentNames) {
    const department = await findOrCreate(
      Department,
      { unit_id: benoTechnology._id, name, isDeleted: false },
      {
        org_id: organization._id,
        company_id: company._id,
        status: "active",
        description: `${name} department`,
        created_by: orgAdmin._id,
      }
    );
    departments.set(name, department);
  }

  for (const name of jobRoleNames) {
    const jobRole = await findOrCreate(
      Designation,
      { unit_id: benoTechnology._id, name, isDeleted: false },
      {
        org_id: organization._id,
        company_id: company._id,
        status: "active",
        created_by: orgAdmin._id,
      }
    );
    jobRoles.set(name, jobRole);
  }

  const users = new Map();
  for (const person of PEOPLE) {
    const role = rolesBySlug.get(person.role);
    const isOrgLevel = role.level === "org";
    const isCompanyLevel = role.level === "company";
    const user = await findOrCreate(
      User,
      { email: person.email, org_id: organization._id },
      {
        name: person.name,
        phone: person.phone,
        password: passwordHash,
        roleId: role._id,
        company_id: isOrgLevel ? null : company._id,
        unit_id: isOrgLevel || isCompanyLevel ? null : benoTechnology._id,
        status: "ACTIVE",
        is_first_login: false,
        isEmailVerified: true,
        is_deleted: false,
        createdBy: orgAdmin._id,
      }
    );
    users.set(person.key, user);
  }

  const employees = new Map();
  for (const person of PEOPLE) {
    const employee = await findOrCreate(
      Employee,
      { org_id: organization._id, company_id: company._id, employeeId: person.employeeId },
      {
        unit_id: benoTechnology._id,
        lob_id: lob._id,
        userId: users.get(person.key)._id,
        employeeId: person.employeeId,
        name: person.name,
        email: person.email,
        phone: person.phone,
        departmentId: departments.get(person.department)._id,
        designationId: jobRoles.get(person.jobRole)._id,
        reportingManagerId: null,
        employmentType: person.employmentType || "FULL_TIME",
        joiningDate: new Date("2026-09-01T00:00:00.000Z"),
        status: "ACTIVE",
        salary: {
          basic: 0,
          hra: 0,
          grossSalary: 0,
          netSalary: 0,
          currency: "INR",
        },
        currentAddress: { country: "India", countryCode: "IN" },
        isDeleted: false,
        createdBy: orgAdmin._id,
      }
    );
    employees.set(person.key, employee);
  }

  for (const person of PEOPLE) {
    if (!person.reportsTo) continue;
    await Employee.updateOne(
      { _id: employees.get(person.key)._id },
      { $set: { reportingManagerId: employees.get(person.reportsTo)._id } }
    );
  }

  const departmentHeads = {
    "Executive Leadership": "abinesh",
    Administration: "lawrance",
    "Human Resources": "chetan",
    "Information Technology": "rajat",
    Marketing: "manoj",
    "Business Development": "manoj",
    "Finance & Accounts": "lawrance",
  };
  await Promise.all(Object.entries(departmentHeads).map(([departmentName, personKey]) =>
    Department.updateOne(
      { _id: departments.get(departmentName)._id },
      { $set: { departmentHeadId: employees.get(personKey)._id } }
    )
  ));

  await Company.updateOne(
    { _id: company._id },
    { $set: { admin: users.get("pavan")._id } }
  );

  const summary = {
    plan: plan.name,
    organization: organization.name,
    orgAdmin: `${PEOPLE[0].name} <${PEOPLE[0].email}>`,
    company: company.company_name,
    companyAdmin: `${PEOPLE[1].name} <${PEOPLE[1].email}>`,
    lob: lob.name,
    units: [benoTechnology.name, cloudThink.name],
    workingUnit: benoTechnology.name,
    departments: departmentNames,
    jobRoles: jobRoleNames,
    employees: PEOPLE.map((person) => ({
      name: person.name,
      accessRole: person.role,
      jobRole: person.jobRole,
      department: person.department,
      email: person.email,
    })),
    testPassword: TEST_PASSWORD,
  };

  console.log(JSON.stringify(summary, null, 2));
}

seedInternalTestingScenario()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });