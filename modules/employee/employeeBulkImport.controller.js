// modules/employee/employeeBulkImport.controller.js
const bulkImportService = require('./employeeBulkImport.service')

/**
 * Bulk import employees from CSV
 * POST /api/v1/employees/bulk-import
 */
exports.bulkImportEmployees = async (req, res, next) => {
  try {
    const { employees } = req.body

    if (!employees || !Array.isArray(employees) || employees.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No employee data provided'
      })
    }

    const result = await bulkImportService.bulkImportEmployees(employees, req.user)

    return res.status(200).json({
      success: true,
      message: `Import completed. ${result.successCount} successful, ${result.failCount} failed`,
      data: result
    })

  } catch (error) {
    console.error('Bulk import error:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to import employees'
    })
  }
}
