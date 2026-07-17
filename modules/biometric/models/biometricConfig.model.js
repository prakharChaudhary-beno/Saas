// modules/biometric/models/biometricConfig.model.js
// Biometric Device Configuration — UNIT-LEVEL SCOPING
//
// Physical biometric devices are located at specific units/offices.
// Each unit can have multiple devices with independent configuration.
//
// Feature Flag: biometricEnabled must be true for any sync to occur
// Encryption: Credentials encrypted with AES-256 at rest

const mongoose  = require('mongoose');
const crypto    = require('crypto');
const { Schema } = mongoose;

// ─── Encryption Configuration ────────────────────────────────────────
const ENCRYPTION_ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY       = process.env.BIOMETRIC_ENCRYPTION_KEY; // 32-byte hex string from .env
const IV_LENGTH            = 16; // AES block size

if (!ENCRYPTION_KEY) {
  console.warn('[BiometricConfig] WARNING: BIOMETRIC_ENCRYPTION_KEY not set in environment. Credentials will not be encrypted.');
}

// ─── Encryption Helpers ───────────────────────────────────────────────
const encrypt = (text) => {
  if (!ENCRYPTION_KEY || !text) return text;
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (err) {
    console.error('[BiometricConfig] Encryption failed:', err.message);
    return text; // Fallback to plaintext
  }
};

const decrypt = (encryptedText) => {
  if (!ENCRYPTION_KEY || !encryptedText) return encryptedText;
  try {
    const [ivHex, encrypted] = encryptedText.split(':');
    if (!ivHex || !encrypted) return encryptedText; // Not encrypted format
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('[BiometricConfig] Decryption failed:', err.message);
    return encryptedText; // Return as-is
  }
};

// ─── Device Schema (Embedded) ──────────────────────────────────────────
const deviceSchema = new Schema({
  serialNumber: {
    type:     String,
    required: true,
    trim:     true,
    uppercase: true
  },
  name: {
    type:     String,
    required: true,
    trim:     true
  },
  location: {
    type:     String,
    trim:     true,
    default:  null
  },
  isActive: {
    type:    Boolean,
    default: true
  },
  syncEnabled: {
    type:    Boolean,
    default: true
  },
  lastSyncedAt: {
    type:    Date,
    default: null
  },
  lastSyncedRecordId: {
    type:    String,
    default: null
  },
  connectionStatus: {
    type:    String,
    enum:    ['ONLINE', 'OFFLINE', 'ERROR'],
    default: 'OFFLINE'
  },
  lastPingAt: {
    type:    Date,
    default: null
  },
  lastTestedAt: {
    type:    Date,
    default: null
  },
  lastError: {
    type:    String,
    default: null
  },
  addedAt: {
    type:    Date,
    default: Date.now
  }
}, { _id: true });

// ─── Main Config Schema ───────────────────────────────────────────────
const biometricConfigSchema = new Schema({
  // ─── Multi-Tenant Scope (UNIT-LEVEL) ────────────────────────────────
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
    unique:   true, // One config per unit
    index:    true
  },

  // ─── Feature Flag ───────────────────────────────────────────────────
  biometricEnabled: {
    type:    Boolean,
    default: false,
    index:   true
  },

  // ─── Vendor Configuration ───────────────────────────────────────────
  vendor: {
    type:    String,
    enum:    ['ESSL'], // Extensible for future vendors
    default: 'ESSL'
  },

  // ─── Server Configuration ───────────────────────────────────────────
  serverUrl: {
    type:     String,
    trim:     true,
    default:  null
    // e.g., "http://192.168.1.100/iclock/WebAPIService.asmx"
  },

  // ─── API Credentials (Encrypted at Rest) ────────────────────────────
  apiKey: {
    type:     String,
    default:  null,
    set:      encrypt,    // Encrypt on save
    get:      decrypt,    // Decrypt on read (only when accessed via getter)
    select:   false       // Hidden by default
  },
  
  username: {
    type:     String,
    trim:     true,
    default:  null
  },
  
  password: {
    type:     String,
    default:  null,
    set:      encrypt,
    get:      decrypt,
    select:   false
  },

  // ─── Devices List ───────────────────────────────────────────────────
  devices: {
    type: [deviceSchema],
    default: []
  },

  // ─── Sync Settings ──────────────────────────────────────────────────
  syncIntervalMinutes: {
    type:    Number,
    default: 5,
    min:     1,
    max:     60
  },

  // ─── Connection Tracking ───────────────────────────────────────────────
  connectionStatus: {
    type:    String,
    enum:    ['ONLINE', 'OFFLINE', 'ERROR', 'UNKNOWN'],
    default: 'UNKNOWN'
  },
  lastTestedAt: {
    type:    Date,
    default: null
  },
  lastError: {
    type:    String,
    default: null
  },

  // ─── Metadata ───────────────────────────────────────────────────────
  createdBy: {
    type:    Schema.Types.ObjectId,
    ref:     'User',
    default: null
  },
  updatedBy: {
    type:    Schema.Types.ObjectId,
    ref:     'User',
    default: null
  },
  isDeleted: {
    type:    Boolean,
    default: false
  }

}, {
  timestamps: true,
  toJSON:   { getters: true, virtuals: true },
  toObject: { getters: true, virtuals: true }
});

