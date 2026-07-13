// Migration: Update existing LeaveTypes to include all employment types
// Run once to fix existing data

const mongoose = require('mongoose');
const LeaveType = require('../modules/leave/models/leaveType.models');

async function migrateEmploymentTypes() {
  try {
    const result = await LeaveType.updateMany(
      { 
        applicableEmploymentTypes: { $exists: true, $ne: ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"] }
      },
      {
        $set: {
          applicableEmploymentTypes: ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"]
        }
      }
    );
    
    console.log(`✅ Migration complete. Updated ${result.modifiedCount} leave types`);
    return result;
  } catch (err) {
    console.error('❌ Migration failed:', err);
    throw err;
  }
}

module.exports = migrateEmploymentTypes;
