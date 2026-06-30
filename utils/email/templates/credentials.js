// src/utils/email/templates/credentials.js
exports.credentialsTemplate = ({ name, email, password, companyName }) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Your Login Credentials 🔐</h2>
      <p>Hi <strong>${name}</strong>,</p>
      <p>Your account in HRMS has been created.</p>
      <div style="background: #f4f4f4; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p>📧 <strong>Email:</strong> ${email}</p>
        <p>🔑 <strong>Password:</strong> ${password}</p>
      </div>
      <p style="color: #e53e3e;">
        ⚠️ Please change your password after first login.
      </p>
      <a href="${process.env.FRONTEND_URL}/auth/login" target="_blank"
         style="background: #4F46E5; color: white; padding: 12px 24px;
                border-radius: 6px; text-decoration: none;">
        Login Now
      </a>
      <p style="color: #999; margin-top: 30px; font-size: 12px;">
        If you did not expect this email, please contact your HR.
      </p>
    </div>
  `;
};