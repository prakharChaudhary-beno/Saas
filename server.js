require('dotenv').config();
require('./config/db')();

// Run migrations after DB connects
const mongoose = require('mongoose');
mongoose.connection.once('open', async () => {
  console.log('📦 Running database migrations...');
  const dropTenantIdIndex = require('./modules/companyConfig/migrations/dropTenantIdIndex');
  await dropTenantIdIndex();
});

const app = require('./app');

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});