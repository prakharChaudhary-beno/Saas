// Auto-migration: Drop old designation name index on server start
// This runs automatically when the backend starts
// Fixes "duplicate key" error when re-adding a designation name after soft-delete

const mongoose = require('mongoose');

module.exports = async function migrateDesignationIndexes() {
  try {
    const db = mongoose.connection.db;
    if (!db) {
      console.log('⏳ Database not connected yet, skipping designation migration');
      return;
    }

    const collection = db.collection('designations');

    // Try to drop the old stale unique index on designation name
    // This index doesn't account for soft-deleted documents, causing conflicts
    try {
      await collection.dropIndex('name_1_company_1');
      console.log('✅ [Migration] Dropped old name_1_company_1 index from designations');
    } catch (err) {
      // Index doesn't exist - that's fine
      if (err.code !== 27) {
        console.log('ℹ️  [Migration] Index name_1_company_1 already removed or doesn\'t exist');
      }
    }
  } catch (err) {
    console.error('⚠️  [Migration] Failed to drop designation index:', err.message);
    // Don't throw - allow server to continue starting
  }
};
