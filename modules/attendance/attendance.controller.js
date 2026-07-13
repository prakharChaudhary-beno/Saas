// modules/attendance/attendance.controller.js

const attendanceService = require("./attendance.service");

// ─────────────────────────────────────────────────────────────────────────────
// POST /hrms/me/attendance/punch-in
// Employee punch-in karta hai
// ─────────────────────────────────────────────────────────────────────────────
exports.punchIn = async (req, res, next) => {
  try {
    // Pass req object for IP-based location capture
    const record = await attendanceService.punchIn(req.body, req.user, req);

    return res.status(201).json({
      success: true,
      message: "Punch-in successful",
      data:    record,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /hrms/me/attendance/punch-out
// Employee punch-out karta hai
// ─────────────────────────────────────────────────────────────────────────────
exports.punchOut = async (req, res, next) => {
  try {
    const record = await attendanceService.punchOut(req.body, req.user);

    return res.status(200).json({
      success: true,
      message: "Punch-out successful",
      data:    record,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /hrms/me/attendance?month=YYYY-MM
// Employee apna monthly attendance detail dekhta hai
// ─────────────────────────────────────────────────────────────────────────────
exports.getMyAttendance = async (req, res, next) => {
  try {
    const result = await attendanceService.getMyAttendance(req.query, req.user);

    return res.status(200).json({
      success: true,
      message: "Attendance fetched successfully",
      data:    result,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /hrms/me/attendance/today
// Employee aaj ka punch-in/out status dekhta hai
// ─────────────────────────────────────────────────────────────────────────────
exports.getTodayStatus = async (req, res, next) => {
  try {
    const result = await attendanceService.getTodayStatus(req.user);

    return res.status(200).json({
      success: true,
      message: "Today's attendance status fetched",
      data:    result,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /hrms/me/attendance/summary?month=YYYY-MM
// Employee ka monthly summary (present, absent, late count etc.)
// ─────────────────────────────────────────────────────────────────────────────
exports.getMySummary = async (req, res, next) => {
  try {
    const result = await attendanceService.getMySummary(req.query, req.user);

    return res.status(200).json({
      success: true,
      message: "Attendance summary fetched",
      data:    result,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /hrms/attendance/team (Manager only)
// Manager sees attendance of employees reporting to them
// ─────────────────────────────────────────────────────────────────────────────
exports.getTeamAttendance = async (req, res, next) => {
  try {
    const result = await attendanceService.getTeamAttendance(req.query, req.user);

    return res.status(200).json({
      success:    true,
      message:    "Team attendance fetched",
      data:       result.records,
      pagination: {
        page:  result.page,
        limit: result.limit,
        total: result.total,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /hrms/attendance?month=&employeeId=&status=  (HR only)
// HR sab employees ki attendance dekhta hai
// ─────────────────────────────────────────────────────────────────────────────
exports.getAllAttendance = async (req, res, next) => {
  try {
    const result = await attendanceService.getAllAttendance(req.query, req.user);

    return res.status(200).json({
      success:    true,
      message:    "All attendance records fetched",
      data:       result.records,
      pagination: {
        page:  result.page,
        limit: result.limit,
        total: result.total,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /hrms/attendance/:id/regularize  (HR only)
// HR manually kisi attendance record ko fix karta hai
// ─────────────────────────────────────────────────────────────────────────────
exports.regularize = async (req, res, next) => {
  try {
    const record = await attendanceService.regularize(
      req.params.id,
      req.body,
      req.user
    );

    return res.status(200).json({
      success: true,
      message: "Attendance regularized successfully",
      data:    record,
    });
  } catch (err) {
    next(err);
  }
};