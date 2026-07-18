// Check current indexes on employees collection
// Run: node check-indexes.js

require('dotenv').config();
const mongoose = require('mongoose');

async function checkIndexes() {
  try {
    const MONGO_URI = process.env.MONGO_URI;
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const indexes = await db.collection('employees').indexes();
    
    console.log('\n📋 Current indexes on employees collection:');
    indexes.forEach(idx => {
      console.log(`\n  ${idx.name}:`);
      console.log(`    Keys: ${JSON.stringify(idx.key)}`);
      if (idx.unique) console.log(`    Unique: true`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkIndexes();
