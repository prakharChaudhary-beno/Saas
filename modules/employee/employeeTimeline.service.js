// modules/employee/employeeTimeline.service.js
// Employee Career Timeline Service

const mongoose = require("mongoose");
const EmployeeTimeline = require("./models/employeeTimeline.model");
const Employee = require("./models/employee.model");
const Designation = require("../designation/designation.model");
const Department = require("../department/department.model");
const User = require("../auth/models/user.model");
const AppError = require("../../utils/appError");

// ─────────────────────────────────────────────────────────────
// CREATE TIMELINE EVENT
// Called whenever employee data changes
// ─────────────────────────────────────────────────────────────
exports.createTimelineEvent = async (data) => {
  const timelineEvent = await EmployeeTimeline.create(data);
  return timelineEvent;
};

// ─────────────────────────────────────────────────────────────
// GET EMPLOYEE TIMELINE
// GET /api/v1/employees/:id/timeline
// ─────────────────────────────────────────────────────────────
exports.getEmployeeTimeline = async (employeeId, currentUser) => {
  // Validate employee exists
  const employee = await Employee.findOne({
    _id: employeeId,
    org_id: currentUser.orgId,
    isDeleted: false,
  })
    .populate("userId", "name email profilePhoto")
    .populate("departmentId", "name")
    .populate("designationId", "name")
    .populate("reportingManagerId", "name email profilePhoto")
    .lean();

  if (!employee) {
    throw new AppError("Employee not found", 404);
  }

  // Fetch timeline events
  const timeline = await EmployeeTimeline.find({
    employeeId: employeeId,
    org_id: currentUser.orgId,
  })
    .populate("fromDesignationId", "name")
    .populate("toDesignationId", "name")
    .populate("fromDepartmentId", "name")
    .populate("toDepartmentId", "name")
    .populate("fromReportingManagerId", "name email profilePhoto")
    .populate("toReportingManagerId", "name email profilePhoto")
    .populate("changedBy", "name email profilePhoto")
    .sort({ effectiveDate: -1, createdAt: -1 })
    .lean();

  // Enhance timeline with computed fields
  const enhancedTimeline = timeline.map((event) => {
    const enriched = { ...event };

    // Add display labels based on event type
    switch (event.eventType) {
      case "joining":
        enriched.title = "Employee Joined";
        enriched.description = `${employee.name} joined the organization`;
        enriched.icon = "tabler:user-plus";
        enriched.color = "success";
        break;

      case "confirmation":
        enriched.title = "Confirmation";
        enriched.description = `Employee confirmed after probation period`;
        enriched.icon = "tabler:badge";
        enriched.color = "info";
        break;

      case "exit":
        enriched.title = "Employee Exit";
        enriched.description = `Employee left the organization`;
        enriched.icon = "tabler:user-minus";
        enriched.color = "error";
        break;

      case "designation_change":
        enriched.title = "Designation Changed";
        enriched.description = `Designation changed from ${event.fromDesignationId?.name || "N/A"} to ${event.toDesignationId?.name || "N/A"}`;
        enriched.icon = "tabler:briefcase";
        enriched.color = "primary";
        break;

      case "department_transfer":
        enriched.title = "Department Transfer";
        enriched.description = `Transferred from ${event.fromDepartmentId?.name || "N/A"} to ${event.toDepartmentId?.name || "N/A"}`;
        enriched.icon = "tabler:building-community";
        enriched.color = "warning";
        break;

      case "reporting_manager_change":
        enriched.title = "Reporting Manager Changed";
        const fromManager = event.fromReportingManagerId?.name || "N/A";
        const toManager = event.toReportingManagerId?.name || "N/A";
        enriched.description = `Reporting manager changed from ${fromManager} to ${toManager}`;
        enriched.icon = "tabler:users";
        enriched.color = "secondary";
        break;

      case "status_change":
        enriched.title = "Status Changed";
        enriched.description = `Status changed from ${event.fromStatus || "N/A"} to ${event.toStatus || "N/A"}`;
        enriched.icon = "tabler:refresh";
        enriched.color = "info";
        break;

      case "salary_revision":
        enriched.title = "Salary Revision";
        const oldSalary = event.fromSalary?.grossSalary || 0;
        const newSalary = event.toSalary?.grossSalary || 0;
        const diff = newSalary - oldSalary;
        const percentage = oldSalary > 0 ? ((diff / oldSalary) * 100).toFixed(1) : 0;
        enriched.description = `Salary ${diff >= 0 ? "increased" : "decreased"} by ${Math.abs(percentage)}%`;
        enriched.icon = diff >= 0 ? "tabler:trending-up" : "tabler:trending-down";
        enriched.color = diff >= 0 ? "success" : "error";
        break;

      case "employment_type_change":
        enriched.title = "Employment Type Changed";
        enriched.description = `Employment type changed from ${event.fromEmploymentType || "N/A"} to ${event.toEmploymentType || "N/A"}`;
        enriched.icon = "tabler:briefcase";
        enriched.color = "primary";
        break;

      default:
        enriched.title = "Update";
        enriched.description = "Employee record updated";
        enriched.icon = "tabler:activity";
        enriched.color = "secondary";
    }

    return enriched;
  });

  return {
    employee,
    timeline: enhancedTimeline,
    totalEvents: enhancedTimeline.length,
  };
};

