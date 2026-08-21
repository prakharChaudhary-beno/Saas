// Test payroll calculation for July 2026
// This script verifies: policy config, attendance data, and payslip calculations

const mongoose = require('mongoose');
require('dotenv').config();

async function testPayrollCalculation() {
  try {
    await mongoose.connect(process.env.MONGODB_URL || 'mongodb://localhost:27017/hrms');
    console.log('✅ Connected to MongoDB');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
  
  const db = mongoose.connection.db;
  
  console.log('\n' + '='.repeat(80));
  console.log('PAYROLL CALCULATION VERIFICATION - JULY 2026');
  console.log('='.repeat(80));
  
  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: Find User and Employee
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n📋 STEP 1: Finding Employee Details');
  console.log('-'.repeat(80));
  
  const users = await db.collection('users').find({ 
    name: { $regex: /chetan/i } 
  }).limit(5).toArray();
  
  if (users.length === 0) {
    console.log('❌ Employee "Chetan" not found');
    await mongoose.disconnect();
    return;
  }
  
  const user = users[0];
  
  console.log('✅ Employee Found:');
  console.log('   Name:', user.name);
  console.log('   Employee ID:', user.employeeId);
  console.log('   User ID:', user._id);
  console.log('   Company ID:', user.company_id);
  console.log('   Unit ID:', user.unit_id);
  console.log('   Salary:', user.salary);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: Check Payroll Policy Configuration
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n📋 STEP 2: Checking Payroll Policy Configuration');
  console.log('-'.repeat(80));
  
  const policy = await db.collection('payrollpolicies').findOne({
    company_id: user.company_id,
    status: 'active'
  });
  
  if (!policy) {
    console.log('❌ No active payroll policy found for company:', user.company_id);
    await mongoose.disconnect();
    return;
  }
  
  console.log('✅ Payroll Policy Found:');
  console.log('   Policy Name:', policy.name);
  console.log('   Policy ID:', policy._id);
  console.log('   Status:', policy.status);
  console.log('\n   ⭐ OVERTIME CONFIGURATION:');
  console.log('   - Enabled:', policy.overtimePay?.enabled !== false);
  console.log('   - Rate Multiplier:', policy.overtimePay?.rateMultiplier || 1.5);
  console.log('   - Payable Component:', policy.overtimePay?.payableComponent || 'BASIC');
  console.log('   - Cap Hours/Month:', policy.overtimePay?.capHoursPerMonth || 'No cap');
  
  console.log('\n   ⭐ LOP CONFIGURATION:');
  console.log('   - LOP Enabled:', policy.lop?.enabled !== false);
  console.log('   - LOP Calculation:', policy.lop?.calculationMethod || 'daily_rate');
  
  console.log('\n   ⭐ TAX CONFIGURATION:');
  console.log('   - PF Enabled:', policy.taxCompliance?.pfEnabled || false);
  console.log('   - PF Rate:', policy.taxCompliance?.pfRate || 'Not set');
  console.log('   - ESI Enabled:', policy.taxCompliance?.esiEnabled || false);
  console.log('   - ESI Rate:', policy.taxCompliance?.esiRate || 'Not set');
  console.log('   - PT Enabled:', policy.taxCompliance?.ptEnabled || false);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: Check Attendance Data for July 2026
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n📋 STEP 3: Checking Attendance Data for July 2026');
  console.log('-'.repeat(80));
  
  const attendanceRecords = await db.collection('attendences').find({
    employee_id: user._id,
    month: 7,
    year: 2026
  }).toArray();
  
  let summary = {
    present: 0, absent: 0, halfDay: 0, holiday: 0, weeklyOff: 0,
    onLeave: 0, late: 0, wfh: 0, overtimeHours: 0
  };
  
  if (attendanceRecords.length === 0) {
    console.log('❌ No attendance records found for July 2026');
    console.log('   employee_id:', user._id);
    console.log('   Checking all attendance for this employee...');
    
    const allAttendance = await db.collection('attendences')
      .find({ employee_id: user._id })
      .limit(5)
      .toArray();
    
    console.log(`   Found ${allAttendance.length} records in total`);
    allAttendance.forEach(att => {
      console.log(`   - Month: ${att.month}/${att.year}, Status: ${att.status}`);
    });
  } else {
    console.log(`✅ Found ${attendanceRecords.length} attendance records\n`);
    
    // Summarize attendance
    attendanceRecords.forEach(record => {
      switch(record.status) {
        case 'PRESENT': summary.present++; break;
        case 'ABSENT': summary.absent++; break;
        case 'HALF_DAY': summary.halfDay++; break;
        case 'HOLIDAY': summary.holiday++; break;
        case 'WEEKLY_OFF': summary.weeklyOff++; break;
        case 'ON_LEAVE': summary.onLeave++; break;
        case 'LATE': summary.late++; summary.present++; break;
        case 'WFH': summary.wfh++; summary.present++; break;
      }
      summary.overtimeHours += (record.overtimeHours || 0);
    });
    
    console.log('   ATTENDANCE SUMMARY:');
    console.log('   - Present Days:', summary.present);
    console.log('   - Late:', summary.late);
    console.log('   - WFH:', summary.wfh);
    console.log('   - Half Day:', summary.halfDay);
    console.log('   - On Leave:', summary.onLeave);
    console.log('   - Holiday:', summary.holiday);
    console.log('   - Weekly Off:', summary.weeklyOff);
    console.log('   - Absent:', summary.absent);
    console.log('\n   ⭐ TOTAL OVERTIME HOURS:', summary.overtimeHours.toFixed(2));
  }
  
  // Calculate working days
  const totalDaysInMonth = 31; // July has 31 days
  const workingDays = totalDaysInMonth - summary.holiday - summary.weeklyOff;
  
  console.log('\n   WORKING DAYS CALCULATION:');
  console.log('   - Total Days in Month:', totalDaysInMonth);
  console.log('   - Holidays:', summary.holiday);
  console.log('   - Weekly Offs:', summary.weeklyOff);
  console.log('   - Working Days:', workingDays);
  
  // Days present calculation (as per payroll logic)
  const daysPresent = summary.present + (summary.halfDay * 0.5) + summary.onLeave + summary.holiday;
  const lopDays = Math.max(0, workingDays - daysPresent);
  
  console.log('\n   DAYS PRESENT CALCULATION (as per payroll):');
  console.log('   - Present:', summary.present);
  console.log('   - Half Day (×0.5):', (summary.halfDay * 0.5));
  console.log('   - On Leave:', summary.onLeave);
  console.log('   - Holiday:', summary.holiday);
  console.log('   - Total Days Present:', daysPresent);
  console.log('   - LOP Days:', lopDays);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4: Manual Payroll Calculation
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n📋 STEP 4: Manual Payroll Calculation Verification');
  console.log('-'.repeat(80));
  
  const salary = user.salary || 0;
  const basic = salary * 0.5; // Assuming 50% basic
  const hra = salary * 0.2; // Assuming 20% HRA
  const conveyance = salary * 0.1;
  const special = salary * 0.1;
  const medical = salary * 0.1;
  
  console.log('\n   SALARY STRUCTURE (Estimated):');
  console.log('   - Gross Salary:', salary.toFixed(2));
  console.log('   - Basic (50%):', basic.toFixed(2));
  console.log('   - HRA (20%):', hra.toFixed(2));
  console.log('   - Conveyance (10%):', conveyance.toFixed(2));
  console.log('   - Medical (10%):', medical.toFixed(2));
  console.log('   - Special (10%):', special.toFixed(2));
  
  let overtimePay = 0;
  if (policy.overtimePay?.enabled !== false && summary.overtimeHours > 0) {
    const hourlyBasic = basic / 26 / 8; // 26 working days, 8 hours
    overtimePay = summary.overtimeHours * hourlyBasic * (policy.overtimePay?.rateMultiplier || 1.5);
    
    console.log('\n   ⭐ OVERTIME CALCULATION:');
    console.log('   - Hourly Basic:', hourlyBasic.toFixed(2));
    console.log('   - Overtime Hours:', summary.overtimeHours.toFixed(2));
    console.log('   - Rate Multiplier:', policy.overtimePay?.rateMultiplier || 1.5);
    console.log('   - Calculated OT Pay:', overtimePay.toFixed(2));
  } else {
    console.log('\n   ⚠️  OVERTIME NOT CALCULATED:');
    console.log('   - Policy Enabled:', policy.overtimePay?.enabled !== false);
    console.log('   - Overtime Hours:', summary.overtimeHours || 0);
  }
  
  // LOP Deduction calculation
  let lopDeduction = 0;
  if (lopDays > 0 && policy.lop?.enabled !== false) {
    const dailySalary = salary / totalDaysInMonth;
    lopDeduction = lopDays * dailySalary;
    
    console.log('\n   LOP DEDUCTION CALCULATION:');
    console.log('   - Daily Salary:', dailySalary.toFixed(2));
    console.log('   - LOP Days:', lopDays);
    console.log('   - LOP Deduction:', lopDeduction.toFixed(2));
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 5: Check Existing Payslip for July 2026
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n📋 STEP 5: Checking Existing Payslip for July 2026');
  console.log('-'.repeat(80));
  
  const payslip = await db.collection('payslips').findOne({
    employee_id: user._id,
    month: 7,
    year: 2026
  });
  
  if (!payslip) {
    console.log('❌ No payslip found for July 2026');
    console.log('   You need to run payroll for this month first');
    console.log('\n   Run: POST /api/v1/payroll/run with month=7, year=2026');
  } else {
    console.log('✅ Payslip Found:');
    console.log('   Payslip ID:', payslip._id);
    console.log('   Status:', payslip.status);
    console.log('\n   EARNINGS:');
    console.log('   - Basic:', payslip.earnings?.basic?.toFixed(2) || '0.00');
    console.log('   - HRA:', payslip.earnings?.hra?.toFixed(2) || '0.00');
    console.log('   - Travel Allowance:', payslip.earnings?.travelAllowance?.toFixed(2) || '0.00');
    console.log('   - Medical Allowance:', payslip.earnings?.medicalAllowance?.toFixed(2) || '0.00');
    console.log('   - Special Allowance:', payslip.earnings?.specialAllowance?.toFixed(2) || '0.00');
    console.log('   - Overtime:', payslip.earnings?.overtime?.toFixed(2) || '0.00');
    console.log('   - Bonus:', payslip.earnings?.bonus?.toFixed(2) || '0.00');
    console.log('   - Arrears:', payslip.earnings?.arrears?.toFixed(2) || '0.00');
    console.log('   - Gross Salary:', payslip.grossSalary?.toFixed(2) || '0.00');
    
    console.log('\n   DEDUCTIONS:');
    console.log('   - PF:', payslip.deductions?.pf?.toFixed(2) || '0.00');
    console.log('   - ESI:', payslip.deductions?.esi?.toFixed(2) || '0.00');
    console.log('   - TDS:', payslip.deductions?.tds?.toFixed(2) || '0.00');
    console.log('   - Professional Tax:', payslip.deductions?.professionalTax?.toFixed(2) || '0.00');
    console.log('   - LOP:', payslip.deductions?.lop?.toFixed(2) || '0.00');
    console.log('   - Advance:', payslip.deductions?.advance?.toFixed(2) || '0.00');
    console.log('   - Other:', payslip.deductions?.other?.toFixed(2) || '0.00');
    
    console.log('\n   ATTENDANCE DATA:');
    console.log('   - Working Days:', payslip.totalWorkingDays || '0');
    console.log('   - Days Present:', payslip.daysPresent || '0');
    console.log('   - LOP Days:', payslip.lopDays || '0');
    console.log('   - Overtime Hours:', payslip.overtimeHours || '0');
    
    console.log('\n   FINAL CALCULATIONS:');
    console.log('   - Gross After LOP:', payslip.grossAfterLOP?.toFixed(2) || '0.00');
    console.log('   - Net Salary:', payslip.netSalary?.toFixed(2) || '0.00');
    
    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 6: Discrepancy Analysis
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n📋 STEP 6: Discrepancy Analysis');
    console.log('-'.repeat(80));
    
    const discrepancies = [];
    
    // Check 1: Overtime calculation
    if (policy.overtimePay?.enabled !== false && summary.overtimeHours > 0) {
      const hourlyBasic = basic / 26 / 8;
      const expectedOT = (summary.overtimeHours * hourlyBasic * (policy.overtimePay?.rateMultiplier || 1.5));
      const actualOT = payslip.earnings?.overtime || 0;
      
      if (Math.abs(expectedOT - actualOT) > 1) {
        discrepancies.push({
          field: 'Overtime Pay',
          expected: expectedOT.toFixed(2),
          actual: actualOT.toFixed(2),
          difference: (expectedOT - actualOT).toFixed(2),
          reason: `Overtime hours ${summary.overtimeHours.toFixed(2)} × hourly basic ${hourlyBasic.toFixed(2)} × rate ${(policy.overtimePay?.rateMultiplier || 1.5)}`
        });
      }
    }
    
    // Check 2: Working days
    if (payslip.totalWorkingDays !== workingDays) {
      discrepancies.push({
        field: 'Working Days',
        expected: workingDays.toString(),
        actual: (payslip.totalWorkingDays || 0).toString(),
        reason: `Total days in month ${totalDaysInMonth} - holidays ${summary.holiday} - weekly offs ${summary.weeklyOff}`
      });
    }
    
    // Check 3: Days Present
    if (Math.abs((payslip.daysPresent || 0) - daysPresent) > 0.1) {
      discrepancies.push({
        field: 'Days Present',
        expected: daysPresent.toFixed(1),
        actual: (payslip.daysPresent || 0).toString(),
        reason: `Present ${summary.present} + half day ${(summary.halfDay * 0.5)} + on leave ${summary.onLeave} + holiday ${summary.holiday}`
      });
    }
    
    // Check 4: LOP days
    if ((payslip.lopDays || 0) !== lopDays) {
      discrepancies.push({
        field: 'LOP Days',
        expected: lopDays.toString(),
        actual: (payslip.lopDays || 0).toString(),
        reason: `Working days ${workingDays} - days present ${daysPresent}`
      });
    }
    
    // Check 5: LOP Deduction
    if (lopDays > 0) {
      const dailySalary = salary / totalDaysInMonth;
      const expectedLOPDeduction = lopDays * dailySalary;
      const actualLOPDeduction = payslip.deductions?.lop || 0;
      
      if (Math.abs(expectedLOPDeduction - actualLOPDeduction) > 1) {
        discrepancies.push({
          field: 'LOP Deduction',
          expected: expectedLOPDeduction.toFixed(2),
          actual: actualLOPDeduction.toFixed(2),
          difference: (expectedLOPDeduction - actualLOPDeduction).toFixed(2),
          reason: `LOP days ${lopDays} × daily salary ${dailySalary.toFixed(2)}`
        });
      }
    }
    
    if (discrepancies.length > 0) {
      console.log('❌ DISCREPANCIES FOUND:\n');
      discrepancies.forEach((d, i) => {
        console.log(`   ${i + 1}. ${d.field}:`);
        console.log(`      Expected: ${d.expected}`);
        console.log(`      Actual: ${d.actual}`);
        if (d.difference) console.log(`      Difference: ${d.difference}`);
        console.log(`      Reason: ${d.reason}\n`);
      });
    } else {
      console.log('✅ NO DISCREPANCIES FOUND - All calculations match!');
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('TEST COMPLETE');
  console.log('='.repeat(80) + '\n');
  
  await mongoose.disconnect();
}

// Run the test
testPayrollCalculation().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
