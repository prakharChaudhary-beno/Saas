// Test script to verify search functionality
// Run: node test-search-query.js

const mongoose = require('mongoose')

const MONGO_URI = 'mongodb+srv://workprakhar9805_db_user:frPJmV3gDExUypUJ@cluster0.9m2axyw.mongodb.net/test?retryWrites=true&w=majority'

// JWT payload from your curl command
const JWT_PAYLOAD = {
  userId: '6a5774555f88a58eda850019',
  org_id: '6a56905259e7ce40e0b3518c',
  company_id: '6a576fe9b8610c7fbd98f922',
  unit_id: '6a5774555f88a58eda850018',
  role: 'unit_admin',
  level: 'unit'
}

async function testSearch() {
  try {
    await mongoose.connect(MONGO_URI)
    console.log('✅ Connected to MongoDB')
    
    // Load models
    const Employee = require('./modules/employee/models/employee.model')
    const LeaveRequest = require('./modules/leave/models/leaveRequest.models')
    const Department = require('./modules/department/department.model')
    const Designation = require('./modules/designation/designation.model')
    const Holiday = require('./modules/holiday/models/holiday.models')
    
    const query = 'pr'
    const regex = new RegExp(query, 'i')
    
    // Build scope filter based on level
    let scopeFilter = {}
    switch(JWT_PAYLOAD.level) {
      case 'org':
        scopeFilter = { org_id: JWT_PAYLOAD.org_id }
        break
      case 'company':
        scopeFilter = { 
          org_id: JWT_PAYLOAD.org_id, 
          company_id: JWT_PAYLOAD.company_id 
        }
        break
      case 'unit':
        scopeFilter = { 
          org_id: JWT_PAYLOAD.org_id, 
          company_id: JWT_PAYLOAD.company_id, 
          unit_id: JWT_PAYLOAD.unit_id 
        }
        break
    }
    
    console.log('\n=== SCOPE FILTER ===')
    console.log('Level:', JWT_PAYLOAD.level)
    console.log('Filter:', JSON.stringify(scopeFilter, null, 2))
    
    // Test 1: Search Employees
    console.log('\n=== TEST 1: EMPLOYEES ===')
    const employees = await Employee.find({
      ...scopeFilter,
      isDeleted: { $ne: true },
      $or: [
        { name: regex },
        { employeeId: regex },
        { email: regex },
        { phone: regex }
      ]
    })
    .select('name employeeId email departmentId designationId profilePhoto')
    .populate('departmentId', 'name')
    .populate('designationId', 'name')
    .limit(5)
    .lean()
    
    console.log(`Found ${employees.length} employees`)
    employees.forEach(emp => {
      console.log(`  - ${emp.name} (${emp.employeeId})`)
      console.log(`    Dept: ${emp.departmentId?.name || 'N/A'}`)
      console.log(`    Desig: ${emp.designationId?.name || 'N/A'}`)
    })
    
    // Test 2: Search Leave Requests (simplified without LeaveType populate)
    console.log('\n=== TEST 2: LEAVE REQUESTS ===')
    require('./modules/leave/models/leaveType.models') // Load before query
    const leaveRequests = await LeaveRequest.find({
      ...scopeFilter,
      isDeleted: { $ne: true },
      $or: [
        { reason: regex },
        { status: regex }
      ]
    })
    .select('reason status employeeId leaveTypeId startDate endDate')
    .populate('employeeId', 'name employeeId profilePhoto')
    .populate('leaveTypeId', 'name')
    .limit(5)
    .sort({ createdAt: -1 })
    .lean()
    
    console.log(`Found ${leaveRequests.length} leave requests`)
    leaveRequests.forEach(leave => {
      console.log(`  - ${leave.employeeId?.name || 'Unknown'}: ${leave.leaveTypeId?.name || 'Unknown Leave'}`)
      console.log(`    Status: ${leave.status}`)
      console.log(`    Reason: ${leave.reason?.substring(0, 50)}...`)
    })
    
    // Test 3: Search Departments
    console.log('\n=== TEST 3: DEPARTMENTS ===')
    const departments = await Department.find({
      ...scopeFilter,
      isDeleted: { $ne: true },
      name: regex
    })
    .select('name')
    .limit(5)
    .lean()
    
    console.log(`Found ${departments.length} departments`)
    departments.forEach(dept => {
      console.log(`  - ${dept.name}`)
    })
    
    // Test 4: Search Designations
    console.log('\n=== TEST 4: DESIGNATIONS ===')
    const designations = await Designation.find({
      ...scopeFilter,
      isDeleted: { $ne: true },
      name: regex
    })
    .select('name')
    .limit(5)
    .lean()
    
    console.log(`Found ${designations.length} designations`)
    designations.forEach(desig => {
      console.log(`  - ${desig.name}`)
    })
    
    // Test 5: Search Holidays
    console.log('\n=== TEST 5: HOLIDAYS ===')
    const holidays = await Holiday.find({
      ...scopeFilter,
      name: regex
    })
    .select('name date')
    .limit(5)
    .lean()
    
    console.log(`Found ${holidays.length} holidays`)
    holidays.forEach(hol => {
      console.log(`  - ${hol.name} (${hol.date?.toDateString()})`)
    })
    
    // Test 6: Check if query matches leave TYPE name
    console.log('\n=== TEST 6: LEAVE TYPES (Company Level) ===')
    const LeaveType = require('./modules/leave/models/leaveType.models')
    const leaveTypes = await LeaveType.find({
      org_id: JWT_PAYLOAD.org_id,
      company_id: JWT_PAYLOAD.company_id,
      name: regex
    })
    .select('name code')
    .lean()
    
    console.log(`Found ${leaveTypes.length} leave types`)
    leaveTypes.forEach(lt => {
      console.log(`  - ${lt.name} (${lt.code})`)
    })
    
    // Summary
    console.log('\n=== SUMMARY ===')
    console.log(`✅ Total results for "${query}":`)
    console.log(`   Employees: ${employees.length}`)
    console.log(`   Leave Requests: ${leaveRequests.length}`)
    console.log(`   Departments: ${departments.length}`)
    console.log(`   Designations: ${designations.length}`)
    console.log(`   Holidays: ${holidays.length}`)
    console.log(`   Leave Types: ${leaveTypes.length}`)
    
    if (employees.length === 0 && leaveRequests.length === 0) {
      console.log('\n⚠️  No results found. Checking if data exists...')
      
      const totalEmps = await Employee.countDocuments({
        ...scopeFilter,
        isDeleted: { $ne: true }
      })
      console.log(`Total employees in your scope: ${totalEmps}`)
      
      if (totalEmps > 0) {
        const sampleEmp = await Employee.findOne({
          ...scopeFilter,
          isDeleted: { $ne: true }
        }).select('name employeeId').lean()
        console.log('Sample employee:', sampleEmp)
      }
    }
    
    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

testSearch()
