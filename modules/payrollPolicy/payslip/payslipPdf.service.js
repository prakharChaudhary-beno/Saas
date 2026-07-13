// modules/payrollPolicy/payslip/payslipPdf.service.js
const Payslip = require('../models/payslip.model')
const mongoose = require('mongoose')

/**
 * Generate PDF content for a payslip
 * @param {String} payslipId - Payslip ID
 * @param {Object} user - Current authenticated user
 * @returns {Object} - PDF data and metadata
 */
exports.generatePayslipPdf = async (payslipId, user) => {
  if (!mongoose.Types.ObjectId.isValid(payslipId)) {
    throw new Error('Invalid payslip ID')
  }

  const payslip = await Payslip.findById(payslipId)
    .populate('employeeId', 'name email phone departmentId designationId')
    .populate({
      path: 'employeeId',
      populate: [
        { path: 'departmentId', select: 'name' },
        { path: 'designationId', select: 'name' }
      ]
    })
    .lean()

  if (!payslip) {
    throw new Error('Payslip not found')
  }

  // Authorization check
  if (user.role !== 'super_admin' && user.role !== 'hr_manager') {
    if (payslip.employeeId?._id?.toString() !== user.employeeId?.toString()) {
      throw new Error('Unauthorized to access this payslip')
    }
  }

  // Generate simplified PDF content (as Buffer)
  // In production, use libraries like PDFKit, html-pdf, or puppeteer
  const pdfContent = generateSimplePdfContent(payslip)

  return {
    buffer: pdfContent,
    filename: `payslip_${payslip.month}_${payslip.year}_${payslip.employeeId?.name || 'employee'}.pdf`,
    mimeType: 'application/pdf'
  }
}

/**
 * Generate simple PDF content (placeholder implementation)
 * In production, replace with actual PDF generation library
 */
function generateSimplePdfContent(payslip) {
  // This is a simplified version - in production, use a PDF library
  const content = `
PAYSLIP
=======
Month: ${payslip.month} ${payslip.year}
Employee: ${payslip.employeeId?.name || 'N/A'}
Email: ${payslip.employeeId?.email || 'N/A'}
Department: ${payslip.employeeId?.departmentId?.name || 'N/A'}
Designation: ${payslip.employeeId?.designationId?.name || 'N/A'}

EARNINGS
--------
Basic Salary: ₹${payslip.earnings?.basic || 0}
HRA: ₹${payslip.earnings?.hra || 0}
Travel Allowance: ₹${payslip.earnings?.travelAllowance || 0}
Medical Allowance: ₹${payslip.earnings?.medicalAllowance || 0}
Special Allowance: ₹${payslip.earnings?.specialAllowance || 0}
--------------------------------
Gross Earnings: ₹${payslip.grossEarnings || 0}

DEDUCTIONS
----------
PF: ₹${payslip.deductions?.pf || 0}
ESI: ₹${payslip.deductions?.esi || 0}
TDS: ₹${payslip.deductions?.tds || 0}
Professional Tax: ₹${payslip.deductions?.professionalTax || 0}
--------------------------------
Total Deductions: ₹${payslip.totalDeductions || 0}

NET PAY
-------
Net Salary: ₹${payslip.netPay || 0}

Status: ${payslip.status}
Payment Date: ${payslip.paymentDate ? new Date(payslip.paymentDate).toLocaleDateString() : 'Pending'}
  `

  return Buffer.from(content, 'utf-8')
}
