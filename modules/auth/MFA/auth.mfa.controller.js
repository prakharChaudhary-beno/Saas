// const mfaService = require("./auth.mfa.service");
// const jwt        = require("../../../utils/jwt.utils");
// const AppError   = require("../../../utils/appError");


// // POST /api/v1/auth/mfa/enrol
// exports.enrol = async (req, res, next) => {
//   try {
//     const result = await mfaService.enrol(req.user.userId);
//     res.status(200).json({
//       success: true,
//       message: "Scan the QR code with your authenticator app",
//       data:    result,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// // POST /api/v1/auth/mfa/verify-enrolment
// exports.verifyEnrolment = async (req, res, next) => {
//   try {
//     const { token } = req.body;
//     if (!token) return next(new (require("../../utils/appError"))("OTP token is required", 400));

//     const result = await mfaService.verifyEnrolment(req.user.userId, token);

//     res.status(200).json({
//       success: true,
//       message: result.message,
//       data: {
//         backupCodes: result.backupCodes,
//         warning: "Save these backup codes now. They will not be shown again.",
//       },
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// // POST /api/v1/auth/mfa/challenge
// // Login ke baad OTP submit karta hai — full JWT milta hai
// exports.challenge = async (req, res, next) => {
//   try {
//       const { mfaToken, token } = req.body; // ✅ userId nahi

//     if (!mfaToken || !token) {
//       return next(new AppError("mfaToken and OTP are required", 400));
//     }

//     // mfaToken decode karo
//     let decoded;
//     try {
//       decoded = jwt.verify(mfaToken, process.env.JWT_SECRET);
//     } catch {
//       return next(new AppError("MFA session expired. Please login again.", 401));
//     }

//     if (!decoded.mfaPending) {
//       return next(new AppError("Invalid MFA token", 400));
//     }
//     const result = await mfaService.verifyLoginChallenge(userId, token);

//     if (!result.verified) {
//       return next(new (require("../../utils/appError"))("Verification failed", 400));
//     }

//     // Verified — ab full JWT generate karo
//     // User fetch karo for JWT payload
//     const User = require("./models/user.model");
//     const user = await User.findById(userId).populate("roleId", "slug name");

//     const fullToken = jwt.signToken({
//       userId:   user._id,
//       tenantId: user.tenantId,
//       roleId:   user.roleId._id,
//       role:     user.roleId.slug,
//     });

//     res.status(200).json({
//       success: true,
//       message: "MFA verified successfully",
//       data: {
//         token:  fullToken,
//         method: result.method,
//         ...(result.remainingBackups !== undefined && {
//           remainingBackupCodes: result.remainingBackups,
//         }),
//       },
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// // POST /api/v1/auth/mfa/disable
// exports.disable = async (req, res, next) => {
//   try {
//     const { token } = req.body;
//     if (!token) return next(new (require("../../utils/appError"))("OTP token is required", 400));

//     const result = await mfaService.disable(req.user.userId, token);
//     res.status(200).json({ success: true, message: result.message });
//   } catch (error) {
//     next(error);
//   }
// };

// // POST /api/v1/auth/mfa/backup-codes/regenerate
// exports.regenerateBackupCodes = async (req, res, next) => {
//   try {
//     const { token } = req.body;
//     if (!token) return next(new (require("../../utils/appError"))("OTP token is required", 400));

//     const result = await mfaService.regenerateBackupCodes(req.user.userId, token);
//     res.status(200).json({
//       success: true,
//       message: result.message,
//       data: {
//         backupCodes: result.backupCodes,
//         warning: "Save these backup codes now. They will not be shown again.",
//       },
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// // GET /api/v1/auth/mfa/status
// exports.getStatus = async (req, res, next) => {
//   try {
//     const result = await mfaService.getStatus(req.user.userId);
//     res.status(200).json({ success: true, data: result });
//   } catch (error) {
//     next(error);
//   }
// };


const mfaService    = require("./auth.mfa.service");
const { verifyToken, generateToken } = require("../../../utils/jwt.utils"); // ✅ correct import
const AppError      = require("../../../utils/appError");
const User          = require("../models/user.model"); // ✅ top pe import

// POST /api/v1/auth/mfa/enrol
exports.enrol = async (req, res, next) => {
  try {
    const result = await mfaService.enrol(req.user.userId);
    res.status(200).json({
      success: true,
      message: "Scan the QR code with your authenticator app",
      data:    result,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/auth/mfa/verify-enrolment
exports.verifyEnrolment = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return next(new AppError("OTP token is required", 400)); // ✅

    const result = await mfaService.verifyEnrolment(req.user.userId, token);
    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        backupCodes: result.backupCodes,
        warning: "Save these backup codes now. They will not be shown again.",
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/auth/mfa/challenge
exports.challenge = async (req, res, next) => {
  try {
    const { mfaToken, token } = req.body;

    if (!mfaToken || !token) {
      return next(new AppError("mfaToken and OTP are required", 400));
    }

    // ✅ verifyToken use karo — jwt.verify nahi
    let decoded;
    try {
      decoded = verifyToken(mfaToken);
    } catch {
      return next(new AppError("MFA session expired. Please login again.", 401));
    }

    if (!decoded.mfaPending) {
      return next(new AppError("Invalid MFA token", 400));
    }

    const userId = decoded.userId; // ✅ decoded se nikalo

    const result = await mfaService.verifyLoginChallenge(userId, token);

    if (!result.verified) {
      return next(new AppError("Verification failed", 400));
    }

    const user = await User.findById(userId).populate("roleId", "slug name level");

    const fullToken = generateToken({
      userId:         user._id,
      org_id:         user.org_id     || null,
      company_id:     user.company_id || null,
      unit_id:        user.unit_id    || null,
      roleId:         user.roleId._id,
      role:           user.roleId.slug,
      level:          user.roleId.level,
      is_first_login: user.is_first_login || false,
    });

    res.status(200).json({
      success: true,
      message: "MFA verified successfully",
      data: {
        token:  fullToken,
        method: result.method,
        ...(result.remainingBackups !== undefined && {
          remainingBackupCodes: result.remainingBackups,
        }),
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/auth/mfa/disable
exports.disable = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return next(new AppError("OTP token is required", 400)); // ✅

    const result = await mfaService.disable(req.user.userId, token);
    res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/auth/mfa/backup-codes/regenerate
exports.regenerateBackupCodes = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return next(new AppError("OTP token is required", 400)); // ✅

    const result = await mfaService.regenerateBackupCodes(req.user.userId, token);
    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        backupCodes: result.backupCodes,
        warning: "Save these backup codes now. They will not be shown again.",
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/auth/mfa/status
exports.getStatus = async (req, res, next) => {
  try {
    const result = await mfaService.getStatus(req.user.userId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};