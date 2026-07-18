// Update compound index to include unit_id for employeeId uniqueness
// Run: node update-employee-index.js

require('dotenv').config();
const mongoose = require('mongoose');

async function updateIndex() {
  try {
    const MONGO_URI = process.env.MONGO_URI;
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('employees');

    // Drop old index
    console.log('\n📦 Dropping old index: org_id_1_company_id_1_employeeId_1');
    try {
      await collection.dropIndex('org_id_1_company_id_1_employeeId_1');
      console.log('  ✓ Old index dropped');
    } catch (err) {
      if (err.code === 27) {
        console.log('  ⚠️  Index not found (already dropped)');
      } else {
        throw err;
      }
    }

    // Create new index with unit_id
    console.log('\n📦 Creating new index: org_id_1_company_id_1_unit_id_1_employeeId_1');
    await collection.createIndex(
      { org_id: 1, company_id: 1, unit_id: 1, employeeId: 1 },
      { unique: true, background: true }
    );
    console.log('  ✓ New index created');

    // Verify
    console.log('\n📋 Verifying indexes...');
    const indexes = await collection.indexes();
    const newIndex = indexes.find(idx => idx.name === 'org_id_1_company_id_1_unit_id_1_employeeId_1');
    
    if (newIndex) {
      console.log('  ✅ New index verified:');
      console.log(`     Keys: ${JSON.stringify(newIndex.key)}`);
      console.log(`     Unique: ${newIndex.unique}`);
    } else {
      console.log('  ❌ New index not found!');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

updateIndex();
