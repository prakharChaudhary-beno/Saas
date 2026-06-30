const departmentService = require("./department.service");

exports.create = async (req, res) => {
  try {

    const department = await departmentService.createDepartment(
      req.body,
      req.user
    );

    res.status(201).json({
      success: true,
      data: department
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

    const departments = await departmentService.getDepartments(req.user);

    res.json({
      success: true,
      data: departments
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

    const department = await departmentService.getDepartmentById(
      req.params.id,
      req.user
    );

    res.json({
      success: true,
      data: department
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

    const department = await departmentService.updateDepartment(
      req.params.id,
      req.body,
      req.user
    );

    res.json({
      success: true,
      data: department
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

    const result = await departmentService.deleteDepartment(
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