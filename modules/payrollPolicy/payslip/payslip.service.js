// modules/payrollPolicy/payslip.service.js
// Complete payslip service — GET, publish, pay, email

"use strict";

const mongoose  = require("mongoose");
const Payslip   = require("../models/payslip.model");
const Employee  = require("../../employee/models/employee.model");
const Company   = require("../../company/models/company.model");
const User      = require("../../auth/models/user.model");
const AppError  = require("../../../utils/appError");
const { sendEmail }                = require("../../../utils/email/email");
const { payslipPublishedTemplate } = require("../../../utils/email/templates/payslipEmail");

const toObjId = (id) => new mongoose.Types.ObjectId(String(id));

// ─── Scope filter ─────────────────────────────────────────────
const buildScope = (user) => {
  const scope = { isDeleted: false };
  const role  = user.role;

  if (role === "SUPER_ADMIN") return scope;

  scope.org_id = toObjId(user.orgId);

  if (["org_admin", "org_auditor"].includes(role)) return scope;

  scope.company_id = toObjId(user.companyId);

  if (["company_admin", "company_hr_manager"].includes(role)) return scope;

  // unit level — employee sees only own payslips
  if (role === "employee") {
    scope.company_id = toObjId(user.companyId);
    // employee_id will be added per function
    return scope;
  }

  if (user.unitId) scope.unit_id = toObjId(user.unitId);
  return scope;
};

// ─────────────────────────────────────────────────────────────
// GET MY PAYSLIPS (Employee self-service) — P-18
// GET /api/v1/payslips/my
// ─────────────────────────────────────────────────────────────
exports.getMyPayslips = async (query, user) => {
  // Find employee record linked to this user
  const employee = await Employee.findOne({
    userId:     toObjId(user.userId),
    org_id:     toObjId(user.orgId),
    company_id: toObjId(user.companyId),
    isDeleted:  false,
  }).select("_id name employeeId email").lean();

  if (!employee) throw new AppError("Employee record not found for your account", 404);

  const { year, status, page = 1, limit = 12 } = query;

  const filter = {
    employee_id: employee._id,
    company_id:  toObjId(user.companyId),
    isDeleted:   false,
  };

  // Employees can only see PUBLISHED or PAID payslips — not DRAFT
  filter.status = { $in: ["PUBLISHED", "PAID"] };

  if (year)   filter.year   = Number(year);
  if (status && ["PUBLISHED", "PAID"].includes(status)) filter.status = status;

  const skip  = (Number(page) - 1) * Number(limit);
  const total = await Payslip.countDocuments(filter);

  const payslips = await Payslip.find(filter)
    .sort({ year: -1, month: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean();

  return {
    employee: {
      _id:        employee._id,
      name:       employee.name,
      employeeId: employee.employeeId,
    },
    payslips,
    pagination: {
      total,
      page:  Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit)),
    },
  };
};

// ─────────────────────────────────────────────────────────────
// GET ALL PAYSLIPS — HR/Admin view — P-13
// GET /api/v1/payslips
// ─────────────────────────────────────────────────────────────
exports.getAllPayslips = async (query, user) => {
  const {
    employeeId, year, month, status,
    page = 1, limit = 20,
  } = query;

  const filter = buildScope(user);

  if (year)       filter.year   = Number(year);
  if (month)      filter.month  = Number(month);
  if (status)     filter.status = status;
  if (employeeId) filter.employee_id = toObjId(employeeId);

  const skip  = (Number(page) - 1) * Number(limit);
  const total = await Payslip.countDocuments(filter);

  const payslips = await Payslip.find(filter)
    .populate("employee_id", "name employeeId email unit_id")
    .populate("generatedBy", "name email")
    .populate("approvedBy",  "name email")
    .sort({ year: -1, month: -1, createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean();

  return {
    payslips,
    pagination: {
      total,
      page:  Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit)),
    },
  };
};

