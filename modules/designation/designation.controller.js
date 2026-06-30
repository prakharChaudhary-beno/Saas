const designationService = require("./designation.service");

exports.create = async (req, res) => {
  try {

    const designation = await designationService.createDesignation(
      req.body,
      req.user
    );

    res.status(201).json({
      success: true,
      data: designation
    });

  } catch (error) {

    res.status(400).json({
      success: false,
      message: error.message
    });

  }
};


exports.list = async (req, res) => {
  try {

    const designations = await designationService.getDesignations(req.user);

    res.json({
      success: true,
      data: designations
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }
};


exports.getById = async (req, res) => {
  try {

    const designation = await designationService.getDesignationById(
      req.params.id,
      req.user
    );

    res.json({
      success: true,
      data: designation
    });

  } catch (error) {

    res.status(404).json({
      success: false,
      message: error.message
    });

  }
};


exports.update = async (req, res) => {
  try {

    const designation = await designationService.updateDesignation(
      req.params.id,
      req.body,
      req.user
    );

    res.json({
      success: true,
      data: designation
    });

  } catch (error) {

    res.status(400).json({
      success: false,
      message: error.message
    });

  }
};


exports.delete = async (req, res) => {
  try {

    const result = await designationService.deleteDesignation(
      req.params.id,
      req.user
    );

    res.json({
      success: true,
      message: result.message
    });

  } catch (error) {

    res.status(400).json({
      success: false,
      message: error.message
    });

  }
};