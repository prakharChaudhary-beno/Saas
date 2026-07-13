// modules/employee/employeeTemplate.controller.js
const templateService = require('./employeeTemplate.service')
const bulkImportService = require('./employeeBulkImport.service')

/**
 * Download Excel template with dropdowns
 */
exports.downloadTemplate = async (req, res) => {
  try {
    const orgId = req.user.orgId
    
    const buffer = await templateService.generateExcelTemplate(orgId)
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename=employee_import_template.xlsx')
    
    res.send(buffer)
  } catch (error) {
    console.error('Error downloading template:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to generate template'
    })
  }
}

/**
 * Bulk import from Excel file (Cloudinary)
 */
exports.bulkImportFromExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      })
    }

    // File is uploaded to Cloudinary, get URL
    const fileUrl = req.file.path
    const publicId = req.file.filename

    console.log(`📥 Processing bulk import from: ${fileUrl}`)

    // Download file from Cloudinary
    const https = require('https')
    const http = require('http')
    
    const downloadFile = (url) => {
      return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http
        const chunks = []
        
        protocol.get(url, (response) => {
          response.on('data', (chunk) => chunks.push(chunk))
          response.on('end', () => resolve(Buffer.concat(chunks)))
          response.on('error', reject)
        }).on('error', reject)
      })
    }

    const buffer = await downloadFile(fileUrl)

    // Parse Excel file
    const employees = templateService.parseExcelFile(buffer)
    
    if (!employees || employees.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No employee data found in file'
      })
    }

    console.log(`📊 Parsed ${employees.length} employee records from Excel`)

    // Import employees
    const result = await bulkImportService.bulkImportEmployees(employees, req.user)

    // Delete file from Cloudinary after processing (cleanup)
    const cloudinary = require('cloudinary').v2
    cloudinary.uploader.destroy(publicId, (err, result) => {
      if (err) console.log('Warning: Failed to delete temp file from Cloudinary')
    })

    console.log(`✅ Bulk import complete: ${result.successCount} success, ${result.failCount} failed`)

    res.json({
      success: true,
      ...result
    })
  } catch (error) {
    console.error('Bulk import error:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to import employees'
    })
  }
}

/**
 * Get dropdown data for frontend
 */
exports.getDropdownData = async (req, res) => {
  try {
    const Department = require('../department/department.model')
    const Designation = require('../designation/designation.model')
    const Unit = require('../unit/models/unit.model')
    const Employee = require('./models/employee.model')

    const orgId = req.user.orgId

    const [departments, designations, units] = await Promise.all([
      Department.find({ org_id: orgId, isDeleted: false }).select('name').sort('name').lean(),
      Designation.find({ org_id: orgId, isDeleted: false }).select('name').sort('name').lean(),
      Unit.find({ org_id: orgId, isDeleted: false }).select('name').sort('name').lean()
    ])

    res.json({
      success: true,
      data: {
        departments: departments.map(d => d.name),
        designations: designations.map(d => d.name),
        units: units.map(u => u.name),
        employmentTypes: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'],
        genders: ['MALE', 'FEMALE', 'OTHER']
      }
    })
  } catch (error) {
    console.error('Error fetching dropdown data:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dropdown data'
    })
  }
}
