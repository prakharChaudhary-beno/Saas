// modules/biometric/biometric.service.js
// Biometric Device Integration Service
//
// Orchestrates adapter calls, stores config, manages sync.
// Always uses adapter abstraction - never calls SOAP directly.
//
// Scope: UNIT-LEVEL (org_id + company_id + unit_id)

const BiometricConfig    = require('./models/biometricConfig.model');
const BiometricCommand   = require('./models/biometricCommand.model');
const BiometricSyncLog   = require('./models/biometricSyncLog.model');
const BiometricMapping   = require('./models/biometricMapping.model');
const BiometricCounter   = require('./models/biometricCounter.model');
const Employee           = require('../employee/models/employee.model');
const Attendance         = require('../attendance/models/attendance.model');
const AppError          = require('../../utils/appError');
const { createAdapter } = require('./adapters/biometricAdapter.interface');

// ─── Build Scope Filter ───────────────────────────────────────────────
const buildScopeFilter = (user) => {
  const filter = { 
    org_id:     user.orgId,
    company_id: user.companyId 
  };

  // Unit admin/manager only sees their unit
  if (user.level === 'unit') {
    filter.unit_id = user.unitId;
  }

  return filter;
};

// ─── Get/Decrypt Config Credentials ─────────────────────────────────────
const getDecryptedConfig = async (configId) => {
  const config = await BiometricConfig.findById(configId).select('+password +apiKey');
  if (!config) throw new AppError('Biometric config not found', 404);
  
  // Decrypt happens via schema getters when accessing
  return {
    serverUrl: config.serverUrl,
    apiKey:    config.apiKey,    // Already decrypted by getter
    username:  config.username,
    password:  config.password,  // Already decrypted by getter
    vendor:    config.vendor
  };
};

// ─── CREATE CONFIG (Unit-scoped) ─────────────────────────────────────────
exports.createConfig = async (payload, user) => {
  // Validate biometric config requirements
  if (payload.biometricEnabled) {
    if (!payload.serverUrl) {
      throw new AppError('Server URL is required when biometric is enabled', 400);
    }
    if (!payload.username) {
      throw new AppError('Username is required when biometric is enabled', 400);
    }
    if (!payload.password) {
      throw new AppError('Password is required when biometric is enabled', 400);
    }
  }
  
  // Validate unit belongs to user's scope
  const scopeFilter = buildScopeFilter(user);
  
  // Check if config already exists for this unit
  const existing = await BiometricConfig.findOne({
    ...scopeFilter,
    unit_id: payload.unit_id
  });

  if (existing) {
    throw new AppError('Biometric config already exists for this unit', 409);
  }

  // Create config
  const config = await BiometricConfig.create({
    ...payload,
    org_id:     user.orgId,
    company_id: user.companyId,
    createdBy:  user._id
  });

  return config.toObject({ getters: true });
};

// ─── UPDATE CONFIG ───────────────────────────────────────────────────────
exports.updateConfig = async (configId, updates, user) => {
  const scopeFilter = buildScopeFilter(user);
  
  // Find and validate scope
  const config = await BiometricConfig.findOne({
    _id:       configId,
    ...scopeFilter,
    isDeleted: false
  });

  if (!config) {
    throw new AppError('Biometric config not found', 404);
  }

  // Allowed updates
  const allowedUpdates = [
    'biometricEnabled', 'serverUrl', 'apiKey', 'username', 'password',
    'devices', 'syncIntervalMinutes'
  ];

  allowedUpdates.forEach(field => {
    if (updates[field] !== undefined) {
      config[field] = updates[field];
    }
  });

  config.updatedBy = user._id;
  await config.save();

  return config.toObject({ getters: true });
};

// ─── GET CONFIG ──────────────────────────────────────────────────────────
exports.getConfig = async (user) => {
  const scopeFilter = buildScopeFilter(user);
  
  const config = await BiometricConfig.findOne({
    ...scopeFilter,
    isDeleted: false
  });

  if (!config) return null;

  // Don't expose encrypted credentials in response
  const result = config.toObject({ getters: true });
  delete result.apiKey;
  delete result.password;

  return result;
};

