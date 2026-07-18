// utils/timeFormat.js
// Consistent time formatting utilities for HRMS
// All times displayed in 12-hour AM/PM format

/**
 * Format time string from "HH:MM" to "hh:mm AM/PM"
 * @param {String} timeStr - Time in "HH:MM" format (e.g., "18:00")
 * @returns {String} - Formatted time (e.g., "06:00 PM")
 */
const formatTime12Hour = (timeStr) => {
  if (!timeStr || !timeStr.match(/^\d{2}:\d{2}$/)) return timeStr;
  
  const [hours, minutes] = timeStr.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12; // Convert 0 to 12 for 12 AM
  
  return `${String(displayHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`;
};

/**
 * Format Date object to "hh:mm AM/PM"
 * @param {Date} date - Date object
 * @returns {String} - Formatted time (e.g., "06:30 PM")
 */
const formatDateToTime12Hour = (date) => {
  if (!date) return '';
  
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  
  return `${String(displayHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`;
};

/**
 * Format Date object to full datetime string with AM/PM
 * @param {Date} date - Date object
 * @returns {String} - Formatted datetime (e.g., "2025-07-17 06:30 PM")
 */
const formatDateTime12Hour = (date) => {
  if (!date) return '';
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  
  return `${year}-${month}-${day} ${String(displayHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`;
};

/**
 * Format hours (decimal) to readable string
 * @param {Number} hours - Hours in decimal (e.g., 8.5)
 * @returns {String} - Formatted string (e.g., "8h 30m")
 */
const formatHoursToReadable = (hours) => {
  if (!hours && hours !== 0) return '0h 0m';
  
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  
  return `${h}h ${m}m`;
};

/**
 * Format shift time range for display
 * @param {String} startTime - Start time in "HH:MM" format
 * @param {String} endTime - End time in "HH:MM" format
 * @param {Boolean} isNextDay - Night shift flag
 * @returns {String} - Formatted range (e.g., "06:00 PM - 02:00 AM (Next Day)")
 */
const formatShiftRange = (startTime, endTime, isNextDay = false) => {
  const startFormatted = formatTime12Hour(startTime);
  const endFormatted = formatTime12Hour(endTime);
  const nextDayLabel = isNextDay ? ' (Next Day)' : '';
  
  return `${startFormatted} - ${endFormatted}${nextDayLabel}`;
};

/**
 * Parse 12-hour time string to 24-hour format
 * @param {String} timeStr - Time in "hh:mm AM/PM" format
 * @returns {String} - Time in "HH:MM" format
 */
const parseTimeTo24Hour = (timeStr) => {
  if (!timeStr) return '';
  
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return timeStr;
  
  let [_, hours, minutes, period] = match;
  hours = parseInt(hours);
  
  if (period.toUpperCase() === 'PM' && hours !== 12) {
    hours += 12;
  } else if (period.toUpperCase() === 'AM' && hours === 12) {
    hours = 0;
  }
  
  return `${String(hours).padStart(2, '0')}:${minutes}`;
};

/**
 * Get current time in 12-hour format
 * @returns {String} - Current time (e.g., "06:30 PM")
 */
const getCurrentTime12Hour = () => {
  return formatDateToTime12Hour(new Date());
};

module.exports = {
  formatTime12Hour,
  formatDateToTime12Hour,
  formatDateTime12Hour,
  formatHoursToReadable,
  formatShiftRange,
  parseTimeTo24Hour,
  getCurrentTime12Hour
};
