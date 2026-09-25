#!/usr/bin/env node
/**
 * Standalone Database Seeding Script
 * 
 * This script should ONLY be run manually when:
 * - Setting up a new environment
 * - Adding new permissions/roles/plans to seeder files
 * - Intentional reset of system data
 * 
 * DO NOT run this automatically on server start!
 * Dashboard permission changes must persist permanently.
 * 
 * Usage:
 *   npm run seed
 *   node scripts/seed.js
 *   node scripts/seed.js --force  (skip confirmation)
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const { seedModules }     = require('../seeders/module.Seeders');
const { seedPlans }       = require('../seeders/plan.Seeder');
const { seedPermissions } = require('../seeders/permission.Seeder');
const { seedRoles }       = require('../seeders/roleSeeder');
const { seedHolidays }    = require('../seeders/holiday.Seeders');
const migrateLeaveTypeIndexes = require('../modules/leave/migrations/migrateLeaveTypeIndexes');

const args = process.argv.slice(2);
const forceMode = args.includes('--force') || args.includes('-f');

async function connectDB() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI environment variable is not set');
  }

  await mongoose.connect(process.env.MONGO_URI, {
    bufferCommands: false,
    serverSelectionTimeoutMS: 10000,
  });

  console.log('✅ MongoDB connected');
}

async function runSeeders() {
  console.log('\n🔄 Running database seeders...\n');

  try {
    await seedModules();
    console.log('✅ Modules seeded');

    await seedPlans();
    console.log('✅ Plans seeded');

    await seedPermissions();
    console.log('✅ Permissions seeded');

    await seedRoles();
    console.log('✅ Roles seeded');

    await seedHolidays();
    console.log('✅ Holidays seeded');

    await migrateLeaveTypeIndexes();
    console.log('✅ LeaveType indexes migrated');

    console.log('\n✅ All seeders completed successfully!\n');
    console.log('📌 Note: Role permissions use $setOnInsert - existing permissions preserved');
    console.log('📌 Dashboard permission changes will now persist across server restarts\n');

  } catch (error) {
    console.error('\n❌ Seeding failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('      HRMS Database Seeding Script');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (!forceMode) {
    console.log('⚠️  WARNING: This will seed/reset system data in the database');
    console.log('⚠️  Role permissions use $setOnInsert - existing permissions preserved');
    console.log('⚠️  Only NEW roles will get default permissions\n');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  try {
    await connectDB();
    await runSeeders();
    await mongoose.connection.close();
    console.log('👋 Database connection closed\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Script failed:', error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n⚠️  Seeding interrupted by user');
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
  }
  process.exit(0);
});

main();