// ─── TEST SERVER CONNECTION ─────────────────────────────────────────────────
exports.testServerConnection = async (configId, user) => {
  const scopeFilter = buildScopeFilter(user);
  
  const config = await BiometricConfig.findOne({
    _id:       configId,
    ...scopeFilter,
    isDeleted: false
  }).select('+password +apiKey').lean({ getters: true });

  if (!config) {
    throw new AppError('Biometric config not found', 404);
  }

  console.log('[DEBUG] Config loaded:', {
    serverUrl: config.serverUrl,
    hasUsername: !!config.username,
    hasPassword: !!config.password,
    hasApiKey: !!config.apiKey
  });

  if (!config.serverUrl || !config.username || !config.password) {
    throw new AppError('Server URL, username, and password are required', 400);
  }

  const adapter = createAdapter(config.vendor || 'ESSL', {
    serverUrl: config.serverUrl,
    apiKey:    config.apiKey || null,
    username:  config.username,
    password:  config.password
  });
  
  try {
    // Test the connection
    const testResult = await adapter.testConnection();

    // Update config with connection status
    await BiometricConfig.updateOne(
      { _id: configId },
      {
        $set: {
          connectionStatus: testResult.success ? 'ONLINE' : 'ERROR',
          lastTestedAt: new Date(),
          lastError: testResult.success ? null : testResult.error
        }
      }
    );

    if (!testResult.success) {
      throw new AppError(testResult.error || 'Connection test failed', 502);
    }

    return {
      status: 'ONLINE',
      message: 'Server connection successful',
      serverUrl: config.serverUrl,
      testedAt: config.lastTestedAt
    };
  } catch (err) {
    // Update config with error status
    config.connectionStatus = 'ERROR';
    config.lastTestedAt = new Date();
    config.lastError = err.message;
    await config.save();

    throw new AppError(`Server connection failed: ${err.message}`, 502);
  }
};

// ─── ADD DEVICE ───────────────────────────────────────────────────────────
exports.addDevice = async (configId, deviceData, user) => {
  const scopeFilter = buildScopeFilter(user);
  
  const config = await BiometricConfig.findOne({
    _id:       configId,
    ...scopeFilter,
    isDeleted: false
  });

  if (!config) {
    throw new AppError('Biometric config not found', 404);
  }

  try {
    config.addDevice(deviceData);
    await config.save();
    return config.devices[config.devices.length - 1];
  } catch (err) {
    throw new AppError(err.message, 400);
  }
};

// ─── UPDATE DEVICE ─────────────────────────────────────────────────────────
exports.updateDevice = async (configId, serialNumber, updates, user) => {
  const scopeFilter = buildScopeFilter(user);
  
  const config = await BiometricConfig.findOne({
    _id:       configId,
    ...scopeFilter,
    isDeleted: false
  });

  if (!config) {
    throw new AppError('Biometric config not found', 404);
  }

  try {
    config.updateDevice(serialNumber, updates);
    await config.save();
    return config.getDevice(serialNumber);
  } catch (err) {
    throw new AppError(err.message, 404);
  }
};

// ─── REMOVE DEVICE ─────────────────────────────────────────────────────────
exports.removeDevice = async (configId, serialNumber, user) => {
  const scopeFilter = buildScopeFilter(user);
  
  const config = await BiometricConfig.findOne({
    _id:       configId,
    ...scopeFilter,
    isDeleted: false
  });

  if (!config) {
    throw new AppError('Biometric config not found', 404);
  }

  config.removeDevice(serialNumber);
  await config.save();

  return { message: 'Device removed successfully' };
};