// ─── Indexes ────────────────────────────────────────────────────────────
biometricConfigSchema.index({ org_id: 1, company_id: 1, unit_id: 1 });
biometricConfigSchema.index({ 'devices.serialNumber': 1 }, { sparse: true });
biometricConfigSchema.index({ biometricEnabled: 1, unit_id: 1 });

// ─── Virtual: Active Devices Count ─────────────────────────────────────
biometricConfigSchema.virtual('activeDevicesCount').get(function() {
  return this.devices.filter(d => d.isActive).length;
});

// ─── Pre-Save Hook: Validate Config ────────────────────────────────────
// DISABLED - Validation moved to service layer for Mongoose 9.x compatibility
// biometricConfigSchema.pre('save', function(next) {
//   if (!this.biometricEnabled) return next();
//   if (!this.serverUrl || !this.username || !this.password) {
//     return next(new Error('Server URL, username, and password are required when biometric is enabled'));
//   }
//   next();
// });

// ─── Instance Method: Get Device by Serial ─────────────────────────────
biometricConfigSchema.methods.getDevice = function(serialNumber) {
  return this.devices.find(d => d.serialNumber === serialNumber);
};

// ─── Instance Method: Add Device ───────────────────────────────────────
biometricConfigSchema.methods.addDevice = function(deviceData) {
  // Check for duplicate serial number in this unit
  const exists = this.devices.some(d => d.serialNumber === deviceData.serialNumber);
  if (exists) {
    throw new Error(`Device with serial number ${deviceData.serialNumber} already exists in this unit`);
  }
  this.devices.push(deviceData);
  return this;
};

// ─── Instance Method: Remove Device ────────────────────────────────────
biometricConfigSchema.methods.removeDevice = function(serialNumber) {
  this.devices = this.devices.filter(d => d.serialNumber !== serialNumber);
  return this;
};

// ─── Instance Method: Update Device ───────────────────────────────────
biometricConfigSchema.methods.updateDevice = function(serialNumber, updates) {
  const device = this.devices.find(d => d.serialNumber === serialNumber);
  if (!device) {
    throw new Error(`Device ${serialNumber} not found`);
  }
  Object.assign(device, updates);
  return this;
};

// ─── Static: Find Config by Unit ───────────────────────────────────────
biometricConfigSchema.statics.findByUnit = function(orgId, companyId, unitId) {
  return this.findOne({
    org_id:     orgId,
    company_id: companyId,
    unit_id:    unitId,
    isDeleted:  false
  });
};

// ─── Static: Find All Enabled Configs ─────────────────────────────────
biometricConfigSchema.statics.findAllEnabled = function() {
  return this.find({
    biometricEnabled: true,
    isDeleted:        false
  });
};

// ─── Export ────────────────────────────────────────────────────────────
module.exports = mongoose.models.BiometricConfig || 
                 mongoose.model('BiometricConfig', biometricConfigSchema);
