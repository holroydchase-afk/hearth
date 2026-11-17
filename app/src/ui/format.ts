// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Sun, Oct 11" in the phone's local time. No Intl dependency (old Android/Hermes builds). */
export function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${DAYS[d.getDay()]}, ${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** UX-R37: a no-break space (U+00A0) so the number and its word never wrap apart. */
export const people = (n: number) => `${n}\u00a0${n === 1 ? 'person' : 'people'}`;
export const photos = (n: number) => `${n} ${n === 1 ? 'photo' : 'photos'}`;

/** "Chase", "Chase and Alex", "Chase, Alex and Jo" */
export function andList(names: string[]): string {
  const u = [...new Set(names.filter(Boolean))];
  if (u.length <= 1) return u[0] ?? '';
  return `${u.slice(0, -1).join(', ')} and ${u[u.length - 1]}`;
}

/** UI-27 / FIRSTMIN-1: the avatar initials. The first letters of the first two words, after skipping a
 *  leading "The" ("The Holroyds" → "H", "Grandma Jo" → "GJ"); one word stays one letter; "?" when there's no name. */
export function initialOf(name: string): string {
  const all = name.trim().split(/\s+/).filter(Boolean);
  const words = all.length > 1 && all[0]?.toLowerCase() === 'the' ? all.slice(1) : all;
  const letters = words.slice(0, 2).map((w) => w.slice(0, 1).toUpperCase()).join('');
  return letters || '?';
}

/** RD-51 (DEC-65): a post's time, like Instagram's, in the phone's local time. "Just now" under a minute (or a clock
 *  that runs ahead), "5 minutes ago", "3 hours ago" under a day, then by calendar day "Yesterday", "2 days ago" up to
 *  "6 days ago", then "Nov 3", and "Nov 3, 2025" for another year. A bad date reads nothing. */
export function relativeTime(iso: string, now: Date): string {
  const d = new Date(iso);
  const t = d.getTime();
  if (Number.isNaN(t)) return '';
  const ms = now.getTime() - t;
  if (ms < 60e3) return 'Just now';
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'} ago`;
  if (ms < 3600e3) return plural(Math.floor(ms / 60e3), 'minute');
  if (ms < 24 * 3600e3) return plural(Math.floor(ms / 3600e3), 'hour');
  const midnight = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((midnight(now) - midnight(d)) / (24 * 3600e3)); // round: a DST day is 23 or 25 hours
  if (days <= 1) return 'Yesterday';
  if (days <= 6) return `${days} days ago`;
  const md = `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`;
  return d.getFullYear() === now.getFullYear() ? md : `${md}, ${d.getFullYear()}`;
}

/** RD-45: "October 17", the full month name and the day, for a spoken label. */
export function longDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${LONG_MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export const LONG_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
