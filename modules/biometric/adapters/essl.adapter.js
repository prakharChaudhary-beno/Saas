// modules/biometric/adapters/essl.adapter.js
// eSSL eTimetracklite Biometric Device Adapter
//
// Implements BiometricAdapterInterface for eSSL devices.
// Uses BiometricSoapClient for low-level communication.
//
// Key Notes:
// - EmployeeCode MUST be numeric (digits only)
// - All operations return CommandId for async status tracking
// - Master device serial number required for bulk operations

const { BiometricAdapterInterface } = require('./biometricAdapter.interface');
const { BiometricSoapClient }       = require('../biometricSoap.client');

/**
 * ESSL Adapter Configuration
 * @typedef {Object} ESSLConfig
 * @property {string} serverUrl - Device server URL (e.g., "http://192.168.1.100/iclock/WebAPIService.asmx")
 * @property {string} apiKey - API key (decrypted)
 * @property {string} username - Auth username
 * @property {string} password - Auth password (decrypted)
 */

class ESSLAdapter extends BiometricAdapterInterface {
  /**
   * @param {ESSLConfig} config
   */
  constructor(config) {
    super(config);
    this.vendor     = 'ESSL';
    this.soapClient = new BiometricSoapClient(config);
  }

  // ─── Connection ────────────────────────────────────────────────────────

  async testConnection() {
    const result = await this.soapClient.testConnection();
    
    if (result.success) {
      return { 
        success: true, 
        message: result.message || 'Connection successful'
      };
    }
    
    return { 
      success: false, 
      error: result.error || 'Connection failed' 
    };
  }

  // ─── Employee Operations ───────────────────────────────────────────────

