// scripts/add-biometric-permissions.js
// Script to add biometric permissions to unit_admin and hr_manager roles
//
// Run: node scripts/add-biometric-permissions.js

require('dotenv').config();
const mongoose = require('mongoose');

// Connect to DB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || process.env.DB_URI || process.env.MONGODB_URI);
    console.log('✅ Connected to database');
  } catch (err) {
    console.error('❌ Database connection error:', err.message);
    process.exit(1);
  }
};

const run = async () => {
  await connectDB();

  // Models
  const Role       = require('../modules/role/role.model');
  const Permission = require('../modules/permission/permission.model');

  // Biometric permissions
const biometricPermissions = [
    { slug: 'biometric.read', name: 'biometric.read', label: 'View Biometric', description: 'View biometric configuration and logs', module: 'biometric', action: 'read', scope: ['unit', 'company', 'org'] },
    { slug: 'biometric.create', name: 'biometric.create', label: 'Create Biometric', description: 'Create biometric configuration', module: 'biometric', action: 'create', scope: ['unit', 'company', 'org'] },
    { slug: 'biometric.update', name: 'biometric.update', label: 'Update Biometric', description: 'Update biometric configuration and sync attendance', module: 'biometric', action: 'update', scope: ['unit', 'company', 'org'] },
    { slug: 'biometric.delete', name: 'biometric.delete', label: 'Delete Biometric', description: 'Delete biometric configuration and devices', module: 'biometric', action: 'delete', scope: ['company', 'org'] }
  ];

  // Create permissions
  console.log('\n📋 Creating biometric permissions...');
  for (const perm of biometricPermissions) {
    const existing = await Permission.findOne({ slug: perm.slug });
    if (!existing) {
      await Permission.create(perm);
      console.log(`  ✅ Created permission: ${perm.slug}`);
    } else {
      console.log(`  ⏭️  Permission already exists: ${perm.slug}`);
    }
  }

  // Roles to update
  const rolesToUpdate = ['unit_admin', 'hr_manager', 'company_admin', 'org_admin'];

  console.log('\n📋 Adding biometric permissions to roles...');
  for (const roleSlug of rolesToUpdate) {
    const role = await Role.findOne({ slug: roleSlug });
    if (!role) {
      console.log(`  ⚠️  Role not found: ${roleSlug}`);
      continue;
    }

    // Get permission IDs
    const permIds = [];
    for (const perm of biometricPermissions) {
      const doc = await Permission.findOne({ slug: perm.slug });
      if (doc) permIds.push(doc._id);
    }

    // Add to role if not already present
    const existingPerms = role.permissions || [];
    let addedCount = 0;
    for (const permId of permIds) {
      if (!existingPerms.some(p => String(p) === String(permId))) {
        existingPerms.push(permId);
        addedCount++;
      }
    }

    if (addedCount > 0) {
      role.permissions = existingPerms;
      await role.save();
      console.log(`  ✅ Added ${addedCount} biometric permissions to ${roleSlug}`);
    } else {
      console.log(`  ⏭️  ${roleSlug} already has biometric permissions`);
    }
  }

  console.log('\n✅ Biometric permissions setup complete!');
  process.exit(0);
};

run().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
