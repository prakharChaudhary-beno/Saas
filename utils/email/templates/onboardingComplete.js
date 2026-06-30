// src/utils/email/templates/onboardingComplete.js
exports.onboardingCompleteTemplate = ({ name, companyName, trialEndsAt }) => {
  const date = new Date(trialEndsAt).toDateString();
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Setup Complete! 🎉</h2>
      <p>Hi <strong>${name}</strong>,</p>
      <p><strong>${companyName}</strong> is all set up and ready to go!</p>
      <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p>✅ Company profile complete</p>
        <p>✅ Working hours configured</p>
        <p>✅ Leave policy set</p>
        <p>✅ Pay schedule configured</p>
      </div>
      <div style="background: #f4f4f4; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p>🎯 <strong>Trial ends on:</strong> ${date}</p>
      </div>
      <a href="${process.env.FRONTEND_URL}/dashboard"
         style="background: #4F46E5; color: white; padding: 12px 24px;
                border-radius: 6px; text-decoration: none;">
        Go to Dashboard
      </a>
    </div>
  `;
};