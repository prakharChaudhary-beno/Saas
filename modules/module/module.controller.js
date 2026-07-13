// modules/module/module.controller.js
// Module management controller

const Module = require('./models/module.model');
const AppError = require('../../middlewares/error.middleware');

// GET /modules - Fetch all active modules (Super Admin)
exports.getAllModules = async (req, res, next) => {
  try {
    const modules = await Module.find({ is_active: true })
      .select('_id slug name description icon color order pages')
      .sort({ order: 1 });
    
    res.json({
      status: 'success',
      data: modules
    });
  } catch (error) {
    next(error);
  }
};

// GET /modules/:id - Fetch single module
exports.getModuleById = async (req, res, next) => {
  try {
    const module = await Module.findById(req.params.id)
      .select('_id slug name description icon color order pages permissions');
    
    if (!module) {
      return next(new AppError('Module not found', 404));
    }
    
    res.json({
      status: 'success',
      data: module
    });
  } catch (error) {
    next(error);
  }
};