// ─── TEST DEVICE CONNECTION ───────────────────────────────────────────────
exports.testConnection = async (configId, serialNumber, user) => {
  const scopeFilter = buildScopeFilter(user);
  
  const config = await BiometricConfig.findOne({
    _id:       configId,
    ...scopeFilter,
    isDeleted: false
  }).select('+password +apiKey');

  if (!config) {
    throw new AppError('Biometric config not found', 404);
  }

  const device = config.getDevice(serialNumber);
  if (!device) {
    throw new AppError('Device not found', 404);
  }

  // Get decrypted credentials (password/apiKey are decrypted via schema getters)
  const credentials = {
    serverUrl: config.serverUrl,
    apiKey:    config.apiKey,
    username:  config.username,
    password:  config.password,
    vendor:    config.vendor
  };
  
  // Create adapter
  const adapter = createAdapter(config.vendor, credentials);

  // Test connection
  const result = await adapter.testConnection();

  // Update device status
  device.connectionStatus = result.success ? 'ONLINE' : 'OFFLINE';
  device.lastPingAt       = new Date();
  await config.save();

  return result;
};

// ─── PUSH EMPLOYEE TO DEVICE ──────────────────────────────────────────────
exports.pushEmployeeToDevice = async (configId, employeeId, serialNumber, user) => {
  const scopeFilter = buildScopeFilter(user);
  
  // Get config
  const config = await BiometricConfig.findOne({
    _id:       configId,
    ...scopeFilter,
    isDeleted: false,
    biometricEnabled: true
  });

  if (!config) {
    throw new AppError('Biometric not enabled for this unit', 400);
  }

  const device = config.getDevice(serialNumber);
  if (!device) {
    throw new AppError('Device not found', 404);
  }

  // Get employee
  const employee = await Employee.findOne({
    _id:       employeeId,
    ...scopeFilter,
    isDeleted: false
  });

  if (!employee) {
    throw new AppError('Employee not found', 404);
  }

  // Minimum biometricCode is 1001 (4-digit requirement for eSSL devices)
  const MIN_BIOMETRIC_CODE = 1001;

  // Generate biometricCode if not exists or too low
  let biometricCode = employee.biometricCode;
  if (!biometricCode || biometricCode < MIN_BIOMETRIC_CODE) {
    // Use atomic counter to prevent race conditions
    biometricCode = await getNextBiometricCode(config.unit_id);
    employee.biometricCode = biometricCode;
    await employee.save();
  }

  // Create adapter
  const credentials = await getDecryptedConfig(config._id);
  const adapter     = createAdapter(config.vendor, credentials);

  // Push to device
  const result = await adapter.pushEmployee({
    employeeCode: biometricCode,
    name:         employee.name,
    cardNumber:   employee.rfidCardNumber
  }, serialNumber);

  // Track command
  if (result.success && result.commandId) {
    try {
      await BiometricCommand.create({
        org_id:                  user.orgId,
        company_id:               user.companyId,
        unit_id:                  user.unitId || config.unit_id,
        commandId:                String(result.commandId),
        type:                     'ADD_EMPLOYEE',
        employeeId:               employee._id,
        biometricCode:            biometricCode,
        deviceSerialNumber:       serialNumber
      });
    } catch (cmdErr) {
      console.error('[BiometricService] Failed to track command:', cmdErr);
      // Don't fail the request if tracking fails
    }
  }

  return result;
};