// ─────────────────────────────────────────────────────────────
// GET SINGLE PAYSLIP — P-16
// GET /api/v1/payslips/:id
// ─────────────────────────────────────────────────────────────
exports.getPayslipById = async (id, user) => {
  const payslip = await Payslip.findOne({
    _id:       toObjId(id),
    isDeleted: false,
  })
    .populate("employee_id", "name employeeId email unit_id departmentId designationId")
    .populate("generatedBy", "name email")
    .populate("approvedBy",  "name email")
    .lean();

  if (!payslip) throw new AppError("Payslip not found", 404);

  // Scope check — employee can only see own payslip
  if (user.role === "employee") {
    const emp = await Employee.findOne({
      userId:    toObjId(user.userId),
      isDeleted: false,
    }).select("_id").lean();

    if (!emp || String(payslip.employee_id._id) !== String(emp._id)) {
      throw new AppError("You can only view your own payslip", 403);
    }

    // Employee cannot see DRAFT
    if (payslip.status === "DRAFT") {
      throw new AppError("Payslip not yet published", 404);
    }
  }

  return payslip;
};

// ─────────────────────────────────────────────────────────────
// PUBLISH PAYSLIP — P-10, P-17, N-04
// PATCH /api/v1/payslips/:id/publish
// Sends email to employee
// ─────────────────────────────────────────────────────────────
exports.publishPayslip = async (id, user) => {
  const payslip = await Payslip.findOne({
    _id:       toObjId(id),
    isDeleted: false,
  }).populate("employee_id", "name employeeId email userId");

  if (!payslip) throw new AppError("Payslip not found", 404);

  // Scope check
  if (user.companyId && String(payslip.company_id) !== String(user.companyId)) {
    throw new AppError("Access denied", 403);
  }

  if (payslip.status !== "DRAFT") {
    throw new AppError(`Payslip is already ${payslip.status}. Only DRAFT can be published.`, 400);
  }

  payslip.status     = "PUBLISHED";
  payslip.approvedBy = toObjId(user.userId);
  payslip.approvedAt = new Date();
  await payslip.save();

  // Send email to employee — N-04, P-17
  const employee = payslip.employee_id;
  if (employee?.email) {
    try {
      // Get company name
      const company = await Company.findById(payslip.company_id)
        .select("company_name brand_name").lean();
      const companyName = company?.brand_name || company?.company_name || "Your Company";

      await sendEmail({
        to:      employee.email,
        subject: `Your Payslip for ${_monthName(payslip.month)} ${payslip.year} is Ready`,
        html:    payslipPublishedTemplate({
          employeeName:    employee.name,
          employeeId:      employee.employeeId,
          month:           payslip.month,
          year:            payslip.year,
          companyName,
          earnings:        payslip.earnings,
          deductions:      payslip.deductions,
          grossSalary:     payslip.grossSalary,
          netSalary:       payslip.netSalary,
          totalWorkingDays: payslip.totalWorkingDays,
          daysPresent:     payslip.daysPresent,
          lopDays:         payslip.lopDays,
          overtimeHours:   payslip.overtimeHours,
        }),
      });
      console.log(`✅ Payslip email sent to ${employee.email}`);
    } catch (emailErr) {
      // Non-fatal — payslip published even if email fails
      console.error("⚠️  Payslip email failed:", emailErr.message);
    }
  }

  return payslip;
};

