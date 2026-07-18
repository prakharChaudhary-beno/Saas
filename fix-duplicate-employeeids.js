// Migration script: Fix duplicate employeeIds within org/company/unit scope
// Run: node fix-duplicate-employeeids.js

require('dotenv').config();
const mongoose = require('mongoose');
const Employee = require('./modules/employee/models/employee.model');

async function fixDuplicates() {
  try {
    const MONGO_URI = process.env.MONGO_URI;
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Find all employees with duplicates
    const duplicates = await Employee.aggregate([
      {
        $group: {
          _id: {
            org_id: '$org_id',
            company_id: '$company_id',
            unit_id: '$unit_id',
            employeeId: '$employeeId'
          },
          count: { $sum: 1 },
          docs: { $push: '$_id' }
        }
      },
      {
        $match: { count: { $gt: 1 } }
      }
    ]);

    console.log(`\n📊 Found ${duplicates.length} groups with duplicate employeeIds`);

    if (duplicates.length === 0) {
      console.log('✅ No duplicates found!');
      process.exit(0);
    }

    // For each duplicate group, keep the oldest and rename others
    for (const group of duplicates) {
      const { org_id, company_id, unit_id, employeeId } = group._id;
      console.log(`\nProcessing duplicate: employeeId="${employeeId}" in org=${org_id}, company=${company_id}, unit=${unit_id}`);
      console.log(`  Found ${group.count} duplicates`);

      // Get all employees in this group sorted by createdAt (oldest first)
      const employees = await Employee.find({
        org_id,
        company_id,
        unit_id,
        employeeId
      }).sort({ createdAt: 1 });

      // Keep the first one (oldest), rename the rest
      for (let i = 1; i < employees.length; i++) {
        const emp = employees[i];
        const newEmployeeId = `${employeeId}_DUP${i}`;
        
        console.log(`  ❌ Renaming: ${emp.name} (${emp.employeeId}) → ${newEmployeeId}`);
        
        await Employee.findByIdAndUpdate(emp._id, { 
          employeeId: newEmployeeId 
        });
      }
    }

    console.log('\n✅ All duplicates have been renamed');
    console.log('⚠️  Note: You should manually review renamed employees and delete unwanted ones');

    // Now drop old index and create new one
    console.log('\n📦 Updating indexes...');
    
    try {
      await Employee.collection.dropIndex('org_id_1_company_id_1_employeeId_1');
      console.log('  ✓ Dropped old index: org_id_1_company_id_1_employeeId_1');
    } catch (err) {
      if (err.code !== 27) { // Ignore "index not found" error
        console.log('  ⚠️  Could not drop old index:', err.message);
      }
    }

    // Create new compound index with unit_id
    await Employee.collection.createIndex(
      { org_id: 1, company_id: 1, unit_id: 1, employeeId: 1 },
      { unique: true, background: true }
    );
    console.log('  ✓ Created new index: org_id_1_company_id_1_unit_id_1_employeeId_1');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixDuplicates();
