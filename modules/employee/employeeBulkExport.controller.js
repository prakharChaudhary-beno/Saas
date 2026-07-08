// modules/employee/employeeBulkExport.controller.js
const bulkExportService = require('./employeeBulkExport.service')

/**
 * Export employees to CSV
 * GET /api/v1/employees/export
 */
exports.exportEmployees = async (req, res, next) => {
  try {
    const csvContent = await bulkExportService.exportEmployees(req.user, req.query)

    const filename = `employees_export_${new Date().toISOString().split('T')[0]}.csv`

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(csvContent)

  } catch (error) {
    console.error('Export error:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to export employees'
    })
  }
}
