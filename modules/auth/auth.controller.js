const authService = require("./auth.service");
const jwt = require("jsonwebtoken");
const User = require("./models/user.model");
const Tenant = require("../tenant/tenant.models");
const AppError = require("../../utils/appError");

// exports.superAdminLogin = async (req, res, next) => {
//   try {

//     const { email, password } = req.body;

//     const data = await authService.superAdminLogin(email, password);

//     return res.status(200).json({
//       success: true,
//       message: "Super admin login successful",
//       data
//     });

//   } catch (error) {
//     next(error);
//   }
// };

// exports.tenantlogin = async (req, res, next) => {
//   try {

//     const result = await authService.login(req.body);

//     res.status(200).json({
//       status: "success",
//       data: result
//     });

//   } catch (err) {
//     next(err);
//   }
// };
  exports.login = async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
        // ✅ MFA required hai toh alag response
    if (result.mfaRequired) {
      return res.status(200).json({
        success:     true,
        mfaRequired: true,
        mfaToken:    result.mfaToken,
      });
    }
    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

exports.googleCallback = async (req, res, next) => {
  try {
    const googleUser = req.user;

    // ✅ state se lo ya fallback
    const returnUrl = req.query.state 
      || `${process.env.GOOGLE_FRONTEND_REDIRECT_URI}/auth/google/callback`;

    console.log("State:", req.query.state);
    console.log("Return URL:", returnUrl);

    if (googleUser.isNewUser) {
      const tempToken = jwt.sign(
        {
          email:    googleUser.email,
          name:     googleUser.firstName,
          googleId: googleUser.googleId,
          isNewUser: true
        },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      );

      const params = new URLSearchParams({
        token : tempToken,
        isNewUser: "true"
      });

      // ✅ /auth/google/callback path add karo
      return res.redirect(
        `${returnUrl}?${params.toString()}`
      );
    }

    // Existing user
    const user = await User.findById(googleUser._id).populate("roleId");
    const tenant = await Tenant.findOne({ _id: user.org_id, isDeleted: false });

    const token = jwt.sign(
      {
        userId:     user._id,
        org_id:     user.org_id     || null,
        company_id: user.company_id || null,
        unit_id:    user.unit_id    || null,
        roleId:     user.roleId._id,
        role:       user.roleId.slug,
        level:      user.roleId.level,
        is_first_login: user.is_first_login || false,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    const daysLeft = tenant ? Math.ceil(
      (new Date(tenant.trialEndsAt) - new Date()) / (1000 * 60 * 60 * 24)
    ) : 0;

    const params = new URLSearchParams({
      token,
      isOnboardingComplete: tenant?.isOnboardingComplete || false,
      currentStep:          tenant?.onboardingStep || 1,
      plan:                 tenant?.plan || "TRIAL",
      daysLeft:             daysLeft > 0 ? daysLeft : 0
    });

    // ✅ /auth/google/callback path add karo
    return res.redirect(
      `${returnUrl}?${params.toString()}`
    );

  } catch (error) {
    next(error);
  }
};

exports.getMe = async (req, res, next) => {
  try {
    const result = await authService.getMe(req.user);
    return res.status(200).json({
      success: true,
      message: "User fetched successfully",
      data:    result
    });
  } catch (error) {
    next(error);
  }
};






// exports.googleCallback = async (req, res, next) => {
//   try {
//     const googleUser = req.user;
//     // console.log("Google user data:", googleUser);

//     // Naya user — company details chahiye
//     if (googleUser.isNewUser) {
//       const tempToken = jwt.sign(
//         {
//           email:     googleUser.email,
//           name:      googleUser.firstName,
//           googleId:  googleUser.googleId,
//           isNewUser: true
//         },
//         process.env.JWT_SECRET,
//         { expiresIn: "1h" }
//       );

//       // Frontend onboarding page pe redirect
//       return res.redirect(
//         `${process.env.FRONTEND_URL}/onboarding?token=${tempToken}`
//       );
//     }

//     // Existing user — normal login
//     const user = await User.findById(googleUser._id).populate("roleId");
//     const tenant = await Tenant.findOne({ _id: user.tenantId, isDeleted: false });

//     const token = jwt.sign(
//       {
//         userId:   user._id,
//         tenantId: user.tenantId,
//         roleId:   user.roleId._id,
//         role:     user.roleId.slug
//       },
//       process.env.JWT_SECRET,
//       { expiresIn: "1d" }
//     );
//     // Frontend dashboard pe redirect
//     return res.redirect(
//       `${process.env.GOOGLE_FRONTEND_REDIRECT_URI}/auth/google/callback?token=${token}`
//     );

//   } catch (error) {
//     next(error);
//   }
// };

// exports.googleCallback = async (req, res, next) => {
//   try {
//     const googleUser = req.user;

//     // Naya user — company details chahiye
//     if (googleUser.isNewUser) {
//       const tempToken = jwt.sign(
//         {
//           email:     googleUser.email,
//           name:      googleUser.firstName,
//           googleId:  googleUser.googleId,
//           isNewUser: true
//         },
//         process.env.JWT_SECRET,
//         { expiresIn: "1h" }
//       );

//       // ✅ Frontend nahi hai — JSON return karo
//       return res.status(200).json({
//         success:  true,
//         message:  "New user — complete registration",
//         isNewUser: true,
//         tempToken  // frontend pe bhejoge baad mein
//       });
//     }

//     // Existing user — normal login
//     const user = await User.findById(googleUser._id).populate("roleId");
//     const tenant = await Tenant.findOne({ _id: user.tenantId, isDeleted: false });

//     const token = jwt.sign(
//       {
//         userId:   user._id,
//         tenantId: user.tenantId,
//         roleId:   user.roleId._id,
//         role:     user.roleId.slug
//       },
//       process.env.JWT_SECRET,
//       { expiresIn: "1d" }
//     );

//     // ✅ Frontend nahi hai — JSON return karo
//     return res.status(200).json({
//       success: true,
//       message: "Login successful",
//       data: {
//         token,
//         user: {
//           id:       user._id,
//           name:     user.name,
//           email:    user.email,
//           tenantId: user.tenantId,
//           role: {
//             name: user.roleId.name,
//             slug: user.roleId.slug
//           }
//         },
//         onboarding: {
//           isComplete:  tenant?.isOnboardingComplete || false,
//           currentStep: tenant?.onboardingStep || 1,
//           totalSteps:  3
//         },
//         trial: {
//           plan:        tenant?.plan,
//           trialEndsAt: tenant?.trialEndsAt,
//           daysLeft:    tenant ? Math.ceil((new Date(tenant.trialEndsAt) - new Date()) / (1000 * 60 * 60 * 24)) : null
//         }
//       }
//     });

//   } catch (error) {
//     next(error);
//   }
// };

exports.completeRegistration = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) throw new AppError("Token required", 401);

    // Temp token verify karo
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      throw new AppError("Invalid or expired token", 401);
    }

    // isNewUser check — real token se access na ho
    if (!decoded.isNewUser) {
      throw new AppError("Invalid token", 401);
    }

    const result = await authService.completeRegistration(req.body, decoded);

    return res.status(201).json({
      success: true,
      message: "Registration complete! Trial started.",
      data:    result
    });

  } catch (error) {
    next(error);
  }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const result = await authService.forgotPassword(req.body.email);
    return res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error) {
    next(error);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    const result = await authService.resetPassword(token, password);
    return res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error) {
    next(error);
  }
};