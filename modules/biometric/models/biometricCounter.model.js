// modules/biometric/models/biometricCounter.model.js
//
// Atomic counter for biometric codes
// Prevents race conditions during concurrent employee pushes
//
// Each Unit gets its own counter sequence starting at 1001
// (4-digit minimum to ensure compatibility with eSSL devices)

const mongoose = require('mongoose');
const { Schema } = mongoose;

const biometricCounterSchema = new Schema({
  // Unit scope - each unit has its own biometric code sequence
  unit_id: {
    type:     Schema.Types.ObjectId,
    ref:      'Unit',
    required: true,
    unique:   true,
    index:    true
  },
  
  // Current sequence value
  // Starts at 1001 to ensure all codes are 4+ digits (1001, 1002, etc.)
  sequenceValue: {
    type:    Number,
    default: 1001,
    min:     1001
  }
}, {
  timestamps: true
});

// Compound index for uniqueness
biometricCounterSchema.index({ unit_id: 1 }, { unique: true });

/**
 * Get next biometric code atomically
 * Also checks existing employee codes to avoid conflicts
 */
biometricCounterSchema.statics.getNextCode = async function(unitId) {
  const Employee = require('../../employee/models/employee.model');
  
  // Find highest existing biometricCode for this unit
  const highestEmployee = await Employee.findOne({
    unit_id: unitId,
    biometricCode: { $exists: true, $ne: null, $gte: 1001 }
  }).sort({ biometricCode: -1 }).lean();
  
  // Start from 1001 or increment from highest
  const minStart = 1001;
  let nextCode = minStart;
  
  if (highestEmployee?.biometricCode && highestEmployee.biometricCode >= minStart) {
    nextCode = highestEmployee.biometricCode + 1;
  }
  
  // Atomic increment with upsert
  const counter = await this.findOneAndUpdate(
    { unit_id: unitId },
    { $max: { sequenceValue: nextCode + 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  
  // Return current value (sequenceValue is already incremented)
  return counter.sequenceValue - 1;
};

module.exports = mongoose.model('BiometricCounter', biometricCounterSchema);
