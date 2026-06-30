// src/utils/email/templates/forgotPassword.js
exports.forgotPasswordTemplate = ({ name, resetLink }) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Reset Your Password 🔒</h2>
      <p>Hi <strong>${name}</strong>,</p>
      <p>We received a request to reset your password.</p>
      <div style="margin: 20px 0;">
        <a href="${resetLink}"
           style="background: #4F46E5; color: white; padding: 12px 24px;
                  border-radius: 6px; text-decoration: none;">
          Reset Password
        </a>
      </div>
      <p style="color: #999;">
        This link will expire in <strong>1 hour</strong>.
      </p>
      <p style="color: #999; margin-top: 30px; font-size: 12px;">
        If you did not request this, please ignore this email.
        Your password will not be changed.
      </p>
    </div>
  `;
};