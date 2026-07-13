// modules/employee/employeeEmail.service.js
const nodemailer = require('nodemailer')
const { FRONTEND_URL, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env

/**
 * Send welcome email with login credentials to new employee
 * @param {Object} employee - Employee object
 * @param {String} tempPassword - Temporary password
 * @param {String} orgName - Organization name
 */
exports.sendWelcomeEmail = async (employee, tempPassword, orgName) => {
  try {
    // Create transporter
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST || 'smtp.gmail.com',
      port: SMTP_PORT || 587,
      secure: false,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      }
    })

    const loginUrl = `${FRONTEND_URL || 'http://localhost:3000'}/login`

    const mailOptions = {
      from: `"${orgName} HRMS" <${SMTP_USER}>`,
      to: employee.email,
      subject: `Welcome to ${orgName} - Your HRMS Account`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0;">Welcome to ${orgName}!</h1>
          </div>
          
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #ddd;">
            <p style="font-size: 16px; color: #333;">Dear <strong>${employee.name}</strong>,</p>
            
            <p style="font-size: 16px; color: #333; line-height: 1.6;">
              Welcome to <strong>${orgName}</strong>! Your employee account has been created in our HRMS system.
            </p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
              <h3 style="margin-top: 0; color: #667eea;">Your Login Credentials</h3>
              <p style="margin: 10px 0;"><strong>Email:</strong> ${employee.email}</p>
              <p style="margin: 10px 0;"><strong>Temporary Password:</strong> <code style="background: #f0f0f0; padding: 5px 10px; border-radius: 4px;">${tempPassword}</code></p>
              <p style="margin: 10px 0;"><strong>Employee ID:</strong> ${employee.employeeId}</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-size: 16px; display: inline-block;">
                Login to HRMS
              </a>
            </div>
            
            <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #856404;"><strong>⚠️ Important:</strong></p>
              <ul style="margin: 10px 0; color: #856404;">
                <li>Please change your password immediately after first login</li>
                <li>This temporary password expires in 7 days</li>
                <li>Complete your profile after logging in</li>
              </ul>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              If you have any questions, please contact HR department.
            </p>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            
            <p style="font-size: 12px; color: #999; text-align: center;">
              This is an automated message from ${orgName} HRMS. Please do not reply to this email.
            </p>
          </div>
        </div>
      `
    }

    // Send email
    const info = await transporter.sendMail(mailOptions)
    
    console.log(`✅ Welcome email sent to ${employee.email}: ${info.messageId}`)
    
    return { success: true, messageId: info.messageId }
    
  } catch (error) {
    console.error(`❌ Failed to send welcome email to ${employee.email}:`, error.message)
    return { success: false, error: error.message }
  }
}

/**
 * Send bulk welcome emails to multiple employees
 * @param {Array} employees - Array of employee objects with tempPassword
 * @param {String} orgName - Organization name
 * @returns {Object} - Email sending results
 */
exports.sendBulkWelcomeEmails = async (employees, orgName) => {
  const results = []
  
  for (const emp of employees) {
    const result = await exports.sendWelcomeEmail(emp, emp.tempPassword, orgName)
    results.push({
      email: emp.email,
      employeeId: emp.employeeId,
      emailSent: result.success,
      error: result.error || null
    })
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  
  return results
}
