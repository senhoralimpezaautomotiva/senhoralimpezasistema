/**
 * Centralized Date Utilities
 * 
 * Provides a single, reliable source of truth for the current date and time across the application,
 * eliminating hardcoded values like '2026-07-15'.
 */

/**
 * Returns the current date and time.
 */
export function getCurrentDate(): Date {
  return new Date();
}

/**
 * Returns the current date formatted as YYYY-MM-DD.
 */
export function getCurrentDateStr(): string {
  const d = getCurrentDate();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns the current month prefix formatted as YYYY-MM.
 */
export function getCurrentMonthPrefix(): string {
  const d = getCurrentDate();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Returns the current year as a number.
 */
export function getCurrentYear(): number {
  return getCurrentDate().getFullYear();
}
