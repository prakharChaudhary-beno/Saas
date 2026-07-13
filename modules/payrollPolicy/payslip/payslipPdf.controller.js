// modules/payrollPolicy/payslip/payslipPdf.controller.js
const pdfService = require('./payslipPdf.service')

/**
 * Download payslip as PDF
 * GET /api/v1/payslips/:id/pdf
 */
exports.downloadPayslipPdf = async (req, res, next) => {
  try {
    const { id } = req.params

    const pdfData = await pdfService.generatePayslipPdf(id, req.user)

    res.setHeader('Content-Type', pdfData.mimeType)
    res.setHeader('Content-Disposition', `attachment; filename="${pdfData.filename}"`)
    res.send(pdfData.buffer)

  } catch (error) {
    console.error('PDF generation error:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate payslip PDF'
    })
  }
}
