const speakeasy = require("speakeasy");
const qrcode    = require("qrcode");
const crypto    = require("crypto");
const bcrypt    = require("bcryptjs");
const User      = require("../models/user.model");
const AppError  = require("../../../utils/appError");
const { encrypt, decrypt } = require("../../../utils/crypto");

const APP_NAME = process.env.APP_NAME || "BenoSupport HRMS";

// ─── STEP 1: ENROLL ────────────────────────────────────────────────────────

exports.enrol = async (userId) => {
  const user = await User.findById(userId).select("+mfaSecret +mfaTempSecret");

  if (!user) throw new AppError("User not found", 404);

  if (user.mfaEnabled) {
    throw new AppError("MFA is already enabled. Disable it first to re-enrol.", 400);
  }

  const secret = speakeasy.generateSecret({
    name:   `${APP_NAME} (${user.email})`,
    length: 20,
  });

  user.mfaTempSecret = encrypt(secret.base32);
  await user.save({ validateBeforeSave: false });

  const qrCodeDataURL = await qrcode.toDataURL(secret.otpauth_url);

  return {
    secret:      secret.base32,
    otpauthUrl:  secret.otpauth_url,
    qrCode:      qrCodeDataURL,
  };
};

// ─── STEP 2: VERIFY ENROLMENT ──────────────────────────────────────────────

exports.verifyEnrolment = async (userId, token) => {
  const user = await User.findById(userId).select("+mfaSecret +mfaTempSecret +mfaBackupCodes");

  if (!user) throw new AppError("User not found", 404);

  if (user.mfaEnabled) {
    throw new AppError("MFA is already enabled", 400);
  }

  if (!user.mfaTempSecret) {
    throw new AppError("No MFA enrolment in progress. Please call /mfa/enrol first.", 400);
  }

  const tempSecret = decrypt(user.mfaTempSecret);

  const isValid = speakeasy.totp.verify({
    secret:   tempSecret,
    encoding: "base32",
    token:    token,
    window:   1,
  });

  if (!isValid) {
    throw new AppError("Invalid OTP. Please try again.", 400);
  }

  const plainBackupCodes = generateBackupCodes();
  const hashedBackupCodes = await Promise.all(
    plainBackupCodes.map(async c => ({
      codeHash: await bcrypt.hash(c, 10),
      used: false
    }))
  );

  user.mfaSecret      = encrypt(tempSecret);
  user.mfaTempSecret  = null;
  user.mfaEnabled     = true;
  user.mfaEnrolledAt  = new Date();
  user.mfaBackupCodes = hashedBackupCodes;

  await user.save({ validateBeforeSave: false });

  return {
    message:     "MFA enabled successfully",
    backupCodes: plainBackupCodes,
  };
};

// ─── LOGIN CHALLENGE ────────────────────────────────────────────────────────

exports.verifyLoginChallenge = async (userId, token) => {
  const user = await User.findById(userId).select("+mfaSecret +mfaBackupCodes");

  if (!user) throw new AppError("User not found", 404);

  if (!user.mfaEnabled || !user.mfaSecret) {
    throw new AppError("MFA is not enabled for this user", 400);
  }

  const secret = decrypt(user.mfaSecret);

  const isTotpValid = speakeasy.totp.verify({
    secret:   secret,
    encoding: "base32",
    token:    token,
    window:   1,
  });

  if (isTotpValid) return { verified: true, method: "totp" };

  // Check backup codes
  for (const bc of user.mfaBackupCodes) {
    if (!bc.used && await bcrypt.compare(token, bc.codeHash)) {
      bc.used = true;
      bc.usedAt = new Date();
      await user.save({ validateBeforeSave: false });

      const remainingBackups = user.mfaBackupCodes.filter(bc => !bc.used).length;

      return {
        verified:          true,
        method:            "backup_code",
        remainingBackups:  remainingBackups,
      };
    }
  }

  throw new AppError("Invalid OTP or backup code", 400);
};

// ─── DISABLE MFA ────────────────────────────────────────────────────────────

exports.disable = async (userId, token) => {
  const user = await User.findById(userId).select("+mfaSecret +mfaBackupCodes +password");

  if (!user) throw new AppError("User not found", 404);

  if (!user.mfaEnabled) {
    throw new AppError("MFA is not enabled", 400);
  }

  const secret = decrypt(user.mfaSecret);

  const isValid = speakeasy.totp.verify({
    secret:   secret,
    encoding: "base32",
    token:    token,
    window:   1,
  });

  if (!isValid) {
    throw new AppError(
      "Invalid OTP. Please provide current authenticator code to disable MFA.",
      400
    );
  }

  user.mfaEnabled     = false;
  user.mfaSecret      = null;
  user.mfaTempSecret  = null;
  user.mfaBackupCodes = [];

  await user.save({ validateBeforeSave: false });

  return { message: "MFA disabled successfully" };
};

// ─── REGENERATE BACKUP CODES ───────────────────────────────────────────────

exports.regenerateBackupCodes = async (userId, token) => {
  const user = await User.findById(userId).select("+mfaSecret +mfaBackupCodes");

  if (!user) throw new AppError("User not found", 404);

  if (!user.mfaEnabled || !user.mfaSecret) {
    throw new AppError("MFA is not enabled", 400);
  }

  const secret = decrypt(user.mfaSecret);

  const isValid = speakeasy.totp.verify({
    secret:   secret,
    encoding: "base32",
    token:    token,
    window:   1,
  });

  if (!isValid) {
    throw new AppError("Invalid OTP", 400);
  }

  const plainBackupCodes  = generateBackupCodes();
  const hashedBackupCodes = await Promise.all(
    plainBackupCodes.map(async c => ({
      codeHash: await bcrypt.hash(c, 10),
      used: false
    }))
  );

  user.mfaBackupCodes = hashedBackupCodes;

  await user.save({ validateBeforeSave: false });

  return {
    message:     "Backup codes regenerated",
    backupCodes: plainBackupCodes,
  };
};

// ─── GET MFA STATUS ─────────────────────────────────────────────────────────

exports.getStatus = async (userId) => {
  const user = await User.findById(userId).select("+mfaBackupCodes +mfaEnabled +mfaEnrolledAt");

  if (!user) throw new AppError("User not found", 404);

  const remainingBackupCodes = user.mfaBackupCodes.filter(bc => !bc.used).length;

  return {
    enabled:              user.mfaEnabled,
    enrolledAt:          user.mfaEnrolledAt,
    remainingBackupCodes: remainingBackupCodes,
    totalBackupCodes:     user.mfaBackupCodes.length
  };
};

// ─── HELPER FUNCTIONS ───────────────────────────────────────────────────────

const generateBackupCodes = (count = 8) => {
  return Array.from({ length: count }, () => {
    const part1 = crypto.randomBytes(3).toString("hex").toUpperCase();
    const part2 = crypto.randomBytes(3).toString("hex").toUpperCase();
    return `${part1}-${part2}`;
  });
};
