// modules/biometric/models/biometricMapping.model.js
// Manual Employee Mapping for Pre-Existing Device Employees
//
// SCENARIO: Some employees already registered on device (e.g., to sync to a different device, or imported via legacy system)
// SOLUTION: This table allows manual mapping of EmployeeCode to HRMS Employee
//
// After mapping, employee gets a biometricCode assigned for future syncs.

const mongoose = require('mongoose');
const { Schema } = mongoose;

// ─── Mapping Schema ───────────────────────────────────────────────────
const biometricMappingSchema = new Schema({
  // ─── Multi-Tenant Scope ─────────────────────────────────────────────
  org_id: {
    type:     Schema.Types.ObjectId,
    ref:      'Organization',
    required: true,
    index:    true
  },
  company_id: {
    type:     Schema.Types.ObjectId,
    ref:      'Company',
    required: true,
    index:    true
  },
  unit_id: {
    type:     Schema.Types.ObjectId,
    ref:      'Unit',
    required: true,
    index:    true
  },

  // ─── Device Reference ───────────────────────────────────────────────
  deviceSerialNumber: {
    type:     String,
    required: true,
    index:    true
  },

  // ─── Device Employee Code (Raw) ──────────────────────────────────────
  deviceEmployeeCode: {
    type:     String,    // Raw EmployeeCode from device logs
    required: true,
    trim:     true
  },

  // ─── HRMS Employee Reference ─────────────────────────────────────────
  employeeId: {
    type:     Schema.Types.ObjectId,
    ref:      'Employee',
    required: true,
    index:    true
  },

  // ─── Assigned BiometricCode ─────────────────────────────────────────
  biometricCode: {
    type:     Number,    // Device-scoped numeric ID assigned after mapping
    default:  null,
    index:    true
  },

  // ─── Mapping Source ─────────────────────────────────────────────────
  mappingSource: {
    type:    String,
    enum:    ['MANUAL', 'AUTO_MATCHED', 'LEGACY_IMPORT'],
    default: 'MANUAL'
  },

  // ─── Mapping Status ─────────────────────────────────────────────────
  status: {
    type:    String,
    enum:    ['PENDING', 'ACTIVE', 'REMOVED'],
    default: 'PENDING',
    index:   true
  },

  // ─── Verification ───────────────────────────────────────────────────
  isVerified: {
    type:    Boolean,   // Admin confirmed this mapping is correct
    default: false
  },
  verifiedBy: {
    type:    Schema.Types.ObjectId,
    ref:     'User',
    default: null
  },
  verifiedAt: {
    type:    Date,
    default: null
  },

  // ─── Created By ─────────────────────────────────────────────────────
  createdBy: {
    type:     Schema.Types.ObjectId,
    ref:      'User',
    required: true
  },

  // ─── Notes ──────────────────────────────────────────────────────────
  notes: {
    type:    String,
    default: null
  },

  // ─── Soft Delete ────────────────────────────────────────────────────
  isDeleted: {
    type:    Boolean,
    default: false
  }

}, {
  timestamps: true,
  toJSON:   { virtuals: true },
  toObject: { virtuals: true }
});

// ─── Indexes ────────────────────────────────────────────────────────────
biometricMappingSchema.index({ org_id: 1, company_id: 1, unit_id: 1, deviceEmployeeCode: 1 });
biometricMappingSchema.index({ deviceSerialNumber: 1, deviceEmployeeCode: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });
biometricMappingSchema.index({ employeeId: 1, deviceSerialNumber: 1 });
biometricMappingSchema.index({ status: 1, isDeleted: 1 });

// ─── Virtual: Employee Populated ──────────────────────────────────────
biometricMappingSchema.virtual('employee', {
  ref:          'Employee',
  localField:   'employeeId',
  foreignField: '_id',
  justOne:      true
});

// ─── Pre-Save Hook ───────────────────────────────────────────────────
// Mongoose 9.x: Use async function without next parameter
biometricMappingSchema.pre('save', async function() {
  // If verified, update status to ACTIVE
  if (this.isVerified && this.status === 'PENDING') {
    this.status = 'ACTIVE';
  }
});

// ─── Instance Method: Verify Mapping ─────────────────────────────────
biometricMappingSchema.methods.verify = function(userId) {
  this.isVerified = true;
  this.verifiedBy = userId;
  this.verifiedAt = new Date();
  this.status     = 'ACTIVE';
  return this.save();
};

// ─── Instance Method: Remove Mapping ─────────────────────────────────-
biometricMappingSchema.methods.removeMapping = function() {
  this.status    = 'REMOVED';
  this.isDeleted = true;
  return this.save();
};

// ─── Static: Find by Device Code ────────────────────────────────────
biometricMappingSchema.statics.findByDeviceCode = function(serialNumber, deviceCode) {
  return this.findOne({
    deviceSerialNumber: serialNumber,
    deviceEmployeeCode: deviceCode,
    isDeleted:          false
  }).populate('employeeId');
};

// ─── Static: Find by Employee ───────────────────────────────────────
biometricMappingSchema.statics.findByEmployee = function(employeeId) {
  return this.find({
    employeeId: employeeId,
    isDeleted:  false
  }).populate('employeeId');
};

// ─── Static: Find Pending Mappings ──────────────────────────────────
biometricMappingSchema.statics.findPending = function(unitId) {
  return this.find({
    unit_id:    unitId,
    status:     'PENDING',
    isDeleted:  false
  }).populate('employeeId');
};

// ─── Static: Find Unmapped Device Codes ─────────────────────────────
biometricMappingSchema.statics.getMappedCodes = async function(unitId) {
  const mappings = await this.find({
    unit_id:    unitId,
    status:     { $in: ['PENDING', 'ACTIVE'] },
    isDeleted:  false
  }).select('deviceEmployeeCode biometricCode');

  return mappings.reduce((acc, m) => {
    acc[m.deviceEmployeeCode] = m.biometricCode;
    return acc;
  }, {});
};

// ─── Static: Get Mapping Stats ──────────────────────────────────────
biometricMappingSchema.statics.getMappingStats = async function(unitId) {
  const result = await this.aggregate([
    {
      $match: {
        unit_id:    mongoose.Types.ObjectId(unitId),
        isDeleted:  false
      }
    },
    {
      $group: {
        _id:               '$status',
        count:             { $sum: 1 }
      }
    }
  ]);

  const stats = { PENDING: 0, ACTIVE: 0, REMOVED: 0 };
  result.forEach(item => {
    stats[item._id] = item.count;
  });

  return stats;
};

// ─── Export ────────────────────────────────────────────────────────
module.exports = mongoose.models.BiometricMapping || 
                 mongoose.model('BiometricMapping', biometricMappingSchema);
