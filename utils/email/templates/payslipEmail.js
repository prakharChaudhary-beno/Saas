// utils/email/templates/payslipEmail.js
// Payslip published notification email

"use strict";

const fmt = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
    .format(n || 0);

const monthName = (m) =>
  ["January","February","March","April","May","June",
   "July","August","September","October","November","December"][m - 1] || "";

exports.payslipPublishedTemplate = ({
  employeeName,
  employeeId,
  month,
  year,
  companyName,
  earnings = {},
  deductions = {},
  grossSalary = 0,
  netSalary = 0,
  totalWorkingDays = 0,
  daysPresent = 0,
  lopDays = 0,
  overtimeHours = 0,
}) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Payslip — ${monthName(month)} ${year}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:640px;margin:32px auto;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">

    <!-- Header -->
    <div style="background:#1e293b;padding:28px 32px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700">${companyName}</h1>
          <p style="margin:6px 0 0;color:#94a3b8;font-size:13px">Payslip for ${monthName(month)} ${year}</p>
        </div>
        <div style="background:#3b82f6;color:#fff;padding:8px 16px;border-radius:6px;font-size:13px;font-weight:600">
          PAYSLIP
        </div>
      </div>
    </div>

    <!-- Employee Info -->
    <div style="padding:24px 32px;background:#f8fafc;border-bottom:1px solid #e2e8f0">
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="padding:4px 0;color:#64748b;font-size:13px;width:140px">Employee Name</td>
          <td style="padding:4px 0;color:#1e293b;font-size:13px;font-weight:600">${employeeName}</td>
          <td style="padding:4px 0;color:#64748b;font-size:13px;width:120px">Employee ID</td>
          <td style="padding:4px 0;color:#1e293b;font-size:13px;font-weight:600">${employeeId}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#64748b;font-size:13px">Pay Period</td>
          <td style="padding:4px 0;color:#1e293b;font-size:13px;font-weight:600">${monthName(month)} ${year}</td>
          <td style="padding:4px 0;color:#64748b;font-size:13px">Working Days</td>
          <td style="padding:4px 0;color:#1e293b;font-size:13px;font-weight:600">${daysPresent} / ${totalWorkingDays}${lopDays > 0 ? ` <span style="color:#ef4444">(LOP: ${lopDays})</span>` : ""}</td>
        </tr>
        ${overtimeHours > 0 ? `
        <tr>
          <td style="padding:4px 0;color:#64748b;font-size:13px">Overtime Hours</td>
          <td style="padding:4px 0;color:#1e293b;font-size:13px;font-weight:600">${overtimeHours} hrs</td>
          <td></td><td></td>
        </tr>` : ""}
      </table>
    </div>

    <!-- Earnings & Deductions -->
    <div style="padding:24px 32px">
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr>
            <th style="background:#f1f5f9;padding:10px 12px;text-align:left;font-size:12px;color:#64748b;border-radius:4px 0 0 4px;text-transform:uppercase;letter-spacing:0.5px">Earnings</th>
            <th style="background:#f1f5f9;padding:10px 12px;text-align:right;font-size:12px;color:#64748b;border-radius:0 4px 4px 0">Amount</th>
            <th style="width:20px"></th>
            <th style="background:#fff3f3;padding:10px 12px;text-align:left;font-size:12px;color:#64748b;border-radius:4px 0 0 4px;text-transform:uppercase;letter-spacing:0.5px">Deductions</th>
            <th style="background:#fff3f3;padding:10px 12px;text-align:right;font-size:12px;color:#64748b;border-radius:0 4px 4px 0">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${[
            ["Basic Salary",       earnings.basic,           "Provident Fund (PF)",   deductions.pf],
            ["HRA",                earnings.hra,             "ESI",                   deductions.esi],
            ["Travel Allowance",   earnings.travelAllowance, "TDS (Income Tax)",      deductions.tds],
            ["Medical Allowance",  earnings.medicalAllowance,"Professional Tax",      deductions.professionalTax],
            ["Special Allowance",  earnings.specialAllowance,"Loss of Pay (LOP)",     deductions.lop],
            ["Overtime Pay",       earnings.overtime,        "Advance Recovery",      deductions.advance],
            ["Bonus",              earnings.bonus,           "Other Deductions",      deductions.other],
            ["Arrears",            earnings.arrears,         "",                      null],
          ].filter(r => r[1] > 0 || r[3] > 0).map(([el, ev, dl, dv]) => `
          <tr>
            <td style="padding:8px 12px;font-size:13px;color:#334155;border-bottom:1px solid #f1f5f9">${el}</td>
            <td style="padding:8px 12px;font-size:13px;color:#10b981;text-align:right;border-bottom:1px solid #f1f5f9;font-weight:500">${ev > 0 ? fmt(ev) : "—"}</td>
            <td></td>
            <td style="padding:8px 12px;font-size:13px;color:#334155;border-bottom:1px solid #f1f5f9">${dl || ""}</td>
            <td style="padding:8px 12px;font-size:13px;color:${dv > 0 ? "#ef4444" : "#94a3b8"};text-align:right;border-bottom:1px solid #f1f5f9;font-weight:500">${dv > 0 ? fmt(dv) : (dl ? "—" : "")}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>

    <!-- Net Pay -->
    <div style="margin:0 32px 24px;background:#1e293b;border-radius:8px;padding:20px 24px">
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="color:#94a3b8;font-size:13px">Gross Salary</td>
          <td style="color:#ffffff;font-size:14px;font-weight:600;text-align:right">${fmt(grossSalary)}</td>
          <td style="width:40px"></td>
          <td style="color:#94a3b8;font-size:13px">Total Deductions</td>
          <td style="color:#ef4444;font-size:14px;font-weight:600;text-align:right">- ${fmt(grossSalary - netSalary)}</td>
        </tr>
      </table>
      <div style="border-top:1px solid #334155;margin:16px 0"></div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="color:#ffffff;font-size:15px;font-weight:700">Net Pay (Take Home)</span>
        <span style="color:#10b981;font-size:22px;font-weight:700">${fmt(netSalary)}</span>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding:20px 32px;border-top:1px solid #e2e8f0;text-align:center">
      <p style="margin:0;color:#94a3b8;font-size:12px">
        This is a system-generated payslip. Please do not reply to this email.<br>
        For any discrepancies, contact your HR Manager.
      </p>
      <p style="margin:12px 0 0;color:#cbd5e1;font-size:11px">
        © ${year} ${companyName} · Powered by BenoSupport HRMS
      </p>
    </div>

  </div>
</body>
</html>`;
