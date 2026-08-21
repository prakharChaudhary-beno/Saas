/**
 * Script to help set up REAL SSO connection
 * 
 * Steps:
 * 1. Go to https://dashboard.workos.com
 * 2. Navigate to SSO Connections
 * 3. Click "Create Connection"
 * 4. Choose your IdP (Okta, Azure AD, Google Workspace, etc.)
 * 5. Follow the setup wizard
 * 6. Copy the Organization ID (looks like: org_01ABC123XYZ...)
 * 7. Run this script with the real organization ID
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const readline = require('readline');

dotenv.config({ path: '.env' });

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

// SSO Connection Model
const ssoConnectionSchema = new mongoose.Schema({
  org_id: { type: mongoose.Schema.Types.ObjectId, required: true },
  connectionId: { type: String, required: true, unique: true },
  domain: { type: String, required: true },
  provider: { type: String, enum: ['okta', 'azure', 'google', 'onelogin', 'saml', 'mock'], required: true },
  environment: { type: String, enum: ['development', 'production'], default: 'development' },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { collection: 'ssoconnections' });

const SSOConnection = mongoose.model('SSOConnection', ssoConnectionSchema);

// Helper function to get organization ID
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function setupSSO() {
  try {
    console.log('\n====================================');
    console.log('🏢 SSO Connection Setup Helper');
    console.log('====================================\n');

    console.log('📋 Instructions:');
    console.log('1. Go to https://dashboard.workos.com');
    console.log('2. Navigate to "SSO" in sidebar');
    console.log('3. Click "Create Connection"');
    console.log('4. Choose your IdP (Okta, Azure AD, Google Workspace, etc.)');
    console.log('5. Follow the setup wizard');
    console.log('6. After completion, copy the Organization ID\n');

    console.log('Organization ID format: org_01ABC123XYZ...\n');

    const orgId = await question('Enter your Organization ID from WorkOS dashboard: ');
    
    if (!orgId || !orgId.startsWith('org_')) {
      console.log('\n❌ Invalid Organization ID. Must start with "org_"');
      rl.close();
      process.exit(1);
    }

    console.log('\n✅ Organization ID received:', orgId);

    // Ask for other details
    const domain = await question('Enter your company domain (e.g., company.com): ');
    const provider = await question('Enter IdP provider (okta/azure/google/onelogin/saml): ');
    const orgIdMongo = await question('Enter your MongoDB Organization ID: ');

    console.log('\n📝 Creating SSO connection...');
    console.log({
      organizationId: orgId,
      domain: domain,
      provider: provider,
      orgId: orgIdMongo
    });

    // Delete old test connection
    await SSOConnection.deleteMany({ connectionId: 'org_test_idp' });
    console.log('✅ Deleted old test connection');

    // Create new SSO connection
    const newConnection = await SSOConnection.create({
      org_id: orgIdMongo,
      connectionId: orgId, // This is the real WorkOS organization ID
      domain: domain,
      provider: provider,
      environment: 'development',
      active: true
    });

    console.log('\n✅ SSO Connection created successfully!');
    console.log('Connection ID:', newConnection.connectionId);
    console.log('Domain:', newConnection.domain);
    console.log('Provider:', newConnection.provider);

    console.log('\n🎯 Next steps:');
    console.log('1. Test SSO login: POST /api/v1/auth/sso/login');
    console.log('2. Email should use domain:', domain);
    console.log('3. WorkOS will redirect to your IdP login page');
    console.log('4. After authentication, user redirects back to your app\n');

    rl.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    rl.close();
    process.exit(1);
  }
}

// Run setup
setupSSO();
