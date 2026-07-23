require('dotenv').config();
require('./config/db')();

// Run migrations after DB connects
const mongoose = require('mongoose');
mongoose.connection.once('open', async () => {
  console.log('📦 Running database migrations...');
  const dropTenantIdIndex = require('./modules/companyConfig/migrations/dropTenantIdIndex');
  await dropTenantIdIndex();
  
  // Fix leave type employment types
  const migrateEmploymentTypes = require('./migrations/fix-leave-type-employment');
  await migrateEmploymentTypes();

  // Drop stale non-partial unique index on designations (fixes
  // "duplicate key" error when re-adding a designation name after
  // the original was soft-deleted)
  const migrateDesignationIndexes = require('./modules/designation/migrations/dropDesignationNameIndex');
  await migrateDesignationIndexes();
});

const app = require('./app');

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});