const companyConfigService = require("./companyConfig.service");

// ─── GET /hrms/company/config ─────────────────────
exports.getConfig = async (req, res, next) => {
  try {
    const config = await companyConfigService.getConfig(req.user);
    res.json({
      success: true,
      message: "Company config fetched successfully",
      data: config,
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /hrms/company/config ────────────────────
exports.createConfig = async (req, res, next) => {
  try {
    const config = await companyConfigService.upsertConfig(req.body, req.user);
    res.status(201).json({
      success: true,
      message: "Company config saved successfully",
      data: config,
    });
  } catch (err) {
    next(err);
  }
};

// ─── PUT /hrms/company/config ─────────────────────
exports.updateConfig = async (req, res, next) => {
  try {
    const config = await companyConfigService.upsertConfig(req.body, req.user);
    res.json({
      success: true,
      message: "Company config updated successfully",
      data: config,
    });
  } catch (err) {
    next(err);
  }
};