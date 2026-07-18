// modules/biometric/adapters/biometricAdapter.interface.js
// Vendor-Agnostic Biometric Device Adapter Interface
//
// All biometric vendors should implement this interface.
// Pass tests: biometricAdapter.test.js before merging.

/**
 * @typedef {Object} BiometricAdapter
 * @description Interface for biometric device integration
 */

/**
 * @typedef {Object} AdapterConfig
 * @property {string} serverUrl - Device server URL
 * @property {string} apiKey - Auth key (decrypted)
 * @property {string} username - Auth username
 * @property {string} password - Auth password (decrypted)
 * @property {Object} options - Vendor-specific options
 */

/**
 * @typedef {Object} EmployeePayload
 * @property {number} employeeCode - Numeric biometric code
 * @property {string} name - Employee full name
 * @property {string} [cardNumber] - RFID card number
 * @property {string} [employeeType] - 'REGULAR' | 'VIP'
 * @property {string} [groupCode] - User group code
 */

/**
 * @typedef {Object} CommandResult
 * @property {boolean} success
 * @property {string} [commandId] - Async command ID
 * @property {string} [error]
 * @property {Object} [data] - Response data
 */

/**
 * @typedef {Object} PunchRecord
 * @property {string} employeeCode - Device employee code
 * @property {Date} punchTime - Punch timestamp
 * @property {string} punchType - 'CHECK_IN' | 'CHECK_OUT' | 'CHECK_IN_BREAK' | 'CHECK_OUT_BREAK'
 * @property {string} [verifyType] - Verification method (FP, FACE, CARD, etc.)
 * @property {string} [workCode] - Work code
 * @property {string} [recordId] - Unique record ID
 */

/**
 * @typedef {Object} TransactionFilter
 * @property {Date} startTime - Start of date range
 * @property {Date} endTime - End of date range
 * @property {string} [fromRecordId] - Last record ID for pagination
 * @property {string[]} [employeeCodes] - Filter by specific employees
 * @property {number} [limit] - Max records to return
 */

class BiometricAdapterInterface {
  constructor(config) {
    if (new.target === BiometricAdapterInterface) {
      throw new Error('BiometricAdapterInterface is abstract and cannot be instantiated directly');
    }
    this.config = config;
    this.vendor = 'UNKNOWN';
  }

  /**
   * Test connection to device
   * @returns {Promise<CommandResult>}
   */
  async testConnection() {
    throw new Error('testConnection() must be implemented');
  }

  /**
   * Push employee to device
   * @param {EmployeePayload} employee
   * @param {string} deviceSerialNumber
   * @returns {Promise<CommandResult>}
   */
  async pushEmployee(employee, deviceSerialNumber) {
    throw new Error('pushEmployee() must be implemented');
  }

  /**
   * Push multiple employees to device
   * @param {EmployeePayload[]} employees
   * @param {string} deviceSerialNumber
   * @returns {Promise<CommandResult>}
   */
  async pushMultipleEmployees(employees, deviceSerialNumber) {
    throw new Error('pushMultipleEmployees() must be implemented');
  }

  /**
   * Delete employee from device
   * @param {number} employeeCode
   * @param {string} deviceSerialNumber
   * @returns {Promise<CommandResult>}
   */
  async deleteEmployee(employeeCode, deviceSerialNumber) {
    throw new Error('deleteEmployee() must be implemented');
  }

  /**
   * Block user on device
   * @param {Object} options - { employeeCode, employeeName, deviceSerialNumber }
   * @returns {Promise<CommandResult>}
   */
  async blockEmployee(options) {
    throw new Error('blockEmployee() must be implemented');
  }

  /**
   * Unblock user on device
   * @param {Object} options - { employeeCode, employeeName, deviceSerialNumber }
   * @returns {Promise<CommandResult>}
   */
  async unblockEmployee(options) {
    throw new Error('unblockEmployee() must be implemented');
  }

  /**
   * Initiate fingerprint enrollment
   * @param {Object} options - { employeeCode, deviceSerialNumber, fingerIndex?, overwrite? }
   * @returns {Promise<CommandResult>}
   */
  async enrollFingerprint(options) {
    throw new Error('enrollFingerprint() must be implemented');
  }

  /**
   * Initiate face enrollment
   * @param {Object} options - { employeeCode, deviceSerialNumber, overwrite? }
   * @returns {Promise<CommandResult>}
   */
  async enrollFace(options) {
    throw new Error('enrollFace() must be implemented');
  }

  /**
   * Get command status for async operations
   * @param {string} commandId
   * @returns {Promise<CommandResult>}
   */
  async getCommandStatus(commandId) {
    throw new Error('getCommandStatus() must be implemented');
  }

  /**
   * Pull transaction logs (attendance punches)
   * @param {Object} options - { deviceSerialNumber, fromDateTime, toDateTime }
   * @returns {Promise<{ success: boolean, records: PunchRecord[], error?: string }>}
   */
  async pullTransactions(options) {
    throw new Error('pullTransactions() must be implemented');
  }

  /**
   * Get device status (online, offline, etc.)
   * @param {string} deviceSerialNumber
   * @returns {Promise<{ success: boolean, status: string, error?: string }>}
   */
  async getDeviceStatus(deviceSerialNumber) {
    throw new Error('getDeviceStatus() must be implemented');
  }

  /**
   * Push leave entries to device
   * @param {Object[]} leaveEntries
   * @param {string} deviceSerialNumber
   * @returns {Promise<CommandResult>}
   */
  async pushLeaveEntries(leaveEntries, deviceSerialNumber) {
    throw new Error('pushLeaveEntries() must be implemented');
  }

  /**
   * Push holidays to device
   * @param {Object[]} holidays
   * @param {string} deviceSerialNumber
   * @returns {Promise<CommandResult>}
   */
  async pushHolidays(holidays, deviceSerialNumber) {
    throw new Error('pushHolidays() must be implemented');
  }

  /**
   * Get employees on device (if supported)
   * @param {string} deviceSerialNumber
   * @returns {Promise<{ success: boolean, employees?: Object[], error?: string }>}
   */
  async getDeviceEmployees(deviceSerialNumber) {
    // Note: eSSL doesn't support this
    return { success: false, employees: [], error: 'Not supported by this vendor' };
  }

  /**
   * Health check - lightweight ping
   * @param {string} deviceSerialNumber
   * @returns {Promise<{ success: boolean, latencyMs: number }>}
   */
  async healthCheck(deviceSerialNumber) {
    const start = Date.now();
    try {
      await this.testConnection();
      return { success: true, latencyMs: Date.now() - start };
    } catch (err) {
      return { success: false, latencyMs: Date.now() - start };
    }
  }
}

/**
 * Adapter factory - creates adapter based on vendor type
 * @param {string} vendor - Vendor name ('ESSL')
 * @param {AdapterConfig} config
 * @returns {BiometricAdapterInterface}
 */
function createAdapter(vendor, config) {
  switch (vendor.toUpperCase()) {
    case 'ESSL':
      const { ESSLAdapter } = require('./essl.adapter');
      return new ESSLAdapter(config);
    default:
      throw new Error(`Unknown biometric vendor: ${vendor}`);
  }
}

module.exports = {
  BiometricAdapterInterface,
  createAdapter
};
