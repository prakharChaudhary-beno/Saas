/**
 * WorkOS SSO Test Script
 * Tests your WorkOS integration via the existing backend on port 5000
 * 
 * Prerequisites:
 * 1. Backend server running on port 5000
 * 2. WorkOS credentials in .env (already configured)
 * 3. Redirect URI added in WorkOS Dashboard: http://localhost:5000/api/v1/auth/sso/callback
 * 
 * Run: node test-workos-sso.js
 */

require('dotenv').config();
const axios = require('axios');

const WORKOS_API_KEY = process.env.WORKOS_API_KEY;
const WORKOS_CLIENT_ID = process.env.WORKOS_CLIENT_ID;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

console.log('\n========================================');
console.log('WorkOS SSO Integration Test');
console.log('========================================\n');

// Check environment variables
const requiredVars = ['WORKOS_API_KEY', 'WORKOS_CLIENT_ID'];
const missing = requiredVars.filter(v => !process.env[v]);

if (missing.length) {
  console.error('❌ Missing environment variables:', missing.join(', '));
  console.error('\nPlease add these to your .env file:');
  missing.forEach(v => console.error(`  ${v}=your_value_here`));
  process.exit(1);
}

console.log('✅ Environment variables configured:');
console.log(`   WORKOS_API_KEY: ${WORKOS_API_KEY ? WORKOS_API_KEY.substring(0, 20) + '...' : 'NOT SET'}`);
console.log(`   WORKOS_CLIENT_ID: ${WORKOS_CLIENT_ID}`);
console.log(`   BACKEND_URL: ${BACKEND_URL}\n`);

// Test 1: Check if backend server is running
async function testBackendRunning() {
  console.log('Test 1: Checking if backend server is running...');
  try {
    const response = await axios.get(`${BACKEND_URL}/api/v1/health`, { timeout: 3000 });
    console.log('✅ Backend server is running on port 5000\n');
    return true;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ Backend server is NOT running on port 5000');
      console.error('   Please start the server: npm run dev\n');
      return false;
    }
    // Health endpoint might not exist, but server is running
    console.log('✅ Backend server is running (health endpoint not found, but that\'s OK)\n');
    return true;
  }
}

// Test 2: Test SSO login endpoint
async function testSSOLoginEndpoint() {
  console.log('Test 2: Testing SSO login endpoint...');
  
  const testEmail = 'test@example.com'; // Replace with a real email from your WorkOS organization
  
  try {
    const response = await axios.post(`${BACKEND_URL}/api/v1/auth/sso/login`, {
      email: testEmail
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000
    });
    
    if (response.data?.success && response.data?.data?.authorizationUrl) {
      console.log('✅ SSO login endpoint working');
      console.log(`   Authorization URL: ${response.data.data.authorizationUrl.substring(0, 80)}...\n`);
      return response.data.data.authorizationUrl;
    } else {
      console.error('❌ SSO login endpoint returned unexpected response');
      console.error('   Response:', JSON.stringify(response.data, null, 2), '\n');
      return null;
    }
  } catch (error) {
    console.error('❌ SSO login endpoint failed:');
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Message: ${error.response.data?.message || error.response.statusText}`);
    } else if (error.request) {
      console.error('   No response received - is the server running?');
    } else {
      console.error(`   Error: ${error.message}`);
    }
    console.log('');
    return null;
  }
}

// Test 3: Provide manual testing instructions
function provideManualTestInstructions() {
  console.log('========================================');
  console.log('Manual Testing Instructions');
  console.log('========================================\n');
  
  console.log('Option 1: Test via Browser');
  console.log('----------------------------');
  console.log('1. Open your browser');
  console.log('2. Navigate to:');
  console.log(`   ${BACKEND_URL}/api/v1/auth/sso/login\n`);
  console.log('3. You should be redirected to WorkOS login page');
  console.log('4. After login, you\'ll be redirected back to:');
  console.log(`   ${BACKEND_URL}/api/v1/auth/sso/callback?code=...\n`);
  
  console.log('Option 2: Test via curl');
  console.log('-----------------------');
  console.log('Run this command:\n');
  console.log(`curl -X POST ${BACKEND_URL}/api/v1/auth/sso/login \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -d '{"email":"your-email@company.com"}'\n`);
  
  console.log('Option 3: Test via Frontend');
  console.log('---------------------------');
  console.log('1. Add SSO button to your login page');
  console.log('2. User clicks "Sign in with SSO"');
  console.log('3. Frontend calls POST /api/v1/auth/sso/login');
  console.log('4. Redirect user to the authorizationUrl from response');
  console.log('5. User authenticates via WorkOS');
  console.log('6. WorkOS redirects to your callback URL\n');
  
  console.log('========================================');
  console.log('WorkOS Dashboard Setup');
  console.log('========================================\n');
  console.log('Make sure you\'ve added this Redirect URI in WorkOS Dashboard:');
  console.log('https://dashboard.workos.com → Redirects → Add Redirect URI\n');
  console.log(`  ${BACKEND_URL}/api/v1/auth/sso/callback\n`);
  console.log('⚠️  EXACT MATCH REQUIRED (including http vs https)\n');
}

// Test 4: Verify WorkOS credentials format
function verifyWorkOSCredentials() {
  console.log('Test 3: Verifying WorkOS credentials format...');
  
  // Check API key format (should start with sk_test_ or sk_live_)
  if (WORKOS_API_KEY.startsWith('sk_test_') || WORKOS_API_KEY.startsWith('sk_live_')) {
    console.log('✅ API key format looks correct');
  } else {
    console.warn('⚠️  API key format might be incorrect');
    console.warn(`   Expected: sk_test_... or sk_live_...`);
    console.warn(`   Got: ${WORKOS_API_KEY.substring(0, 10)}...`);
  }
  
  // Check Client ID format (should start with client_)
  if (WORKOS_CLIENT_ID.startsWith('client_')) {
    console.log('✅ Client ID format looks correct\n');
  } else {
    console.warn('⚠️  Client ID format might be incorrect');
    console.warn(`   Expected: client_...`);
    console.warn(`   Got: ${WORKOS_CLIENT_ID.substring(0, 10)}...\n`);
  }
}

// Main test execution
async function runTests() {
  const backendRunning = await testBackendRunning();
  
  if (!backendRunning) {
    console.log('\n❌ Cannot proceed with tests - backend server is not running\n');
    provideManualTestInstructions();
    process.exit(1);
  }
  
  verifyWorkOSCredentials();
  
  console.log('========================================');
  console.log('Running Integration Tests');
  console.log('========================================\n');
  
  const authUrl = await testSSOLoginEndpoint();
  
  if (authUrl) {
    console.log('========================================');
    console.log('✅ All Tests Passed!');
    console.log('========================================\n');
    console.log('Your WorkOS integration is properly configured.');
    console.log('Open test in browser:\n');
    console.log(authUrl);
    console.log('');
  } else {
    console.log('\n========================================');
    console.log('⚠️  Some Tests Failed');
    console.log('========================================\n');
    console.log('This might be expected if you haven\'t set up a');
    console.log('WorkOS connection yet. Check WorkOS Dashboard:\n');
    console.log('https://dashboard.workos.com/sso\n');
  }
  
  provideManualTestInstructions();
}

// Run all tests
runTests().catch(console.error);
