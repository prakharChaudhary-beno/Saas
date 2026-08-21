const mongoose = require('mongoose');
const EmployeeTimeline = require('./modules/employee/models/employeeTimeline.model');
const Employee = require('./modules/employee/models/employee.model');
const User = require('./modules/auth/models/user.model');
const Department = require('./modules/department/department.model');
const Designation = require('./modules/designation/designation.model');

async function testTimeline() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb+srv://workprakhar9805_db_user:frPJmV3gDExUypUJ@cluster0.9m2axyw.mongodb.net/test?retryWrites=true&w=majority');
    console.log('✅ Connected to MongoDB');

    // Find a test employee
    const employee = await Employee.findOne({ isDeleted: false })
      .populate('userId', 'name email profilePhoto')
      .populate('departmentId', 'name')
      .populate('designationId', 'name')
      .lean();

    if (employee) {
      console.log('\n📋 Found Employee:');
      console.log(`   Name: ${employee.name}`);
      console.log(`   Email: ${employee.email}`);
      console.log(`   Employee ID: ${employee.employeeId}`);
      console.log(`   Department: ${employee.departmentId?.name || 'N/A'}`);
      console.log(`   Designation: ${employee.designationId?.name || 'N/A'}`);

      // Check if timeline events exist
      const timelineCount = await EmployeeTimeline.countDocuments({ employeeId: employee._id });
      console.log(`\n📊 Timeline Events: ${timelineCount}`);

      if (timelineCount > 0) {
        const events = await EmployeeTimeline.find({ employeeId: employee._id })
          .populate('fromDesignationId', 'name')
          .populate('toDesignationId', 'name')
          .populate('fromDepartmentId', 'name')
          .populate('toDepartmentId', 'name')
          .populate('changedBy', 'name email')
          .sort({ effectiveDate: -1 })
          .lean();

        console.log('\n📅 Timeline:');
        events.forEach((event, idx) => {
          console.log(`\n   Event ${idx + 1}:`);
          console.log(`   Type: ${event.eventType}`);
          console.log(`   Date: ${new Date(event.effectiveDate).toLocaleDateString('en-IN')}`);
          console.log(`   Reason: ${event.changeReason || 'N/A'}`);
          if (event.fromDesignationId || event.toDesignationId) {
            console.log(`   Designation: ${event.fromDesignationId?.name || 'N/A'} → ${event.toDesignationId?.name || 'N/A'}`);
          }
          if (event.fromDepartmentId || event.toDepartmentId) {
            console.log(`   Department: ${event.fromDepartmentId?.name || 'N/A'} → ${event.toDepartmentId?.name || 'N/A'}`);
          }
        });
      }
    } else {
      console.log('❌ No employees found in database');
    }

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testTimeline();
