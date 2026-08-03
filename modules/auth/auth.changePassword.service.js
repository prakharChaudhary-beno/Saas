// modules/auth/auth.changePassword.service.js
//
// Service for authenticated password change
//
// Rules:
// 1. Requires valid JWT (user authenticated)
// 2. User must provide current password
// 3. New password validation: min 8 chars, at least one uppercase, one lowercase, one number, one special char
// 4. New password must not equal current password
// 5. Clears all refresh tokens after change (force re-login)

const bcrypt = require("bcryptjs");
const User = require("./models/user.model");
const AppError = require("../../utils/appError");

exports.changePassword = async (userId, currentPassword, newPassword) => {
  // Validation
  if (!currentPassword || !newPassword) {
    throw new AppError("Current password and new password are required", 400);
  }

  if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
    throw new AppError("Passwords must be strings", 400);
  }

  // Password strength validation
  if (newPassword.trim().length < 8) {
    throw new AppError("Password must be at least 8 characters", 400);
  }

  // Check password complexity
  const hasUpperCase = /[A-Z]/.test(newPassword);
  const hasLowerCase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);

  if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecialChar) {
    throw new AppError(
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
      400
    );
  }

  // Fetch user with password field
  const user = await User.findOne({ _id: userId, is_deleted: false }).select("+password");

  if (!user) {
    throw new AppError("User not found", 404);
  }

  // If user is in first login state, they should use set-password endpoint
  if (user.is_first_login === true) {
    throw new AppError(
      "This appears to be your first login. Please use the set-password endpoint instead.",
      400
    );
  }

  // Verify current password
  const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);

  if (!isCurrentPasswordValid) {
    throw new AppError("Current password is incorrect", 401);
  }

  // Check if new password is same as current
  const isSamePassword = await bcrypt.compare(newPassword, user.password);

  if (isSamePassword) {
    throw new AppError("New password cannot be the same as current password", 400);
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Update password and clear refresh tokens
  user.password = hashedPassword;
  user.refreshTokens = [];
  user.blockedAt = new Date(); // Invalidate all existing JWTs
  
  // If this was first login scenario, set to false
  if (user.is_first_login === true) {
    user.is_first_login = false;
  }

  await user.save();

  return {
    message: "Password changed successfully",
    requireLogin: true
  };
};
