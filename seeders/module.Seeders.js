// seeders/moduleSeeder.js
//
// Inserts 6 platform modules on server start.
// Safe to run multiple times — upsert on slug.
// Run order: moduleSeeder → planSeeder → permissionSeeder → roleSeeder

const Module = require("../modules/module/models/module.model");

const modules = [
  {
    slug: "employee",
    name: "Employee Management",
    description: "Employee profiles, lifecycle, designations, documents",
  },
  {
    slug: "attendance",
    name: "Attendance Management",
    description: "Check-in/out, biometric, WFH, overtime, reports",
  },
  {
    slug: "leave",
    name: "Leave Management",
    description: "Leave types, policy, approval workflow, balance tracking",
  },
  {
    slug: "payroll",
    name: "Payroll Management",
    description: "Salary structure, pay runs, payslips, TDS/PF/ESI",
  },
  {
    slug: "organisation",
    name: "Organisation Setup",
    description: "Org structure, companies, LOBs, units, departments",
  },
  {
    slug: "auth",
    name: "Auth and Access Control",
    description: "RBAC, roles, permissions, SSO, 2FA, user management",
  },
  // T-04 — Additional modules
  {
    slug: "crm",
    name: "CRM",
    description: "Customer relationship management, leads, contacts, deals",
  },
  {
    slug: "sales",
    name: "Sales",
    description: "Sales pipeline, targets, invoicing, revenue tracking",
  },
  {
    slug: "bd",
    name: "Business Development",
    description: "BD pipeline, partnerships, market expansion tracking",
  },
];

exports.seedModules = async () => {
  try {
    for (const mod of modules) {
      await Module.findOneAndUpdate(
        { slug: mod.slug },
        { $setOnInsert: mod },
        { upsert: true, returnDocument: "after"}
      );
    }
    console.log("✅ Modules seeded successfully");
  } catch (error) {
    console.error("❌ Module seeder failed:", error.message);
  }
};