/**
 * Debug Script: Trace SSO Flow
 * Run: node scripts/debug-sso-flow.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const axios = require('axios');

dotenv.config({ path: '.env' });

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

// Models
const SSOState = mongoose.model('SSOState', new mongoose.Schema({
  state: String,
  org_id: mongoose.Schema.Types.ObjectId,
  connectionId: String,
  email: String,
  createdAt: Date,
  expiresAt: Date
}, { collection: 'sso_states' }));

async function debugSSOFlow() {
  try {
    console.log('\n=== 🔍 SSO Flow Debug ===\n');

    // Step 1: Initiate SSO Login
    console.log('1️⃣ Initiating SSO login...');
    const email = 'vibhav@benosupport.com';
    
    const loginResponse = await axios.post('http://localhost:5000/api/v1/auth/sso/login', 
      { email },
      { headers: { 'Content-Type': 'application/json' } }
    );
    
    console.log('\n✅ Login Response:');
    console.log('   Success:', loginResponse.data.success);
    console.log('   State:', loginResponse.data.state ? loginResponse.data.state.substring(0, 20) + '...' : 'MISSING');
    console.log('   URL:', loginResponse.data.authorizationUrl ? loginResponse.data.authorizationUrl.substring(0, 80) + '...' : 'MISSING');
    
    const { state, authorizationUrl } = loginResponse.data;
    
    if (!state) {
      console.log('\n❌ ERROR: No state returned from login endpoint');
      process.exit(1);
    }

    // Step 2: Check MongoDB for saved state
    console.log('\n2️⃣ Checking MongoDB for saved state...');
    const savedState = await SSOState.findOne({ state });
    
    if (savedState) {
      console.log('✅ State found in MongoDB:');
      console.log('   State ID:', savedState._id);
      console.log('   State:', savedState.state);
      console.log('   Org ID:', savedState.org_id);
      console.log('   Connection:', savedState.connectionId);
      console.log('   Email:', savedState.email);
      console.log('   Expires:', savedState.expiresAt);
    } else {
      console.log('❌ State NOT found in MongoDB');
      console.log('   This means state was not saved during login');
      
      // Check all recent states
      const recentStates = await SSOState.find({}).sort({ createdAt: -1 }).limit(5);
      console.log('\n   Recent states in DB:', recentStates.length);
      recentStates.forEach(s => {
        console.log(`   - State: ${s.state.substring(0, 20)}... | Org: ${s.org_id}`);
      });
    }

    // Step 3: Parse authorization URL
    console.log('\n3️⃣ Parsing authorization URL...');
    const url = new URL(authorizationUrl);
    const urlParams = {
      client_id: url.searchParams.get('client_id'),
      redirect_uri: url.searchParams.get('redirect_uri'),
      state: url.searchParams.get('state'),
      organization: url.searchParams.get('organization'),
    };
    
    console.log('   Client ID:', urlParams.client_id);
    console.log('   Redirect URI:', urlParams.redirect_uri);
    console.log('   State:', urlParams.state ? urlParams.state.substring(0, 20) + '...' : 'MISSING');
    console.log('   Organization:', urlParams.organization);

    // Step 4: Simulate WorkOS callback (requires actual auth code from WorkOS)
    console.log('\n4️⃣ Simulating callback...');
    console.log('   Note: This would require real WorkOS auth code after user login');
    console.log('   Callback URL format:', `${urlParams.redirect_uri}?code=WORKOS_CODE&state=${urlParams.state}`);

    // Step 5: Summary
    console.log('\n=== 📊 Summary ===\n');
    console.log('Frontend opens popup with URL:', authorizationUrl.substring(0, 100) + '...');
    console.log('User authenticates in popup (WorkOS Test IdP)');
    console.log('WorkOS redirects to callback URL with code and state');
    console.log('Backend receives: code + state');
    console.log('Backend validates state:', state.substring(0, 20) + '...');
    console.log('State in MongoDB:', savedState ? '✅ YES' : '❌ NO');
    
    if (!savedState) {
      console.log('\n❌ PROBLEM: State not saved to MongoDB');
      console.log('   Possible issues:');
      console.log('   1. SSOState.create() failed silently');
      console.log('   2. Wrong database connection');
      console.log('   3. Schema validation error');
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

// Run debug
debugSSOFlow();
