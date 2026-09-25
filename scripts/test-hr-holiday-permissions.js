/**
 * Test script to verify HR Manager has holiday permissions
 * Run: node scripts/test-hr-holiday-permissions.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Role = require('../modules/role/role.model');
const Permission = require('../modules/permission/permission.model');

async function testHRHolidayPermissions() {
  try {
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get HR role with populated permissions
    const hrRole = await Role.findOne({ slug: 'hr_manager', isSystem: true })
      .populate('permissions');

    if (!hrRole) {
      throw new Error('HR Manager role not found');
    }

    console.log('📋 HR Manager Role Details:');
    console.log('   Name:', hrRole.name);
    console.log('   Level:', hrRole.level);
    console.log('   Total Permissions:', hrRole.permissions.length);
    console.log('');

    // Filter holiday permissions
    const holidayPerms = hrRole.permissions.filter(p =>
      p.slug && p.slug.startsWith('holiday.')
    );

    console.log('🎊 Holiday Permissions:');
    if (holidayPerms.length === 0) {
      console.log('   ❌ NO holiday permissions found');
    } else {
      holidayPerms.forEach(p => {
        console.log(`   ✅ ${p.slug}`);
      });
    }
    console.log('');

    // Expected holiday permissions
    const expected = ['holiday.create', 'holiday.read', 'holiday.update', 'holiday.delete'];
    const missing = expected.filter(slug =>
      !hrRole.permissions.some(p => p.slug === slug)
    );

    if (missing.length > 0) {
      console.log('⚠️  Missing permissions:', missing.join(', '));
      process.exit(1);
    } else {
      console.log('🎉 HR Manager has ALL holiday permissions needed!');
      console.log('');
      console.log('✨ HR can now:');
      console.log('   • Create holidays (holiday.create)');
      console.log('   • View holidays (holiday.read)');
      console.log('   • Update holidays (holiday.update)');
      console.log('   • Delete holidays (holiday.delete)');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testHRHolidayPermissions();
