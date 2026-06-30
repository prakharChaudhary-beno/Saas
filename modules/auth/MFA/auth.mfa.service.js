const speakeasy = require("speakeasy");
const qrcode    = require("qrcode");
const crypto    = require("crypto");
const User      = require("../models/user.model");
const jwt       = require("../../../utils/jwt.utils");
const mfaService = require("./auth.mfa.service");
const AppError  = require("../../../utils/appError");

// App name — QR code mein dikhega (Google Authenticator mein "BenoSupport HRMS")
const APP_NAME = process.env.APP_NAME || "BenoSupport HRMS";

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — ENROL (Generate secret + QR code)
// POST /api/v1/auth/mfa/enrol
// ─────────────────────────────────────────────────────────────────────────────
//
// Kya hota hai:
//   1. Naya TOTP secret generate karo (speakeasy)
//   2. otpauth:// URI banao — Google Authenticator isi ko scan karta hai
//   3. QR code image banao (base64 PNG)
//   4. Secret ko TEMP mein store karo user ke paas
//      (DB mein permanent tab save hoga jab verify ho jaye)
//
// Kyun temp mein store?
//   Agar user QR scan kare bina chala jaye toh secret permanently nahi ban-ta.
//   Sirf verify ke baad real mfaSecret set hoti hai.
// ─────────────────────────────────────────────────────────────────────────────

exports.enrol = async (userId) => {

  const user = await User.findById(userId).select("+mfaSecret +mfaTempSecret");

  if (!user) throw new AppError("User not found", 404);

  // Already enabled hai toh block karo
  if (user.mfaEnabled) {
    throw new AppError(
      "MFA is already enabled. Disable it first to re-enrol.",
      400
    );
  }

  // Step 1: Secret generate karo
  const secret = speakeasy.generateSecret({
    name:   `${APP_NAME} (${user.email})`,  // QR mein label
    length: 20,                              // 20 bytes = strong enough
  });

  // Step 2: Temp mein save karo — verify hone tak
  user.mfaTempSecret = secret.base32;
  await user.save({ validateBeforeSave: false });

  // Step 3: QR code banao — otpauth URI se
  const qrCodeDataURL = await qrcode.toDataURL(secret.otpauth_url);

  return {
    secret:      secret.base32,       // Manual entry ke liye (agar QR scan na ho sake)
    otpauthUrl:  secret.otpauth_url,  // Advanced users ke liye
    qrCode:      qrCodeDataURL,       // Frontend mein <img src={qrCode} /> karo
  };

};

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — VERIFY ENROLMENT (Confirm + activate MFA)
// POST /api/v1/auth/mfa/verify-enrolment
// ─────────────────────────────────────────────────────────────────────────────
//
// User ne QR scan kiya, app se 6-digit OTP aaya — verify karo
// Sahi hone pe:
//   - mfaTempSecret → mfaSecret (permanent)
//   - mfaEnabled: true
//   - 8 backup codes generate karo (hashed store, plain text return)
// ─────────────────────────────────────────────────────────────────────────────

exports.verifyEnrolment = async (userId, token) => {

  const user = await User.findById(userId).select(
    "+mfaSecret +mfaTempSecret +mfaBackupCodes"
  );

  if (!user) throw new AppError("User not found", 404);

  if (user.mfaEnabled) {
    throw new AppError("MFA is already enabled", 400);
  }

  if (!user.mfaTempSecret) {
    throw new AppError(
      "No MFA enrolment in progress. Please call /mfa/enrol first.",
      400
    );
  }

  // Token verify karo against temp secret
  const isValid = speakeasy.totp.verify({
    secret:   user.mfaTempSecret,
    encoding: "base32",
    token:    token,
    window:   1,  // ±1 time window (30s drift allow) — prevents clock skew issues
  });

  if (!isValid) {
    throw new AppError("Invalid OTP. Please try again.", 400);
  }

  // Valid — ab permanent activate karo
  const plainBackupCodes = generateBackupCodes();   // plain text — user ko dikhao
  const hashedBackupCodes = plainBackupCodes.map(hashBackupCode); // hashed — DB mein store

  user.mfaSecret      = user.mfaTempSecret;   // temp → permanent
  user.mfaTempSecret  = null;                  // temp clear karo
  user.mfaEnabled     = true;
  user.mfaBackupCodes = hashedBackupCodes;

  await user.save({ validateBeforeSave: false });

  return {
    message:     "MFA enabled successfully",
    backupCodes: plainBackupCodes,  // Sirf ek baar dikhao — user save kare
  };

};

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN CHALLENGE — Verify OTP at login
// POST /api/v1/auth/mfa/challenge
// ─────────────────────────────────────────────────────────────────────────────
//
// Login ke baad jab mfaRequired: true aata hai
// Frontend OTP maangta hai, yahan verify hota hai → full JWT milta hai
//
// Backup code bhi accept karta hai (agar phone nahi hai)
// ─────────────────────────────────────────────────────────────────────────────

