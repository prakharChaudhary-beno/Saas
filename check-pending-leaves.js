const mongoose = require('mongoose')
require('dotenv').config()

async function checkPendingLeaves() {
  try {
    await mongoose.connect(process.env.MONGO_URI)
    console.log('✅ Connected to DB:', mongoose.connection.db.databaseName)
    
    const LeaveRequest = require('./modules/leave/models/leaveRequest.models')
    const Employee = require('./modules/employee/models/employee.model')
    
    // Find Prakhar
    const employee = await Employee.findOne({ name: { $regex: 'prakhar', $options: 'i' } })
      .select('name employeeId org_id')
      .lean()
    
    if (!employee) {
      console.log('❌ Employee Prakhar not found')
      return
    }
    
    console.log('✅ Found employee:', employee.name, '-', employee.employeeId)
    console.log('   ID:', employee._id)
    
    // Find PENDING leave requests for this employee
    const pendingLeaves = await LeaveRequest.find({
      employeeId: employee._id,
      status: 'PENDING',
      isDeleted: { $ne: true }
    })
    .populate('leaveTypeId', 'name')
    .select('leaveTypeId reason status startDate endDate totalDays')
    .lean()
    
    console.log(`\n📊 Found ${pendingLeaves.length} PENDING leave requests for ${employee.name}`)
    
    if (pendingLeaves.length > 0) {
      pendingLeaves.forEach((leave, idx) => {
        console.log(`\n  ${idx + 1}. Leave Type: ${leave.leaveTypeId?.name || 'Unknown'}`)
        console.log(`     Reason: ${leave.reason || 'No reason'}`)
        console.log(`     Status: ${leave.status}`)
        console.log(`     Days: ${leave.totalDays}`)
        console.log(`     Start: ${leave.startDate?.toISOString().split('T')[0]}`)
        console.log(`     End: ${leave.endDate?.toISOString().split('T')[0]}`)
      })
    } else {
      console.log('\n  No pending leave requests found')
    }
    
    // Also check all leave requests for this employee
    const allLeaves = await LeaveRequest.find({
      employeeId: employee._id,
      isDeleted: { $ne: true }
    })
    .select('status')
    .lean()
    
    console.log(`\n📈 Total leave requests: ${allLeaves.length}`)
    const byStatus = allLeaves.reduce((acc, leave) => {
      acc[leave.status] = (acc[leave.status] || 0) + 1
      return acc
    }, {})
    
    Object.entries(byStatus).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`)
    })
    
    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

checkPendingLeaves()
