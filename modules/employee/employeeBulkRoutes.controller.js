// modules/employee/employeeBulkRoutes.controller.js
const employeeService = require('./employee.service')

/**
 * Bulk import employees - uses SAME logic as single creation
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

    console.log(`📋 Bulk import: Processing ${employees.length} employees`)

    const results = []
    let successCount = 0
    let failCount = 0

    // Process each employee using the SAME service as single creation
    for (let i = 0; i < employees.length; i++) {
      const empData = employees[i]
      const rowNum = i + 1

      try {
        console.log(`📝 [${rowNum}/${employees.length}] Creating: ${empData.email}`)

        // Use EXACT same service as single employee creation
        const employee = await employeeService.createEmployee(empData, req.user)

        results.push({
          rowNum,
          name: empData.name,
          email: empData.email,
          success: true,
          message: 'Employee created successfully',
          employeeId: employee.employeeId,
          tempPassword: 'Temp@123' // Default temp password
        })

        successCount++
        console.log(`✅ [${rowNum}/${employees.length}] Success: ${employee.employeeId}`)

      } catch (err) {
        results.push({
          rowNum,
          name: empData.name,
          email: empData.email,
          success: false,
          message: err.message || 'Failed to create employee'
        })

        failCount++
        console.log(`❌ [${rowNum}/${employees.length}] Failed: ${err.message}`)
      }
    }

    console.log(`\n📊 BULK IMPORT COMPLETE:`)
    console.log(`   ✅ Success: ${successCount}`)
    console.log(`   ❌ Failed: ${failCount}`)

    res.json({
      success: true,
      successCount,
      failCount,
      total: employees.length,
      results
    })

  } catch (error) {
    console.error('❌ Bulk import error:', error)
    next(error)
  }
}
