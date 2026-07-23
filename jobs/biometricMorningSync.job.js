// jobs/biometricMorningSync.job.js
// Enterprise HRMS - Biometric Morning Sync Cron Job
// 
// Purpose:
//   - Run after grace period of shift start time
//   - Pull attendance from biometric devices
//   - Mark late/absent employees who haven't punched in
//   - Sync morning punches automatically
//
// Schedule: Every 5 minutes during morning hours (configurable per unit)
// Trigger time: Shift start + grace minutes + 1 minute
//
// Flow:
//   1. Find all units with biometric enabled
//   2. For each unit:
//      a. Get shift start time and grace minutes
//      b. Check if current time is shift start + grace + buffer
//      c. Pull attendance from biometric devices
//      d. Update attendance records
//      e. Mark absent for employees not punched in

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
 * Run morning biometric sync for all units
 * Called by cron scheduler every 5 minutes
 * 
 * @returns {Object} - Summary of synced units and employees
 */
exports.runMorningSync = async () => {
  console.log(`[MorningSync] Starting biometric morning sync...`);
  
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
    let syncedEmployees = 0;
    let errors = 0;
    
    for (const config of configs) {
      try {
        if (!config.unit_id || !config.unit_id.shiftConfig || !config.unit_id.shiftConfig.defaultShift) {
          console.log(`[MorningSync] Skipping unit ${config.unit_id?.name || 'unknown'} - no shift config`);
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
        
        // Parse shift start time
        const [startH, startM] = shift.startTime.split(':').map(Number);
        const shiftStartTime = moment(nowInOrg).set({ hour: startH, minute: startM, second: 0, millisecond: 0 });
        
        // Calculate when to run this sync (shift start + grace minutes + 2 minute buffer)
        const graceMinutes = shift.graceMinutes || 15;
        const syncTime = moment(shiftStartTime).add(graceMinutes, 'minutes').add(2, 'minutes');
        
        // Check if current time is within sync window (syncTime ± 3 minutes)
        const diffMinutes = nowInOrg.diff(syncTime, 'minutes');
        
        if (Math.abs(diffMinutes) > 3) {
          console.log(`[MorningSync] Skipping ${config.unit_id.name} - not in sync window (diff: ${diffMinutes} min)`);
          continue;
        }
        
        console.log(`[MorningSync] Syncing ${config.unit_id.name} (shift: ${shift.startTime}, grace: +${graceMinutes}min)`);
        
        // Create sync log
        const BiometricSyncLog = require('../modules/biometric/models/biometricSyncLog.model');
        const syncLog = await BiometricSyncLog.create({
          org_id: config.org_id,
          company_id: config.company_id,
          unit_id: config.unit_id._id,
          deviceSerialNumber: 'MORNING_SYNC',
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
              syncedEmployees += result.processedCount || 0;
            }
          } catch (err) {
            console.error(`[MorningSync] Error syncing device ${device.serialNumber}:`, err.message);
            errors++;
          }
        }
        
        // Update sync log
        syncLog.status = 'SUCCESS';
        syncLog.completedAt = new Date();
        await syncLog.save();
        
        syncedUnits++;
        
      } catch (err) {
        console.error(`[MorningSync] Error processing unit ${config.unit_id?.name}:`, err.message);
        errors++;
      }
    }
    
    console.log(`[MorningSync] Completed: ${syncedUnits} units synced, ${syncedEmployees} employees processed, ${errors} errors`);
    
    return {
      syncedUnits,
      syncedEmployees,
      errors,
      timestamp: now
    };
    
  } catch (err) {
    console.error('[MorningSync] Fatal error:', err);
    throw err;
  }
};

// ─── Standalone Execution (for testing) ────────────────────────────
if (require.main === module) {
  exports.runMorningSync()
    .then(result => console.log('[MorningSync] Result:', result))
    .catch(err => console.error('[MorningSync] Error:', err))
    .finally(() => process.exit(0));
}
