// src/utils/day.js
// Utilities for consistent date handling across the application

/**
 * Get today's date in ISO format (YYYY-MM-DD)
 * @returns {string} Today's date in ISO format
 */
export function getTodayISO() {
  const today = new Date()
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset())
  return today.toISOString().slice(0, 10)
}

/**
 * Format date for display (DD/MM/YYYY)
 * @param {string} dateISO - Date in ISO format (YYYY-MM-DD)
 * @returns {string} Formatted date for display
 */
export function formatDateForDisplay(dateISO) {
  if (!dateISO) return ''
  const [year, month, day] = dateISO.split('-')
  return `${day}/${month}/${year}`
}

/**
 * Check if a date string is today
 * @param {string} dateISO - Date in ISO format (YYYY-MM-DD)
 * @returns {boolean} True if the date is today
 */
export function isToday(dateISO) {
  return dateISO === getTodayISO()
}

/**
 * Get current timestamp in ISO format
 * @returns {string} Current timestamp in ISO format
 */
export function getCurrentTimestamp() {
  return new Date().toISOString()
}

/**
 * Check if a timestamp is from the selected day
 * @param {string} timestamp - Timestamp in ISO format
 * @param {string} selectedDay - Selected day in ISO format (YYYY-MM-DD)
 * @returns {boolean} True if timestamp is from the selected day
 */
export function isFromSelectedDay(timestamp, selectedDay) {
  if (!timestamp || !selectedDay) return false
  return timestamp.slice(0, 10) === selectedDay
}

/**
 * Parse date from various formats to ISO format (YYYY-MM-DD)
 * @param {string|Date} date - Date to parse
 * @returns {string} Date in ISO format
 */
export function parseToISO(date) {
  if (!date) return getTodayISO()
  
  if (date instanceof Date) {
    const d = new Date(date)
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    return d.toISOString().slice(0, 10)
  }
  
  if (typeof date === 'string') {
    // If already in ISO format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date
    }
    
    // Try to parse and convert
    const d = new Date(date)
    if (!isNaN(d.getTime())) {
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
      return d.toISOString().slice(0, 10)
    }
  }
  
  return getTodayISO()
}
