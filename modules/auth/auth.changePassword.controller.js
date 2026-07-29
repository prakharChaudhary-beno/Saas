// modules/auth/auth.changePassword.controller.js
//
// Handles authenticated user password change (not first login)
// User must provide current password + new password

const authChangePasswordService = require("./auth.changePassword.service");

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    // userId is in req.user.userId (from JWT payload)
    const userId = req.user.userId;

    const result = await authChangePasswordService.changePassword(
      userId,
      currentPassword,
      newPassword
    );

    res.status(200).json({
      success: true,
      message: "Password changed successfully. Please login again.",
      data: result
    });
  } catch (error) {
    next(error);
  }
};
