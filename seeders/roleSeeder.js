// seeders/roleSeeder.js
//
// REWRITTEN — 8 system roles for BenoSupport hierarchy
//
// Run order: moduleSeeder → planSeeder → permissionSeeder → roleSeeder
//
// Roles:
//   Org Level    → org_admin, org_auditor
//   Company Level → company_admin, company_hr_manager
//   Unit Level   → unit_admin, hr_manager, manager, employee
//
// All system roles have org_id: null, company_id: null, unit_id: null
// isSystem: true — cannot be edited or deleted by customer admins

const Role       = require("../modules/role/role.model");
const Permission = require("../modules/permission/permission.model");

exports.seedRoles = async () => {
  try {
    // Fetch all permissions from DB
    const allPerms = await Permission.find({}, "_id slug");

    if (!allPerms.length) {
      console.warn("⚠️  No permissions found. Run seedPermissions() first.");
      return;
    }

    // Helper — get permission ObjectIds by slugs
    const getIds = (slugs) => {
      const ids = [];
      for (const slug of slugs) {
        const found = allPerms.find((p) => p.slug === slug);
        if (found) {
          ids.push(found._id);
        } else {
          console.warn(`  ⚠️  Permission not found: "${slug}"`);
        }
      }
      return ids;
    };

    // All permission slugs
   const allSlugs = allPerms
  .map((p) => p.slug)
  .filter(Boolean);

// Only .read permission slugs
const readOnlySlugs = allSlugs.filter(
  (s) => typeof s === "string" && s.endsWith(".read")
);

    // ── Role definitions ──────────────────────────────────────

    const roles = [

      // ── ORG LEVEL ─────────────────────────────────────────

      {
        name:        "Org Admin",
        slug:        "org_admin",
        level:       "org",
        userClass:   "Administrative",
        modules:     ["hrms","crm","sales","bd","admin","organisation"],
        description: "Full access across entire organisation. Creates companies, assigns Company Admins, controls module access.",
        permissions: getIds(allSlugs),
        isSystem:    true,
        org_id:      null,
        company_id:  null,
        unit_id:     null,
      },

      {
        name:        "Org Auditor",
        slug:        "org_auditor",
        level:       "org",
        userClass:   "Privilege",
        modules:     ["hrms","organisation"],
        description: "Read-only access across entire organisation. For compliance and internal audit. Cannot modify anything.",
        permissions: getIds(readOnlySlugs),
        isSystem:    true,
        org_id:      null,
        company_id:  null,
        unit_id:     null,
      },

      // ── COMPANY LEVEL ─────────────────────────────────────

      {
        name:        "Company Admin",
        slug:        "company_admin",
        level:       "company",
        userClass:   "Administrative",
        modules:     ["hrms","crm","sales","bd","admin","organisation"],
        description: "Full access at company level. Creates LOBs and units, assigns Unit Admins, controls module access per unit.",
        permissions: getIds([
          "employee.create", "employee.read", "employee.update", "employee.delete",
          "attendance.create", "attendance.read", "attendance.update", "attendance.delete", "attendance.approve",
          "leave.create", "leave.read", "leave.update", "leave.delete", "leave.approve",
          "payroll.create", "payroll.read", "payroll.update", "payroll.delete", "payroll.run",
          "department.create", "department.read", "department.update", "department.delete",
          "designation.create", "designation.read", "designation.update", "designation.delete",
          "holiday.create", "holiday.read", "holiday.update", "holiday.delete",
          "leavepolicy.create", "leavepolicy.read", "leavepolicy.update", "leavepolicy.delete",
"attendancepolicy.create", "attendancepolicy.read", "attendancepolicy.update", "attendancepolicy.delete",
"payrollpolicy.create", "payrollpolicy.read", "payrollpolicy.update", "payrollpolicy.delete",
"auditlog.read",
          "role.create", "role.read", "role.update", "role.delete",
          "user.create", "user.read", "user.update", "user.delete",
          "company.read", "company.update",
          "lob.create", "lob.read", "lob.update", "lob.delete",
          "unit.create", "unit.read", "unit.update", "unit.delete",
          "subscription.read","shift.create", "shift.read", "shift.update", "shift.delete",
"roster.create", "roster.read", "roster.update", "roster.delete",
"delegation.create", "delegation.read", "delegation.update", "delegation.delete",
"notification.read", "notification.update",
"auditLog.read",
        ]),
        isSystem:    true,
        org_id:      null,
        company_id:  null,
        unit_id:     null,
      },

      {
        name:        "Company HR Manager",
        slug:        "company_hr_manager",
        level:       "company",
        userClass:   "Administrative",
        modules:     ["hrms","admin"],
        description: "Manages HR data across all units in the company. Cannot change structure or modules.",
        permissions: getIds([
          "employee.create", "employee.read", "employee.update", "employee.delete",
          "attendance.create", "attendance.read", "attendance.update", "attendance.approve",
          "leave.create", "leave.read", "leave.update", "leave.approve",
          "payroll.read", "payroll.run",
          "department.read",
          "designation.read",
          "holiday.read",
          "leavePolicy.read",
          "attendancePolicy.read",
          "payrollPolicy.read",
        ]),
        isSystem:    true,
        org_id:      null,
        company_id:  null,
        unit_id:     null,
      },

      // ── UNIT LEVEL ────────────────────────────────────────

      {
        name: "Unit Admin",
        slug: "unit_admin",
        level: "unit",
        userClass: "Administrative",
        modules:   ["hrms","admin"],
        description: "Full access at unit level. Creates HR and Manager roles, manages employees, configures leave and attendance policies.",
        permissions: getIds([
          "employee.create", "employee.read", "employee.update", "employee.delete",
          "attendance.create", "attendance.read", "attendance.update", "attendance.approve",
          "leave.create", "leave.read", "leave.update", "leave.approve",
          "payroll.read", "payroll.run",
          "department.read",
          "designation.read",
          "holiday.read",
          "leavePolicy.create", "leavePolicy.read", "leavePolicy.update", "leavePolicy.delete",
          "attendancePolicy.create", "attendancePolicy.read", "attendancePolicy.update", "attendancePolicy.delete",
          "payrollPolicy.create", "payrollPolicy.read", "payrollPolicy.update", "payrollPolicy.delete",
          "role.create", "role.read", "role.update", "role.delete",
          "user.create", "user.read", "user.update", "user.delete",
          "unit.read",
          "lob.read",
          "department.create",
          "department.update",
          "department.delete",
          "designation.create",
          "designation.update",
          "designation.delete","leavepolicy.create", "leavepolicy.read", "leavepolicy.update", "leavepolicy.delete",
"attendancepolicy.create", "attendancepolicy.read", "attendancepolicy.update", "attendancepolicy.delete",
"payrollpolicy.create", "payrollpolicy.read", "payrollpolicy.update", "payrollpolicy.delete",
"shift.create", "shift.read", "shift.update", "shift.delete",
"roster.create", "roster.read", "roster.update", "roster.delete",
"delegation.create", "delegation.read", "delegation.update", "delegation.delete",
"notification.read", "notification.update",
"auditlog.read",
"holiday.create", "holiday.update", "holiday.delete",
"biometric.read", "biometric.create", "biometric.update", "biometric.delete",
        ]),
        isSystem: true,
        org_id: null,
        company_id: null,
        unit_id: null,
      },

      {
        name:        "HR Manager",
        slug:        "hr_manager",
        level:       "unit",
        userClass:   "Administrative",
        modules:     ["hrms"],
        description: "Manages employees, leave, attendance and payroll within this unit.",
        permissions: getIds([
          "employee.create", "employee.read", "employee.update", "employee.delete",
          "attendance.create", "attendance.read", "attendance.update", "attendance.approve",
          "leave.create", "leave.read", "leave.update", "leave.approve",
          "payroll.create", "payroll.read", "payroll.run",
          "department.read",
          "designation.read",
          "holiday.read",
          "biometric.read", "biometric.create", "biometric.update",
        ]),
        isSystem:    true,
        org_id:      null,
        company_id:  null,
        unit_id:     null,
      },

      {
        name:        "Manager",
        slug:        "manager",
        level:       "unit",
        userClass:   "Privilege",
        modules:     ["hrms"],
        description: "Approves leave and attendance for their team. Views team reports. Cannot edit employee records. Can mark own attendance.",
        permissions: getIds([
          "attendance.create",    // Can punch in (own attendance)
          "attendance.read",      // Can view attendance (own + team)
          "attendance.update",    // Can punch out (own attendance)
          "attendance.approve",   // Can approve team attendance
          "employee.read",
          "leave.read", "leave.approve",
          "payroll.read",
          "department.read",
          "holiday.read",
        ]),
        isSystem:    true,
        org_id:      null,
        company_id:  null,
        unit_id:     null,
      },

      {
        name:        "Employee",
        slug:        "employee",
        level:       "unit",
        userClass:   "General",
        modules:     ["hrms"],
        description: "Self-service only. Apply leave, mark attendance, view own payslip and profile.",
        permissions: getIds([
          "attendance.create", "attendance.update", "attendance.read",  // Can punch in and out
          "leave.create", "leave.read",
          "payroll.read",
        ]),
        isSystem:    true,
        org_id:      null,
        company_id:  null,
        unit_id:     null,
      },

    ];

    // ── Upsert — safe to run multiple times ───────────────────
    let inserted = 0;
    let skipped  = 0;

    for (const role of roles) {
      const result = await Role.updateOne(
        { slug: role.slug, org_id: null },
        { $set: role },
        { upsert: true }
      );
      if (result.upsertedCount > 0) inserted++;
      else skipped++;
    }

    console.log(`✅ Roles seeded — ${inserted} inserted, ${skipped} already existed`);

  } catch (error) {
    console.error("❌ Role seeder failed:", error.message);
  }
};