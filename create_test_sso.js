const mongoose = require('mongoose');
const SSOConnection = require('./modules/auth/SSO/models/sso-connection.model');
const { ObjectId } = mongoose.Types;

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/hrms')
  .then(async () => {
    console.log('✅ Connected to MongoDB');
    
    // Get first organization
    const org = await mongoose.connection.db.collection('organizations').findOne({});
    
    if (!org) {
      console.log('❌ No organization found. Please create one first.');
      process.exit(1);
    }
    
    console.log('Using organization:', org._id, org.name);
    
    // Create test SSO connection
    const ssoConnection = await SSOConnection.create({
      org_id: org._id,
      connectionId: 'conn_test_' + Date.now(),
      domain: 'testcompany.com',
      provider: 'saml',
      active: true
    });
    
    console.log('\n✅ Test SSO Connection Created:');
    console.log(JSON.stringify(ssoConnection.toObject(), null, 2));
    
    console.log('\n🧪 Now test SSO with:');
    console.log('   Email: anything@testcompany.com');
    console.log('\nOr use curl:');
    console.log('   curl -X POST http://localhost:5000/api/v1/auth/sso/login \\');
    console.log('     -H "Content-Type: application/json" \\');
    console.log('     -d \'{"email":"test@testcompany.com"}\'');
    
    mongoose.connection.close();
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });
