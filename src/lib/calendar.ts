/**
 * Factory working-days calendar utilities.
 * Pure functions — no network, no store. Works offline.
 */

/**
 * Count working days between two dates (inclusive).
 * Excludes weekly off-days and specific holiday dates.
 */
export function countWorkingDays(
  start: string,
  end: string,
  weeklyOff: number[],
  holidays: string[],
): number {
  if (!start || !end || start > end) return 0;
  const holidaySet = new Set(holidays);
  let count = 0;
  const d = new Date(start + "T00:00:00");
  const endDate = new Date(end + "T00:00:00");
  while (d <= endDate) {
    const dow = d.getDay(); // 0=Sun, 6=Sat
    const iso = d.toISOString().slice(0, 10);
    if (!weeklyOff.includes(dow) && !holidaySet.has(iso)) {
      count++;
    }
    d.setDate(d.getDate() + 1);
  }
  return count;
}

/**
 * Get tomorrow's date as YYYY-MM-DD.
 */
export function tomorrow(today: string): string {
  const d = new Date(today + "T00:00:00");
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Add N working days to a start date. Returns the resulting date.
 */
export function addWorkingDays(
  start: string,
  days: number,
  weeklyOff: number[],
  holidays: string[],
): string {
  if (days <= 0) return start;
  const holidaySet = new Set(holidays);
  const d = new Date(start + "T00:00:00");
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    const iso = d.toISOString().slice(0, 10);
    if (!weeklyOff.includes(dow) && !holidaySet.has(iso)) {
      added++;
    }
  }
  return d.toISOString().slice(0, 10);
}