// ─────────────────────────────────────────────────────────────
// TRACK EMPLOYEE CHANGES
// Helper to detect and create timeline events
// ─────────────────────────────────────────────────────────────
exports.trackEmployeeChanges = async (
  employeeId,
  oldData,
  newData,
  changedBy
) => {
  const events = [];

  // Track designation change
  if (
    oldData.designationId?.toString() !== newData.designationId?.toString() &&
    newData.designationId
  ) {
    events.push({
      org_id: oldData.org_id,
      company_id: oldData.company_id,
      unit_id: oldData.unit_id,
      employeeId,
      userId: oldData.userId,
      eventType: "designation_change",
      fromDesignationId: oldData.designationId,
      toDesignationId: newData.designationId,
      effectiveDate: new Date(),
      changedBy,
      changeReason: newData.changeReason || "Designation updated",
    });
  }

  // Track department transfer
  if (
    oldData.departmentId?.toString() !== newData.departmentId?.toString() &&
    newData.departmentId
  ) {
    events.push({
      org_id: oldData.org_id,
      company_id: oldData.company_id,
      unit_id: oldData.unit_id,
      employeeId,
      userId: oldData.userId,
      eventType: "department_transfer",
      fromDepartmentId: oldData.departmentId,
      toDepartmentId: newData.departmentId,
      effectiveDate: new Date(),
      changedBy,
      changeReason: newData.changeReason || "Department transfer",
    });
  }

  // Track reporting manager change
  if (
    oldData.reportingManagerId?.toString() !==
      newData.reportingManagerId?.toString() &&
    (newData.reportingManagerId || oldData.reportingManagerId)
  ) {
    events.push({
      org_id: oldData.org_id,
      company_id: oldData.company_id,
      unit_id: oldData.unit_id,
      employeeId,
      userId: oldData.userId,
      eventType: "reporting_manager_change",
      fromReportingManagerId: oldData.reportingManagerId,
      toReportingManagerId: newData.reportingManagerId,
      effectiveDate: new Date(),
      changedBy,
      changeReason: newData.changeReason || "Reporting manager updated",
    });
  }

  // Track status change
  if (oldData.status !== newData.status && newData.status) {
    events.push({
      org_id: oldData.org_id,
      company_id: oldData.company_id,
      unit_id: oldData.unit_id,
      employeeId,
      userId: oldData.userId,
      eventType: "status_change",
      fromStatus: oldData.status,
      toStatus: newData.status,
      effectiveDate: new Date(),
      changedBy,
      changeReason: newData.changeReason || "Status updated",
    });
  }

  // Track employment type change
  if (oldData.employmentType !== newData.employmentType && newData.employmentType) {
    events.push({
      org_id: oldData.org_id,
      company_id: oldData.company_id,
      unit_id: oldData.unit_id,
      employeeId,
      userId: oldData.userId,
      eventType: "employment_type_change",
      fromEmploymentType: oldData.employmentType,
      toEmploymentType: newData.employmentType,
      effectiveDate: new Date(),
      changedBy,
      changeReason: newData.changeReason || "Employment type updated",
    });
  }

  // Track salary revision
  if (
    oldData.salary?.grossSalary !== newData.salary?.grossSalary &&
    newData.salary?.grossSalary
  ) {
    events.push({
      org_id: oldData.org_id,
      company_id: oldData.company_id,
      unit_id: oldData.unit_id,
      employeeId,
      userId: oldData.userId,
      eventType: "salary_revision",
      fromSalary: {
        grossSalary: oldData.salary?.grossSalary || 0,
        netSalary: oldData.salary?.netSalary || 0,
      },
      toSalary: {
        grossSalary: newData.salary.grossSalary,
        netSalary: newData.salary.netSalary || 0,
      },
      effectiveDate: newData.salary.effectiveFrom || new Date(),
      changedBy,
      changeReason: newData.changeReason || "Salary revision",
    });
  }

  // Track confirmation date
  if (!oldData.confirmationDate && newData.confirmationDate) {
    events.push({
      org_id: oldData.org_id,
      company_id: oldData.company_id,
      unit_id: oldData.unit_id,
      employeeId,
      userId: oldData.userId,
      eventType: "confirmation",
      effectiveDate: newData.confirmationDate,
      changedBy,
      changeReason: "Employee confirmed after probation",
    });
  }

  // Track exit date
  if (!oldData.exitDate && newData.exitDate) {
    events.push({
      org_id: oldData.org_id,
      company_id: oldData.company_id,
      unit_id: oldData.unit_id,
      employeeId,
      userId: oldData.userId,
      eventType: "exit",
      effectiveDate: newData.exitDate,
      changedBy,
      changeReason: newData.exitReason || "Employee exit",
    });
  }

  // Create all events
  if (events.length > 0) {
    await EmployeeTimeline.insertMany(events);
  }

  return events;
};

// ─────────────────────────────────────────────────────────────
// CREATE INITIAL JOINING EVENT
// Called when employee is created
// ─────────────────────────────────────────────────────────────
exports.createJoiningEvent = async (employeeData, changedBy) => {
  const event = {
    org_id: employeeData.org_id,
    company_id: employeeData.company_id,
    unit_id: employeeData.unit_id,
    employeeId: employeeData._id,
    userId: employeeData.userId,
    eventType: "joining",
    effectiveDate: employeeData.joiningDate || new Date(),
    changedBy,
    changeReason: "Employee joined the organization",
  };

  return await EmployeeTimeline.create(event);
};
