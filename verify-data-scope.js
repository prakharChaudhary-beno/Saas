// Verify data scope and find employees in org/company
const mongoose = require('mongoose')

const MONGO_URI = 'mongodb+srv://workprakhar9805_db_user:frPJmV3gDExUypUJ@cluster0.9m2axyw.mongodb.net/test?retryWrites=true&w=majority'

const JWT_PAYLOAD = {
  userId: '6a5774555f88a58eda850019',
  org_id: '6a56905259e7ce40e0b3518c',
  company_id: '6a576fe9b8610c7fbd98f922',
  unit_id: '6a5774555f88a58eda850018',
}

async function verify() {
  try {
    await mongoose.connect(MONGO_URI)
    
    const Employee = require('./modules/employee/models/employee.model')
    const Unit = require('./modules/unit/models/unit.model')
    const Company = require('./modules/company/models/company.model')
    const Org = require('./modules/organisation/models/organization.model')
    
    console.log('=== VERIFYING DATA EXISTENCE ===\n')
    
    // Check Org
    const org = await Org.findById(JWT_PAYLOAD.org_id).select('name').lean()
    console.log('Organization:', org?.name || 'NOT FOUND')
    
    // Check Company
    const company = await Company.findById(JWT_PAYLOAD.company_id).select('name').lean()
    console.log('Company:', company?.name || 'NOT FOUND')
    
    // Check Unit
    const unit = await Unit.findById(JWT_PAYLOAD.unit_id).select('name').lean()
    console.log('Your Unit:', unit?.name || 'NOT FOUND')
    
    // Total employees in org
    const totalOrgEmps = await Employee.countDocuments({ 
      org_id: JWT_PAYLOAD.org_id,
      isDeleted: { $ne: true }
    })
    console.log(`\nTotal employees in ORG: ${totalOrgEmps}`)
    
    // Total employees in company
    const totalCompanyEmps = await Employee.countDocuments({ 
      org_id: JWT_PAYLOAD.org_id,
      company_id: JWT_PAYLOAD.company_id,
      isDeleted: { $ne: true }
    })
    console.log(`Total employees in COMPANY: ${totalCompanyEmps}`)
    
    // Total employees in unit
    const totalUnitEmps = await Employee.countDocuments({ 
      org_id: JWT_PAYLOAD.org_id,
      company_id: JWT_PAYLOAD.company_id,
      unit_id: JWT_PAYLOAD.unit_id,
      isDeleted: { $ne: true }
    })
    console.log(`Total employees in YOUR UNIT: ${totalUnitEmps}`)
    
    // List all units in the company
    const unitsInCompany = await Unit.find({
      org_id: JWT_PAYLOAD.org_id,
      company_id: JWT_PAYLOAD.company_id,
      isDeleted: { $ne: true }
    })
    .select('name _id')
    .lean()
    
    console.log(`\n=== ALL UNITS IN COMPANY (${unitsInCompany.length}) ===`)
    for (const u of unitsInCompany) {
      const empCount = await Employee.countDocuments({
        org_id: JWT_PAYLOAD.org_id,
        company_id: JWT_PAYLOAD.company_id,
        unit_id: u._id,
        isDeleted: { $ne: true }
      })
      console.log(`- ${u.name} (${u._id}): ${empCount} employees`)
    }
    
    // Find any employee with "pr" in name across org
    const regex = /pr/i
    const allEmployees = await Employee.find({
      org_id: JWT_PAYLOAD.org_id,
      isDeleted: { $ne: true },
      $or: [
        { name: regex },
        { employeeId: regex },
        { email: regex }
      ]
    })
    .select('name employeeId email unit_id company_id')
    .populate('unit_id', 'name')
    .limit(10)
    .lean()
    
    console.log(`\n=== EMPLOYEES MATCHING "pr" IN ENTIRE ORG ===`)
    if (allEmployees.length === 0) {
      console.log('❌ No employees found matching "pr" in name/email/ID')
    } else {
      allEmployees.forEach(emp => {
        console.log(`- ${emp.name} (${emp.employeeId})`)
        console.log(`  Email: ${emp.email}`)
        console.log(`  Unit: ${emp.unit_id?.name || 'N/A'}`)
        console.log(`  Unit ID: ${emp.unit_id?._id}`)
        console.log('')
      })
    }
    
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

verify()
