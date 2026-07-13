// seeders/enhancedModuleSeeder.js
//
// Enterprise Module Seeder
// Auto-creates modules based on permission definitions
// Links permissions to modules for dynamic UI rendering
//
// Run order: enhancedModuleSeeder → permissionSeeder → roleSeeder

const Module = require('../modules/module/models/module.model')
const Permission = require('../modules/permission/permission.model')

// ─── Module Definitions (Extended) ────────────────────────────────────

const MODULE_DEFINITIONS = [
  {
    slug: 'employee',
    name: 'Employee Management',
    description: 'Employee profiles, lifecycle, designations, documents',
    icon: 'tabler:users',
    color: '#4A90E2',
    order: 1,
    pages: [
      { path: '/users', label: 'Employee List', order: 1 },
      { path: '/users/bulk-import', label: 'Bulk Import', order: 2 },
      { path: '/users/view/[id]', label: 'Employee Details', order: 3 }
    ]
  },
  {
    slug: 'attendance',
    name: 'Attendance Management',
    description: 'Check-in/out, biometric, WFH, overtime, reports',
    icon: 'tabler:clock-check',
    color: '#7ED321',
    order: 2,
    pages: [
      { path: '/attendance/my', label: 'My Attendance', order: 1 },
      { path: '/attendance/team', label: 'Team Attendance', order: 2 },
      { path: '/attendance/regularisation', label: 'Regularisation', order: 3 }
    ]
  },
  {
    slug: 'leave',
    name: 'Leave Management',
    description: 'Leave types, policy, approval workflow, balance tracking',
    icon: 'tabler:calendar-user',
    color: '#F5A623',
    order: 3,
    pages: [
      { path: '/leaves', label: 'Leave Requests', order: 1 },
      { path: '/leaves/approvals', label: 'Approvals', order: 2 },
      { path: '/leaves/balance', label: 'Leave Balance', order: 3 }
    ]
  },
  {
    slug: 'payroll',
    name: 'Payroll Management',
    description: 'Salary structure, pay runs, payslips, TDS/PF/ESI',
    icon: 'tabler:cash',
    color: '#BD10E0',
    order: 4,
    pages: [
      { path: '/payroll/my', label: 'My Payslips', order: 1 },
      { path: '/payroll/salary-register', label: 'Salary Register', order: 2 },
      { path: '/payroll/run', label: 'Run Payroll', order: 3 },
      { path: '/payroll/history', label: 'Payroll History', order: 4 },
      { path: '/payroll/investment-declarations', label: 'Investment Declarations', order: 5 }
    ]
  },
  {
    slug: 'shift',
    name: 'Shift & Roster',
    description: 'Shift scheduling, roster management, shift swaps',
    icon: 'tabler:clock',
    color: '#50E3C2',
    order: 5,
    pages: [
      { path: '/shift', label: 'Shift List', order: 1 },
      { path: '/shift/calendar', label: 'Shift Calendar', order: 2 },
      { path: '/shift/swaps', label: 'Shift Swaps', order: 3 },
      { path: '/shift/roster', label: 'Roster Assignment', order: 4 }
    ]
  },
  {
    slug: 'holiday',
    name: 'Holiday Calendar',
    description: 'Company holidays, regional holidays, holiday policies',
    icon: 'tabler:calendar-event',
    color: '#E91E63',
    order: 6,
    pages: [
      { path: '/holidays', label: 'Holiday Calendar', order: 1 },
      { path: '/holidays/policy', label: 'Holiday Policy', order: 2 }
    ]
  },
  {
    slug: 'role',
    name: 'Roles & Permissions',
    description: 'RBAC configuration, permission assignment, access control',
    icon: 'tabler:lock',
    color: '#9C27B0',
    order: 7,
    pages: [
      { path: '/admin/access-control', label: 'Access Control', order: 1 },
      { path: '/admin/access-control/roles', label: 'Roles', order: 2 },
      { path: '/admin/access-control/permissions', label: 'Permissions', order: 3 }
    ]
  },
  {
    slug: 'organisation',
    name: 'Organisation Setup',
    description: 'Org structure, companies, LOBs, units, departments',
    icon: 'tabler:building-skyscraper',
    color: '#FF5722',
    order: 8,
    pages: [
      { path: '/company', label: 'Companies', order: 1 },
      { path: '/units', label: 'Business Units', order: 2 },
      { path: '/department', label: 'Departments', order: 3 },
      { path: '/designation', label: 'Designations', order: 4 }
    ]
  },
  {
    slug: 'auth',
    name: 'Auth & User Management',
    description: 'User authentication, invitations, sessions, MFA',
    icon: 'tabler:lock-access',
    color: '#607D8B',
    order: 9,
    pages: [
      { path: '/admin-users', label: 'Admin Users', order: 1 },
      { path: '/invitations', label: 'Pending Invitations', order: 2 },
      { path: '/sessions', label: 'Active Sessions', order: 3 }
    ]
  },
  {
    slug: 'leavePolicy',
    name: 'Leave Policy',
    description: 'Leave policies, accrual rules, carry-forward settings',
    icon: 'tabler:file-text',
    color: '#FF9800',
    order: 10,
    pages: [
      { path: '/policy/leave', label: 'Leave Policy', order: 1 }
    ]
  },
  {
    slug: 'attendancePolicy',
    name: 'Attendance Policy',
    description: 'Attendance rules, grace periods, overtime policies',
    icon: 'tabler:file-check',
    color: '#4CAF50',
    order: 11,
    pages: [
      { path: '/policy/attendance', label: 'Attendance Policy', order: 1 }
    ]
  },
  {
    slug: 'payrollPolicy',
    name: 'Payroll Policy',
    description: 'Payroll settings, tax configurations, PF/ESI rules',
    icon: 'tabler:file-dollar',
    color: '#9C27B0',
    order: 12,
    pages: [
      { path: '/policy/payroll', label: 'Payroll Policy', order: 1 }
    ]
  },
  {
    slug: 'delegation',
    name: 'Delegation',
    description: 'Task delegation, approval delegation, transparency controls',
    icon: 'tabler:users-plus',
    color: '#00BCD4',
    order: 13,
    pages: [
      { path: '/delegation', label: 'My Delegations', order: 1 },
      { path: '/delegation/pending', label: 'Pending Approvals', order: 2 }
    ]
  },
  {
    slug: 'notification',
    name: 'Notifications',
    description: 'System notifications, email alerts, push notifications',
    icon: 'tabler:bell',
    color: '#FF5722',
    order: 14,
    pages: [
      { path: '/notifications', label: 'Notifications', order: 1 },
      { path: '/notifications/settings', label: 'Notification Settings', order: 2 }
    ]
  },
  {
    slug: 'auditLog',
    name: 'Audit Log',
    description: 'System audit trail, user activity logs, compliance reports',
    icon: 'tabler:history',
    color: '#795548',
    order: 15,
    pages: [
      { path: '/audit-log', label: 'Audit Log', order: 1 },
      { path: '/audit-log/user-activity', label: 'User Activity', order: 2 }
    ]
  }
]

