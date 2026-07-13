// modules/employee/employeeTemplate.service.js
const Department = require('../department/department.model')
const Designation = require('../designation/designation.model')
const Unit = require('../unit/models/unit.model')
const Employee = require('./models/employee.model')
const XLSX = require('xlsx')

/**
 * Generate Excel template with dropdowns for bulk import
 * @param {String} orgId - Organization ID
 * @returns {Buffer} - Excel file buffer
 */
exports.generateExcelTemplate = async (orgId) => {
  try {
    // Fetch master data for dropdowns
    const [departments, designations, units, managers] = await Promise.all([
      Department.find({ org_id: orgId, isDeleted: false }).select('name').sort('name').lean(),
      Designation.find({ org_id: orgId, isDeleted: false }).select('name').sort('name').lean(),
      Unit.find({ org_id: orgId, isDeleted: false }).select('name').sort('name').lean(),
      Employee.find({ org_id: orgId, isDeleted: false, status: 'ACTIVE' })
        .populate('userId', 'email')
        .select('name employeeId userId')
        .sort('name')
        .lean()
    ])

    // Create workbook
    const wb = XLSX.utils.book_new()

    // ── Main Sheet (for data entry) ────────────────────────────────────────────
    const mainSheetData = [
      ['name*', 'email*', 'phone*', 'department*', 'unit*', 'joiningDate*', 'basicSalary', 'designation', 'employmentType', 'gender', 'dateOfBirth'],
      ['John Doe', 'john.doe@example.com', '+91-9876543210', departments[0]?.name || '', units[0]?.name || '', '2026-01-15', '', designations[0]?.name || '', 'FULL_TIME', 'MALE', '']
    ]

    const mainSheet = XLSX.utils.aoa_to_sheet(mainSheetData)
    
    // Set column widths
    mainSheet['!cols'] = [
      { wch: 20 }, // name*
      { wch: 25 }, // email*
      { wch: 15 }, // phone*
      { wch: 20 }, // department*
      { wch: 15 }, // unit*
      { wch: 12 }, // joiningDate*
      { wch: 12 }, // basicSalary (optional)
      { wch: 20 }, // designation
      { wch: 15 }, // employmentType
      { wch: 10 }, // gender
      { wch: 12 }  // dateOfBirth
    ]

    XLSX.utils.book_append_sheet(wb, mainSheet, 'Employee Import')

    // ── Dropdowns Sheet (reference sheet for dropdowns) ───────────────────────
    const maxEntries = 100 // Maximum dropdown entries
    const dropdownData = []

    // Headers
    dropdownData.push(['Departments', 'Units', 'Designations', 'EmploymentTypes', 'Gender'])

    // Fill dropdown values
    for (let i = 0; i < maxEntries; i++) {
      dropdownData.push([
        departments[i]?.name || '',
        units[i]?.name || '',
        designations[i]?.name || '',
        i < 4 ? ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'][i] : '',
        i < 3 ? ['MALE', 'FEMALE', 'OTHER'][i] : ''
      ])
    }

    const dropdownSheet = XLSX.utils.aoa_to_sheet(dropdownData)
    XLSX.utils.book_append_sheet(wb, dropdownSheet, 'Dropdowns')

    // ── Instructions Sheet ───────────────────────────────────────────────────────
    const instructionsData = [
      ['BULK EMPLOYEE IMPORT INSTRUCTIONS'],
      [''],
      ['Required Fields (marked with *):'],
      ['1. name*', 'Employee full name (minimum 2 characters)'],
      ['2. email*', 'Valid email address (will be used for login)'],
      ['3. phone*', 'Phone number (minimum 10 digits)'],
      ['4. department*', 'Select from Dropdowns sheet or type exact name'],
      ['5. unit*', 'Select from Dropdowns sheet or type exact name'],
      ['6. joiningDate*', 'Format: YYYY-MM-DD (e.g., 2026-01-15)'],
      [''],
      ['Optional Fields:'],
      ['7. basicSalary', 'Monthly basic salary (numeric value, defaults to 0)'],
      ['8. designation', 'Select from Dropdowns sheet or type exact name'],
      ['9. employmentType', 'FULL_TIME, PART_TIME, CONTRACT, or INTERN'],
      ['10. gender', 'MALE, FEMALE, or OTHER'],
      ['11. dateOfBirth', 'Format: YYYY-MM-DD'],
      [''],
      ['Important Notes:'],
      ['• All fields with * are mandatory'],
      ['• Use the "Dropdowns" sheet to see available options'],
      ['• Department and Unit must match existing records exactly'],
      ['• Employees will receive login credentials via email'],
      ['• Temporary password: Temp@123 (must be changed on first login)'],
      [''],
      ['Dropdown Reference:'],
      ['• Departments:', departments.map(d => d.name).join(', ')],
      ['• Units:', units.map(u => u.name).join(', ')],
      ['• Designations:', designations.map(d => d.name).join(', ')],
      ['• Employment Types:', 'FULL_TIME, PART_TIME, CONTRACT, INTERN'],
      ['• Gender:', 'MALE, FEMALE, OTHER']
    ]

    const instructionsSheet = XLSX.utils.aoa_to_sheet(instructionsData)
    instructionsSheet['!cols'] = [{ wch: 20 }, { wch: 80 }]
    XLSX.utils.book_append_sheet(wb, instructionsSheet, 'Instructions')

    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return buffer

  } catch (error) {
    console.error('Error generating Excel template:', error)
    throw error
  }
}

/**
 * Parse Excel file and extract employee data
 * @param {Buffer} buffer - Excel file buffer
 * @returns {Array} - Array of employee objects
 */
exports.parseExcelFile = (buffer) => {
  try {
    console.log('📊 Parsing Excel file...')
    
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('Excel file has no sheets')
    }
    
    const sheetName = workbook.SheetNames[0]
    console.log(`📄 Processing sheet: ${sheetName}`)
    
    const sheet = workbook.Sheets[sheetName]
    
    // Convert to JSON (skip header row)
    const data = XLSX.utils.sheet_to_json(sheet)
    
    if (!data || data.length === 0) {
      throw new Error('No data found in Excel sheet')
    }
    
    console.log(`✅ Parsed ${data.length} rows from Excel`)
    
    // Validate minimum required columns
    const firstRow = data[0]
    const requiredFields = ['name', 'email', 'phone', 'department', 'unit', 'joiningDate']
    const missingFields = requiredFields.filter(field => !firstRow.hasOwnProperty(field))
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required columns: ${missingFields.join(', ')}`)
    }
    
    return data
  } catch (error) {
    console.error('❌ Error parsing Excel file:', error.message)
    
    // Provide user-friendly error messages
    if (error.message.includes('Missing required')) {
      throw error
    } else if (error.message.includes('no sheets')) {
      throw new Error('Invalid Excel file: No data sheets found')
    } else if (error.message.includes('No data found')) {
      throw new Error('Excel file is empty or has no data rows')
    } else if (error.code === 'ENOENT') {
      throw new Error('File not found or cannot be read')
    } else {
      throw new Error(`Failed to parse Excel file: ${error.message}`)
    }
  }
}
