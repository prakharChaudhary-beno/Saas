const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const User = require("../auth/models/user.model");
const Employee = require("../employee/models/employee.model");
const UserProgression = require("./models/userProgression.model");
const Role = require("../role/role.model");
const Department = require("../department/department.model");
const Designation = require("../designation/designation.model");
const Company = require("../company/models/company.model");
const Unit = require("../unit/models/unit.model");
const Joi = require("joi");
const mongoose = require("mongoose");

const AppError = require("../../utils/appError");
const Subscription = require("../subscription/models/subscription.Models"); // T-27
const { sendEmail } = require("../../utils/email/email");
const inviteTemplate = require("../../utils/email/templates/inviteEmail");

const { invalidateEmployeeCache } = require("../../utils/policyResolver");

// ── Scope filter ──────────────────────────────────────────
const buildScopeFilter = (user) => {
  if (user.role === "SUPER_ADMIN") return {};

  const filter = { org_id: user.orgId };

  if (user.level === "company") {
    filter.company_id = user.companyId;
    filter.unit_id    = null;
  } else if (user.level === "unit") {
    filter.company_id = user.companyId;
    filter.unit_id    = user.unitId;
  }
  // org level → sirf org_id, sab users dikhenge

  return filter;
};

// ─────────────────────────────────────────────────────────────
// INVITE USER
// POST /users/invite
// ─────────────────────────────────────────────────────────────
exports.inviteUser = async (data, currentUser) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  let user, role, department, company, tempPassword;

  try {
    const { email, roleId, departmentId, company_id, unit_id, name } = data;

    const existingUser = await User.findOne({
      email,
      org_id: currentUser.orgId,
      isDeleted: false,
    }).session(session);

    if (existingUser) {
      throw new AppError("This email is already registered", 409);
    }

    role = await Role.findOne({
      _id: roleId,
      $or: [
        { org_id: currentUser.orgId },
        { org_id: null, isSystem: true },
      ],
    }).select("name slug level").session(session);

    if (!role) {
      throw new AppError("Role not found or not accessible", 404);
    }

    const hierarchy = { org: 3, company: 2, unit: 1 };
    const currentLevel = hierarchy[currentUser.level] || 0;
    const targetLevel = hierarchy[role.level] || 0;

    if (targetLevel > currentLevel) {
      throw new AppError(`You cannot assign ${role.level} level role`, 403);
    }

    let resolvedDepartmentId = null;

    if (role.slug === "employee") {
      if (!departmentId) {
        throw new AppError("Department is required for employee role", 400);
      }
      const dept = await Department.findOne({
        _id: departmentId,
        company_id: currentUser.companyId,
        isDeleted: false,
      }).session(session);

      if (!dept) throw new AppError("Invalid department", 404);
      resolvedDepartmentId = dept._id;
    }

    const subscription = await Subscription.findOne({
      org_id: currentUser.orgId,
      is_active: true,
    }).select("plan_snapshot.seat_limit").session(session).lean();

    const seatLimit = subscription?.plan_snapshot?.seat_limit;
    if (seatLimit !== null && seatLimit !== undefined) {
      const currentUserCount = await User.countDocuments({
        org_id: currentUser.orgId,
        is_deleted: false,
      }).session(session);

      if (currentUserCount >= seatLimit) {
        throw new AppError(
          `Seat limit reached (${seatLimit}). Please upgrade your plan to invite more users.`,
          403
        );
      }
    }

    tempPassword = crypto.randomBytes(4).toString("hex");
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const createdUsers = await User.create([{
      name: name || email.split("@")[0],
      email,
      password: hashedPassword,
      roleId,
      org_id: currentUser.orgId,
      company_id: company_id || currentUser.companyId || null,
      unit_id: unit_id || currentUser.unitId || null,
      status: "ACTIVE",
      is_first_login: true,
      isEmailVerified: true,
      createdBy: currentUser.userId,
    }], { session });

    user = createdUsers[0];

    // ─────────────────────────────────────────────────────────────
    // CREATE EMPLOYEE RECORD FOR USER (HRMS STANDARD)
    // Every user (including admins) needs an Employee record for:
    // - Attendance (punch in/out)
    // - Leave management
    // - Payroll
    // - Analytics/headcount
    // ─────────────────────────────────────────────────────────────
    
    // Determine unit_id for employee
    // Priority: 1) Passed in request body, 2) Role level is 'unit' → use currentUser's unit
    let employeeUnitId = unit_id;
    if (!employeeUnitId && role.level === 'unit') {
      employeeUnitId = currentUser.unitId;
    }
    // If still no unit_id but role needs unit (like unit_admin), use the unit_id from user we just created
    if (!employeeUnitId && user.unit_id) {
      employeeUnitId = user.unit_id;
    }
    
    // For unit-level roles, we MUST have a unit_id
    if (role.level === 'unit' && !employeeUnitId) {
      employeeUnitId = currentUser.unitId || user.unit_id;
    }
    
    // Determine company_id
    const employeeCompanyId = user.company_id || currentUser.companyId;
    
    // Only create Employee if we have all required fields
    if (employeeUnitId && employeeCompanyId && user.org_id) {
      // Find or create department for the user
      let empDepartmentId = resolvedDepartmentId;
      
      if (!empDepartmentId) {
        // For admin roles, create/find "Administration" department
        let adminDept = await Department.findOne({
          company_id: employeeCompanyId,
          org_id: user.org_id,
          unit_id: employeeUnitId,
          name: { $regex: /^(Administration|Admin|HR)$/i },
          isDeleted: false,
        }).session(session);
        
        if (!adminDept) {
          const [createdDept] = await Department.create([{
            name: 'Administration',
            company_id: employeeCompanyId,
            org_id: user.org_id,
            unit_id: employeeUnitId,
            status: 'active',
            created_by: currentUser.userId,
          }], { session });
          adminDept = createdDept;
        }
        empDepartmentId = adminDept._id;
      }
      
      // Find or create designation based on role name
      let designation = await Designation.findOne({
        company_id: employeeCompanyId,
        org_id: user.org_id,
        unit_id: employeeUnitId,
        name: { $regex: new RegExp(`^(${role.name}|Admin|Manager)$`, 'i') },
        isDeleted: false,
      }).session(session);
      
      if (!designation) {
        const [createdDesig] = await Designation.create([{
          name: role.name,
          company_id: employeeCompanyId,
          org_id: user.org_id,
          unit_id: employeeUnitId,
          status: 'active',
          created_by: currentUser.userId,
        }], { session });
        designation = createdDesig;
      }
      
      // Generate employee ID
      const employeeCount = await Employee.countDocuments({
        org_id: user.org_id,
        company_id: employeeCompanyId,
      }).session(session);
      const employeeId = `EMP${String(employeeCount + 1).padStart(5, '0')}`;
      
      // Create Employee record
      await Employee.create([{
        org_id: user.org_id,
        company_id: employeeCompanyId,
        unit_id: employeeUnitId,
        userId: user._id,
        employeeId,
        name: user.name,
        email: user.email,
        phone: user.phone || '0000000000',
        departmentId: empDepartmentId,
        designationId: designation._id,
        employmentType: 'FULL_TIME',
        joiningDate: new Date(),
        status: 'ACTIVE',
        salary: {
          basic: 0,
          hra: 0,
          grossSalary: 0,
          netSalary: 0,
        },
      }], { session });
    }

    await session.commitTransaction();
    session.endSession();

    [department, company] = await Promise.all([
      resolvedDepartmentId ? Department.findById(resolvedDepartmentId).select("name") : null,
      currentUser.companyId ? Company.findById(currentUser.companyId).select("company_name") : null,
    ]);

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }

  await sendEmail({
    to: data.email,
    subject: "Your HRMS Account Has Been Created 🚀",
    html: inviteTemplate({
      name: data.name || data.email.split("@")[0],
      companyName: company?.company_name || "HRMS",
      roleName: role.name,
      departmentName: department?.name || null,
      email: data.email,
      tempPassword,
    }),
  });

  return {
    id: user._id,
    email: user.email,
    role: role.name,
    temp_password_sent: true,
    is_first_login: true,
  };
};

