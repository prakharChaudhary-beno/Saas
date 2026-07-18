// modules/biometric/biometric.routes.js
// Biometric Device Integration Routes
//
// Unit-scoped biometric configuration and management.
// Access: company_admin, unit_admin only.

const express          = require('express');
const router           = express.Router();
const { authenticate } = require('../../middlewares/auth.middleware');
const checkPermission  = require('../../middlewares/permission.middleware');
const controller       = require('./biometric.controller');

// ─── All routes require authentication ─────────────────────────────────────
router.use(authenticate);

// ══════════════════════════════════════════════════════════════════════════
// CONFIG ROUTES
// ══════════════════════════════════════════════════════════════════════════

// GET /api/v1/biometric/config
// Get biometric config for user's unit
router.get(
  '/config',
  checkPermission('biometric.read'),
  controller.getConfig
);

// POST /api/v1/biometric/config
// Create biometric config for a unit
router.post(
  '/config',
  checkPermission('biometric.create'),
  controller.createConfig
);

// PUT /api/v1/biometric/config/:configId
// Update biometric config
router.put(
  '/config/:configId',
  checkPermission('biometric.update'),
  controller.updateConfig
);

// POST /api/v1/biometric/config/:configId/test
// Test server connection (before adding devices)
router.post(
  '/config/:configId/test',
  checkPermission('biometric.read'),
  controller.testServerConnection
);

// ══════════════════════════════════════════════════════════════════════════
// DEVICE ROUTES
// ══════════════════════════════════════════════════════════════════════════

// POST /api/v1/biometric/config/:configId/devices
// Add device to config
router.post(
  '/config/:configId/devices',
  checkPermission('biometric.create'),
  controller.addDevice
);

// PUT /api/v1/biometric/config/:configId/devices/:serialNumber
// Update device
router.put(
  '/config/:configId/devices/:serialNumber',
  checkPermission('biometric.update'),
  controller.updateDevice
);

// DELETE /api/v1/biometric/config/:configId/devices/:serialNumber
// Remove device
router.delete(
  '/config/:configId/devices/:serialNumber',
  checkPermission('biometric.delete'),
  controller.removeDevice
);

// POST /api/v1/biometric/config/:configId/devices/:serialNumber/test
// Test device connection
router.post(
  '/config/:configId/devices/:serialNumber/test',
  checkPermission('biometric.read'),
  controller.testConnection
);

// GET /api/v1/biometric/config/:configId/devices/:serialNumber/status
// Get device status
router.get(
  '/config/:configId/devices/:serialNumber/status',
  checkPermission('biometric.read'),
  controller.getDeviceStatus
);

// ══════════════════════════════════════════════════════════════════════════
// EMPLOYEE PUSH/DELETE ROUTES
// ══════════════════════════════════════════════════════════════════════════

// POST /api/v1/biometric/config/:configId/employees/:employeeId/push
// Push employee to device
router.post(
  '/config/:configId/employees/:employeeId/push',
  checkPermission('biometric.update'),
  controller.pushEmployeeToDevice
);

// DELETE /api/v1/biometric/config/:configId/employees/:employeeId/device/:serialNumber
// Delete employee from device
router.delete(
  '/config/:configId/employees/:employeeId/device/:serialNumber',
  checkPermission('biometric.delete'),
  controller.deleteEmployeeFromDevice
);

// ══════════════════════════════════════════════════════════════════════════
// ATTENDANCE SYNC ROUTES
// ══════════════════════════════════════════════════════════════════════════

// POST /api/v1/biometric/config/:configId/devices/:serialNumber/sync
// Pull attendance from device manually
router.post(
  '/config/:configId/devices/:serialNumber/sync',
  checkPermission('biometric.update'),
  controller.pullAttendanceFromDevice
);

// POST /api/v1/biometric/config/:configId/devices/:serialNumber/enroll-fp
// Enroll fingerprint
router.post(
  '/config/:configId/devices/:serialNumber/enroll-fp',
  checkPermission('biometric.update'),
  controller.enrollFingerprint
);

// POST /api/v1/biometric/config/:configId/devices/:serialNumber/enroll-face
// Enroll face
router.post(
  '/config/:configId/devices/:serialNumber/enroll-face',
  checkPermission('biometric.update'),
  controller.enrollFace
);

// ══════════════════════════════════════════════════════════════════════════
// SYNC LOGS ROUTES
// ══════════════════════════════════════════════════════════════════════════

// GET /api/v1/biometric/units/:unitId/logs
// Get sync logs for a unit
router.get(
  '/units/:unitId/logs',
  checkPermission('biometric.read'),
  controller.getSyncLogs
);

// GET /api/v1/biometric/logs/:logId
// Get sync log details
router.get(
  '/logs/:logId',
  checkPermission('biometric.read'),
  controller.getSyncLogDetails
);

// ══════════════════════════════════════════════════════════════════════════
// COMMAND ROUTES
// ══════════════════════════════════════════════════════════════════════════

// GET /api/v1/biometric/units/:unitId/commands
// Get commands for a unit
router.get(
  '/units/:unitId/commands',
  checkPermission('biometric.read'),
  controller.getCommands
);

// GET /api/v1/biometric/commands/:commandId/status
// Poll command status
router.get(
  '/commands/:commandId/status',
  checkPermission('biometric.read'),
  controller.pollCommandStatus
);

// ══════════════════════════════════════════════════════════════════════════
// MAPPING ROUTES
// ══════════════════════════════════════════════════════════════════════════

// POST /api/v1/biometric/mappings
// Create manual mapping (for pre-existing device employees)
router.post(
  '/mappings',
  checkPermission('biometric.create'),
  controller.createMapping
);

// GET /api/v1/biometric/units/:unitId/mappings
// Get mappings for a unit
router.get(
  '/units/:unitId/mappings',
  checkPermission('biometric.read'),
  controller.getMappings
);

// PATCH /api/v1/biometric/mappings/:mappingId/verify
// Verify mapping
router.patch(
  '/mappings/:mappingId/verify',
  checkPermission('biometric.update'),
  controller.verifyMapping
);

// DELETE /api/v1/biometric/mappings/:mappingId
// Delete mapping
router.delete(
  '/mappings/:mappingId',
  checkPermission('biometric.delete'),
  controller.deleteMapping
);

module.exports = router;