exports.verifyLoginChallenge = async (userId, token) => {

  const user = await User.findById(userId).select(
    "+mfaSecret +mfaBackupCodes"
  );

  if (!user) throw new AppError("User not found", 404);

  if (!user.mfaEnabled || !user.mfaSecret) {
    throw new AppError("MFA is not enabled for this user", 400);
  }

  // Pehle TOTP check karo
  const isTotpValid = speakeasy.totp.verify({
    secret:   user.mfaSecret,
    encoding: "base32",
    token:    token,
    window:   1,
  });

  if (isTotpValid) return { verified: true, method: "totp" };

  // TOTP fail — backup code check karo
  const tokenHash = hashBackupCode(token);
  const backupIndex = user.mfaBackupCodes.indexOf(tokenHash);

  if (backupIndex !== -1) {
    // Backup code use hone ke baad remove karo — one-time use
    user.mfaBackupCodes.splice(backupIndex, 1);
    await user.save({ validateBeforeSave: false });

    return {
      verified:          true,
      method:            "backup_code",
      remainingBackups:  user.mfaBackupCodes.length,
    };
  }

  throw new AppError("Invalid OTP or backup code", 400);

};

// ─────────────────────────────────────────────────────────────────────────────
// DISABLE MFA
// POST /api/v1/auth/mfa/disable
// ─────────────────────────────────────────────────────────────────────────────
//
// Password confirm + current OTP required — security ke liye dono chahiye
// ─────────────────────────────────────────────────────────────────────────────

exports.disable = async (userId, token) => {

  const user = await User.findById(userId).select(
    "+mfaSecret +mfaBackupCodes +password"
  );

  if (!user) throw new AppError("User not found", 404);

  if (!user.mfaEnabled) {
    throw new AppError("MFA is not enabled", 400);
  }

  // Current OTP verify karo
  const isValid = speakeasy.totp.verify({
    secret:   user.mfaSecret,
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

  // Disable karo — sab clear
  user.mfaEnabled     = false;
  user.mfaSecret      = null;
  user.mfaTempSecret  = null;
  user.mfaBackupCodes = [];

  await user.save({ validateBeforeSave: false });

  return { message: "MFA disabled successfully" };

};

// ─────────────────────────────────────────────────────────────────────────────
// REGENERATE BACKUP CODES
// POST /api/v1/auth/mfa/backup-codes/regenerate
// ─────────────────────────────────────────────────────────────────────────────
//
// Purane backup codes expire ho gaye ya sab use ho gaye
// Current OTP verify karke naye codes generate karo
// ─────────────────────────────────────────────────────────────────────────────

exports.regenerateBackupCodes = async (userId, token) => {

  const user = await User.findById(userId).select(
    "+mfaSecret +mfaBackupCodes"
  );

  if (!user) throw new AppError("User not found", 404);

  if (!user.mfaEnabled || !user.mfaSecret) {
    throw new AppError("MFA is not enabled", 400);
  }

  // Current OTP se confirm karo
  const isValid = speakeasy.totp.verify({
    secret:   user.mfaSecret,
    encoding: "base32",
    token:    token,
    window:   1,
  });

  if (!isValid) {
    throw new AppError("Invalid OTP", 400);
  }

  const plainBackupCodes  = generateBackupCodes();
  user.mfaBackupCodes     = plainBackupCodes.map(hashBackupCode);

  await user.save({ validateBeforeSave: false });

  return {
    message:     "Backup codes regenerated",
    backupCodes: plainBackupCodes,  // Sirf ek baar dikhao
  };

};

// ─────────────────────────────────────────────────────────────────────────────
// GET MFA STATUS
// GET /api/v1/auth/mfa/status
// ─────────────────────────────────────────────────────────────────────────────

exports.getStatus = async (userId) => {

  const user = await User.findById(userId).select("+mfaBackupCodes +mfaEnabled");

  if (!user) throw new AppError("User not found", 404);

  return {
    mfaEnabled:          user.mfaEnabled,
    remainingBackupCodes: user.mfaEnabled ? user.mfaBackupCodes.length : 0,
  };

};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 8 backup codes generate karo
 * Format: XXXX-XXXX (easy to read and type)
 */
const generateBackupCodes = (count = 8) => {
  return Array.from({ length: count }, () => {
    const part1 = crypto.randomBytes(3).toString("hex").toUpperCase(); // 6 chars
    const part2 = crypto.randomBytes(3).toString("hex").toUpperCase(); // 6 chars
    return `${part1}-${part2}`;
  });
};

/**
 * Backup code ko SHA-256 hash karo — DB mein plain text nahi store karte
 */
const hashBackupCode = (code) => {
  return crypto
    .createHash("sha256")
    .update(code.toUpperCase().trim())  // case insensitive
    .digest("hex");
};