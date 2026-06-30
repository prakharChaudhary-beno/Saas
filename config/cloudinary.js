const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");

// Cloudinary configure karo
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Storage configure karo
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    return {
      folder:         `hrms/employees/${req.params.id}/documents`,
      allowed_formats: ["jpg", "jpeg", "png", "pdf"],
      resource_type:  "auto",
      public_id:      `${Date.now()}-${file.originalname.replace(/\s/g, "_")}`
    };
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPG, PNG and PDF files are allowed"), false);
  }
};

// Multer upload
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024  // 5MB max
  }
});

module.exports = { upload, cloudinary };