/**
 * Employee Avatar Helper
 * 
 * Centralized utility for consistent employee avatar handling across the codebase.
 * 
 * Usage:
 *   const { getAvatarUrl, getInitials } = require('./employeeAvatar');
 *   
 *   // In service layer:
 *   const employeeWithAvatar = formatEmployeeAvatar(employee);
 *   
 *   // Get avatar URL:
 *   const url = getAvatarUrl(employee);
 *   
 *   // Get initials for fallback:
 *   const initials = getInitials(employee.name);
 */

/**
 * Get avatar URL from employee object
 * Handles multiple field name variations: profilePhoto, profilePicture, avatar, photo
 * 
 * @param {Object} employee - Employee object
 * @returns {string|null} - Avatar URL or null
 */
const getAvatarUrl = (employee) => {
  if (!employee) return null;
  
  // Check all possible field names in order of preference
  return employee.profilePhoto || 
         employee.profilePicture || 
         employee.avatar || 
         employee.photo || 
         null;
};

/**
 * Get initials from name (max 2 characters)
 * Used as fallback when no avatar image available
 * 
 * @param {string} name - Employee name
 * @returns {string} - Initials (max 2 chars, uppercase)
 */
const getInitials = (name) => {
  if (!name) return '?';
  
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

/**
 * Format employee object with consistent avatar fields
 * Adds computed fields for frontend consumption
 * 
 * @param {Object} employee - Employee document (lean or mongoose)
 * @returns {Object} - Employee object with avatarUrl and initials
 */
const formatEmployeeAvatar = (employee) => {
  if (!employee) return null;
  
  // Handle both lean() objects and mongoose documents
  const emp = employee._doc || employee;
  
  return {
    ...emp,
    avatarUrl: getAvatarUrl(emp),
    initials: getInitials(emp.name),
    // Standardize on 'profilePhoto' as the canonical field
    profilePhoto: emp.profilePhoto || null
  };
};

/**
 * Format multiple employees with avatar data
 * Used in list endpoints
 * 
 * @param {Array} employees - Array of employee objects
 * @returns {Array} - Array of formatted employee objects
 */
const formatEmployeesAvatar = (employees) => {
  if (!Array.isArray(employees)) return [];
  return employees.map(formatEmployeeAvatar);
};

/**
 * Add avatar data to user object
 * Used when merging employee data with user data
 * 
 * @param {Object} user - User object
 * @param {Object} employee - Employee object (optional)
 * @returns {Object} - User object with avatar fields
 */
const addUserAvatar = (user, employee) => {
  if (!user) return null;
  
  const avatarUrl = getAvatarUrl(employee);
  const name = user.name || employee?.name || '';
  
  return {
    ...user,
    avatarUrl,
    initials: getInitials(name),
    profilePhoto: employee?.profilePhoto || null,
    // Also add to employee if present
    ...(employee ? { employee: formatEmployeeAvatar(employee) } : {})
  };
};

module.exports = {
  getAvatarUrl,
  getInitials,
  formatEmployeeAvatar,
  formatEmployeesAvatar,
  addUserAvatar
};
