// src/utils/email/email.js
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host:   process.env.EMAIL_HOST,
  port:   process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

exports.sendEmail = async ({ to, subject, html }) => {
  try {
    const info = await transporter.sendMail({
      from:    `"HRMS" <${process.env.EMAIL_FROM}>`,
      to,
      subject,
      html
    });
    console.log("Email sent:", info.messageId);
    return info;
  } catch (error) {
    console.error("Email error:", error);
    throw error;
  }
};