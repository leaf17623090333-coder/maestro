/**
 * Duration formatting and parsing utilities.
 */

/**
 * Format a number of minutes into a compact "XhYm" string.
 */
export function formatDurationMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const rem = Math.round(minutes % 60);
  return rem > 0 ? `${hours}h${rem}m` : `${hours}h`;
}

/** Format an ISO timestamp to "YYYY-MM-DD HH:MM:SS" (human-readable, no timezone). */
export function formatTimestamp(iso: string): string {
  return iso.replace('T', ' ').slice(0, 19);
}

/** Convert an ISO timestamp to a filesystem-safe string (replacing : and . with -). */
export function timestampToFilename(iso: string): string {
  return iso.replace(/[:.]/g, '-');
}

/**
 * Parse a compact duration string ("2h30m", "45m", "1h") into total minutes.
 * Returns undefined if the string contains no valid duration components.
 */
export function parseDurationMinutes(duration: string): number | undefined {
  const hoursMatch = duration.match(/(\d+)h/);
  const minutesMatch = duration.match(/(\d+)m/);
  const hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 0;
  const minutes = minutesMatch ? parseInt(minutesMatch[1], 10) : 0;
  const total = hours * 60 + minutes;
  return total > 0 ? total : undefined;
}
