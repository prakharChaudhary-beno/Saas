
const permissionService = require("./permission.service");


exports.getPermissions = async (req, res, next) => {
  try {
    const permissions = await permissionService.getPermissions();
    return res.status(200).json({
      success: true,
      message: "Permissions fetched successfully",
      data: permissions
    });
  } catch (error) {
    next(error);
  }
};  