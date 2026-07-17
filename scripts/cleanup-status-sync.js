// /hrms-backend/scripts/cleanup-status-sync.js
// One-time script to fix existing status mismatches
// Run: node scripts/cleanup-status-sync.js

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../modules/auth/models/user.model');
const Employee = require('../modules/employee/models/employee.model');
const { mapEmployeeStatusToUser, mapUserStatusToEmployee } = require('../utils/statusSync');

async function cleanupStatusMismatches() {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URL;
    if (!mongoUri) {
      throw new Error('MONGODB_URI or MONGO_URL must be defined in .env');
    }
    
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected successfully!\n');
    
    console.log('Starting status synchronization cleanup...\n');
    console.log('=' .repeat(70));
    
    // Find all employees with linked userId
    const employees = await Employee.find({ 
      userId: { $ne: null }, 
      isDeleted: false 
    }).lean();
    
    let totalChecked = 0;
    let fixedEmployeeToUser = 0;
    let fixedUserToEmployee = 0;
    
    for (const employee of employees) {
      totalChecked++;
      
      const user = await User.findById(employee.userId).lean();
      if (!user) continue;
      
      const expectedUserStatus = mapEmployeeStatusToUser(employee.status);
      const expectedEmployeeStatus = mapUserStatusToEmployee(user.status);
      
      // Fix User if mismatch
      if (user.status !== expectedUserStatus) {
        console.log(`\n📡 FIXING User.status mismatch:`);
        console.log(`   Employee: ${employee.name} (${employee.employeeId})`);
        console.log(`   Employee.status: ${employee.status}`);
        console.log(`   User.status: ${user.status} → ${expectedUserStatus}`);
        
        await User.findByIdAndUpdate(user._id, { status: expectedUserStatus });
        fixedEmployeeToUser++;
        console.log('   ✅ Fixed');
      }
      
      // Fix Employee if mismatch
      if (employee.status !== expectedEmployeeStatus) {
        console.log(`\n📡 FIXING Employee.status mismatch:`);
        console.log(`   Employee: ${employee.name} (${employee.employeeId})`);
        console.log(`   User.status: ${user.status}`);
        console.log(`   Employee.status: ${employee.status} → ${expectedEmployeeStatus}`);
        
        await Employee.findByIdAndUpdate(employee._id, { status: expectedEmployeeStatus });
        fixedUserToEmployee++;
        console.log('   ✅ Fixed');
      }
    }
    
    console.log('\n' + '=' .repeat(70));
    console.log('\n📊 CLEANUP SUMMARY:');
    console.log(`   Total records checked:    ${totalChecked}`);
    console.log(`   User statuses fixed:      ${fixedEmployeeToUser}`);
    console.log(`   Employee statuses fixed:  ${fixedUserToEmployee}`);
    console.log('\n✅ Cleanup complete!\n');
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

cleanupStatusMismatches();
