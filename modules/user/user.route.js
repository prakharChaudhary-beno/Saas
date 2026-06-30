// modules/user/user.route.js
//
// Task 3.1 — checkRole middleware
// Task 3.5 — invite, getUsers, updateUser, deleteUser, progression

const express    = require("express");
const router     = express.Router();

const controller                       = require("./user.controller");
const { authenticate }                 = require("../../middlewares/auth.middleware");
const { checkRole, requireTenantUser } = require("../../middlewares/checkRole.middleware");
const validate                         = require("../../middlewares/validate.middleware");
const { inviteUserSchema, updateUserSchema } = require("./user.validation");

// ── Global guards — sab routes ke liye ───────────────────────
router.use(authenticate);
router.use(requireTenantUser);

// ── POST /users/invite ────────────────────────────────────────
// hr_manager + upar wale invite kar sakte hain
router.post(
  "/invite",
  checkRole("hr_manager"),
  validate(inviteUserSchema),
  controller.inviteUser
);

// ── GET /users ────────────────────────────────────────────────
// Filters: ?page=1&limit=10&search=&status=&roleId=&departmentId=
router.get(
  "/",
  checkRole("hr_manager"),
  controller.getUsers
);

// ── GET /users/:id/progression ────────────────────────────────
// IMPORTANT: /progression pehle register karo — /:id se match ho jaata hai
router.get(
  "/:id/progression",
  checkRole("hr_manager"),
  controller.getProgressionHistory
);

// ── PUT /users/:id ────────────────────────────────────────────
// Updatable: roleId, status, name, lastName, phone, departmentId, note
router.put(
  "/:id",
  checkRole("hr_manager"),
  validate(updateUserSchema),
  controller.updateUser
);

// ── DELETE /users/:id ─────────────────────────────────────────
// Sirf tenant_admin delete kar sakta hai
router.delete(
  "/:id",
  checkRole("unit_admin"),  // ← tenant_admin → unit_admin
  controller.deleteUser
);

module.exports = router;