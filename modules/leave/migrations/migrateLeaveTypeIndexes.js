const mongoose = require("mongoose");

/**
 * Replaces stale Leave Type unique indexes with the soft-delete-aware schema index.
 */
module.exports = async function migrateLeaveTypeIndexes() {
  try {
    const db = mongoose.connection.db;
    if (!db) return;

    const collection = db.collection("leavetypes");
    const indexes = await collection.indexes();
    const expectedName = "org_id_1_company_id_1_code_1";

    for (const index of indexes) {
      const isCodeUniqueIndex = index.unique && Object.hasOwn(index.key, "code");
      if (isCodeUniqueIndex && index.name !== expectedName) {
        await collection.dropIndex(index.name);
        console.log(`[Migration] Dropped stale Leave Type index ${index.name}`);
      }
    }

    const expectedIndex = indexes.find((index) => index.name === expectedName);
    const isExpectedPartial = expectedIndex?.partialFilterExpression?.isDeleted === false;
    if (expectedIndex && !isExpectedPartial) {
      await collection.dropIndex(expectedName);
    }

    await collection.createIndex(
      { org_id: 1, company_id: 1, code: 1 },
      {
        unique: true,
        partialFilterExpression: { isDeleted: false },
        name: expectedName,
      }
    );
    console.log("[Migration] Leave Type unique index is current");
  } catch (error) {
    console.error("[Migration] Leave Type index migration failed:", error.message);
  }
};