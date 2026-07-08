// modules/employee/employeeBulkExport.service.js
const Employee = require('./models/employee.model')
const mongoose = require('mongoose')

/**
 * Export employees to CSV format
 * @param {Object} user - Current authenticated user
 * @param {Object} query - Query filters (department, status, etc.)
 * @returns {String} - CSV content
 */
exports.exportEmployees = async (user, query = {}) => {
  const { departmentId, status, employmentType } = query

  // Build filter
  const filter = {
    org_id: user.orgId,
    isDeleted: false
  }

  if (departmentId && mongoose.Types.ObjectId.isValid(departmentId)) {
    filter.departmentId = departmentId
  }

  if (status) {
    filter.status = status.toUpperCase()
  }

  if (employmentType) {
    filter.employmentType = employmentType.toUpperCase()
  }

  // Fetch employees
  const employees = await Employee.find(filter)
    .populate('userId', 'email')
    .populate('departmentId', 'name')
    .populate('designationId', 'name')
    .populate('unit_id', 'name')
    .populate('reportingManagerId', 'name')
    .lean()

  // Build CSV headers
  const headers = [
    'Employee ID',
    'Name',
    'Email',
    'Phone',
    'Department',
    'Designation',
    'Unit',
    'Reporting Manager',
    'Joining Date',
    'Employment Type',
    'Basic Salary',
    'HRA',
    'Travel Allowance',
    'Medical Allowance',
    'Special Allowance',
    'Status',
    'Gender',
    'Date of Birth'
  ]

  // Build CSV rows
  const rows = employees.map(emp => [
    emp._id,
    emp.name,
    emp.email,
    emp.phone,
    emp.departmentId?.name || '',
    emp.designationId?.name || '',
    emp.unit_id?.name || '',
    emp.reportingManagerId?.name || '',
    emp.joiningDate ? new Date(emp.joiningDate).toISOString().split('T')[0] : '',
    emp.employmentType || '',
    emp.salary?.basic || 0,
    emp.salary?.hra || 0,
    emp.salary?.travelAllowance || 0,
    emp.salary?.medicalAllowance || 0,
    emp.salary?.specialAllowance || 0,
    emp.status || '',
    emp.gender || '',
    emp.dateOfBirth ? new Date(emp.dateOfBirth).toISOString().split('T')[0] : ''
  ])

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(field => `"${field}"`).join(','))
  ].join('\n')

  return csvContent
}