// ─────────────────────────────────────────────────────────────
// GET INVITE BY TOKEN
// ─────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────
// GET USERS
// GET /users?page=1&limit=10&search=&status=&roleId=&departmentId=
// ─────────────────────────────────────────────────────────────
exports.getUsers = async (query, currentUser) => {
  const { page = 1, limit = 10, search, status, roleId, departmentId } = query;

  const filter = {
    ...buildScopeFilter(currentUser),
    is_deleted: false,
  };

  // T-25 — Filter by role type (Administrative/Privilege/General)
  if (query.roleType) {
    const Role = require("../role/role.model");
    const matchingRoles = await Role.find({
      userClass: query.roleType,
      isDeleted: false,
    }).select("_id");
    filter.roleId = { $in: matchingRoles.map(r => r._id) };
  }

  if (search) filter.email  = { $regex: search, $options: "i" };
  if (status) filter.status = status;
  if (roleId) filter.roleId = roleId;

  // departmentId — Employee model se matching userIds
  if (departmentId) {
    const empUserIds = await Employee.distinct("userId", {
      ...buildScopeFilter(currentUser),
      departmentId,
      is_deleted: false,
    });
    filter._id = { $in: empUserIds };
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [users, total] = await Promise.all([
    User.find(filter)
      .select("-password -refreshTokens -mfaSecret -mfaTempSecret -mfaBackupCodes -loginAttempts -blockedAt -__v")
      .populate("roleId", "name slug level")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    User.countDocuments(filter),
  ]);

  // Department attach from Employee model
  const userIds   = users.map((u) => u._id);
  const employees = await Employee.find({
    userId:    { $in: userIds },
    ...buildScopeFilter(currentUser),
    isDeleted: false,
  }).select("userId departmentId").populate("departmentId", "name");

  const deptMap = {};
  employees.forEach((e) => {
    if (e.userId) deptMap[e.userId.toString()] = e.departmentId;
  });

  const usersWithDept = users.map((u) => ({
    ...u.toObject(),
    department: deptMap[u._id.toString()] || null,
  }));

  return {
    users: usersWithDept,
    pagination: {
      total,
      page:  Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit)),
    },
  };
};

