/**
 * Quick script to update HR Manager role with holiday management permissions
 * Run: node scripts/update-hr-holiday-permissions.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Role = require('../modules/role/role.model');
const Permission = require('../modules/permission/permission.model');

async function updateHRHolidayPermissions() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find HR Manager role
    const hrRole = await Role.findOne({ slug: 'hr_manager', isSystem: true });
    if (!hrRole) {
      throw new Error('HR Manager role not found');
    }
    console.log('✅ Found HR Manager role:', hrRole._id);

    // Find holiday permissions
    const holidayPermissions = await Permission.find({
      slug: { $in: ['holiday.create', 'holiday.update', 'holiday.delete'] }
    });
    const missing = ['holiday.create', 'holiday.update', 'holiday.delete']
      .filter(slug => !holidayPermissions.some(permission => permission.slug === slug));
    if (missing.length > 0) {
      throw new Error(`Holiday permissions not found: ${missing.join(', ')}`);
    }
    console.log('✅ Found holiday permissions:', holidayPermissions.map(p => p.slug));

    // Add new permissions to HR role (avoid duplicates)
    const existingPermIds = hrRole.permissions.map(p => p.toString());
    const newPermIds = holidayPermissions
      .map(p => p._id.toString())
      .filter(id => !existingPermIds.includes(id));

    if (newPermIds.length === 0) {
      console.log('⚠️  HR role already has all holiday permissions');
      process.exit(0);
    }

    // Update HR role with new permissions
    hrRole.permissions = [...hrRole.permissions, ...newPermIds];
    await hrRole.save();

    console.log('✅ HR role updated with permissions:', holidayPermissions.map(p => p.slug));
    console.log('🎉 HR Manager can now create, update, and delete holidays!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

updateHRHolidayPermissions();
