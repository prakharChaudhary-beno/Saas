// Test script to debug the employee query
// Run with: node test-employees-query.js

require('dotenv').config();
const mongoose = require('mongoose');

// Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hrms';

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// Import Employee model
const Employee = require('./modules/employee/models/employee.model');

async function testQuery() {
  try {
    const unitId = '6a5774555f88a58eda850018';
    const orgId = '6a56905259e7ce40e0b3518c';
    const companyId = '6a576fe9b8610c7fbd98f922';
    
    // Test 0: Check BiometricConfig unit_id
    console.log('\n📊 Test 0: Check BiometricConfig');
    const BiometricConfig = require('./modules/biometric/models/biometricConfig.model');
    const config = await BiometricConfig.findOne({ org_id: orgId, company_id: companyId }).lean();
    console.log('BiometricConfig found:', config ? 'YES' : 'NO');
    if (config) {
      console.log('Config unit_id:', config.unit_id);
      console.log('Config org_id:', config.org_id);
      console.log('Config company_id:', config.company_id);
    }
    
    // Test 1: Basic query without filters
    console.log('\n📊 Test 1: Count all employees in unit');
    const allCount = await Employee.countDocuments({ unit_id: unitId });
    console.log(`Total employees in unit: ${allCount}`);
    
    // Test 2: Count with status and isDeleted
    console.log('\n📊 Test 2: Count ACTIVE employees');
    const activeCount = await Employee.countDocuments({ 
      unit_id: unitId, 
      status: 'ACTIVE',
      isDeleted: false 
    });
    console.log(`ACTIVE employees: ${activeCount}`);
    
    // Test 3: Count with biometricCode null
    console.log('\n📊 Test 3: Count employees with biometricCode null');
    const nullCount = await Employee.countDocuments({ 
      unit_id: unitId,
      biometricCode: null 
    });
    console.log(`Employees with biometricCode null: ${nullCount}`);
    
    // Test 4: Count with $or operator
    console.log('\n📊 Test 4: Count with $or operator');
    const orCount = await Employee.countDocuments({ 
      unit_id: unitId,
      $or: [
        { biometricCode: null },
        { biometricCode: { $exists: false } }
      ]
    });
    console.log(`Employees with $or: ${orCount}`);
    
    // Test 5: Full query (same as service)
    console.log('\n📊 Test 5: Full query (same as service)');
    const filter = {
      org_id: orgId,
      company_id: companyId,
      unit_id: unitId,
      isDeleted: false,
      status: 'ACTIVE',
      $or: [
        { biometricCode: null },
        { biometricCode: { $exists: false } }
      ]
    };
    
    console.log('Filter:', JSON.stringify(filter, null, 2));
    
    const employees = await Employee.find(filter)
      .select('name employeeId status biometricCode')
      .sort({ name: 1 })
      .limit(10);
    
    console.log(`\n✅ Found ${employees.length} employees:`);
    employees.forEach(emp => {
      console.log(`  - ${emp.name} (${emp.employeeId}): biometricCode=${emp.biometricCode}, status=${emp.status}`);
    });
    
    // Test 5b: Find ALL employees with EMP0006 across ALL orgs
    console.log('\n📊 Test 5b: Find ALL employees with employeeId EMP0006');
    const allEMP0006 = await Employee.find({ employeeId: 'EMP0006' })
      .select('name employeeId status biometricCode org_id company_id unit_id isDeleted');
    console.log(`Found ${allEMP0006.length} employees with EMP0006:`);
    allEMP0006.forEach(emp => {
      console.log(`  - ${emp.name} (${emp.employeeId})`);
      console.log(`    org_id: ${emp.org_id}, company_id: ${emp.company_id}, unit_id: ${emp.unit_id}`);
      console.log(`    status: ${emp.status}, isDeleted: ${emp.isDeleted}, biometricCode: ${emp.biometricCode}`);
    });
    
    // Test 5c: Find employee "chetan" specifically
    console.log('\n📊 Test 5c: Find employee named "chetan" in correct org/company/unit');
    const chetan = await Employee.findOne({
      name: { $regex: 'chetan', $options: 'i' },
      org_id: orgId,
      company_id: companyId,
      unit_id: unitId
    }).select('name employeeId status biometricCode org_id company_id unit_id isDeleted');
    
    if (chetan) {
      console.log(`\n✅ Found chetan:`);
      console.log(`  name: ${chetan.name}, employeeId: ${chetan.employeeId}`);
      console.log(`  org_id: ${chetan.org_id}`);
      console.log(`  company_id: ${chetan.company_id}`);
      console.log(`  unit_id: ${chetan.unit_id}`);
      console.log(`  status: ${chetan.status}, isDeleted: ${chetan.isDeleted}, biometricCode: ${chetan.biometricCode}`);
    } else {
      console.log('\n❌ No employee named "chetan" found in correct org/company/unit');
    }
    
    // Test 6: Find the specific employee
    console.log('\n📊 Test 6: Find employee EMP0006');
    const emp = await Employee.findOne({ employeeId: 'EMP0006' });
    if (emp) {
      console.log('Employee found:', {
        name: emp.name,
        employeeId: emp.employeeId,
        status: emp.status,
        biometricCode: emp.biometricCode,
        isDeleted: emp.isDeleted,
        org_id: emp.org_id?.toString(),
        company_id: emp.company_id?.toString(),
        unit_id: emp.unit_id?.toString()
      });
    } else {
      console.log('❌ Employee EMP0006 not found');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testQuery();
