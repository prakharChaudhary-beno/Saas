// Debug biometric permissions
const mongoose = require('mongoose');

async function debugBiometricPermissions() {
  try {
    await mongoose.connect('mongodb+srv://workprakhar9805_db_user:frPJmV3gDExUypUJ@cluster0.9m2axyw.mongodb.net/?appName=Cluster0');
    console.log('✅ Connected to MongoDB Atlas');

    // Get biometric permissions
    const biometricPerms = await mongoose.connection.db
      .collection('permissions')
      .find({ module: 'biometric' })
      .project({ _id: 1, slug: 1, name: 1 })
      .toArray();

    console.log('\n📋 Biometric permissions in DB:');
    biometricPerms.forEach(p => console.log(`  - ${p.slug}: ${p._id}`));

    if (biometricPerms.length === 0) {
      console.log('\n❌ No biometric permissions found!');
      
      // Create them
      console.log('\n🔨 Creating biometric permissions...');
      const newPerms = [
        { module: 'biometric', slug: 'biometric.read', name: 'View Biometric Config', is_active: true, createdAt: new Date(), updatedAt: new Date() },
        { module: 'biometric', slug: 'biometric.create', name: 'Create Biometric Config', is_active: true, createdAt: new Date(), updatedAt: new Date() },
        { module: 'biometric', slug: 'biometric.update', name: 'Update Biometric Config', is_active: true, createdAt: new Date(), updatedAt: new Date() },
        { module: 'biometric', slug: 'biometric.delete', name: 'Delete Biometric Config', is_active: true, createdAt: new Date(), updatedAt: new Date() }
      ];

      await mongoose.connection.db.collection('permissions').insertMany(newPerms);
      console.log('✅ Created 4 biometric permissions');
      
      // Fetch again
      biometricPerms.push(...await mongoose.connection.db
        .collection('permissions')
        .find({ module: 'biometric' })
        .project({ _id: 1, slug: 1 })
        .toArray());
    }

    // Check unit_admin role
    console.log('\n🔍 Checking unit_admin role...');
    const unitAdminRoleId = mongoose.Types.ObjectId.createFromHexString('6a44f1c7d97f5fdfeaf1d6d0');
    const unitAdminRole = await mongoose.connection.db
      .collection('roles')
      .findOne({ _id: unitAdminRoleId });

    if (!unitAdminRole) {
      console.log('❌ unit_admin role not found!');
      process.exit(1);
    }

    console.log(`\n📊 unit_admin role has ${unitAdminRole.permissions?.length || 0} permissions`);
    
    // Check if biometric permissions are in the role
    const biometricIds = biometricPerms.map(p => p._id.toString());
    const rolePermIds = (unitAdminRole.permissions || []).map(id => id.toString());
    
    const hasBiometric = biometricIds.filter(id => rolePermIds.includes(id));
    
    if (hasBiometric.length === 0) {
      console.log('❌ unit_admin does NOT have biometric permissions');
      console.log('\n🔥 Adding biometric permissions to unit_admin role...');
      
      await mongoose.connection.db
        .collection('roles')
        .updateOne(
          { _id: unitAdminRoleId },
          { $addToSet: { permissions: { $each: biometricPerms.map(p => p._id) } } }
        );
      
      console.log('✅ Added biometric permissions to unit_admin role');
      console.log('\n⚠️  USER MUST RE-LOGIN TO GET NEW PERMISSIONS');
    } else {
      console.log(`✅ unit_admin has ${hasBiometric.length} biometric permissions`);
    }

    // Final verification
    const updatedRole = await mongoose.connection.db
      .collection('roles')
      .findOne({ _id: unitAdminRoleId }, { projection: { permissions: 1 } });

    console.log(`\n📊 unit_admin now has ${updatedRole.permissions.length} total permissions`);

    mongoose.connection.close();
    console.log('\n✅ Done!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

debugBiometricPermissions();
