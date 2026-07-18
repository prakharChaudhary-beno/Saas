// /hrms-backend/utils/statusSync.js
// Centralized bidirectional status synchronization between User and Employee models

const STATUS_MAPPING = {
  // Employee → User status mapping
  // When syncing Employee status to User, these incompatible values must be converted
  employeeToUser: {
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE',
    TERMINATED: 'INACTIVE',     // User doesn't support TERMINATED
    ON_LEAVE: 'ACTIVE',         // User stays login-capable while on leave
    ON_NOTICE: 'ACTIVE',        // User stays login-capable during notice
  },
  
  // User → Employee status mapping
  // When syncing User status to Employee, these incompatible values must be converted
  userToEmployee: {
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE',
    BLOCKED: 'INACTIVE',        // Employee doesn't support BLOCKED
  }
};

/**
 * Map Employee status to User-compatible status
 * @param {string} employeeStatus - Employee.status value
 * @returns {string} - Compatible User.status value
 */
function mapEmployeeStatusToUser(employeeStatus) {
  return STATUS_MAPPING.employeeToUser[employeeStatus] || 'INACTIVE';
}

/**
 * Map User status to Employee-compatible status
 * @param {string} userStatus - User.status value
 * @returns {string} - Compatible Employee.status value
 */
function mapUserStatusToEmployee(userStatus) {
  return STATUS_MAPPING.userToEmployee[userStatus] || 'INACTIVE';
}

/**
 * Sync User.status to linked Employee.status
 * Called when User.status changes (admin-users page, user management)
 * 
 * @param {ObjectId} userId - The User._id whose status was updated
 * @param {string} userStatus - The new User.status value
 * @param {ObjectId} actorId - The user performing the update (for audit)
 * @returns {Promise<{employeeStatus: string}>}
 */
async function syncUserStatusToEmployee(userId, userStatus, actorId = null) {
  const Employee = require('../modules/employee/models/employee.model');
  
  const employeeStatus = mapUserStatusToEmployee(userStatus);
  
  await Employee.findOneAndUpdate(
    { userId, isDeleted: false },
    { 
      status: employeeStatus,
      updatedBy: actorId
    }
  );
  
  return { employeeStatus };
}

/**
 * Sync Employee.status to linked User.status
 * Called when Employee.status changes (employee management screens)
 * 
 * @param {ObjectId} employeeId - The Employee._id whose status was updated
 * @param {string} employeeStatus - The new Employee.status value
 * @param {ObjectId} actorId - The user performing the update (for audit)
 * @returns {Promise<{userStatus: string|null}>}
 */
async function syncEmployeeStatusToUser(employeeId, employeeStatus, actorId = null) {
  const Employee = require('../modules/employee/models/employee.model');
  const User = require('../modules/auth/models/user.model');
  
  const userStatus = mapEmployeeStatusToUser(employeeStatus);
  
  // Get employee to find linked userId
  const employee = await Employee.findById(employeeId).select('userId');
  if (!employee || !employee.userId) {
    // No linked user account, nothing to sync
    return { userStatus: null };
  }
  
  await User.findByIdAndUpdate(
    employee.userId,
    { 
      status: userStatus,
      updatedBy: actorId
    }
  );
  
  return { userStatus };
}

module.exports = {
  STATUS_MAPPING,
  mapEmployeeStatusToUser,
  mapUserStatusToEmployee,
  syncUserStatusToEmployee,
  syncEmployeeStatusToUser,
};