// ─────────────────────────────────────────────────────────────
// UPDATE USER
// PUT /users/:id
// ─────────────────────────────────────────────────────────────
exports.updateUser = async (id, data, currentUser) => {

  const user = await User.findOne({
    _id:       id,
    ...buildScopeFilter(currentUser),
    is_deleted: false,
  });
  if (!user) throw new AppError("User not found", 404);

  // Self-update block
  if (user._id.toString() === currentUser.userId) {
    throw new AppError("You cannot update your own account from here", 400);
  }

  // Role change track
  const roleChanged = data.roleId &&
    data.roleId.toString() !== user.roleId?.toString();
  const fromRoleId  = user.roleId || null;

  // Update user fields
  if (data.name)     user.name     = data.name;
  if (data.lastName) user.lastName = data.lastName;
  if (data.phone)    user.phone    = data.phone;
  if (data.status)   user.status   = data.status;
  if (roleChanged)   user.roleId   = data.roleId;

  // T-26 — Track blockedAt for JWT invalidation
  if (data.status === "BLOCKED" && !user.blockedAt) {
    user.blockedAt = new Date();
  } else if (data.status && data.status !== "BLOCKED") {
    user.blockedAt = null;
  }

  user.updatedBy = currentUser.userId;
  await user.save();

  // Department change — Employee model
  let deptChanged = false;
  let fromDeptId  = null;

  if (data.departmentId) {
    const employee = await Employee.findOne({
      userId:    user._id,
      ...buildScopeFilter(currentUser),
      isDeleted: false,
    });

    if (employee) {
      deptChanged = data.departmentId.toString() !== employee.departmentId?.toString();
      fromDeptId  = employee.departmentId || null;

      if (deptChanged) {
        employee.departmentId = data.departmentId;
        employee.updatedBy    = currentUser.userId;
        await employee.save();
      }
    }
  }

  // Progression log
  if (roleChanged || deptChanged) {
    const changeType =
      roleChanged && deptChanged ? "both"
      : roleChanged              ? "role"
      :                            "department";

    await UserProgression.create({
      org_id:     currentUser.orgId,
      company_id: currentUser.companyId || null,
      unit_id:    currentUser.unitId    || null,
      userId:     user._id,
      fromRoleId: roleChanged ? fromRoleId        : undefined,
      toRoleId:   roleChanged ? data.roleId       : undefined,
      fromDeptId: deptChanged ? fromDeptId        : undefined,
      toDeptId:   deptChanged ? data.departmentId : undefined,
      changeType,
      changedBy:  currentUser.userId,
      note:       data.note || null,
    });

    const empForCache = await Employee.findOne({
      userId:    user._id,
      ...buildScopeFilter(currentUser),
      isDeleted: false,
    }).select("_id").lean();

    if (empForCache) {
      invalidateEmployeeCache(
        currentUser.orgId.toString(),
        empForCache._id.toString()
      );
    }
  }

  return user;
};

// ─────────────────────────────────────────────────────────────
// GET PROGRESSION HISTORY
// GET /users/:id/progression
// ─────────────────────────────────────────────────────────────
exports.getProgressionHistory = async (id, currentUser) => {
  const user = await User.findOne({
    _id:       id,
    ...buildScopeFilter(currentUser),
    isDeleted: false,
  });
  if (!user) throw new AppError("User not found", 404);

  return await UserProgression.find({
    userId:  id,
    org_id:  currentUser.orgId,
  })
    .populate("fromRoleId", "name")
    .populate("toRoleId",   "name")
    .populate("fromDeptId", "name")
    .populate("toDeptId",   "name")
    .populate("changedBy",  "name email")
    .sort({ createdAt: -1 });
};

// ─────────────────────────────────────────────────────────────
// DELETE USER (Soft)
// DELETE /users/:id
// ─────────────────────────────────────────────────────────────
exports.deleteUser = async (id, currentUser) => {
  const user = await User.findOne({
    _id:       id,
    ...buildScopeFilter(currentUser),
    isDeleted: false,
  });
  if (!user) throw new AppError("User not found", 404);

  if (user._id.toString() === currentUser.userId) {
    throw new AppError("You cannot delete your own account", 400);
  }

  user.isDeleted = true;
  user.status    = "INACTIVE";
  user.updatedBy = currentUser.userId;
  await user.save();

  return { message: "User deleted successfully" };
};