// ─── Seed Function ────────────────────────────────────────────────────

const seedModules = async () => {
  try {
    console.log('🔄 Starting Enhanced Module Seeder...')

    for (const moduleDef of MODULE_DEFINITIONS) {
      // Create or update module
      const module = await Module.findOneAndUpdate(
        { slug: moduleDef.slug },
        {
          $set: {
            name: moduleDef.name,
            description: moduleDef.description,
            icon: moduleDef.icon,
            color: moduleDef.color,
            order: moduleDef.order || 99,
            pages: moduleDef.pages || [],
            is_active: true
          }
        },
        { upsert: true, new: true }
      )

      console.log(`✅ Module: ${module.name} (${module.slug})`)

      // Link permissions to this module
      const permissions = await Permission.find({ module: moduleDef.slug })
      
      if (permissions.length > 0) {
        await Module.updateOne(
          { _id: module._id },
          { $set: { permissions: permissions.map(p => p._id) } }
        )
        console.log(`   → Linked ${permissions.length} permissions`)
      }
    }

    // Create unknown modules for orphan permissions
    const allPermissions = await Permission.find({})
    const moduleSlugs = await Module.distinct('slug')
    
    const orphanModules = new Set(
      allPermissions
        .filter(p => !moduleSlugs.includes(p.module))
        .map(p => p.module)
    )

    for (const orphanModule of orphanModules) {
      console.log(`⚠️  Creating orphan module: ${orphanModule}`)
      
      const permissions = await Permission.find({ module: orphanModule })
      
      await Module.findOneAndUpdate(
        { slug: orphanModule },
        {
          $set: {
            name: orphanModule.charAt(0).toUpperCase() + orphanModule.slice(1),
            slug: orphanModule,
            description: `Auto-created module for ${orphanModule} permissions`,
            is_active: true,
            order: 99,
            permissions: permissions.map(p => p._id)
          }
        },
        { upsert: true }
      )
    }

    console.log('✅ Enhanced Module Seeder completed successfully')
    
    // Summary
    const totalModules = await Module.countDocuments({ is_active: true })
    const totalPermissions = await Permission.countDocuments()
    
    console.log(`\n📊 Summary:`)
    console.log(`   Total Modules: ${totalModules}`)
    console.log(`   Total Permissions: ${totalPermissions}`)
    
  } catch (error) {
    console.error('❌ Enhanced Module Seeder failed:', error.message)
    throw error
  }
}

// ─── Run if called directly ────────────────────────────────────────────

if (require.main === module) {
  seedModules()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err)
      process.exit(1)
    })
}

module.exports = seedModules
