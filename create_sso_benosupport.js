const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://workprakhar9805_db_user:frPJmV3gDExUypUJ@cluster0.9m2axyw.mongodb.net/test?retryWrites=true&w=majority';

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB Atlas');
    
    // Get organizations collection
    const db = mongoose.connection.db;
    
    // Find first organization
    const org = await db.collection('organizations').findOne({});
    
    if (!org) {
      console.log('❌ No organization found');
      process.exit(1);
    }
    
    console.log('Using organization:', org._id, org.name || 'N/A');
    
    // Create SSO connection
    const ssoConnection = {
      org_id: org._id,
      connectionId: 'conn_beno_' + Date.now(),
      domain: 'benosupport.com',
      provider: 'saml',
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await db.collection('sso_connections').insertOne(ssoConnection);
    
    console.log('\n✅ SSO Connection Created Successfully!');
    console.log('Domain: benosupport.com');
    console.log('Connection ID:', ssoConnection.connectionId);
    
    console.log('\n🧪 Now you can test SSO with:');
    console.log('   Email: anything@benosupport.com');
    console.log('\nExample:');
    console.log('   curl -X POST http://localhost:5000/api/v1/auth/sso/login \\');
    console.log('     -H "Content-Type: application/json" \\');
    console.log('     -d \'{"email":"vibhav@benosupport.com"}\'');
    
    mongoose.connection.close();
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });
