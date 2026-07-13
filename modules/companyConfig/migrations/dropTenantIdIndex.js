// Auto-migration: Drop old tenantId index on server start
// This runs automatically when the backend starts

const mongoose = require('mongoose');

module.exports = async function migrateCompanyConfigIndexes() {
  try {
    const db = mongoose.connection.db;
    if (!db) {
      console.log('⏳ Database not connected yet, skipping migration');
      return;
    }

    const collection = db.collection('companyconfigs');

    // Try to drop the old tenantId index
    try {
      await collection.dropIndex('tenantId_1');
      console.log('✅ [Migration] Dropped old tenantId_1 index from companyconfigs');
    } catch (err) {
      // Index doesn't exist - that's fine
      if (err.code !== 27) {
        console.log('ℹ️  [Migration] Index tenantId_1 already removed or doesn\'t exist');
      }
    }
  } catch (err) {
    console.error('⚠️  [Migration] Failed to drop old index:', err.message);
    // Don't throw - allow server to continue starting
  }
};
