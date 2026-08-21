#!/usr/bin/env node

/**
 * MongoDB SSO Connection Update Script
 * 
 * This script updates the SSO connection in MongoDB with real WorkOS connection IDs
 * 
 * Usage:
 * node update-sso-connection.js --dev conn_01M_YOUR_DEV_ID
 * node update-sso-connection.js --prod conn_01M_YOUR_PROD_ID
 * node update-sso-connection.js --both conn_01M_DEV_ID conn_01M_PROD_ID
 */

const { MongoClient, ObjectId } = require('mongodb');

// MongoDB connection string from .env
const MONGO_URI = 'mongodb+srv://workprakhar9805_db_user:frPJmV3gDExUypUJ@cluster0.9m2axyw.mongodb.net/test?retryWrites=true&w=majority';

// Organization ID from your setup
const ORG_ID = '6a44f2f900e74ed3ecb234d0';
const DOMAIN = 'benosupport.com';

async function updateSSOConnection() {
  const client = new MongoClient(MONGO_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db();
    const collection = db.collection('sso_connections');
    
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
      console.log('❗ Usage:');
      console.log('  node update-sso-connection.js --dev conn_01M_YOUR_DEV_ID');
      console.log('  node update-sso-connection.js --prod conn_01M_YOUR_PROD_ID');
      console.log('  node update-sso-connection.js --both conn_01M_DEV_ID conn_01M_PROD_ID\n');
      return;
    }
    
    const mode = args[0];
    
    if (mode === '--dev') {
      const devConnectionId = args[1];
      if (!devConnectionId || !devConnectionId.startsWith('conn_')) {
        console.log('❌ Invalid connection ID. Must start with "conn_"');
        return;
      }
      
      console.log(`📝 Updating DEVELOPMENT connection: ${devConnectionId}\n`);
      
      // Check if connection exists
      const existing = await collection.findOne({ domain: DOMAIN, environment: 'development' });
      
      if (existing) {
        // Update existing
        const result = await collection.updateOne(
          { domain: DOMAIN, environment: 'development' },
          { 
            $set: { 
              connectionId: devConnectionId,
              provider: 'mock',  // or 'saml'
              updatedAt: new Date()
            }
          }
        );
        console.log(`✅ Updated ${result.modifiedCount} document(s)`);
      } else {
        // Create new
        const result = await collection.insertOne({
          org_id: new ObjectId(ORG_ID),
          connectionId: devConnectionId,
          domain: DOMAIN,
          provider: 'mock',
          environment: 'development',
          active: true,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        console.log(`✅ Created new connection with ID: ${result.insertedId}`);
      }
      
    } else if (mode === '--prod') {
      const prodConnectionId = args[1];
      if (!prodConnectionId || !prodConnectionId.startsWith('conn_')) {
        console.log('❌ Invalid connection ID. Must start with "conn_"');
        return;
      }
      
      console.log(`📝 Updating PRODUCTION connection: ${prodConnectionId}\n`);
      
      // Check if connection exists
      const existing = await collection.findOne({ domain: DOMAIN, environment: 'production' });
      
      if (existing) {
        // Update existing
        const result = await collection.updateOne(
          { domain: DOMAIN, environment: 'production' },
          { 
            $set: { 
              connectionId: prodConnectionId,
              provider: 'saml',  // or 'okta', 'azure', 'google'
              updatedAt: new Date()
            }
          }
        );
        console.log(`✅ Updated ${result.modifiedCount} document(s)`);
      } else {
        // Create new
        const result = await collection.insertOne({
          org_id: new ObjectId(ORG_ID),
          connectionId: prodConnectionId,
          domain: DOMAIN,
          provider: 'saml',
          environment: 'production',
          active: true,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        console.log(`✅ Created new connection with ID: ${result.insertedId}`);
      }
      
    } else if (mode === '--both') {
      const devConnectionId = args[1];
      const prodConnectionId = args[2];
      
      if (!devConnectionId || !prodConnectionId) {
        console.log('❌ Both connection IDs required');
        return;
      }
      
      console.log(`📝 Updating BOTH connections:`);
      console.log(`   Dev: ${devConnectionId}`);
      console.log(`   Prod: ${prodConnectionId}\n`);
      
      // Delete existing connections for this domain
      await collection.deleteMany({ domain: DOMAIN });
      
      // Insert both connections
      const result = await collection.insertMany([
        {
          org_id: new ObjectId(ORG_ID),
          connectionId: devConnectionId,
          domain: DOMAIN,
          provider: 'mock',
          environment: 'development',
          active: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          org_id: new ObjectId(ORG_ID),
          connectionId: prodConnectionId,
          domain: DOMAIN,
          provider: 'saml',
          environment: 'production',
          active: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]);
      
      console.log(`✅ Created ${result.insertedCount} connection(s)`);
      
    } else if (mode === '--show') {
      // Show current connections
      console.log('📋 Current SSO Connections:\n');
      const connections = await collection.find({ domain: DOMAIN }).toArray();
      
      if (connections.length === 0) {
        console.log('   No connections found');
      } else {
        connections.forEach((conn, idx) => {
          console.log(`   ${idx + 1}. Environment: ${conn.environment || 'development'}`);
          console.log(`      Connection ID: ${conn.connectionId}`);
          console.log(`      Provider: ${conn.provider}`);
          console.log(`      Active: ${conn.active}`);
          console.log(`      Created: ${conn.createdAt}`);
          console.log('');
        });
      }
      
    } else {
      console.log('❌ Unknown option. Use --dev, --prod, --both, or --show');
    }
    
    // Show final state
    if (mode !== '--show') {
      console.log('\n📋 Final SSO Connections State:\n');
      const connections = await collection.find({ domain: DOMAIN }).toArray();
      
      connections.forEach((conn, idx) => {
        console.log(`   ${idx + 1}. Environment: ${conn.environment}`);
        console.log(`      Connection ID: ${conn.connectionId}`);
        console.log(`      Provider: ${conn.provider}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

updateSSOConnection();
