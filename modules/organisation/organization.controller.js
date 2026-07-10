// modules/organisation/organization.controller.js

const Organization = require("./models/organization.model");
const AppError = require("../../utils/appError");

// ─── GET /api/v1/organization/config ─────────────────────
exports.getConfig = async (req, res, next) => {
  try {
    if (!req.user.orgId) {
      return next(new AppError("Organization ID not found in user context", 400));
    }

    const org = await Organization.findById(req.user.orgId).select(
      "name logo_url address timezone currency fiscalYearStart industry country contact_email contact_phone"
    );

    if (!org) {
      return next(new AppError("Organization not found", 404));
    }

    res.json({
      success: true,
      message: "Organization config fetched successfully",
      data: org,
    });
  } catch (err) {
    next(err);
  }
};

// ─── PUT /api/v1/organization/config ─────────────────────
exports.updateConfig = async (req, res, next) => {
  try {
    if (!req.user.orgId) {
      return next(new AppError("Organization ID not found in user context", 400));
    }

    const allowedUpdates = [
      "logo_url",
      "address",
      "timezone",
      "currency",
      "fiscalYearStart",
      "industry",
      "country",
      "contact_email",
      "contact_phone",
    ];

    const updates = {};
    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    // Validate timezone if provided
    if (updates.timezone) {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: updates.timezone });
      } catch {
        return next(new AppError("Invalid IANA timezone. Example: Asia/Kolkata", 400));
      }
    }

    // Validate currency if provided
    if (updates.currency && !/^[A-Z]{3}$/.test(updates.currency.toUpperCase())) {
      return next(new AppError("Invalid currency code. Must be 3 uppercase letters. Example: INR", 400));
    }

    if (updates.currency) updates.currency = updates.currency.toUpperCase();

    const org = await Organization.findByIdAndUpdate(
      req.user.orgId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select(
      "name logo_url address timezone currency fiscalYearStart industry country contact_email contact_phone"
    );

    if (!org) {
      return next(new AppError("Organization not found", 404));
    }

    res.json({
      success: true,
      message: "Organization config updated successfully",
      data: org,
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/v1/organization/logo (Upload) ─────────────────────
exports.uploadLogo = async (req, res, next) => {
  try {
    if (!req.user.orgId) {
      return next(new AppError("Organization ID not found in user context", 400));
    }

    if (!req.file) {
      return next(new AppError("No file uploaded", 400));
    }

    // File uploaded to Cloudinary via multer middleware
    const logoUrl = req.file.path; // Cloudinary URL

    const org = await Organization.findByIdAndUpdate(
      req.user.orgId,
      { logo_url: logoUrl },
      { new: true }
    ).select("logo_url");

    if (!org) {
      return next(new AppError("Organization not found", 404));
    }

    res.json({
      success: true,
      message: "Logo uploaded successfully",
      data: { logo_url: org.logo_url },
    });
  } catch (err) {
    next(err);
  }
};