// ─── GET NEXT BIOMETRIC CODE (Atomic) ───────────────────────────────────────
// Atomically returns the next valid biometric code for a unit
// Ensures code is >= 1001 (4-digit minimum for eSSL devices)
const getNextBiometricCode = async (unitId) => {
  const MIN_CODE = 1001;
  
  // First check highest existing code in employees collection
  const highestEmployee = await Employee.findOne({
    unit_id: unitId,
    biometricCode: { $exists: true, $ne: null, $gte: MIN_CODE }
  }).sort({ biometricCode: -1 }).lean();
  
  // Determine next code
  let nextCode = MIN_CODE;
  if (highestEmployee?.biometricCode && highestEmployee.biometricCode >= MIN_CODE) {
    nextCode = highestEmployee.biometricCode + 1;
  }
  
  // Atomic increment with conflict prevention
  const counter = await BiometricCounter.findOneAndUpdate(
    { unit_id: unitId },
    { $max: { sequenceValue: nextCode } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  
  // Increment by 1 and return
  const finalCounter = await BiometricCounter.findOneAndUpdate(
    { unit_id: unitId },
    { $inc: { sequenceValue: 1 } },
    { new: true }
  );
  
  return finalCounter.sequenceValue;
};

// ─── ENROLL FINGERPRINT ───────────────────────────────────────────────────
exports.enrollFingerprint = async (configId, serialNumber, payload, user) => {
  const scopeFilter = buildScopeFilter(user);
  
  const config = await BiometricConfig.findOne({
    _id:       configId,
    ...scopeFilter,
    isDeleted: false,
    biometricEnabled: true
  }).select('+password +apiKey');

  if (!config) {
    throw new AppError('Biometric not enabled for this unit', 404);
  }

  const device = config.getDevice(serialNumber);
  if (!device) {
    throw new AppError('Device not found', 404);
  }

  if (!payload.employeeCode) {
    throw new AppError('employeeCode is required', 400);
  }

  if (payload.fingerIndex === undefined || payload.fingerIndex < 0 || payload.fingerIndex > 9) {
    throw new AppError('fingerIndex is required and must be 0-9', 400);
  }

  // Create adapter
  const credentials = {
    serverUrl: config.serverUrl,
    apiKey:    config.apiKey,
    username:  config.username,
    password:  config.password,
    vendor:    config.vendor
  };
  const adapter = createAdapter(config.vendor, credentials);

  // Enroll fingerprint
  const result = await adapter.enrollFingerprint({
    deviceSerialNumber: serialNumber,
    employeeCode:       payload.employeeCode,
    fingerIndex:        payload.fingerIndex,
    overwrite:          payload.isOverWrite !== false
  });

  // Track command
  if (result.success && result.commandId) {
    await BiometricCommand.create({
      org_id:                user.orgId,
      company_id:             user.companyId,
      unit_id:                user.unitId || config.unit_id,
      commandId:              result.commandId,
      type:                   'ENROLL_FINGERPRINT',
      biometricCode:          payload.employeeCode,
      deviceSerialNumber:     serialNumber
    });
  }

  return result;
};

// ─── ENROLL FACE ───────────────────────────────────────────────────────────
exports.enrollFace = async (configId, serialNumber, payload, user) => {
  const scopeFilter = buildScopeFilter(user);
  
  const config = await BiometricConfig.findOne({
    _id:       configId,
    ...scopeFilter,
    isDeleted: false,
    biometricEnabled: true
  }).select('+password +apiKey');

  if (!config) {
    throw new AppError('Biometric not enabled for this unit', 404);
  }

  const device = config.getDevice(serialNumber);
  if (!device) {
    throw new AppError('Device not found', 404);
  }

  if (!payload.employeeCode) {
    throw new AppError('employeeCode is required', 400);
  }

  // Create adapter
  const credentials = {
    serverUrl: config.serverUrl,
    apiKey:    config.apiKey,
    username:  config.username,
    password:  config.password,
    vendor:    config.vendor
  };
  const adapter = createAdapter(config.vendor, credentials);

  // Enroll face
  const result = await adapter.enrollFace({
    deviceSerialNumber: serialNumber,
    employeeCode:       payload.employeeCode,
    overwrite:          payload.isOverWrite !== false
  });

  // Track command
  if (result.success && result.commandId) {
    await BiometricCommand.create({
      org_id:                user.orgId,
      company_id:             user.companyId,
      unit_id:                user.unitId || config.unit_id,
      commandId:              result.commandId,
      type:                   'ENROLL_FACE',
      biometricCode:          payload.employeeCode,
      deviceSerialNumber:     serialNumber
    });
  }

  return result;
};

// ─── PULL ATTENDANCE FROM DEVICE ───────────────────────────────────────────
exports.pullAttendanceFromDevice = async (configId, serialNumber, options, user) => {
  const scopeFilter = buildScopeFilter(user);
  
  // Get config
  const config = await BiometricConfig.findOne({
    _id:       configId,
    ...scopeFilter,
    isDeleted: false,
    biometricEnabled: true
  });

  if (!config) {
    throw new AppError('Biometric not enabled for this unit', 404);
  }

  const device = config.getDevice(serialNumber);
  if (!device) {
    throw new AppError('Device not found', 404);
  }

  // Create sync log
  const syncLog = await BiometricSyncLog.create({
    org_id:              user.orgId,
    company_id:           user.companyId,
    unit_id:              user.unitId || config.unit_id,
    deviceSerialNumber:   serialNumber,
    syncType:            options.isManual ? 'MANUAL' : 'SCHEDULED',
    status:              'RUNNING',
    triggeredBy:         user._id
  });

  try {
    // Create adapter
    const credentials = await getDecryptedConfig(config._id);
    const adapter     = createAdapter(config.vendor, credentials);

    // Determine time range
    const startTime = options?.startTime || new Date(Date.now() - 24 * 60 * 60 * 1000); // Default: last 24h
    const endTime   = options?.endTime || new Date();
    const fromRecordId = device.lastSyncedRecordId;

    // Pull transactions
    const result = await adapter.pullTransactions({
      startTime,
      endTime,
      fromRecordId
    }, serialNumber);

    if (!result.success) {
      syncLog.status = 'FAILED';
      syncLog.errorMessage = result.error;
      syncLog.completedAt = new Date();
      await syncLog.save();
      return result;
    }

    // Process records
    const processedResult = await processPunchRecords(
      result.records,
      config,
      device,
      user
    );

    // Update device sync status
    device.lastSyncedAt       = new Date();
    device.lastSyncedRecordId = result.lastRecordId || device.lastSyncedRecordId;
    await config.save();

    // Complete sync log
    await syncLog.complete({
      status:            processedResult.failedCount === 0 ? 'SUCCESS' : 'PARTIAL',
      recordsFetched:    result.records.length,
      recordsProcessed:  processedResult.processedCount,
      recordsMatched:    processedResult.matchedCount,
      recordsUnmatched:  processedResult.unmatchedCount,
      lastRecordId:      result.lastRecordId,
      unmatchedRecords:  processedResult.unmatchedRecords.slice(0, 100) // Limit to 100
    });

    return {
      success:        true,
      recordsFetched: result.records.length,
      recordsMatched: processedResult.matchedCount,
      recordsCreated: processedResult.createdCount,
      recordsUpdated: processedResult.updatedCount,
      unmatchedCount: processedResult.unmatchedCount,
      syncLogId:      syncLog._id
    };

  } catch (error) {
    syncLog.status       = 'FAILED';
    syncLog.errorMessage = error.message;
    syncLog.errorStack    = error.stack;
    syncLog.completedAt  = new Date();
    await syncLog.save();

    throw error;
  }
};

// ─── PROCESS PUNCH RECORDS ────────────────────────────────────────────────
const processPunchRecords = async (records, config, device, user) => {
  const result = {
    processedCount:  0,
    matchedCount:    0,
    unmatchedCount:  0,
    createdCount:    0,
    updatedCount:    0,
    failedCount:     0,
    unmatchedRecords: []
  };

  for (const record of records) {
    try {
      // Find employee by biometricCode
      const employee = await Employee.findOne({
        biometricCode: parseInt(record.employeeCode),
        org_id:        config.org_id,
        company_id:    config.company_id,
        unit_id:       config.unit_id,
        isDeleted:     false
      });

      if (!employee) {
        // Check manual mapping
        const mapping = await BiometricMapping.findByDeviceCode(
          device.serialNumber,
          record.employeeCode
        );

        if (mapping && mapping.employeeId) {
          result.matchedCount++;
          // Continue processing with mapped employee
          await updateAttendanceFromPunch(mapping.employeeId, record, config, user);
          result.processedCount++;
          continue;
        }

        // Unmapped - log for admin
        result.unmatchedCount++;
        result.unmatchedRecords.push({
          employeeCode: record.employeeCode,
          punchTime:    record.punchTime,
          punchType:    record.punchType,
          message:      'Employee not found with this biometric code'
        });
        continue;
      }

      result.matchedCount++;
      
      // Update attendance
      const attendanceResult = await updateAttendanceFromPunch(employee, record, config, user);
      
      if (attendanceResult.created) {
        result.createdCount++;
      } else {
        result.updatedCount++;
      }

      result.processedCount++;

    } catch (err) {
      console.error('[BiometricService] Error processing record:', err.message);
      result.failedCount++;
    }
  }

  return result;
};

// ─── UPDATE ATTENDANCE FROM PUNCH ──────────────────────────────────────────
const updateAttendanceFromPunch = async (employee, punchRecord, config, user) => {
  const punchDate = new Date(punchRecord.punchTime);
  punchDate.setUTCHours(0, 0, 0, 0);

  // Find or create attendance for this date
  let attendance = await Attendance.findOne({
    employee_id: employee._id,
    date:        punchDate,
    org_id:      config.org_id,
    company_id:  config.company_id
  });

  if (!attendance && punchRecord.punchType === 'CHECK_IN') {
    // Create new attendance record
    attendance = await Attendance.create({
      employee_id:          employee._id,
      date:                 punchDate,
      checkInTime:          punchRecord.punchTime,
      punchSource:          'BIOMETRIC',
      org_id:               config.org_id,
      company_id:           config.company_id,
      unit_id:              config.unit_id
    });
    return { created: true, attendance };
  }

  if (attendance) {
    // Update existing attendance
    if (punchRecord.punchType === 'CHECK_OUT') {
      attendance.checkOutTime = punchRecord.punchTime;
      attendance.punchSource  = 'BIOMETRIC_CLOSED';
    }
    
    await attendance.save();
    return { created: false, updated: true, attendance };
  }

  return { created: false, updated: false };
};

// ─── GET SYNC LOGS ─────────────────────────────────────────────────────────
exports.getSyncLogs = async (unitId, options, user) => {
  const scopeFilter = buildScopeFilter(user);
  
  const logs = await BiometricSyncLog.find({
    ...scopeFilter,
    unit_id: unitId
  })
  .sort({ startedAt: -1 })
  .limit(options.limit || 20);

  return logs;
};

// ─── GET SYNC LOG DETAILS ────────────────────────────────────────────────
exports.getSyncLogDetails = async (logId, user) => {
  const scopeFilter = buildScopeFilter(user);
  
  const log = await BiometricSyncLog.findOne({
    _id:           logId,
    ...scopeFilter
  });

  if (!log) {
    throw new AppError('Sync log not found', 404);
  }

  return log;
};

// ─── GET DEVICE STATUS ────────────────────────────────────────────────────
exports.getDeviceStatus = async (configId, serialNumber, user) => {
  const scopeFilter = buildScopeFilter(user);
  
  const config = await BiometricConfig.findOne({
    _id:       configId,
    ...scopeFilter,
    isDeleted: false
  });

  if (!config) {
    throw new AppError('Biometric config not found', 404);
  }

  const device = config.getDevice(serialNumber);
  if (!device) {
    throw new AppError('Device not found', 404);
  }

  return {
    serialNumber:    device.serialNumber,
    name:            device.name,
    isActive:        device.isActive,
    syncEnabled:     device.syncEnabled,
    connectionStatus: device.connectionStatus,
    lastSyncedAt:    device.lastSyncedAt,
    lastPingAt:      device.lastPingAt
  };
};

// ─── DELETE EMPLOYEE FROM DEVICE ──────────────────────────────────────────
exports.deleteEmployeeFromDevice = async (configId, employeeId, serialNumber, user) => {
  const scopeFilter = buildScopeFilter(user);
  
  const config = await BiometricConfig.findOne({
    _id:       configId,
    ...scopeFilter,
    isDeleted: false,
    biometricEnabled: true
  });

  if (!config) {
    throw new AppError('Biometric not enabled for this unit', 404);
  }

  const employee = await Employee.findOne({
    _id:       employeeId,
    ...scopeFilter,
    isDeleted: false
  });

  if (!employee || !employee.biometricCode) {
    throw new AppError('Employee not found or not registered on device', 404);
  }

  const credentials = await getDecryptedConfig(config._id);
  const adapter     = createAdapter(config.vendor, credentials);

  const result = await adapter.deleteEmployee(employee.biometricCode, serialNumber);

  if (result.success && result.commandId) {
    await BiometricCommand.create({
      org_id:              user.orgId,
      company_id:           user.companyId,
      unit_id:              user.unitId || config.unit_id,
      commandId:            result.commandId,
      type:                 'DELETE_EMPLOYEE',
      employeeId:           employee._id,
      biometricCode:        employee.biometricCode,
      deviceSerialNumber:   serialNumber
    });
  }

  return result;
};

// ─── GET COMMANDS ──────────────────────────────────────────────────────────
exports.getCommands = async (unitId, options, user) => {
  const scopeFilter = buildScopeFilter(user);
  
  const commands = await BiometricCommand.find({
    ...scopeFilter,
    unit_id: unitId
  })
  .sort({ createdAt: -1 })
  .limit(options.limit || 50);

  return commands;
};

// ─── POLL COMMAND STATUS ──────────────────────────────────────────────────
exports.pollCommandStatus = async (commandId, user) => {
  const command = await BiometricCommand.findById(commandId);
  
  if (!command) {
    throw new AppError('Command not found', 404);
  }

  // Check scope
  if (user.level === 'unit') {
    if (String(command.unit_id) !== String(user.unitId)) {
      throw new AppError('Access denied', 403);
    }
  }

  // Get config
  const config = await BiometricConfig.findOne({
    unit_id:    command.unit_id,
    isDeleted:  false
  });

  if (!config) {
    throw new AppError('Biometric config not found', 404);
  }

  // Create adapter and poll
  const credentials = await getDecryptedConfig(config._id);
  const adapter    = createAdapter(config.vendor, credentials);

  const result = await adapter.getCommandStatus(command.commandId, command.deviceSerialNumber);

  // Update command
  await command.incrementAttempt();

  if (result.success && result.data?.Status === 'SUCCESS') {
    await command.markSuccess(result.data);
  } else if (result.success && result.data?.Status === 'FAILED') {
    await command.markFailed(result.data?.Error || 'Command failed');
  }

  return command;
};

// ─── CREATE MANUAL MAPPING ─────────────────────────────────────────────────
exports.createMapping = async (payload, user) => {
  const scopeFilter = buildScopeFilter(user);
  
  // Check if mapping already exists
  const existing = await BiometricMapping.findOne({
    deviceSerialNumber: payload.deviceSerialNumber,
    deviceEmployeeCode: payload.deviceEmployeeCode,
    isDeleted:          false
  });

  if (existing) {
    throw new AppError('Mapping already exists for this device employee code', 409);
  }

  const mapping = await BiometricMapping.create({
    ...payload,
    org_id:     user.orgId,
    company_id: user.companyId,
    unit_id:    user.unitId || payload.unit_id,
    createdBy:  user._id
  });

  return mapping;
};

// ─── GET MAPPINGS ──────────────────────────────────────────────────────────
exports.getMappings = async (unitId, user) => {
  const scopeFilter = buildScopeFilter(user);
  
  const mappings = await BiometricMapping.find({
    ...scopeFilter,
    unit_id: unitId,
    isDeleted: false
  })
  .populate('employeeId')
  .sort({ createdAt: -1 });

  return mappings;
};

// ─── VERIFY MAPPING ────────────────────────────────────────────────────────
exports.verifyMapping = async (mappingId, user) => {
  const scopeFilter = buildScopeFilter(user);
  
  const mapping = await BiometricMapping.findOne({
    _id:       mappingId,
    ...scopeFilter,
    isDeleted: false
  });

  if (!mapping) {
    throw new AppError('Mapping not found', 404);
  }

  await mapping.verify(user._id);

  return mapping;
};

// ─── DELETE MAPPING ─────────────────────────────────────────────────────────
exports.deleteMapping = async (mappingId, user) => {
  const scopeFilter = buildScopeFilter(user);
  
  const mapping = await BiometricMapping.findOne({
    _id:       mappingId,
    ...scopeFilter,
    isDeleted: false
  });

  if (!mapping) {
    throw new AppError('Mapping not found', 404);
  }

  await mapping.removeMapping();

  return { message: 'Mapping removed successfully' };
};
