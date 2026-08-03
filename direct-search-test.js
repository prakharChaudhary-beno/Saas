// Direct test of search service
const mongoose = require('mongoose')
require('dotenv').config()

async function testSearchService() {
  try {
    await mongoose.connect(process.env.MONGO_URI)
    console.log('✅ Connected to DB:', mongoose.connection.db.databaseName)
    
    const Employee = require('./modules/employee/models/employee.model')
    
    // JWT payload (org_admin)
    const userScope = {
      level: 'org',
      orgId: '6a56905259e7ce40e0b3518c',
      companyId: null,
      unitId: null
    }
    
    const query = 'adar'
    const regex = new RegExp(query, 'i')
    
    console.log('\n=== DIRECT QUERY TEST ===')
    console.log('Query:', query)
    console.log('Level:', userScope.level)
    console.log('orgId:', userScope.orgId)
    
    // Build filter like searchQueryBuilder does
    let scopeFilter = {}
    switch(userScope.level) {
      case 'org':
        scopeFilter = { org_id: userScope.orgId }
        break
      case 'company':
        scopeFilter = { org_id: userScope.orgId, company_id: userScope.companyId }
        break
      case 'unit':
        scopeFilter = { org_id: userScope.orgId, company_id: userScope.companyId, unit_id: userScope.unitId }
        break
    }
    
    console.log('Scope Filter:', JSON.stringify(scopeFilter, null, 2))
    
    // Direct query
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
    .limit(5)
    .lean()
    
    console.log(`\n=== RESULTS ===`)
    console.log(`Found ${employees.length} employees`)
    employees.forEach(emp => {
      console.log(`  - ${emp.name} (${emp.employeeId})`)
      console.log(`    Email: ${emp.email}`)
      console.log(`    org_id: ${emp.org_id}`)
    })
    
    // Check total employees in org
    const total = await Employee.countDocuments({
      ...scopeFilter,
      isDeleted: { $ne: true }
    })
    console.log(`\nTotal employees in org: ${total}`)
    
    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

testSearchService()
