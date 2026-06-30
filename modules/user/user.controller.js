// modules/user/user.controller.js
// Task 3.5 — User Invite + CRUD + Role Assignment

const userService = require("./user.service");

// ── POST /users/invite ────────────────────────────────────────
exports.inviteUser = async (req, res, next) => {
  try {
    const result = await userService.inviteUser(req.body, req.user);

    res.status(201).json({
      success: true,
      message: "Invite sent successfully",
      data:    result,
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /users ────────────────────────────────────────────────
exports.getUsers = async (req, res, next) => {
  try {
    const result = await userService.getUsers(req.query, req.user);

    res.json({
      success: true,
      message: "Users fetched successfully",
      data:    result,
    });
  } catch (err) {
    next(err);
  }
};

// ── PUT /users/:id ────────────────────────────────────────────
exports.updateUser = async (req, res, next) => {
  try {
    const user = await userService.updateUser(req.params.id, req.body, req.user);

    res.json({
      success: true,
      message: "User updated successfully",
      data:    user,
    });
  } catch (err) {
    next(err);
  }
};

// ── DELETE /users/:id ─────────────────────────────────────────
exports.deleteUser = async (req, res, next) => {
  try {
    const result = await userService.deleteUser(req.params.id, req.user);

    res.json({
      success: true,
      message: result.message,
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /users/:id/progression ────────────────────────────────
exports.getProgressionHistory = async (req, res, next) => {
  try {
    const result = await userService.getProgressionHistory(req.params.id, req.user);

    res.json({
      success: true,
      message: "Progression history fetched",
      data:    result,
    });
  } catch (err) {
    next(err);
  }
};