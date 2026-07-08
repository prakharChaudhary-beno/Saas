// modules/attendance/regularisationPolicy.controller.js
// Enterprise-level Regularisation Policy Controller

"use strict";

const service = require("./regularisationPolicy.service");

// ─── CREATE ─────────────────────────────────────────────────────
exports.createPolicy = async (req, res, next) => {
  try {
    const policy = await service.createPolicy(req.body, req.user);
    res.status(201).json({
      success: true,
      message: "Regularisation policy created successfully",
      data: policy,
    });
  } catch (error) {
    next(error);
  }
};

// ─── GET ALL ────────────────────────────────────────────────────
exports.getPolicies = async (req, res, next) => {
  try {
    const result = await service.getPolicies(req.query, req.user);
    res.status(200).json({
      success: true,
      data: result.policies,
      pagination: {
        page: result.page,
        limit: Number(req.query.limit) || 20,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── GET BY ID ──────────────────────────────────────────────────
exports.getPolicyById = async (req, res, next) => {
  try {
    const policy = await service.getPolicyById(req.params.id, req.user);
    res.status(200).json({
      success: true,
      data: policy,
    });
  } catch (error) {
    next(error);
  }
};

// ─── UPDATE ─────────────────────────────────────────────────────
exports.updatePolicy = async (req, res, next) => {
  try {
    const policy = await service.updatePolicy(req.params.id, req.body, req.user);
    res.status(200).json({
      success: true,
      message: "Regularisation policy updated successfully",
      data: policy,
    });
  } catch (error) {
    next(error);
  }
};

// ─── DELETE ─────────────────────────────────────────────────────
exports.deletePolicy = async (req, res, next) => {
  try {
    const result = await service.deletePolicy(req.params.id, req.user);
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

// ─── TOGGLE ENABLE/DISABLE ──────────────────────────────────────
exports.togglePolicy = async (req, res, next) => {
  try {
    const policy = await service.togglePolicy(req.params.id, req.user);
    res.status(200).json({
      success: true,
      message: `Policy ${policy.enabled ? "enabled" : "disabled"} successfully`,
      data: policy,
    });
  } catch (error) {
    next(error);
  }
};

// ─── GET EFFECTIVE POLICY ───────────────────────────────────────
exports.getEffectivePolicy = async (req, res, next) => {
  try {
    const Employee = require("../employee/models/employee.model");
    const employee = await Employee.findOne({
      userId: req.user.userId,
      org_id: req.user.orgId,
    }).lean();

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    const policy = await service.getEffectivePolicy(employee, req.user);
    res.status(200).json({
      success: true,
      data: policy,
    });
  } catch (error) {
    next(error);
  }
};
