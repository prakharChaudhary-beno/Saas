// modules/biometric/biometric.controller.js
// Biometric Device Integration Controller
//
// REST endpoints for biometric configuration, sync, and management.
// Unit-scoped access (org_id + company_id + unit_id).

const biometricService = require('./biometric.service');

// ─── CONFIG ENDPOINTS ───────────────────────────────────────────────────

// GET /api/v1/biometric/config
exports.getConfig = async (req, res, next) => {
  try {
    const config = await biometricService.getConfig(req.user);
    
    res.status(200).json({
      success: true,
      data:    config
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/biometric/config
exports.createConfig = async (req, res, next) => {
  try {
    const config = await biometricService.createConfig(req.body, req.user);
    
    res.status(201).json({
      success: true,
      message: 'Biometric config created successfully',
      data:    config
    });
  } catch (err) {
    next(err);
  }
};

// PUT /api/v1/biometric/config/:configId
exports.updateConfig = async (req, res, next) => {
  try {
    const config = await biometricService.updateConfig(
      req.params.configId,
      req.body,
      req.user
    );
    
    res.status(200).json({
      success: true,
      message: 'Biometric config updated successfully',
      data:    config
    });
  } catch (err) {
    next(err);
  }
};

// ─── DEVICE ENDPOINTS ─────────────────────────────────────────────────────

// POST /api/v1/biometric/config/:configId/devices
exports.addDevice = async (req, res, next) => {
  try {
    const device = await biometricService.addDevice(
      req.params.configId,
      req.body,
      req.user
    );
    
    res.status(201).json({
      success: true,
      message: 'Device added successfully',
      data:    device
    });
  } catch (err) {
    next(err);
  }
};

// PUT /api/v1/biometric/config/:configId/devices/:serialNumber
exports.updateDevice = async (req, res, next) => {
  try {
    const device = await biometricService.updateDevice(
      req.params.configId,
      req.params.serialNumber,
      req.body,
      req.user
    );
    
    res.status(200).json({
      success: true,
      message: 'Device updated successfully',
      data:    device
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/v1/biometric/config/:configId/devices/:serialNumber
exports.removeDevice = async (req, res, next) => {
  try {
    await biometricService.removeDevice(
      req.params.configId,
      req.params.serialNumber,
      req.user
    );
    
    res.status(200).json({
      success: true,
      message: 'Device removed successfully'
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/biometric/config/:configId/test
exports.testServerConnection = async (req, res, next) => {
  try {
    const result = await biometricService.testServerConnection(
      req.params.configId,
      req.user
    );
    
    res.status(200).json({
      success: true,
      message: 'Server connection successful',
      data:    result
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/biometric/config/:configId/devices/:serialNumber/test
exports.testConnection = async (req, res, next) => {
  try {
    const result = await biometricService.testConnection(
      req.params.configId,
      req.params.serialNumber,
      req.user
    );
    
    res.status(200).json({
      success: result.success,
      message: result.success ? 'Device connection successful' : 'Device connection failed',
      data:    result
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/biometric/config/:configId/devices/:serialNumber/status
exports.getDeviceStatus = async (req, res, next) => {
  try {
    const status = await biometricService.getDeviceStatus(
      req.params.configId,
      req.params.serialNumber,
      req.user
    );
    
    res.status(200).json({
      success: true,
      data:    status
    });
  } catch (err) {
    next(err);
  }
};

// ─── EMPLOYEE PUSH ENDPOINTS ───────────────────────────────────────────────

// POST /api/v1/biometric/config/:configId/employees/:employeeId/push
exports.pushEmployeeToDevice = async (req, res, next) => {
  try {
    const result = await biometricService.pushEmployeeToDevice(
      req.params.configId,
      req.params.employeeId,
      req.params.serialNumber || req.body.serialNumber,
      req.user
    );
    
    res.status(200).json({
      success: result.success,
      message: result.success ? 'Employee pushed to device' : result.error,
      data:    result
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/v1/biometric/config/:configId/employees/:employeeId/device/:serialNumber
exports.deleteEmployeeFromDevice = async (req, res, next) => {
  try {
    const result = await biometricService.deleteEmployeeFromDevice(
      req.params.configId,
      req.params.employeeId,
      req.params.serialNumber,
      req.user
    );
    
    res.status(200).json({
      success: result.success,
      message: result.success ? 'Employee deleted from device' : result.error,
      data:    result
    });
  } catch (err) {
    next(err);
  }
};

// ─── ATTENDANCE SYNC ENDPOINTS ────────────────────────────────────────────

// POST /api/v1/biometric/config/:configId/devices/:serialNumber/sync
exports.pullAttendanceFromDevice = async (req, res, next) => {
  try {
    const result = await biometricService.pullAttendanceFromDevice(
      req.params.configId,
      req.params.serialNumber,
      {
        startTime: req.body.startTime ? new Date(req.body.startTime) : undefined,
        endTime:   req.body.endTime ? new Date(req.body.endTime) : undefined,
        isManual:  true
      },
      req.user
    );
    
    res.status(200).json({
      success: result.success,
      message: result.success ? 'Attendance synced successfully' : 'Sync failed',
      data:    result
    });
  } catch (err) {
    next(err);
  }
};

// ─── ENROLLMENT ENDPOINTS ───────────────────────────────────────────────

// POST /api/v1/biometric/config/:configId/devices/:serialNumber/enroll-fp
exports.enrollFingerprint = async (req, res, next) => {
  try {
    const result = await biometricService.enrollFingerprint(
      req.params.configId,
      req.params.serialNumber,
      req.body,
      req.user
    );
    
    res.status(200).json({
      success: result.success,
      message: result.success ? 'Fingerprint enrollment initiated' : result.error,
      data:    result
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/biometric/config/:configId/devices/:serialNumber/enroll-face
exports.enrollFace = async (req, res, next) => {
  try {
    const result = await biometricService.enrollFace(
      req.params.configId,
      req.params.serialNumber,
      req.body,
      req.user
    );
    
    res.status(200).json({
      success: result.success,
      message: result.success ? 'Face enrollment initiated' : result.error,
      data:    result
    });
  } catch (err) {
    next(err);
  }
};

// ─── SYNC LOGS ENDPOINTS ──────────────────────────────────────────────────

// GET /api/v1/biometric/units/:unitId/logs
exports.getSyncLogs = async (req, res, next) => {
  try {
    const logs = await biometricService.getSyncLogs(
      req.params.unitId,
      req.query,
      req.user
    );
    
    res.status(200).json({
      success: true,
      count:   logs.length,
      data:    logs
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/biometric/logs/:logId
exports.getSyncLogDetails = async (req, res, next) => {
  try {
    const log = await biometricService.getSyncLogDetails(
      req.params.logId,
      req.user
    );
    
    res.status(200).json({
      success: true,
      data:    log
    });
  } catch (err) {
    next(err);
  }
};

// ─── COMMAND ENDPOINTS ───────────────────────────────────────────────────

// GET /api/v1/biometric/units/:unitId/commands
exports.getCommands = async (req, res, next) => {
  try {
    const commands = await biometricService.getCommands(
      req.params.unitId,
      req.query,
      req.user
    );
    
    res.status(200).json({
      success: true,
      count:   commands.length,
      data:    commands
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/biometric/commands/:commandId/status
exports.pollCommandStatus = async (req, res, next) => {
  try {
    const command = await biometricService.pollCommandStatus(
      req.params.commandId,
      req.user
    );
    
    res.status(200).json({
      success: command.status === 'SUCCESS',
      status:  command.status,
      data:    command
    });
  } catch (err) {
    next(err);
  }
};

// ─── MAPPING ENDPOINTS ────────────────────────────────────────────────────

// POST /api/v1/biometric/mappings
exports.createMapping = async (req, res, next) => {
  try {
    const mapping = await biometricService.createMapping(req.body, req.user);
    
    res.status(201).json({
      success: true,
      message: 'Mapping created successfully',
      data:    mapping
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/biometric/units/:unitId/mappings
exports.getMappings = async (req, res, next) => {
  try {
    const mappings = await biometricService.getMappings(
      req.params.unitId,
      req.user
    );
    
    res.status(200).json({
      success: true,
      count:   mappings.length,
      data:    mappings
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/v1/biometric/mappings/:mappingId/verify
exports.verifyMapping = async (req, res, next) => {
  try {
    const mapping = await biometricService.verifyMapping(
      req.params.mappingId,
      req.user
    );
    
    res.status(200).json({
      success: true,
      message: 'Mapping verified successfully',
      data:    mapping
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/v1/biometric/mappings/:mappingId
exports.deleteMapping = async (req, res, next) => {
  try {
    await biometricService.deleteMapping(
      req.params.mappingId,
      req.user
    );
    
    res.status(200).json({
      success: true,
      message: 'Mapping removed successfully'
    });
  } catch (err) {
    next(err);
  }
};
