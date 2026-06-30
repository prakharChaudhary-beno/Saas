// utils/email/templates/leaveStatus.js
// T-31 — Leave status notification emails (Approved / Rejected / Cancelled)

exports.leaveApprovedTemplate = ({ name, leaveType, startDate, endDate, totalDays, approverName }) => `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Leave Approved</title></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px">
  <div style="max-width:600px;margin:auto;background:#fff;border-radius:8px;padding:32px">
    <div style="background:#10b981;color:#fff;padding:16px 24px;border-radius:6px;margin-bottom:24px">
      <h2 style="margin:0">✅ Leave Approved</h2>
    </div>
    <p>Hi <strong>${name}</strong>,</p>
    <p>Your leave request has been <strong>approved</strong>.</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0">
      <tr style="background:#f9fafb">
        <td style="padding:10px;border:1px solid #e5e7eb"><strong>Leave Type</strong></td>
        <td style="padding:10px;border:1px solid #e5e7eb">${leaveType}</td>
      </tr>
      <tr>
        <td style="padding:10px;border:1px solid #e5e7eb"><strong>From</strong></td>
        <td style="padding:10px;border:1px solid #e5e7eb">${startDate}</td>
      </tr>
      <tr style="background:#f9fafb">
        <td style="padding:10px;border:1px solid #e5e7eb"><strong>To</strong></td>
        <td style="padding:10px;border:1px solid #e5e7eb">${endDate}</td>
      </tr>
      <tr>
        <td style="padding:10px;border:1px solid #e5e7eb"><strong>Total Days</strong></td>
        <td style="padding:10px;border:1px solid #e5e7eb">${totalDays}</td>
      </tr>
      <tr style="background:#f9fafb">
        <td style="padding:10px;border:1px solid #e5e7eb"><strong>Approved By</strong></td>
        <td style="padding:10px;border:1px solid #e5e7eb">${approverName}</td>
      </tr>
    </table>
    <p style="color:#6b7280;font-size:13px">This is an automated notification. Please do not reply.</p>
  </div>
</body>
</html>`;

exports.leaveRejectedTemplate = ({ name, leaveType, startDate, endDate, totalDays, approverName, reason }) => `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Leave Rejected</title></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px">
  <div style="max-width:600px;margin:auto;background:#fff;border-radius:8px;padding:32px">
    <div style="background:#ef4444;color:#fff;padding:16px 24px;border-radius:6px;margin-bottom:24px">
      <h2 style="margin:0">❌ Leave Rejected</h2>
    </div>
    <p>Hi <strong>${name}</strong>,</p>
    <p>Your leave request has been <strong>rejected</strong>.</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0">
      <tr style="background:#f9fafb">
        <td style="padding:10px;border:1px solid #e5e7eb"><strong>Leave Type</strong></td>
        <td style="padding:10px;border:1px solid #e5e7eb">${leaveType}</td>
      </tr>
      <tr>
        <td style="padding:10px;border:1px solid #e5e7eb"><strong>From</strong></td>
        <td style="padding:10px;border:1px solid #e5e7eb">${startDate}</td>
      </tr>
      <tr style="background:#f9fafb">
        <td style="padding:10px;border:1px solid #e5e7eb"><strong>To</strong></td>
        <td style="padding:10px;border:1px solid #e5e7eb">${endDate}</td>
      </tr>
      <tr>
        <td style="padding:10px;border:1px solid #e5e7eb"><strong>Total Days</strong></td>
        <td style="padding:10px;border:1px solid #e5e7eb">${totalDays}</td>
      </tr>
      <tr style="background:#f9fafb">
        <td style="padding:10px;border:1px solid #e5e7eb"><strong>Rejected By</strong></td>
        <td style="padding:10px;border:1px solid #e5e7eb">${approverName}</td>
      </tr>
      ${reason ? `<tr>
        <td style="padding:10px;border:1px solid #e5e7eb"><strong>Reason</strong></td>
        <td style="padding:10px;border:1px solid #e5e7eb">${reason}</td>
      </tr>` : ""}
    </table>
    <p>Please contact your HR Manager if you have questions.</p>
    <p style="color:#6b7280;font-size:13px">This is an automated notification. Please do not reply.</p>
  </div>
</body>
</html>`;

exports.leavePendingTemplate = ({ approverName, employeeName, leaveType, startDate, endDate, totalDays, reason }) => `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Leave Approval Required</title></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px">
  <div style="max-width:600px;margin:auto;background:#fff;border-radius:8px;padding:32px">
    <div style="background:#f59e0b;color:#fff;padding:16px 24px;border-radius:6px;margin-bottom:24px">
      <h2 style="margin:0">⏳ Leave Approval Required</h2>
    </div>
    <p>Hi <strong>${approverName}</strong>,</p>
    <p><strong>${employeeName}</strong> has applied for leave and requires your approval.</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0">
      <tr style="background:#f9fafb">
        <td style="padding:10px;border:1px solid #e5e7eb"><strong>Employee</strong></td>
        <td style="padding:10px;border:1px solid #e5e7eb">${employeeName}</td>
      </tr>
      <tr>
        <td style="padding:10px;border:1px solid #e5e7eb"><strong>Leave Type</strong></td>
        <td style="padding:10px;border:1px solid #e5e7eb">${leaveType}</td>
      </tr>
      <tr style="background:#f9fafb">
        <td style="padding:10px;border:1px solid #e5e7eb"><strong>From</strong></td>
        <td style="padding:10px;border:1px solid #e5e7eb">${startDate}</td>
      </tr>
      <tr>
        <td style="padding:10px;border:1px solid #e5e7eb"><strong>To</strong></td>
        <td style="padding:10px;border:1px solid #e5e7eb">${endDate}</td>
      </tr>
      <tr style="background:#f9fafb">
        <td style="padding:10px;border:1px solid #e5e7eb"><strong>Total Days</strong></td>
        <td style="padding:10px;border:1px solid #e5e7eb">${totalDays}</td>
      </tr>
      ${reason ? `<tr>
        <td style="padding:10px;border:1px solid #e5e7eb"><strong>Reason</strong></td>
        <td style="padding:10px;border:1px solid #e5e7eb">${reason}</td>
      </tr>` : ""}
    </table>
    <p>Please login to your HRMS portal to approve or reject this request.</p>
    <p style="color:#6b7280;font-size:13px">This is an automated notification. Please do not reply.</p>
  </div>
</body>
</html>`;
