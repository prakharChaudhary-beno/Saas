#!/usr/bin/env node
/**
 * One-time script to backfill ABSENT records for historical working days
 * 
 * Usage:
 *   node scripts/backfillAbsentRecords.js [options]
 * 
 * Options:
 *   --dry-run          Preview changes without writing to DB
 *   --org-id=ID        Specific org ID (optional, processes all if not specified)
 *   --company-id=ID    Specific company ID (optional, processes all if not specified)
 *   --start-date=YYYY-MM-DD  Start date (default: first day of current month)
 *   --end-date=YYYY-MM-DD    End date (default: yesterday)
 * 
 * This script fills the gap for days before auto-absent marker was enabled.
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Attendance = require('../modules/attendance/models/attendance.model');
const Employee = require('../modules/employee/models/employee.model');
const CompanyConfig = require('../modules/companyConfig/models/companyConfig.model');
const Holiday = require('../modules/holiday/models/holiday.models');
const LeaveRequest = require('../modules/leave/models/leaveRequest.models');

const moment = require('moment-timezone');

// Parse command line args
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.replace('--', '').split('=');
  acc[key] = value || true;
  return acc;
}, {});

const DRY_RUN = args['dry-run'] || false;
const TARGET_ORG_ID = args['org-id'] || null;
const TARGET_COMPANY_ID = args['company-id'] || null;
const START_DATE = args['start-date'] || moment().startOf('month').format('YYYY-MM-DD');
const END_DATE = args['end-date'] || moment().subtract(1, 'day').format('YYYY-MM-DD');

console.log('=== ABSENT RECORDS BACKFILL SCRIPT ===');
console.log('Dry run:', DRY_RUN ? 'YES (no changes will be made)' : 'NO (changes will be saved)');
console.log('Date range:', START_DATE, 'to', END_DATE);
if (TARGET_ORG_ID) console.log('Org filter:', TARGET_ORG_ID);
if (TARGET_COMPANY_ID) console.log('Company filter:', TARGET_COMPANY_ID);
console.log('');

// Connect to database
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!MONGODB_URI) {
  console.error('ERROR: MONGODB_URI or MONGO_URI not found in environment');
  process.exit(1);
}

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✓ Connected to database'))
  .catch(err => {
    console.error('✗ Database connection failed:', err.message);
    process.exit(1);
  });

const getWorkingDays = (startDate, endDate, timezone) => {
  const days = [];
  let current = moment(startDate).tz(timezone);
  const end = moment(endDate).tz(timezone);
  
  while (current.isSameOrBefore(end, 'day')) {
    const dayOfWeek = current.day(); // 0=Sun, 6=Sat
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      days.push(current.clone().startOf('day').toDate());
    }
    current.add(1, 'day');
  }
  
  return days;
};

const runBackfill = async () => {
  try {
    // Build employee filter
    const empFilter = { status: 'ACTIVE', isDeleted: false };
    if (TARGET_ORG_ID) empFilter.org_id = mongoose.Types.ObjectId(TARGET_ORG_ID);
    if (TARGET_COMPANY_ID) empFilter.company_id = mongoose.Types.ObjectId(TARGET_COMPANY_ID);
    
    const employees = await Employee.find(empFilter)
      .select('_id org_id company_id unit_id employeeId name')
      .lean();
    
    console.log(`✓ Found ${employees.length} active employees`);
    
    if (employees.length === 0) {
      console.log('No employees to process');
      mongoose.connection.close();
      return;
    }
    
    // Group by company for timezone handling
    const companyGroups = {};
    for (const emp of employees) {
      const key = `${emp.org_id}_${emp.company_id}`;
      if (!companyGroups[key]) {
        companyGroups[key] = {
          org_id: emp.org_id,
          company_id: emp.company_id,
          employees: []
        };
      }
      companyGroups[key].employees.push(emp);
    }
    
    console.log(`✓ Grouped into ${Object.keys(companyGroups).length} company groups`);
    
    let totalMarkedAbsent = 0;
    let totalMarkedOnLeave = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    
    // Process each company
    for (const [key, group] of Object.entries(companyGroups)) {
      console.log(`\n--- Processing company ${key} (${group.employees.length} employees) ---`);
      
      // Get timezone
      const config = await CompanyConfig.findOne({
        org_id: group.org_id,
        company_id: group.company_id
      }).select('timezone').lean();
      
      const timezone = config?.timezone || 'Asia/Kolkata';
      console.log(`Timezone: ${timezone}`);
      
      // Get working days in date range
      const workingDays = getWorkingDays(START_DATE, END_DATE, timezone);
      console.log(`Working days to check: ${workingDays.length}`);
      
      // Get holidays for this company
      const holidays = await Holiday.find({
        org_id: group.org_id,
        company_id: group.company_id,
        date: { $in: workingDays },
        isDeleted: false
      }).select('date').lean();
      
      const holidayDates = new Set(holidays.map(h => h.date.getTime()));
      console.log(`Holidays in range: ${holidayDates.size}`);
      
      // Process each employee
      for (const emp of group.employees) {
        try {
          // Process each working day
          for (const day of workingDays) {
            // Skip holidays
            if (holidayDates.has(day.getTime())) {
              totalSkipped++;
              continue;
            }
            
            // Check if attendance record exists
            const existing = await Attendance.findOne({
              org_id: emp.org_id,
              company_id: emp.company_id,
              employeeId: emp._id,
              date: day
            });
            
            if (existing) {
              totalSkipped++;
              continue;
            }
            
            // Check for approved leave
            const approvedLeave = await LeaveRequest.findOne({
              employeeId: emp._id,
              org_id: emp.org_id,
              company_id: emp.company_id,
              startDate: { $lte: day },
              endDate: { $gte: day },
              status: 'APPROVED',
              isDeleted: false
            });
            
            if (DRY_RUN) {
              if (approvedLeave) {
                console.log(`[DRY RUN] Would mark ${emp.employeeId} as ON_LEAVE for ${moment(day).format('YYYY-MM-DD')}`);
                totalMarkedOnLeave++;
              } else {
                console.log(`[DRY RUN] Would mark ${emp.employeeId} as ABSENT for ${moment(day).format('YYYY-MM-DD')}`);
                totalMarkedAbsent++;
              }
            } else {
              // Create record
              await Attendance.create({
                org_id: emp.org_id,
                company_id: emp.company_id,
                unit_id: emp.unit_id,
                employeeId: emp._id,
                userId: emp.userId || emp._id, // Fallback
                date: day,
                status: approvedLeave ? 'ON_LEAVE' : 'ABSENT',
                leaveRequestId: approvedLeave?._id || null,
                checkIn: null,
                checkOut: null,
                workingHours: 0,
                remarks: approvedLeave 
                  ? 'Auto-backfilled: On approved leave' 
                  : 'Auto-backfilled: No punch recorded (historical)',
              });
              
              if (approvedLeave) {
                totalMarkedOnLeave++;
              } else {
                totalMarkedAbsent++;
              }
            }
          }
        } catch (err) {
          console.error(`✗ Error processing employee ${emp.employeeId}:`, err.message);
          totalErrors++;
        }
      }
    }
    
    console.log('\n=== SUMMARY ===');
    console.log('Marked ABSENT:', totalMarkedAbsent);
    console.log('Marked ON_LEAVE:', totalMarkedOnLeave);
    console.log('Skipped (existing/holiday):', totalSkipped);
    console.log('Errors:', totalErrors);
    
    if (DRY_RUN) {
      console.log('\n⚠️  DRY RUN - No changes were made to database');
      console.log('Run without --dry-run to apply changes');
    }
    
    mongoose.connection.close();
    console.log('\n✓ Done');
    
  } catch (error) {
    console.error('✗ Fatal error:', error);
    mongoose.connection.close();
    process.exit(1);
  }
};

runBackfill();
