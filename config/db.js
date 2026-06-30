const mongoose = require('mongoose');
const { seedRoles }       = require('../seeders/roleSeeder');
const { seedPermissions } = require('../seeders/permission.Seeder');
const { seedModules }     = require('../seeders/module.Seeders');
const { seedPlans }       = require('../seeders/plan.Seeder');
const { seedHolidays }    = require('../seeders/holiday.Seeders');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/erp');
    console.log('✅ MongoDB connected');

    // ── Mongoose Query Logger (dev only) ──────────────────────
    if (process.env.NODE_ENV !== 'production') {
      mongoose.set('debug', (collectionName, method, query, doc) => {
        try {
          const safeQuery = JSON.stringify(query)
          const safeDoc   = doc && typeof doc === 'object' && Object.keys(doc).length
            ? JSON.stringify(doc)
            : ''
          console.log(
            `\x1b[35m  🍃 Mongoose:\x1b[0m \x1b[33m${collectionName}.${method}\x1b[0m`,
            safeQuery,
            safeDoc
          )
        } catch (e) {
          console.log(
            `\x1b[35m  🍃 Mongoose:\x1b[0m \x1b[33m${collectionName}.${method}\x1b[0m`,
            '[query not serializable — session or circular ref]'
          )
        }
      });
    }

    // ── Seeders ───────────────────────────────────────────────
    await seedModules();
    await seedPlans();
    await seedPermissions();
    await seedRoles();
    await seedHolidays();

  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;