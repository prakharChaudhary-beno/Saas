const mongoose = require('mongoose')
require('dotenv').config()

async function checkAllPendingLeaves() {
  try {
    await mongoose.connect(process.env.MONGO_URI)
    console.log('✅ Connected to DB:', mongoose.connection.db.databaseName)
    
    const LeaveRequest = require('./modules/leave/models/leaveRequest.models')
    const Employee = require('./modules/employee/models/employee.model')
    const LeaveType = require('./modules/leave/models/leaveType.models') // Load LeaveType model
    
    // org_id from the JWT token
    const orgId = '6a56905259e7ce40e0b3518c'
    
    // Find ALL PENDING leave requests in the org
    const pendingLeaves = await LeaveRequest.find({
      status: 'PENDING',
      isDeleted: { $ne: true }
    })
    .populate('employeeId', 'name employeeId org_id')
    .populate('leaveTypeId', 'name')
    .select('employeeId leaveTypeId reason status startDate endDate totalDays')
    .lean()
    
    console.log(`\n📊 Found ${pendingLeaves.length} PENDING leave requests in the database`)
    
    // Filter by org
    const orgLeaves = pendingLeaves.filter(leave => 
      leave.employeeId?.org_id?.toString() === orgId
    )
    
    console.log(`📊 Found ${orgLeaves.length} PENDING leave requests in org ${orgId}\n`)
    
    if (orgLeaves.length > 0) {
      orgLeaves.forEach((leave, idx) => {
        console.log(`${idx + 1}. Employee: ${leave.employeeId?.name || 'Unknown'} (${leave.employeeId?.employeeId || 'N/A'})`)
        console.log(`   Leave Type: ${leave.leaveTypeId?.name || 'Unknown'}`)
        console.log(`   Reason: ${leave.reason || 'No reason'}`)
        console.log(`   Status: ${leave.status}`)
        console.log(`   Days: ${leave.totalDays}`)
        console.log(`   Start: ${leave.startDate?.toISOString().split('T')[0]}`)
        console.log(`   End: ${leave.endDate?.toISOString().split('T')[0]}`)
        console.log(`   Employee ID: ${leave.employeeId?._id}`)
        console.log('')
      })
    } else {
      console.log('  No pending leave requests found in this org\n')
    }
    
    // Also check by status breakdown
    const allLeaves = await LeaveRequest.find({
      isDeleted: { $ne: true }
    })
    .populate('employeeId', 'org_id')
    .lean()
    
    const orgAllLeaves = allLeaves.filter(leave => 
      leave.employeeId?.org_id?.toString() === orgId
    )
    
    console.log(`📈 Total leave requests in org: ${orgAllLeaves.length}`)
    const byStatus = orgAllLeaves.reduce((acc, leave) => {
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

checkAllPendingLeaves()