// ─────────────────────────────────────────────────────────────
// PUBLISH ALL PAYSLIPS FOR A MONTH — Bulk publish
// PATCH /api/v1/payslips/publish-all
// ─────────────────────────────────────────────────────────────
exports.publishAllPayslips = async (body, user) => {
  const { month, year } = body;
  if (!month || !year) throw new AppError("month and year required", 400);

  const filter = {
    company_id: toObjId(user.companyId),
    month:      Number(month),
    year:       Number(year),
    status:     "DRAFT",
    isDeleted:  false,
  };

  if (user.unitId) filter.unit_id = toObjId(user.unitId);

  const drafts = await Payslip.find(filter)
    .populate("employee_id", "name employeeId email");

  if (!drafts.length) {
    throw new AppError(`No DRAFT payslips found for ${_monthName(month)} ${year}`, 404);
  }

  const company = await Company.findById(user.companyId)
    .select("company_name brand_name").lean();
  const companyName = company?.brand_name || company?.company_name || "Your Company";

  let published = 0;
  let failed    = 0;
  const errors  = [];

  for (const payslip of drafts) {
    try {
      payslip.status     = "PUBLISHED";
      payslip.approvedBy = toObjId(user.userId);
      payslip.approvedAt = new Date();
      await payslip.save();
      published++;

      // Send email
      const emp = payslip.employee_id;
      if (emp?.email) {
        sendEmail({
          to:      emp.email,
          subject: `Your Payslip for ${_monthName(payslip.month)} ${payslip.year} is Ready`,
          html:    payslipPublishedTemplate({
            employeeName:     emp.name,
            employeeId:       emp.employeeId,
            month:            payslip.month,
            year:             payslip.year,
            companyName,
            earnings:         payslip.earnings,
            deductions:       payslip.deductions,
            grossSalary:      payslip.grossSalary,
            netSalary:        payslip.netSalary,
            totalWorkingDays: payslip.totalWorkingDays,
            daysPresent:      payslip.daysPresent,
            lopDays:          payslip.lopDays,
            overtimeHours:    payslip.overtimeHours,
          }),
        }).catch(e => console.error(`Email failed for ${emp.email}:`, e.message));
      }
    } catch (err) {
      failed++;
      errors.push({ employeeId: payslip.employee_id?._id, error: err.message });
    }
  }

  return {
    month, year,
    summary: { published, failed, errors },
    message: `Published ${published} payslips. Failed: ${failed}.`,
  };
};

// ─────────────────────────────────────────────────────────────
// MARK AS PAID
// PATCH /api/v1/payslips/:id/mark-paid
// ─────────────────────────────────────────────────────────────
exports.markAsPaid = async (id, body, user) => {
  const { paymentDate, paymentMode, transactionRef } = body;

  const payslip = await Payslip.findOne({
    _id:       toObjId(id),
    isDeleted: false,
  });

  if (!payslip) throw new AppError("Payslip not found", 404);

  if (String(payslip.company_id) !== String(user.companyId)) {
    throw new AppError("Access denied", 403);
  }

  if (payslip.status !== "PUBLISHED") {
    throw new AppError("Only PUBLISHED payslips can be marked as PAID", 400);
  }

  payslip.status         = "PAID";
  payslip.paymentDate    = paymentDate || new Date();
  payslip.paymentMode    = paymentMode || "BANK_TRANSFER";
  payslip.transactionRef = transactionRef || null;
  await payslip.save();

  return payslip;
};

// ─────────────────────────────────────────────────────────────
// DELETE (soft) — only DRAFT can be deleted
// DELETE /api/v1/payslips/:id
// ─────────────────────────────────────────────────────────────
exports.deletePayslip = async (id, user) => {
  const payslip = await Payslip.findOne({
    _id:        toObjId(id),
    company_id: toObjId(user.companyId),
    isDeleted:  false,
  });

  if (!payslip) throw new AppError("Payslip not found", 404);

  if (payslip.status !== "DRAFT") {
    throw new AppError(`Cannot delete ${payslip.status} payslip. Only DRAFT can be deleted.`, 400);
  }

  payslip.isDeleted = true;
  await payslip.save();

  return { message: "Payslip deleted successfully" };
};

// ─── Helper ───────────────────────────────────────────────────
const _monthName = (m) =>
  ["January","February","March","April","May","June",
   "July","August","September","October","November","December"][m - 1] || "";
