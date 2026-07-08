// Script to add shift and roster permissions to unit_admin role
// Run: node scripts/add-shift-permissions.js

const mongoose = require('mongoose');
const Role = require('../modules/role/role.model');
const Permission = require('../modules/permission/permission.model');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms';

const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
};

const addShiftPermissions = async () => {
  try {
    await connectDB();

    // Find shift and roster permissions
    const shiftPerms = await Permission.find({
      slug: { $in: ['shift.create', 'shift.read', 'shift.update', 'shift.delete'] }
    });
    
    const rosterPerms = await Permission.find({
      slug: { $in: ['roster.create', 'roster.read', 'roster.update', 'roster.delete'] }
    });

    console.log(` Found ${shiftPerms.length} shift permissions`);
    console.log(`Found ${rosterPerms.length} roster permissions`);

    if (shiftPerms.length === 0 || rosterPerms.length === 0) {
      console.error('❌ Shift/Roster permissions not found. Run permission seeder first.');
      process.exit(1);
    }

    const allPermIds = [...shiftPerms.map(p => p._id), ...rosterPerms.map(p => p._id)];

    // Update unit_admin role
    const result = await Role.findOneAndUpdate(
      { slug: 'unit_admin' },
      { $addToSet: { permissions: { $each: allPermIds } } },
      { new: true }
    );

    if (!result) {
      console.error('❌ unit_admin role not found');
      process.exit(1);
    }

    console.log(`✅ Added shift+roster permissions to unit_admin role`);
    console.log(`   Total permissions: ${result.permissions.length}`);

    // Also update hr_manager role (should have shift.read at minimum)
    const hrManagerResult = await Role.findOneAndUpdate(
      { slug: 'hr_manager' },
      { 
        $addToSet: { 
          permissions: { 
            $each: [
              ...shiftPerms.filter(p => p.slug === 'shift.read').map(p => p._id),
              ...rosterPerms.filter(p => p.slug === 'roster.read').map(p => p._id)
            ] 
          } 
        } 
      },
      { new: true }
    );

    if (hrManagerResult) {
      console.log(`✅ Added shift.read+roster.read permissions to hr_manager role`);
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
};

addShiftPermissions();
