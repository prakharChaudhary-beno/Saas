// jobs/biometricEveningSync.job.js
// Enterprise HRMS - Biometric Evening Sync Cron Job
// 
// Purpose:
//   - Run after shift end time
//   - Pull attendance from biometric devices (final sync)
//   - Finalize attendance with checkOut times
//   - Calculate final working hours
//   - Handle employees who forgot to punch out
//
// Schedule: Every 5 minutes during evening hours (configurable per unit)
// Trigger time: Shift end + 5 minute buffer
//
// Flow:
//   1. Find all units with biometric enabled
//   2. For each unit:
//      a. Get shift end time and isNextDay flag
//      b. Check if current time is shift end + buffer
//      c. Pull attendance from biometric devices
//      d. Finalize attendance records (set checkOut, workingHours)
//      e. Calculate overtime if applicable

"use strict";

const BiometricConfig = require('../modules/biometric/models/biometricConfig.model');
const Attendance = require('../modules/attendance/models/attendance.model');
const Employee = require('../modules/employee/models/employee.model');
const Shift = require('../modules/shift/models/shift.model');
const CompanyConfig = require('../modules/companyConfig/models/companyConfig.model');
const Unit = require('../modules/unit/models/unit.model');
const moment = require('moment-timezone');
const biometricService = require('../modules/biometric/biometric.service');

/**
 * Run evening biometric sync for all units
 * Called by cron scheduler every 5 minutes
 * 
 * @returns {Object} - Summary of synced units and finalized records
 */
exports.runEveningSync = async () => {
  console.log(`[EveningSync] Starting biometric evening sync...`);
  
  try {
    const now = new Date();
    
    // Get all biometric configs with active devices
    const configs = await BiometricConfig.find({
      isDeleted: false,
      biometricEnabled: true,
      'devices.isActive': true
    })
    .populate({
      path: 'unit_id',
      select: 'shiftConfig name',
      populate: {
        path: 'shiftConfig.defaultShift',
        select: 'startTime endTime graceMinutes isNextDay'
      }
    })
    .lean();
    
    let syncedUnits = 0;
    let finalizedRecords = 0;
    let errors = 0;
    
    for (const config of configs) {
      try {
        if (!config.unit_id || !config.unit_id.shiftConfig || !config.unit_id.shiftConfig.defaultShift) {
          console.log(`[EveningSync] Skipping unit ${config.unit_id?.name || 'unknown'} - no shift config`);
          continue;
        }
        
        const shift = config.unit_id.shiftConfig.defaultShift;
        
        // Get company config for timezone
        const companyConfig = await CompanyConfig.findOne({
          org_id: config.org_id,
          company_id: config.company_id
        }).select('timezone').lean();
        
        const timezone = companyConfig?.timezone || 'Asia/Kolkata';
        const nowInOrg = moment(now).tz(timezone);
        
        // Parse shift end time
        const [endH, endM] = shift.endTime.split(':').map(Number);
        let shiftEndTime = moment(nowInOrg).set({ hour: endH, minute: endM, second: 0, millisecond: 0 });
        
        // Handle night shift (isNextDay)
        if (shift.isNextDay) {
          shiftEndTime.add(1, 'day');
        }
        
        // Calculate when to run this sync (shift end + 5 minute buffer)
        const syncTime = moment(shiftEndTime).add(5, 'minutes');
        
        // Check if current time is within sync window (syncTime ± 3 minutes)
        const diffMinutes = nowInOrg.diff(syncTime, 'minutes');
        
        if (Math.abs(diffMinutes) > 3) {
          console.log(`[EveningSync] Skipping ${config.unit_id.name} - not in sync window (diff: ${diffMinutes} min)`);
          continue;
        }
        
        console.log(`[EveningSync] Syncing ${config.unit_id.name} (shift end: ${shift.endTime})`);
        
        // Create sync log
        const BiometricSyncLog = require('../modules/biometric/models/biometricSyncLog.model');
        const syncLog = await BiometricSyncLog.create({
          org_id: config.org_id,
          company_id: config.company_id,
          unit_id: config.unit_id._id,
          deviceSerialNumber: 'EVENING_SYNC',
          syncType: 'SCHEDULED',
          status: 'RUNNING',
          startedAt: new Date()
        });
        
        // Pull attendance for today
        const startOfDay = moment(nowInOrg).startOf('day').toDate();
        const endOfDay = moment(nowInOrg).endOf('day').toDate();
        
        // Sync all active devices for this unit
        const activeDevices = config.devices.filter(d => d.isActive);
        
        for (const device of activeDevices) {
          try {
            const result = await biometricService.pullAttendanceFromDevice(
              config._id,
              device.serialNumber,
              {
                startTime: startOfDay,
                endTime: endOfDay,
                isManual: false
              },
              {
                orgId: config.org_id,
                companyId: config.company_id,
                unitId: config.unit_id._id,
                userId: null // System user
              }
            );
            
            if (result.success) {
              finalizedRecords += result.processedCount || 0;
            }
          } catch (err) {
            console.error(`[EveningSync] Error syncing device ${device.serialNumber}:`, err.message);
            errors++;
          }
        }
        
        // Update sync log
        syncLog.status = 'SUCCESS';
        syncLog.completedAt = new Date();
        await syncLog.save();
        
        syncedUnits++;
        
      } catch (err) {
        console.error(`[EveningSync] Error processing unit ${config.unit_id?.name}:`, err.message);
        errors++;
      }
    }
    
    console.log(`[EveningSync] Completed: ${syncedUnits} units synced, ${finalizedRecords} records finalized, ${errors} errors`);
    
    return {
      syncedUnits,
      finalizedRecords,
      errors,
      timestamp: now
    };
    
  } catch (err) {
    console.error('[EveningSync] Fatal error:', err);
    throw err;
  }
};

// ─── Standalone Execution (for testing) ────────────────────────────
if (require.main === module) {
  exports.runEveningSync()
    .then(result => console.log('[EveningSync] Result:', result))
    .catch(err => console.error('[EveningSync] Error:', err))
    .finally(() => process.exit(0));
}
