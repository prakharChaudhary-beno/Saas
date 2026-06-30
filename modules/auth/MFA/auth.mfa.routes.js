const express       = require("express");
const router        = express.Router();
const mfaController = require("./auth.mfa.controller");
const { authenticate } = require("../../../middlewares/auth.middleware"); // ✅

// ─── Public route — login ke baad challenge (token nahi hota tab) ─────────────
// userId + OTP submit — full JWT milta hai
router.post("/challenge", mfaController.challenge);

// ─── Protected routes — logged in user ke liye ───────────────────────────────
router.use(authenticate);

router.get ("/status",                    mfaController.getStatus);
router.post("/enrol",                     mfaController.enrol);
router.post("/verify-enrolment",          mfaController.verifyEnrolment);
router.post("/disable",                   mfaController.disable);
router.post("/backup-codes/regenerate",   mfaController.regenerateBackupCodes);

module.exports = router;