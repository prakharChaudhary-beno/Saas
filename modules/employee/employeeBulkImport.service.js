// modules/employee/employeeBulkImport.service.js
// Simplified bulk import - uses SAME logic as single employee creation

const Employee = require('./models/employee.model')
const User = require('../auth/models/user.model')
const Department = require('../department/department.model')
const Designation = require('../designation/designation.model')
const Unit = require('../unit/models/unit.model')
const Role = require('../role/role.model')
const bcrypt = require('bcryptjs')
const { sendEmail } = require('../../utils/email/email')
const { credentialsTemplate } = require('../../utils/email/templates/credentials')

/**
 * Bulk import employees - uses SAME logic as single employee creation
 * Creates User account, Employee record, and sends email with credentials
 */
exports.bulkImportEmployees = async (employees, user) => {
  const results = []
  let successCount = 0
  let failCount = 0

  // Get from logged-in user (AUTO - no dropdown needed)
  const orgId = user.orgId
  const companyId = user.companyId
  const unitId = user.unitId  // AUTO - user's unit

  if (!unitId) {
    throw new Error('User unit_id not found. Please contact admin.')
  }

  console.log(`📋 Bulk import: ${employees.length} employees (Unit: ${unitId})`)

  // Process each employee one by one (sequential for safety)
  for (let i = 0; i < employees.length; i++) {
    const empData = employees[i]
    const rowNum = i + 1

    try {
      console.log(`📝 [${rowNum}/${employees.length}] Creating: ${empData.email}`)

      // ── Sanitize Input ─────────────────────────────────────────────
      const sanitize = (str) => {
        if (!str || typeof str !== 'string') return ''
        return str.trim().replace(/[<>'"\/\\]/g, '').substring(0, 100)
      }

      const sanitizeEmail = (email) => {
        if (!email) return ''
        return email.toLowerCase().trim().substring(0, 100)
      }

      const sanitizePhone = (phone) => {
        if (!phone) return ''
        return phone.replace(/[^0-9+\-() ]/g, '').substring(0, 15)
      }

      empData.name = sanitize(empData.name)
      empData.email = sanitizeEmail(empData.email)
      empData.phone = sanitizePhone(empData.phone)
      empData.department = sanitize(empData.department)
      empData.unit = sanitize(empData.unit)
      empData.designation = sanitize(empData.designation)

      // ── Validate Required Fields (NO unit - auto from user) ────────────
      if (!empData.email) throw new Error('Email required')
      if (!empData.name) throw new Error('Name required')
      if (!empData.phone) throw new Error('Phone required')
      if (!empData.department) throw new Error('Department required')
      if (!empData.joiningDate) throw new Error('Joining date required')

      // ── Check if Email Already Exists ─────────────────────────────────
      const existingUser = await User.findOne({
        email: empData.email.toLowerCase(),
        isDeleted: false
      })
      if (existingUser) {
        throw new Error(`Employee with email ${empData.email} already exists`)
      }

      // ── Resolve Department ────────────────────────────────────────────
      const dept = await Department.findOne({
        name: { $regex: new RegExp(`^${empData.department}$`, 'i') },
        org_id: orgId,
        isDeleted: false
      })
      if (!dept) {
        throw new Error(`Department "${empData.department}" not found`)
      }

      // ── Unit: AUTO from logged-in user (no lookup needed) ───────────────
      // unitId already set from user.unitId above

      // ── Resolve Designation (Optional) ────────────────────────────────
      let designationId = null
      if (empData.designation) {
        const desig = await Designation.findOne({
          name: { $regex: new RegExp(`^${empData.designation}$`, 'i') },
          org_id: orgId,
          isDeleted: false
        })
        if (desig) designationId = desig._id
      }

      // ── Generate Employee ID ──────────────────────────────────────────
      const last = await Employee.findOne(
        { org_id: orgId, company_id: companyId, employeeId: { $regex: /^EMP\d+$/ } },
        { employeeId: 1 },
        { sort: { employeeId: -1 } }
      ).lean()

      let nextNum = 1
      if (last?.employeeId) {
        const lastNum = parseInt(last.employeeId.replace('EMP', ''), 10)
        if (!isNaN(lastNum)) nextNum = lastNum + 1
      }
      const employeeId = `EMP${String(nextNum).padStart(4, '0')}`

      // ── Create Employee Record FIRST (no role needed) ─────────────────────
      // Same as single employee creation - employee created first, login activated later
      const employee = await Employee.create({
        employeeId,
        name: empData.name,
        email: empData.email.toLowerCase(),
        phone: empData.phone,
        org_id: orgId,
        company_id: companyId,
        unit_id: unitId,  // AUTO from logged-in user
        departmentId: dept._id,
        designationId,
        joiningDate: new Date(empData.joiningDate),
        employmentType: empData.employmentType?.toUpperCase() || 'FULL_TIME',
        gender: empData.gender?.toUpperCase(),
        dateOfBirth: empData.dateOfBirth ? new Date(empData.dateOfBirth) : null,
        status: 'INACTIVE',  // Same as single creation - activated when login created
        salary: {
          basic: Number(empData.basicSalary) || 0,
          hra: 0,
          travelAllowance: 0,
          medicalAllowance: 0,
          specialAllowance: 0
        },
        createdBy: user.userId
      })

      console.log(`✅ [${rowNum}] Employee created: ${employee.employeeId}`)
      
      // Note: User account NOT created here - Admin can activate login later via:
      // POST /api/v1/employees/:id/activate-login with roleId

      results.push({
        rowNum,
        name: empData.name,
        email: empData.email,
        success: true,
        message: 'Employee created successfully. Activate login from employee list.',
        employeeId: employee.employeeId,
        tempPassword: null  // No password - login not activated yet
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

  return {
    successCount,
    failCount,
    total: employees.length,
    results
  }
}
