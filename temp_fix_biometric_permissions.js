// Fix unit_admin biometric permissions
const mongoose = require('mongoose');

async function fixPermissions() {
  try {
    await mongoose.connect('mongodb+srv://workprakhar9805_db_user:frPJmV3gDExUypUJ@cluster0.9m2axyw.mongodb.net/?appName=Cluster0/test');
    console.log('✅ Connected to MongoDB');

    // Get biometric permission IDs
    const biometricPerms = await mongoose.connection.db
      .collection('permissions')
      .find({ module: 'biometric' })
      .project({ _id: 1, slug: 1 })
      .toArray();

    console.log('\n📋 Biometric permissions found:');
    biometricPerms.forEach(p => console.log(`  - ${p.slug}: ${p._id}`));

    if (biometricPerms.length === 0) {
      console.log('\n❌ No biometric permissions found. Creating...');
      
      // Create biometric permissions
      const newPerms = [
        { module: 'biometric', slug: 'biometric.read', name: 'View Biometric Config', createdAt: new Date(), updatedAt: new Date() },
        { module: 'biometric', slug: 'biometric.create', name: 'Create Biometric Config', createdAt: new Date(), updatedAt: new Date() },
        { module: 'biometric', slug: 'biometric.update', name: 'Update Biometric Config', createdAt: new Date(), updatedAt: new Date() },
        { module: 'biometric', slug: 'biometric.delete', name: 'Delete Biometric Config', createdAt: new Date(), updatedAt: new Date() }
      ];

      const inserted = await mongoose.connection.db.collection('permissions').insertMany(newPerms);
      console.log(`✅ Created ${inserted.insertedCount} biometric permissions`);
      
      biometricPerms.push(...Object.values(inserted.insertedIds).map((id, i) => ({
        _id: id,
        slug: newPerms[i].slug
      })));
    }

    const biometricIds = biometricPerms.map(p => p._id);

    // Update unit_admin role
    const unitAdminUpdate = await mongoose.connection.db
      .collection('roles')
      .updateOne(
        { slug: 'unit_admin' },
        { $addToSet: { permissions: { $each: biometricIds } } }
      );

    console.log(`\n✅ unit_admin role updated: ${unitAdminUpdate.modifiedCount} modified`);

    // Update hr_manager role (read, create, update only)
    const hrManagerPerms = biometricPerms
      .filter(p => p.slug !== 'biometric.delete')
      .map(p => p._id);

    const hrManagerUpdate = await mongoose.connection.db
      .collection('roles')
      .updateOne(
        { slug: 'hr_manager' },
        { $addToSet: { permissions: { $each: hrManagerPerms } } }
      );

    console.log(`✅ hr_manager role updated: ${hrManagerUpdate.modifiedCount} modified`);

    // Verify
    const updatedUnitAdmin = await mongoose.connection.db
      .collection('roles')
      .findOne({ slug: 'unit_admin' }, { projection: { permissions: 1 } });

    console.log('\n📊 unit_admin now has', updatedUnitAdmin.permissions.length, 'permissions');

    mongoose.connection.close();
    console.log('\n✅ Done!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

fixPermissions();
