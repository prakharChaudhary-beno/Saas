// modules/permission/seed/permission.seed.js
// Seed file to create biometric permissions
//
// Run with: node modules/permission/seed/permission.seed.js

const mongoose = require('mongoose');
const Permission = require('../permission.model');

// ─── Biometric Permissions ──────────────────────────────────────────────
const BIOMETRIC_PERMISSIONS = [
  {
    name: 'biometric.read',
    slug: 'biometric.read',
    module: 'biometric',
    action: 'read',
    label: 'View Biometric Devices',
    description: 'View biometric device configuration, sync logs, and device status',
    scope: ['unit', 'company', 'org'],
    category: 'HR Operations',
    frRef: 'BM-01',
    is_active: true
  },
  {
    name: 'biometric.create',
    slug: 'biometric.create',
    module: 'biometric',
    action: 'create',
    label: 'Add Biometric Devices',
    description: 'Add new biometric devices and push employees to devices',
    scope: ['unit', 'company'],
    category: 'HR Operations',
    frRef: 'BM-02',
    is_active: true
  },
  {
    name: 'biometric.update',
    slug: 'biometric.update',
    module: 'biometric',
    action: 'update',
    label: 'Sync Biometric Attendance',
    description: 'Edit biometric config, test device connection, and sync attendance from devices',
    scope: ['unit', 'company'],
    category: 'HR Operations',
    frRef: 'BM-03',
    is_active: true
  },
  {
    name: 'biometric.delete',
    slug: 'biometric.delete',
    module: 'biometric',
    action: 'delete',
    label: 'Remove Biometric Devices',
    description: 'Remove biometric devices from configuration',
    scope: ['unit', 'company'],
    category: 'HR Operations',
    frRef: 'BM-04',
    is_active: true
  }
];

async function seedBiometricPermissions() {
  try {
    // Connect to MongoDB
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hrms';
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Insert or update permissions
    let created = 0;
    let updated = 0;

    for (const perm of BIOMETRIC_PERMISSIONS) {
      const existing = await Permission.findOne({ slug: perm.slug });
      
      if (existing) {
        await Permission.updateOne({ slug: perm.slug }, perm);
        updated++;
        console.log(`   ↻ Updated: ${perm.slug}`);
      } else {
        await Permission.create(perm);
        created++;
        console.log(`   ✓ Created: ${perm.slug}`);
      }
    }

    console.log(`\n✅ Seed complete:
   Created: ${created}
   Updated: ${updated}
   Total:   ${created + updated}
`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  seedBiometricPermissions();
}

module.exports = seedBiometricPermissions;
