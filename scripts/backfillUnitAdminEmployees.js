/**
 * Migration Script: Backfill Employee Records for Unit Admins
 * 
 * This script creates Employee records for existing Unit Admin users
 * who don't have one. In a proper HRMS, all workers (including admins)
 * should have Employee records for:
 * - Attendance (punch in/out)
 * - Leave management
 * - Payroll
 * - Analytics/headcount
 * 
 * Run: node scripts/backfillUnitAdminEmployees.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../modules/auth/models/user.model');
const Employee = require('../modules/employee/models/employee.model');
const Role = require('../modules/role/role.model');
const Department = require('../modules/department/department.model');
const Designation = require('../modules/designation/designation.model');
const Company = require('../modules/company/models/company.model');
const Unit = require('../modules/unit/models/unit.model');

const MONGO_URI = (process.env.MONGO_URI || process.env.MONGODB_URI || '').trim();

async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
}

async function backfillUnitAdminEmployees() {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Find unit_admin role
    const unitAdminRole = await Role.findOne({ slug: 'unit_admin' }).session(session);
    if (!unitAdminRole) {
      throw new Error('Unit Admin role not found. Please run role seeders first.');
    }

    // 2. Find all Unit Admin users
    const unitAdminUsers = await User.find({
      roleId: unitAdminRole._id,
      is_deleted: false,
      unit_id: { $ne: null },
    }).session(session);

    console.log(`\n📋 Found ${unitAdminUsers.length} Unit Admin users`);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const user of unitAdminUsers) {
      try {
        // Check if Employee record already exists
        const existingEmployee = await Employee.findOne({
          $or: [
            { userId: user._id },
            { email: user.email }
          ]
        }).session(session);

        if (existingEmployee) {
          console.log(`⏭️  Skipping ${user.email} - Employee record already exists`);
          skipped++;
          continue;
        }

        // Get company and unit info
        const company = await Company.findById(user.company_id).session(session);
        const unit = await Unit.findById(user.unit_id).session(session);

        if (!company || !unit) {
          console.log(`⚠️  Skipping ${user.email} - Missing company or unit`);
          errors++;
          continue;
        }

        // Find or create "Administration" department
        let department = await Department.findOne({
          company_id: user.company_id,
          org_id: user.org_id,
          name: { $regex: '^(Administration|HR|Admin)$', $options: 'i' },
          is_deleted: false,
        }).session(session);

        if (!department) {
          const [createdDept] = await Department.create([{
            name: 'Administration',
            company_id: user.company_id,
            org_id: user.org_id,
            status: 'ACTIVE',
            created_by: user._id,
          }], { session });
          department = createdDept;
          console.log(`  📁 Created Department: Administration for company ${company.company_name}`);
        }

        // Find or create "Unit Admin" designation
        let designation = await Designation.findOne({
          company_id: user.company_id,
          org_id: user.org_id,
          name: { $regex: '^(Unit Admin|Admin|Manager)$', $options: 'i' },
          is_deleted: false,
        }).session(session);

        if (!designation) {
          const [createdDesig] = await Designation.create([{
            name: 'Unit Admin',
            company_id: user.company_id,
            org_id: user.org_id,
            status: 'ACTIVE',
            created_by: user._id,
          }], { session });
          designation = createdDesig;
          console.log(`  🎯 Created Designation: Unit Admin for company ${company.company_name}`);
        }

        // Generate employee ID
        const employeeCount = await Employee.countDocuments({
          org_id: user.org_id,
          company_id: user.company_id,
        }).session(session);
        const employeeId = `EMP${String(employeeCount + 1).padStart(5, '0')}`;

        // Create Employee record
        const [employee] = await Employee.create([{
          org_id: user.org_id,
          company_id: user.company_id,
          unit_id: user.unit_id,
          lob_id: unit.lob_id || null,
          userId: user._id,
          employeeId,
          name: user.name || user.email.split('@')[0],
          email: user.email,
          phone: user.phone || '0000000000',
          departmentId: department._id,
          designationId: designation._id,
          employmentType: 'FULL_TIME',
          joiningDate: user.createdAt || new Date(),
          status: user.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
          salary: {
            basic: 0,
            hra: 0,
            grossSalary: 0,
            netSalary: 0,
          },
        }], { session });

        console.log(`✅ Created Employee for ${user.email} (${employeeId})`);
        created++;

      } catch (err) {
        console.error(`❌ Error processing ${user.email}:`, err.message);
        errors++;
      }
    }

    await session.commitTransaction();
    session.endSession();

    console.log('\n' + '='.repeat(50));
    console.log('📊 Migration Summary:');
    console.log('   ✅ Created:', created);
    console.log('   ⏭️  Skipped (already exists):', skipped);
    console.log('   ❌ Errors:', errors);
    console.log('='.repeat(50) + '\n');

    process.exit(0);

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

// Run migration
(async () => {
  await connectDB();
  await backfillUnitAdminEmployees();
})();
