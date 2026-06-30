const AppError = require("../utils/appError");

exports.authorizeRoles = (...roles) => {
  return (req, res, next) => {

    if (!roles.includes(req.user.role)) {
      return next(new AppError("Access denied", 403));
    }

    next();
  };
};