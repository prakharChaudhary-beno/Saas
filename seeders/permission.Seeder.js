// seeders/permission.Seeder.js
//
// MODIFIED — each permission now has:
//   + slug    — same as name
//   + label   — human readable UI label
//   + scope   — which role levels can use this permission
//
// NEW permissions added:
//   org.create, org.read, org.update
//   lob.create, lob.read, lob.update, lob.delete
//   unit.create, unit.read, unit.update, unit.delete
//   subscription.read, subscription.update
//   module.read, module.update
//   plan.create, plan.read, plan.update, plan.delete
//
// Run order: moduleSeeder → planSeeder → permissionSeeder → roleSeeder

const Permission = require("../modules/permission/permission.model");

const permissions = [

  // ─── Department ───────────────────────────────────────────
  { name: "department.create", slug: "department.create", module: "department", action: "create", label: "Create Department",    scope: ["company", "unit"],         description: "Create a department", category: "Organisation", frRef: "O-01" },
  { name: "department.read",   slug: "department.read",   module: "department", action: "read",   label: "View Departments",     scope: ["org", "company", "unit"],  description: "View departments", category: "Organisation", frRef: null },
  { name: "department.update", slug: "department.update", module: "department", action: "update", label: "Edit Department",      scope: ["company", "unit"],         description: "Update a department", category: "Organisation", frRef: null },
  { name: "department.delete", slug: "department.delete", module: "department", action: "delete", label: "Delete Department",    scope: ["company"],                 description: "Delete a department", category: "Organisation", frRef: null },

  // ─── Designation ──────────────────────────────────────────
  { name: "designation.create", slug: "designation.create", module: "designation", action: "create", label: "Create Designation",  scope: ["company", "unit"],         description: "Create a designation", category: "Organisation", frRef: null },
  { name: "designation.read",   slug: "designation.read",   module: "designation", action: "read",   label: "View Designations",   scope: ["org", "company", "unit"],  description: "View designations", category: "Organisation", frRef: null },
  { name: "designation.update", slug: "designation.update", module: "designation", action: "update", label: "Edit Designation",    scope: ["company", "unit"],         description: "Update a designation", category: "Organisation", frRef: null },
  { name: "designation.delete", slug: "designation.delete", module: "designation", action: "delete", label: "Delete Designation",  scope: ["company"],                 description: "Delete a designation", category: "Organisation", frRef: null },

  // ─── Employee ─────────────────────────────────────────────
  { name: "employee.create", slug: "employee.create", module: "employee", action: "create", label: "Add Employee",        scope: ["unit"],                    description: "Create an employee record", category: "HR Operations", frRef: "E-01" },
  { name: "employee.read",   slug: "employee.read",   module: "employee", action: "read",   label: "View Employees",      scope: ["org", "company", "unit"],  description: "View employee records", category: "HR Operations", frRef: "E-02" },
  { name: "employee.update", slug: "employee.update", module: "employee", action: "update", label: "Edit Employee",       scope: ["unit", "company"],         description: "Update an employee record", category: "HR Operations", frRef: null },
  { name: "employee.delete", slug: "employee.delete", module: "employee", action: "delete", label: "Delete Employee",     scope: ["unit"],                    description: "Delete an employee record", category: "HR Operations", frRef: null },

  // ─── Role ─────────────────────────────────────────────────
  { name: "role.create", slug: "role.create", module: "role", action: "create", label: "Create Role",   scope: ["org", "company", "unit"],  description: "Create a role", category: "Configuration", frRef: "R-06" },
  { name: "role.read",   slug: "role.read",   module: "role", action: "read",   label: "View Roles",    scope: ["org", "company", "unit"],  description: "View roles", category: "Configuration", frRef: null },
  { name: "role.update", slug: "role.update", module: "role", action: "update", label: "Edit Role",     scope: ["org", "company", "unit"],  description: "Update a role", category: "Configuration", frRef: null },
  { name: "role.delete", slug: "role.delete", module: "role", action: "delete", label: "Delete Role",   scope: ["org", "company", "unit"],  description: "Delete a role", category: "Configuration", frRef: null },

  // ─── User ─────────────────────────────────────────────────
  { name: "user.create", slug: "user.create", module: "user", action: "create", label: "Invite User",         scope: ["org", "company", "unit"],  description: "Invite / create a user", category: "Configuration", frRef: "R-12" },
  { name: "user.read",   slug: "user.read",   module: "user", action: "read",   label: "View Users",          scope: ["org", "company", "unit"],  description: "View users", category: "Configuration", frRef: null },
  { name: "user.update", slug: "user.update", module: "user", action: "update", label: "Edit User",           scope: ["org", "company", "unit"],  description: "Update a user", category: "Configuration", frRef: null },
  { name: "user.delete", slug: "user.delete", module: "user", action: "delete", label: "Remove User",         scope: ["org", "company", "unit"],  description: "Delete a user", category: "Configuration", frRef: null },

  // ─── Attendance ───────────────────────────────────────────
  { name: "attendance.create", slug: "attendance.create", module: "attendance", action: "create", label: "Mark Attendance",      scope: ["unit"],                    description: "Mark / punch-in attendance", category: "HR Operations", frRef: "AT-01" },
  { name: "attendance.read",   slug: "attendance.read",   module: "attendance", action: "read",   label: "View Attendance",      scope: ["org", "company", "unit"],  description: "View attendance records", category: "HR Operations", frRef: null },
  { name: "attendance.update", slug: "attendance.update", module: "attendance", action: "update", label: "Edit Attendance",      scope: ["unit", "company"],         description: "Regularize / update attendance", category: "HR Operations", frRef: "AT-08" },
  { name: "attendance.delete", slug: "attendance.delete", module: "attendance", action: "delete", label: "Delete Attendance",    scope: ["unit"],                    description: "Delete an attendance record", category: "HR Operations", frRef: null },
  { name: "attendance.approve",slug: "attendance.approve",module: "attendance", action: "approve",label: "Approve Attendance",   scope: ["unit", "company"],         description: "Approve attendance regularization", category: "HR Operations", frRef: "AT-13" },

  // ─── Leave ────────────────────────────────────────────────
  { name: "leave.create",  slug: "leave.create",  module: "leave", action: "create",  label: "Apply Leave",         scope: ["unit"],                    description: "Apply for leave", category: "HR Operations", frRef: "L-01" },
  { name: "leave.read",    slug: "leave.read",    module: "leave", action: "read",    label: "View Leave",          scope: ["org", "company", "unit"],  description: "View leave requests and balances", category: "HR Operations", frRef: "L-04" },
  { name: "leave.update",  slug: "leave.update",  module: "leave", action: "update",  label: "Edit Leave",          scope: ["unit", "company"],         description: "Update / cancel a leave request", category: "HR Operations", frRef: null },
  { name: "leave.delete",  slug: "leave.delete",  module: "leave", action: "delete",  label: "Delete Leave",        scope: ["unit"],                    description: "Delete a leave request", category: "HR Operations", frRef: null },
  { name: "leave.approve", slug: "leave.approve", module: "leave", action: "approve", label: "Approve Leave",       scope: ["unit", "company"],         description: "Approve or reject leave requests", category: "HR Operations", frRef: "L-05" },

  // ─── Payroll ──────────────────────────────────────────────
  { name: "payroll.create", slug: "payroll.create", module: "payroll", action: "create", label: "Create Payroll",    scope: ["unit", "company"],         description: "Run payroll / create payroll records", category: "Payroll", frRef: null },
  { name: "payroll.read",   slug: "payroll.read",   module: "payroll", action: "read",   label: "View Payroll",      scope: ["org", "company", "unit"],  description: "View payroll and payslips", category: "Payroll", frRef: "P-17" },
  { name: "payroll.update", slug: "payroll.update", module: "payroll", action: "update", label: "Edit Payroll",      scope: ["unit", "company"],         description: "Update payroll records", category: "Payroll", frRef: null },
  { name: "payroll.delete", slug: "payroll.delete", module: "payroll", action: "delete", label: "Delete Payroll",    scope: ["unit"],                    description: "Delete payroll records", category: "Payroll", frRef: null },
  { name: "payroll.run",    slug: "payroll.run",    module: "payroll", action: "run",    label: "Run Payroll",       scope: ["unit", "company"],         description: "Execute payroll run", category: "Payroll", frRef: "P-14" },

  // ─── Company ──────────────────────────────────────────────
  { name: "company.create", slug: "company.create", module: "company", action: "create", label: "Create Company",   scope: ["org"],                     description: "Create a company under org", category: "Organisation", frRef: null },
  { name: "company.read",   slug: "company.read",   module: "company", action: "read",   label: "View Companies",   scope: ["org", "company"],          description: "View company details", category: "Organisation", frRef: null },
  { name: "company.update", slug: "company.update", module: "company", action: "update", label: "Edit Company",     scope: ["org", "company"],          description: "Update company settings", category: "Organisation", frRef: null },

  // ─── Organisation (Enterprise only) ───────────────────────
  { name: "org.create", slug: "org.create", module: "organisation", action: "create", label: "Create Organisation",  scope: ["org"],  description: "Create organisation", category: "Organisation", frRef: null },
  { name: "org.read",   slug: "org.read",   module: "organisation", action: "read",   label: "View Organisation",    scope: ["org"],  description: "View organisation details", category: "Organisation", frRef: null },
  { name: "org.update", slug: "org.update", module: "organisation", action: "update", label: "Edit Organisation",    scope: ["org"],  description: "Update organisation settings", category: "Organisation", frRef: null },

  // ─── LOB (Enterprise only) ────────────────────────────────
  { name: "lob.create", slug: "lob.create", module: "organisation", action: "create", label: "Create LOB",    scope: ["company"],          description: "Create a Line of Business", category: "Organisation", frRef: null },
  { name: "lob.read",   slug: "lob.read",   module: "organisation", action: "read",   label: "View LOBs",     scope: ["org", "company"],   description: "View Lines of Business", category: "Organisation", frRef: null },
  { name: "lob.update", slug: "lob.update", module: "organisation", action: "update", label: "Edit LOB",      scope: ["company"],          description: "Update a Line of Business", category: "Organisation", frRef: null },
  { name: "lob.delete", slug: "lob.delete", module: "organisation", action: "delete", label: "Delete LOB",    scope: ["company"],          description: "Delete a Line of Business", category: "Organisation", frRef: null },

  // ─── Unit ─────────────────────────────────────────────────
  { name: "unit.create", slug: "unit.create", module: "organisation", action: "create", label: "Create Unit",   scope: ["company"],          description: "Create a unit", category: "Organisation", frRef: "O-03" },
  { name: "unit.read",   slug: "unit.read",   module: "organisation", action: "read",   label: "View Units",    scope: ["org", "company", "unit"], description: "View units", category: "Organisation", frRef: null },
  { name: "unit.update", slug: "unit.update", module: "organisation", action: "update", label: "Edit Unit",     scope: ["company"],          description: "Update a unit", category: "Organisation", frRef: null },
  { name: "unit.delete", slug: "unit.delete", module: "organisation", action: "delete", label: "Delete Unit",   scope: ["company"],          description: "Delete a unit", category: "Organisation", frRef: null },

  // ─── Holiday ──────────────────────────────────────────────
  { name: "holiday.create", slug: "holiday.create", module: "holiday", action: "create", label: "Create Holiday",   scope: ["company"],          description: "Create a holiday", category: "HR Operations", frRef: null },
  { name: "holiday.read",   slug: "holiday.read",   module: "holiday", action: "read",   label: "View Holidays",    scope: ["org", "company", "unit"], description: "View holidays", category: "HR Operations", frRef: null },
  { name: "holiday.update", slug: "holiday.update", module: "holiday", action: "update", label: "Edit Holiday",     scope: ["company"],          description: "Update a holiday", category: "HR Operations", frRef: null },
  { name: "holiday.delete", slug: "holiday.delete", module: "holiday", action: "delete", label: "Delete Holiday",   scope: ["company"],          description: "Delete a holiday", category: "HR Operations", frRef: null },

  // ─── Leave Policy ─────────────────────────────────────────
  { name: "leavePolicy.create", slug: "leavePolicy.create", module: "leavePolicy", action: "create", label: "Create Leave Policy",   scope: ["company", "unit"],  description: "Create a leave policy", category: "HR Operations", frRef: null },
  { name: "leavePolicy.read",   slug: "leavePolicy.read",   module: "leavePolicy", action: "read",   label: "View Leave Policies",   scope: ["org", "company", "unit"], description: "View leave policies", category: "HR Operations", frRef: null },
  { name: "leavePolicy.update", slug: "leavePolicy.update", module: "leavePolicy", action: "update", label: "Edit Leave Policy",     scope: ["company", "unit"],  description: "Update a leave policy", category: "HR Operations", frRef: null },
  { name: "leavePolicy.delete", slug: "leavePolicy.delete", module: "leavePolicy", action: "delete", label: "Delete Leave Policy",   scope: ["company"],          description: "Delete a leave policy", category: "HR Operations", frRef: null },

  // ─── Attendance Policy ────────────────────────────────────
  { name: "attendancePolicy.create", slug: "attendancePolicy.create", module: "attendancePolicy", action: "create", label: "Create Attendance Policy",  scope: ["company", "unit"],  description: "Create attendance policy", category: "HR Operations", frRef: null },
  { name: "attendancePolicy.read",   slug: "attendancePolicy.read",   module: "attendancePolicy", action: "read",   label: "View Attendance Policies",  scope: ["org", "company", "unit"], description: "View attendance policies", category: "HR Operations", frRef: null },
  { name: "attendancePolicy.update", slug: "attendancePolicy.update", module: "attendancePolicy", action: "update", label: "Edit Attendance Policy",    scope: ["company", "unit"],  description: "Update attendance policy", category: "HR Operations", frRef: null },
  { name: "attendancePolicy.delete", slug: "attendancePolicy.delete", module: "attendancePolicy", action: "delete", label: "Delete Attendance Policy",  scope: ["company"],          description: "Delete attendance policy", category: "HR Operations", frRef: null },

  // ─── Payroll Policy ───────────────────────────────────────
  { name: "payrollPolicy.create", slug: "payrollPolicy.create", module: "payrollPolicy", action: "create", label: "Create Payroll Policy",  scope: ["company", "unit"],  description: "Create payroll policy", category: "Payroll", frRef: null },
  { name: "payrollPolicy.read",   slug: "payrollPolicy.read",   module: "payrollPolicy", action: "read",   label: "View Payroll Policies",  scope: ["org", "company", "unit"], description: "View payroll policies", category: "Payroll", frRef: null },
  { name: "payrollPolicy.update", slug: "payrollPolicy.update", module: "payrollPolicy", action: "update", label: "Edit Payroll Policy",    scope: ["company", "unit"],  description: "Update payroll policy", category: "Payroll", frRef: null },
  { name: "payrollPolicy.delete", slug: "payrollPolicy.delete", module: "payrollPolicy", action: "delete", label: "Delete Payroll Policy",  scope: ["company"],          description: "Delete payroll policy", category: "Payroll", frRef: null },

  // ─── Subscription (Product Admin / Org Admin) ─────────────
  { name: "subscription.read",   slug: "subscription.read",   module: "subscription", action: "read",   label: "View Subscription",    scope: ["org"],  description: "View subscription details", category: "Configuration", frRef: null },
  { name: "subscription.update", slug: "subscription.update", module: "subscription", action: "update", label: "Manage Subscription",  scope: ["org"],  description: "Upgrade or cancel subscription", category: "Configuration", frRef: null },

  // ─── Plan (Product Admin only) ────────────────────────────
  { name: "plan.create", slug: "plan.create", module: "plan", action: "create", label: "Create Plan",   scope: ["org"],  description: "Create a pricing plan", category: "Configuration", frRef: null },
  { name: "plan.read",   slug: "plan.read",   module: "plan", action: "read",   label: "View Plans",    scope: ["org"],  description: "View pricing plans", category: "Configuration", frRef: null },
  { name: "plan.update", slug: "plan.update", module: "plan", action: "update", label: "Edit Plan",     scope: ["org"],  description: "Update a pricing plan", category: "Configuration", frRef: null },
  { name: "plan.delete", slug: "plan.delete", module: "plan", action: "delete", label: "Delete Plan",   scope: ["org"],  description: "Deprecate a pricing plan", category: "Configuration", frRef: null },


  // ─── Shift ────────────────────────────────────────────────
{ name: "shift.create", slug: "shift.create", module: "shift", action: "create", label: "Create Shift", scope: ["company", "unit"], description: "Create a shift", category: "HR Operations", frRef: null },
{ name: "shift.read",   slug: "shift.read",   module: "shift", action: "read",   label: "View Shifts",  scope: ["org", "company", "unit"], description: "View shifts", category: "HR Operations", frRef: null },
{ name: "shift.update", slug: "shift.update", module: "shift", action: "update", label: "Edit Shift",   scope: ["company", "unit"], description: "Update a shift", category: "HR Operations", frRef: null },
{ name: "shift.delete", slug: "shift.delete", module: "shift", action: "delete", label: "Delete Shift", scope: ["company", "unit"], description: "Delete a shift", category: "HR Operations", frRef: null },

// ─── Roster ───────────────────────────────────────────────
{ name: "roster.create", slug: "roster.create", module: "roster", action: "create", label: "Assign Roster", scope: ["company", "unit"], description: "Assign roster to employee", category: "HR Operations", frRef: null },
{ name: "roster.read",   slug: "roster.read",   module: "roster", action: "read",   label: "View Roster",   scope: ["org", "company", "unit"], description: "View roster", category: "HR Operations", frRef: null },
{ name: "roster.update", slug: "roster.update", module: "roster", action: "update", label: "Edit Roster",   scope: ["company", "unit"], description: "Update roster", category: "HR Operations", frRef: null },
{ name: "roster.delete", slug: "roster.delete", module: "roster", action: "delete", label: "Delete Roster", scope: ["company", "unit"], description: "Delete roster", category: "HR Operations", frRef: null },

// ─── Delegation ───────────────────────────────────────────
{ name: "delegation.create", slug: "delegation.create", module: "delegation", action: "create", label: "Create Delegation", scope: ["org", "company", "unit"], description: "Delegate permissions", category: "Configuration", frRef: null },
{ name: "delegation.read",   slug: "delegation.read",   module: "delegation", action: "read",   label: "View Delegations",  scope: ["org", "company", "unit"], description: "View delegations", category: "Configuration", frRef: null },
{ name: "delegation.update", slug: "delegation.update", module: "delegation", action: "update", label: "Edit Delegation",   scope: ["org", "company", "unit"], description: "Update delegation", category: "Configuration", frRef: null },
{ name: "delegation.delete", slug: "delegation.delete", module: "delegation", action: "delete", label: "Revoke Delegation", scope: ["org", "company", "unit"], description: "Revoke delegation", category: "Configuration", frRef: null },

// ─── Notification ─────────────────────────────────────────
{ name: "notification.read",   slug: "notification.read",   module: "notification", action: "read",   label: "View Notifications",   scope: ["org", "company", "unit"], description: "View notifications", category: "Configuration", frRef: null },
{ name: "notification.update", slug: "notification.update", module: "notification", action: "update", label: "Manage Notifications", scope: ["org", "company", "unit"], description: "Mark notifications read", category: "Configuration", frRef: null },

// ─── Audit Log ────────────────────────────────────────────
{ name: "auditLog.read", slug: "auditLog.read", module: "auditLog", action: "read", label: "View Audit Logs", scope: ["org", "company", "unit"], description: "View audit trail", category: "Configuration", frRef: null },

];

exports.seedPermissions = async () => {
  try {

    let inserted = 0;

    for (const perm of permissions) {

      await Permission.updateOne(
        { name: perm.name },
        { $set: perm },
        { upsert: true }
      );

      inserted++;
    }

    console.log(`✅ Permissions seeded — ${inserted} synced`);

  } catch (error) {
    console.error("❌ Permission seeder failed:", error.message);
  }
};