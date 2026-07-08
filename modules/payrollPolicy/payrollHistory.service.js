// modules/payrollPolicy/payrollHistory.service.js
// Aggregates payslips by month for payroll history view

"use strict";

const mongoose  = require("mongoose");
const Payslip   = require("./models/payslip.model");
const AppError  = require("../../utils/appError");

const toObjId = (id) => new mongoose.Types.ObjectId(String(id));

// ─── GET PAYROLL HISTORY (AGGREGATED BY MONTH) ──────────────────────────────
// GET /api/v1/payroll-policies/history?year=&page=&limit=
// Returns: array of { month, year, totalEmployees, totalAmount, status }
// ─────────────────────────────────────────────────────────────────────────────
exports.getPayrollHistory = async (query, user) => {
  const { year, page = 1, limit = 20 } = query;

  // Build scope filter based on user role
  const matchFilter = { isDeleted: false };

  // Role-based filtering
  if (user.role === "SUPER_ADMIN") {
    // Can see all
  } else if (["org_admin", "org_auditor"].includes(user.role)) {
    matchFilter.org_id = toObjId(user.orgId);
  } else {
    // Company-scoped roles
    if (user.companyId) matchFilter.company_id = toObjId(user.companyId);
    if (user.unitId) matchFilter.unit_id = toObjId(user.unitId);
  }

  // Year filter (optional)
  if (year) matchFilter.year = Number(year);

  // ── Aggregation Pipeline ───────────────────────────────────────────────────
  const pipeline = [
    { $match: matchFilter },

    // Group by year + month
    {
      $group: {
        _id: { year: "$year", month: "$month" },
        totalEmployees: { $sum: 1 },
        totalGross: { $sum: "$grossSalary" },
        totalNet: { $sum: "$netSalary" },
        totalDeductions: { $sum: { $subtract: ["$grossSalary", "$netSalary"] } },
        statuses: { $push: "$status" },
        createdAt: { $first: "$createdAt" },
      }
    },

    // Determine overall status
    {
      $addFields: {
        status: {
          $cond: {
            if: { $allElementsTrue: [{ $map: { input: "$statuses", as: "s", in: { $eq: ["$$s", "PAID"] } } }] },
            then: "PAID",
            else: {
              $cond: {
                if: { $anyElementTrue: [{ $map: { input: "$statuses", as: "s", in: { $eq: ["$$s", "PUBLISHED"] } } }] },
                then: "PUBLISHED",
                else: "DRAFT"
              }
            }
          }
        }
      }
    },

    // Project final shape
    {
      $project: {
        _id: 0,
        year: "$_id.year",
        month: "$_id.month",
        monthLabel: {
          $let: {
            vars: {
              months: ["January", "February", "March", "April", "May", "June",
                       "July", "August", "September", "October", "November", "December"]
            },
            in: { $arrayElemAt: ["$$months", { $subtract: ["$_id.month", 1] }] }
          }
        },
        totalEmployees: 1,
        totalGross: 1,
        totalNet: 1,
        totalDeductions: 1,
        status: 1,
        createdAt: 1
      }
    },

    // Sort by most recent first
    { $sort: { year: -1, month: -1 } },

    // Pagination
    { $skip: (Number(page) - 1) * Number(limit) },
    { $limit: Number(limit) }
  ];

  // Execute aggregation
  const history = await Payslip.aggregate(pipeline);

  // Get total count
  const countPipeline = [
    { $match: matchFilter },
    {
      $group: {
        _id: { year: "$year", month: "$month" }
      }
    },
    { $count: "total" }
  ];

  const countResult = await Payslip.aggregate(countPipeline);
  const total = countResult[0]?.total || 0;

  // Format response
  const formatted = history.map(h => ({
    id: `${h.year}-${String(h.month).padStart(2, '0')}`,
    month: `${h.monthLabel} ${h.year}`,
    year: h.year,
    monthNum: h.month,
    totalEmployees: h.totalEmployees,
    totalAmount: h.totalNet,
    totalGross: h.totalGross,
    totalDeductions: h.totalDeductions,
    status: h.status,
    createdAt: h.createdAt
  }));

  return {
    history: formatted,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit))
    }
  };
};
