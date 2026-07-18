#!/usr/bin/env node
/**
 * Test script to verify night shift validation logic
 * Run: node test_night_shift_validation.js
 */

const moment = require('moment-timezone');
const { validateShiftWindowTimezone } = require('./utils/timezone.js');

console.log('\n=== NIGHT SHIFT VALIDATION TEST ===\n');

const shiftStart = '21:00';
const shiftEnd = '05:00';
const isNextDay = true;
const timezone = 'Asia/Kolkata';
const policy = { allowEarlyMinutes: 30 };

// Test scenarios
const tests = [
  {
    name: 'Punch at 00:55 AM (after midnight)',
    punchTime: '2025-01-10T19:25:00Z', // Thursday 19:25 UTC = Friday 00:55 IST
    expected: { isValid: true, shouldFail: false }
  },
  {
    name: 'Punch at 02:30 AM (after midnight)',
    punchTime: '2025-01-10T21:00:00Z', // Thursday 21:00 UTC = Friday 02:30 IST
    expected: { isValid: true, shouldFail: false }
  },
  {
    name: 'Punch at 22:00 (before midnight)',
    punchTime: '2025-01-10T16:30:00Z', // Thursday 16:30 UTC = Thursday 22:00 IST
    expected: { isValid: true, shouldFail: false }
  },
  {
    name: 'Punch at 19:00 (too early)',
    punchTime: '2025-01-10T13:30:00Z', // Thursday 13:30 UTC = Thursday 19:00 IST
    expected: { isValid: false, shouldFail: true, reason: 'too early' }
  },
  {
    name: 'Punch at 06:00 (after shift ended)',
    punchTime: '2025-01-11T00:30:00Z', // Friday 00:30 UTC = Friday 06:00 IST
    expected: { isValid: false, shouldFail: true, reason: 'too late or outside window' }
  }
];

let passed = 0;
let failed = 0;

tests.forEach((test, i) => {
  const punchTime = new Date(test.punchTime);
  const result = validateShiftWindowTimezone(
    punchTime,
    shiftStart,
    shiftEnd,
    isNextDay,
    15,
    timezone,
    policy
  );
  
  const punchInOrg = moment(punchTime).tz(timezone).format('YYYY-MM-DD hh:mm A');
  
  console.log(`\nTest ${i + 1}: ${test.name}`);
  console.log(`  Punch time: ${punchInOrg} IST`);
  console.log(`  Shift: ${shiftStart} - ${shiftEnd} (Next Day: ${isNextDay})`);
  console.log(`  Result: Valid=${result.isValid}, TooEarly=${result.isTooEarly}, TooLate=${result.isTooLate}`);
  
  if (result.isValid === test.expected.isValid) {
    console.log(`  ✅ PASS - Expected isValid=${test.expected.isValid}, Got ${result.isValid}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL - Expected isValid=${test.expected.isValid}, Got ${result.isValid}`);
    if (result.reason) {
      console.log(`  Reason: ${result.reason}`);
    }
    failed++;
  }
  
  // Additional debug info
  console.log(`  Window: ${moment(result.windowOpen).tz(timezone).format('hh:mm A')} - ${moment(result.windowClose).tz(timezone).format('hh:mm A')}`);
  console.log(`  Shift: ${moment(result.shiftStart).tz(timezone).format('MMM DD hh:mm A')} - ${moment(result.shiftEnd).tz(timezone).format('MMM DD hh:mm A')}`);
});

console.log('\n' + '='.repeat(50));
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log('='.repeat(50) + '\n');

if (failed > 0) {
  process.exit(1);
}