  /**
   * Push single employee to device
   * 
   * @param {Object} employee - Employee data
   * @param {string} deviceSerialNumber - Device serial number
   * @returns {Promise<{success: boolean, commandId?: string, error?: string}>}
   */
  async pushEmployee(employee, deviceSerialNumber) {
    try {
      console.log(`[ESSLAdapter] pushEmployee called:`, {
        employeeCode: employee.employeeCode,
        name: employee.name,
        serialNumber: deviceSerialNumber
      });
      
      const result = await this.soapClient.addEmployee({
        serialNumber:   deviceSerialNumber,
        employeeCode:   String(employee.employeeCode),
        employeeName:   employee.name,
        cardNumber:     employee.cardNumber || ''
      });

      console.log(`[ESSLAdapter] pushEmployee result:`, JSON.stringify(result));

      if (result.success && result.commandId) {
        return {
          success:   true,
          commandId: String(result.commandId),
          rawResult: result.rawResult
        };
      }

      // Provide more context for server errors
      let errorMsg = result.error || 'Failed to add employee';
      if (result.isServerError) {
        errorMsg = `Device server error: ${errorMsg}. Check if device is online and credentials are correct.`;
      }

      return {
        success: false,
        error:   errorMsg,
        details: result.details
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Push multiple employees to master device
   * 
   * @param {Object[]} employees - Array of {employeeCode, name, cardNumber?}
   * @param {string} masterDeviceSerial - Master device serial number
   * @returns {Promise<{success: boolean, commandIds?: string[], error?: string}>}
   */
  async pushMultipleEmployees(employees, masterDeviceSerial) {
    try {
      // Format for eSSL: [{"EmployeeCode":"1600"},{"EmployeeCode":"1700"}]
      const formattedEmployees = employees.map(e => ({
        EmployeeCode: String(e.employeeCode)
      }));

      const result = await this.soapClient.addMultipleEmployees(masterDeviceSerial, formattedEmployees);

      if (result.success && result.commandId) {
        return {
          success:    true,
          commandId:  String(result.commandId),
          rawResult:  result.rawResult
        };
      }

      return {
        success: false,
        error:   result.error || 'Failed to add employees'
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Delete employee from device
   * 
   * @param {string} employeeCode - Employee code to delete
   * @param {string} deviceSerialNumber - Device serial number
   * @returns {Promise<{success: boolean, commandId?: string, error?: string}>}
   */
  async deleteEmployee(employeeCode, deviceSerialNumber) {
    try {
      const result = await this.soapClient.deleteUser(deviceSerialNumber, employeeCode);

      if (result.success && result.commandId) {
        return {
          success:    true,
          commandId:  String(result.commandId),
          rawResult:  result.rawResult
        };
      }

      return {
        success: false,
        error:   result.error || 'Failed to delete employee'
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Delete multiple employees from master device
   * 
   * @param {string[]} employeeCodes - Array of employee codes to delete
   * @param {string} masterDeviceSerial - Master device serial number
   * @returns {Promise<{success: boolean, commandId?: string, error?: string}>}
   */
  async deleteMultipleEmployees(employeeCodes, masterDeviceSerial) {
    try {
      // Format for eSSL: [{"EmployeeCode":"1600"},{"EmployeeCode":"1700"}]
      const formattedCodes = employeeCodes.map(code => ({
        EmployeeCode: String(code)
      }));

      const result = await this.soapClient.deleteMultipleEmployees(masterDeviceSerial, formattedCodes);

      if (result.success && result.commandId) {
        return {
          success:    true,
          commandId:  String(result.commandId),
          rawResult:  result.rawResult
        };
      }

      return {
        success: false,
        error:   result.error || 'Failed to delete employees'
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Block employee on device
   * 
   * @param {Object} options
   * @param {string} options.employeeCode - Employee code
   * @param {string} options.employeeName - Employee name
   * @param {string} options.deviceSerialNumber - Device serial number
   * @returns {Promise<{success: boolean, commandId?: string, error?: string}>}
   */
  async blockEmployee(options) {
    try {
      const result = await this.soapClient.blockUnblockUser({
        serialNumber:   options.deviceSerialNumber || options.serialNumber,
        employeeCode:   String(options.employeeCode),
        employeeName:   options.employeeName,
        isBlock:        true
      });

      if (result.success && result.commandId) {
        return {
          success:    true,
          commandId:  String(result.commandId),
          rawResult:  result.rawResult
        };
      }

      return {
        success: false,
        error:   result.error || 'Failed to block employee'
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Unblock employee on device
   * 
   * @param {Object} options
   * @param {string} options.employeeCode - Employee code
   * @param {string} options.employeeName - Employee name
   * @param {string} options.deviceSerialNumber - Device serial number
   * @returns {Promise<{success: boolean, commandId?: string, error?: string}>}
   */
  async unblockEmployee(options) {
    try {
      const result = await this.soapClient.blockUnblockUser({
        serialNumber:   options.deviceSerialNumber || options.serialNumber,
        employeeCode:   String(options.employeeCode),
        employeeName:   options.employeeName,
        isBlock:        false
      });

      if (result.success && result.commandId) {
        return {
          success:    true,
          commandId:  String(result.commandId),
          rawResult:  result.rawResult
        };
      }

      return {
        success: false,
        error:   result.error || 'Failed to unblock employee'
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // ─── Enrollment Operations ───────────────────────────────────────────────

  /**
   * Initiate fingerprint enrollment
   * 
   * @param {Object} options
   * @param {string} options.employeeCode - Employee code
   * @param {string} options.deviceSerialNumber - Device serial number
   * @param {number} [options.fingerIndex=0] - Finger index (0-9)
   * @param {boolean} [options.overwrite=true] - Overwrite existing template
   * @returns {Promise<{success: boolean, commandId?: string, error?: string}>}
   */
  async enrollFingerprint(options) {
    try {
      const result = await this.soapClient.enrollUserFP({
        serialNumber:   options.deviceSerialNumber || options.serialNumber,
        employeeCode:   String(options.employeeCode),
        fingerIndex:     options.fingerIndex ?? 0,
        isOverWrite:     options.overwrite ?? true
      });

      if (result.success && result.commandId) {
        return {
          success:    true,
          commandId:  String(result.commandId),
          rawResult:  result.rawResult
        };
      }

      return {
        success: false,
        error:   result.error || 'Failed to initiate fingerprint enrollment'
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Initiate face enrollment
   * 
   * @param {Object} options
   * @param {string} options.employeeCode - Employee code
   * @param {string} options.deviceSerialNumber - Device serial number
   * @param {boolean} [options.overwrite=true] - Overwrite existing template
   * @returns {Promise<{success: boolean, commandId?: string, error?: string}>}
   */
  async enrollFace(options) {
    try {
      const result = await this.soapClient.enrollUserFace({
        serialNumber:   options.deviceSerialNumber || options.serialNumber,
        employeeCode:   String(options.employeeCode),
        isOverWrite:     options.overwrite ?? true
      });

      if (result.success && result.commandId) {
        return {
          success:    true,
          commandId:  String(result.commandId),
          rawResult:  result.rawResult
        };
      }

      return {
        success: false,
        error:   result.error || 'Failed to initiate face enrollment'
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // ─── Command Status Tracking ───────────────────────────────────────────

  /**
   * Get command status
   * 
   * @param {string} commandId - Command ID to check
   * @returns {Promise<{success: boolean, status?: string, error?: string}>}
   */
  async getCommandStatus(commandId) {
    try {
      const result = await this.soapClient.getCommandStatus(commandId);

      if (result.success) {
        return {
          success:  true,
          status:   result.rawResult || result.result,
          commandId: result.commandId ? String(result.commandId) : commandId
        };
      }

      return {
        success: false,
        error:   result.error || 'Failed to get command status'
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // ─── Transaction Sync (Attendance Pull) ─────────────────────────────────

  /**
   * Pull transaction logs (attendance punches) from device
   * 
   * @param {Object} options
   * @param {string} options.deviceSerialNumber - Device serial number
   * @param {Date|string} options.fromDateTime - Start datetime
   * @param {Date|string} options.toDateTime - End datetime
   * @returns {Promise<{success: boolean, records?: Object[], error?: string}>}
   */
  async pullTransactions(options) {
    try {
      const result = await this.soapClient.getTransactionsLog({
        serialNumber:   options.deviceSerialNumber || options.serialNumber,
        fromDateTime:   options.fromDateTime,
        toDateTime:     options.toDateTime
      });

      if (result.success) {
        // Parse transaction data from strDataList
        const records = this._parseTransactions(result.strDataList || result.rawResult);
        
        return {
          success: true,
          records: records,
          raw:     result.rawResult
        };
      }

      return {
        success: false,
        records: [],
        error:   result.error || 'Failed to fetch transactions'
      };
    } catch (err) {
      return { success: false, records: [], error: err.message };
    }
  }

  /**
   * Parse transaction data from device response
   * 
   * @private
   * @param {string} rawData - Raw transaction data from device
   * @returns {Object[]} Array of standardized transaction records
   */
  _parseTransactions(rawData) {
    if (!rawData) return [];

    try {
      // Try to parse as JSON if applicable
      if (typeof rawData === 'string' && rawData.trim().startsWith('[')) {
        const transactions = JSON.parse(rawData);
        return transactions.map(t => this._normalizeTransaction(t));
      }

      // Parse plain text format if JSON parsing fails
      // Format varies by device, typically: "EmployeeCode\tDateTime\tPunchType"
      if (typeof rawData === 'string') {
        const lines = rawData.split(/[\r\n]+/).filter(Boolean);
        return lines.map(line => {
          const parts = line.split('\t');
          return {
            employeeCode: parts[0] || '',
            punchTime:    parts[1] ? new Date(parts[1]) : null,
            punchType:    this._mapPunchType(parts[2]),
            verifyType:   'UNKNOWN',
            rawLine:      line
          };
        }).filter(t => t.employeeCode);
      }

      // Handle object format
      if (typeof rawData === 'object' && !Array.isArray(rawData)) {
        return [this._normalizeTransaction(rawData)];
      }

      return [];
    } catch (err) {
      console.error('[ESSLAdapter] Transaction parse error:', err.message);
      return [];
    }
  }

  /**
   * Normalize a single transaction record
   * @private
   */
  _normalizeTransaction(t) {
    return {
      employeeCode: String(t.EmployeeCode || t.employeeCode || t.EmployeeCode || ''),
      punchTime:    this._parseDateTime(t.DateTime || t.PunchTime || t.punchTime),
      punchType:    this._mapPunchType(t.PunchType || t.punchType || '0'),
      verifyType:   t.VerifyType || t.verifyType || 'FINGER',
      workCode:     t.WorkCode || t.workCode || '',
      recordId:     t.RecordId || t.recordId || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
  }

  /**
   * Parse datetime string from device
   * @private
   */
  _parseDateTime(dateStr) {
    if (!dateStr) return null;
    try {
      // Handle various date formats
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  }

  /**
   * Map punch type code to standardized format
   * @private
   */
  _mapPunchType(type) {
    const typeStr = String(type || '0');
    
    // Common eSSL punch type mappings
    const punchTypeMap = {
      '0':    'CHECK_IN',
      '1':    'CHECK_OUT',
      '2':    'BREAK_OUT',
      '3':    'BREAK_IN',
      '4':    'OVERTIME_IN',
      '5':    'OVERTIME_OUT',
      'I':    'CHECK_IN',
      'O':    'CHECK_OUT',
      'IN':   'CHECK_IN',
      'OUT':  'CHECK_OUT'
    };

    return punchTypeMap[typeStr.toUpperCase()] || punchTypeMap[typeStr] || 'UNKNOWN';
  }
}

// ─── Export ──────────────────────────────────────────────────────────────

module.exports = {
  ESSLAdapter
};
