// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// FLOW-15..17 (DEC-91, SPEC-SHARE-FLOW): the words and dates behind Share's day sheet. Plain functions, no phone
// APIs: names are fixed English tables so a test (and every phone) says the same thing. Days travel as `YYYY-MM-DD`.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

const two = (n: number) => String(n).padStart(2, '0');

/** A real calendar day as `YYYY-MM-DD` (month0 is 0 for January). */
export function isoDay(year: number, month0: number, day: number): string {
  return `${year}-${two(month0 + 1)}-${two(day)}`;
}

/** The local calendar day of a Date as `YYYY-MM-DD`. */
export function isoOf(d: Date): string {
  return isoDay(d.getFullYear(), d.getMonth(), d.getDate());
}

/** `YYYY-MM-DD` to its parts, or null when it is not a real day. */
export function parseIso(iso: string): { year: number; month0: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const [year, month0, day] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const t = new Date(Date.UTC(year, month0, day));
  return t.getUTCFullYear() === year && t.getUTCMonth() === month0 && t.getUTCDate() === day ? { year, month0, day } : null;
}

/** "Saturday, Nov 28": what the day chip and a day cell say. '' when it is not a real day. */
export function dayLabel(iso: string): string {
  const p = parseIso(iso);
  if (!p) return '';
  const weekday = WEEKDAYS[new Date(Date.UTC(p.year, p.month0, p.day)).getUTCDay()]!;
  return `${weekday}, ${MONTHS[p.month0]!.slice(0, 3)} ${p.day}`;
}

/** "Sat, Nov 28": the quick chip's short name for a day. */
export function shortDayLabel(iso: string): string {
  const l = dayLabel(iso);
  const [wd, rest] = l.split(', ');
  return wd && rest ? `${wd.slice(0, 3)}, ${rest}` : l;
}

/** "November 2026". */
export function monthTitle(year: number, month0: number): string {
  return `${MONTHS[month0]!} ${year}`;
}

/** The quick chips: today, tomorrow and the coming Saturday (a week out when today is a Saturday). */
export function quickDays(today: Date): { label: string; iso: string }[] {
  const at = (plus: number) => isoOf(new Date(today.getFullYear(), today.getMonth(), today.getDate() + plus));
  const untilSaturday = (6 - today.getDay() + 7) % 7 || 7;
  return [
    { label: 'Today', iso: at(0) },
    { label: 'Tomorrow', iso: at(1) },
    { label: 'Saturday', iso: at(untilSaturday) },
  ];
}

/** The month grid: weeks of seven cells, `null` before the 1st and after the last day. */
export function monthGrid(year: number, month0: number): (number | null)[][] {
  const lead = new Date(year, month0, 1).getDay();
  const total = new Date(year, month0 + 1, 0).getDate();
  const cells: (number | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** One month earlier or later. */
export function shiftMonth(year: number, month0: number, by: 1 | -1): { year: number; month0: number } {
  const t = year * 12 + month0 + by;
  return { year: Math.floor(t / 12), month0: ((t % 12) + 12) % 12 };
}
