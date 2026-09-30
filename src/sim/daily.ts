// Today's lab (FLT-11): one seed per calendar date, the same for everyone, so friends play the same campus and compare
// run summaries. Pure: the app reads the date (the sim never touches a clock) and hands over the key.

/** "2026-09-30": the date key a daily lab is named by. The app passes the player's local date. */
export const dateKey = (y: number, m: number, d: number): string => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** A well-mixed, non-zero 32-bit seed for a date key (FNV-1a, then a murmur finaliser). */
export function dailySeed(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 0x01000193);
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) || 1;
}

/** "Sep 30, 2026" for the badge and the run summary. */
export function dailyLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${MONTHS[(m ?? 1) - 1] ?? "?"} ${d}, ${y}`;
}
