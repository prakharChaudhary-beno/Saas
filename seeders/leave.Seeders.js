// seeders/leave.Seeders.js
// UPDATED — tenantId → company_id + org_id

const LeaveType = require("../modules/leave/models/leaveType.models");

const defaultLeaveTypes = [
  {
    name: "Annual Leave", code: "AL",
    description: "Yearly paid vacation leave",
    defaultDaysPerYear: 18, isCarryForwardAllowed: true,
    maxCarryForwardDays: 10, isEncashmentAllowed: true,
    isHalfDayAllowed: true, isSandwichApplicable: true,
    minNoticeDays: 3, maxConsecutiveDays: 15,
    applicableGender: "ALL", colorCode: "#4F46E5",
    isPaid: true, isSystem: true,
  },
  {
    name: "Sick Leave", code: "SL",
    description: "Paid leave for medical illness",
    defaultDaysPerYear: 12, isCarryForwardAllowed: false,
    isHalfDayAllowed: true, minNoticeDays: 0,
    requiresDocumentAfterDays: 3,
    applicableGender: "ALL", colorCode: "#EF4444",
    isPaid: true, isSystem: true,
  },
  {
    name: "Casual Leave", code: "CL",
    description: "Short-term leave for personal matters",
    defaultDaysPerYear: 6, isCarryForwardAllowed: false,
    isHalfDayAllowed: true, maxConsecutiveDays: 3,
    applicableGender: "ALL", colorCode: "#F59E0B",
    isPaid: true, isSystem: true,
  },
  {
    name: "Maternity Leave", code: "ML",
    description: "Paid leave for female employees after childbirth",
    defaultDaysPerYear: 182, maxConsecutiveDays: 182,
    applicableGender: "FEMALE", colorCode: "#EC4899",
    isPaid: true, isSystem: true,
  },
  {
    name: "Paternity Leave", code: "PL",
    description: "Paid leave for male employees on birth of child",
    defaultDaysPerYear: 15, maxConsecutiveDays: 15,
    applicableGender: "MALE", colorCode: "#3B82F6",
    isPaid: true, isSystem: true,
  },
  {
    name: "Loss of Pay", code: "LOP",
    description: "Unpaid leave when all paid leaves exhausted",
    defaultDaysPerYear: 0, isHalfDayAllowed: true,
    applicableGender: "ALL", colorCode: "#6B7280",
    isPaid: false, isSystem: true,
  },
  {
    name: "Compensatory Off", code: "COMP",
    description: "Leave granted for working on holidays",
    defaultDaysPerYear: 0, isCarryForwardAllowed: true,
    maxCarryForwardDays: 5, isHalfDayAllowed: true,
    minNoticeDays: 1, maxConsecutiveDays: 5,
    applicableGender: "ALL", colorCode: "#10B981",
    isPaid: true, isSystem: true,
  },
];

// Called when a new company is created — seed default leave types
exports.seedLeaveTypes = async (org_id, company_id, createdBy) => {
  for (const leaveType of defaultLeaveTypes) {
    const exists = await LeaveType.findOne({
      company_id,
      code: leaveType.code,
    });

    if (!exists) {
      await LeaveType.create({
        ...leaveType,
        org_id,
        company_id,
        createdBy,
      });
    }
  }
  console.log(`✅ Leave types seeded for company: ${company_id}`);
};