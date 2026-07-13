// Migration script to drop old tenantId index from CompanyConfig
// Run this ONCE to fix the duplicate key error

const mongoose = require('mongoose');
require('dotenv').config();

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms');
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('companyconfigs');

    // Get existing indexes
    const indexes = await collection.indexes();
    console.log('Existing indexes:', indexes);

    // Drop the old tenantId index if it exists
    try {
      await collection.dropIndex('tenantId_1');
      console.log('✅ Dropped old tenantId_1 index');
    } catch (err) {
      if (err.code === 27) {
        console.log('ℹ️  Index tenantId_1 does not exist (already dropped)');
      } else {
        throw err;
      }
    }

    // Verify the correct index exists
    const remainingIndexes = await collection.indexes();
    console.log('Remaining indexes:', remainingIndexes);

    // Ensure company_id_1 unique index exists
    const hasCompanyIdIndex = remainingIndexes.some(idx => idx.key && idx.key.company_id === 1);
    if (!hasCompanyIdIndex) {
      console.log('⚠️  company_id index not found, but schema defines it as unique');
      console.log('   The index will be created automatically on next insert');
    }

    console.log('\n✅ Migration complete! You can now use the companyConfig API.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

migrate();
