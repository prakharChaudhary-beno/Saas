const designationService = require("./designation.service");

exports.create = async (req, res, next) => {
  try {
    const designation = await designationService.createDesignation(
      req.body,
      req.user,
      req.query
    );

    res.status(201).json({
      success: true,
      data: designation
    });

  } catch (error) { next(error); }
};


exports.list = async (req, res, next) => {
  try {
    const designations = await designationService.getDesignations(req.user, req.query);

    res.json({
      success: true,
      data: designations
    });

  } catch (error) { next(error); }
};


exports.getById = async (req, res, next) => {
  try {

    const designation = await designationService.getDesignationById(
      req.params.id,
      req.user,
      req.query
    );

    res.json({
      success: true,
      data: designation
    });

  } catch (error) { next(error); }
};


exports.update = async (req, res, next) => {
  try {

    const designation = await designationService.updateDesignation(
      req.params.id,
      req.body,
      req.user,
      req.query
    );

    res.json({
      success: true,
      data: designation
    });

  } catch (error) { next(error); }
};


exports.delete = async (req, res, next) => {
  try {

    const result = await designationService.deleteDesignation(
      req.params.id,
      req.user,
      req.query
    );

    res.json({
      success: true,
      message: result.message
    });

  } catch (error) { next(error); }
};