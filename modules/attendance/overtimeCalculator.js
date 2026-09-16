"use strict";

/**
 * Applies attendance-policy eligibility and daily limits to detected overtime.
 * @param {number} detectedHours Hours worked beyond the employee's shift.
 * @param {object | undefined} overtimePolicy Resolved attendance policy overtime settings.
 * @returns {number} Credited overtime hours, rounded to two decimals.
 */
const calculatePolicyOvertime = (detectedHours, overtimePolicy) => {
  if (!overtimePolicy?.enabled || !Number.isFinite(detectedHours) || detectedHours <= 0) {
    return 0;
  }

  const detectedMinutes = detectedHours * 60;
  const minimumMinutes = overtimePolicy.minimumMinutes ?? 60;
  if (detectedMinutes < minimumMinutes) return 0;

  const maxHoursPerDay = overtimePolicy.maxHoursPerDay ?? 4;
  const creditedHours = Math.min(detectedHours, maxHoursPerDay);
  return Number(creditedHours.toFixed(2));
};

module.exports = { calculatePolicyOvertime };