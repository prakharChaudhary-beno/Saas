require('dotenv').config();
const mongoose = require('mongoose');
const EmployeeTimeline = require('./modules/employee/models/employeeTimeline.model');

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://hrms-user:BenoHRMS2024!@cluster0.9m2axyw.mongodb.net/test?retryWrites=true&w=majority';

async function testTimelineModel() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected successfully');

    // Test creating a timeline event with all required fields
    const testEvent = {
      org_id: new mongoose.Types.ObjectId(),
      company_id: new mongoose.Types.ObjectId(),
      unit_id: new mongoose.Types.ObjectId(),
      employeeId: new mongoose.Types.ObjectId(),
      userId: new mongoose.Types.ObjectId(),
      eventType: 'designation_change',
      fromDesignationId: new mongoose.Types.ObjectId(),
      toDesignationId: new mongoose.Types.ObjectId(),
      effectiveDate: new Date(),
      changedBy: new mongoose.Types.ObjectId(),
      changeReason: 'Test event'
    };

    console.log('\n📝 Creating test timeline event...');
    const event = new EmployeeTimeline(testEvent);
    await event.save();
    console.log('✅ Timeline event created successfully!');
    console.log(`   Event ID: ${event._id}`);
    console.log(`   Event Type: ${event.eventType}`);
    console.log(`   Org ID: ${event.org_id}`);
    console.log(`   Company ID: ${event.company_id}`);
    console.log(`   Unit ID: ${event.unit_id}`);

    // Verify the event can be queried
    console.log('\n🔍 Querying the created event...');
    const found = await EmployeeTimeline.findById(event._id);
    console.log('✅ Event found:', found.eventType);

    // Clean up - delete test event
    await EmployeeTimeline.findByIdAndDelete(event._id);
    console.log('\n🧹 Test event cleaned up');

    console.log('\n✅ All tests passed! Timeline model is working correctly.');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.errors) {
      console.error('Validation errors:', error.errors);
    }
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
    process.exit(0);
  }
}

testTimelineModel();
