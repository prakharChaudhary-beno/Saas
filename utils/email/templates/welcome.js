// src/utils/email/templates/welcome.js
exports.welcomeTemplate = ({ name, companyName, trialEndsAt }) => {
  const date = new Date(trialEndsAt).toDateString();
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Welcome to HRMS! 🎉</h2>
      <p>Hi <strong>${name}</strong>,</p>
      <p>Your account for <strong>${companyName}</strong> has been created successfully.</p>
      <div style="background: #f4f4f4; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p>🎯 <strong>14 Days Free Trial</strong></p>
        <p>Trial ends on: <strong>${date}</strong></p>
      </div>
      <p>Login now and start managing your team!</p>
      <a href="${process.env.FRONTEND_URL}/login" 
         style="background: #4F46E5; color: white; padding: 12px 24px; 
                border-radius: 6px; text-decoration: none;">
        Go to Dashboard
      </a>
      <p style="color: #999; margin-top: 30px; font-size: 12px;">
        If you did not create this account, please ignore this email.
      </p>
    </div>
  `;
};