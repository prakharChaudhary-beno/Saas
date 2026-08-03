// Debug org_admin search
const mongoose = require('mongoose')

const MONGO_URI = 'mongodb+srv://workprakhar9805_db_user:frPJmV3gDExUypUJ@cluster0.9m2axyw.mongodb.net/test?retryWrites=true&w=majority'

// JWT payload from your curl command (org_admin)
const JWT_PAYLOAD = {
  userId: '6a56905359e7ce40e0b35194',
  org_id: '6a56905259e7ce40e0b3518c',
  company_id: null,
  unit_id: null,
  role: 'org_admin',
  level: 'org'
}

async function testOrgAdminSearch() {
  try {
    await mongoose.connect(MONGO_URI)
    console.log('✅ Connected to MongoDB\n')
    
    const Employee = require('./modules/employee/models/employee.model')
    
    const query = 'chetan'
    const regex = new RegExp(query, 'i')
    
    // Org admin should see ALL within org
    const scopeFilter = { org_id: JWT_PAYLOAD.org_id }
    
    console.log('=== ORG ADMIN SCOPE ===')
    console.log('Level:', JWT_PAYLOAD.level)
    console.log('Filter:', JSON.stringify(scopeFilter, null, 2))
    console.log('')
    
    // Test 1: Search Employees with "chetan"
    console.log('=== SEARCHING FOR "CHETAN" ===')
    const employees = await Employee.find({
      ...scopeFilter,
      isDeleted: { $ne: true },
      $or: [
        { name: regex },
        { employeeId: regex },
        { email: regex }
      ]
    })
    .select('name employeeId email org_id company_id unit_id')
    .limit(10)
    .lean()
    
    console.log(`Found ${employees.length} employees matching "chetan"`)
    employees.forEach(emp => {
      console.log(`  - ${emp.name} (${emp.employeeId})`)
      console.log(`    Email: ${emp.email}`)
    })
    
    // Test 2: Check if "Chetan" exists ANYWHERE in database
    console.log('\n=== CHECKING ALL EMPLOYEES FOR "CHETAN" (ALL ORGS) ===')
    const allChetans = await Employee.find({
      name: regex,
      isDeleted: { $ne: true }
    })
    .select('name employeeId email org_id')
    .lean()
    
    console.log(`Total employees named "Chetan" in ALL orgs: ${allChetans.length}`)
    allChetans.forEach(emp => {
      console.log(`  - ${emp.name} (${emp.employeeId})`)
      console.log(`    org_id: ${emp.org_id}`)
      console.log(`    YOUR org_id: ${JWT_PAYLOAD.org_id}`)
      console.log(`    MATCH: ${emp.org_id === JWT_PAYLOAD.org_id ? '✅ YES' : '❌ NO'}`)
    })
    
    // Test 3: List ALL employees in YOUR org
    console.log('\n=== ALL EMPLOYEES IN YOUR ORG ===')
    const allOrgEmps = await Employee.find({
      ...scopeFilter,
      isDeleted: { $ne: true }
    })
    .select('name employeeId email')
    .limit(20)
    .lean()
    
    console.log(`Total employees in your org: ${allOrgEmps.length}`)
    allOrgEmps.forEach((emp, idx) => {
      console.log(`  ${idx + 1}. ${emp.name} (${emp.employeeId})`)
    })
    
    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

testOrgAdminSearch()
