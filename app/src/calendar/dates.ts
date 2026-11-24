// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Life calendar v1 (SPEC-LIFE-CALENDAR, CAL-14, CAL-16): dates in words and how soon they come, on the phone's own
// date. Month and day only: nothing here knows or shows a year or an age (CAL-9).
import type { FamilyDate } from '../api/HearthApi';

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** How many days a month can have (February 29 allowed). */
export const daysIn = (month: number): number => MONTH_DAYS[month - 1] ?? 31;

/** "December 8". */
export const dateWords = (month: number, day: number): string => `${MONTHS[month - 1] ?? ''} ${day}`;

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
/** This date's day in year y: Feb 29 falls on Feb 28 in a year without one (CAL-16). */
const occurrence = (y: number, month: number, day: number) =>
  new Date(y, month - 1, month === 2 && day === 29 && !isLeap(y) ? 28 : day);

/** Whole days from today (0) to the date's next time, counted on the phone's own calendar. */
export function daysUntil(month: number, day: number, now: Date = new Date()): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = occurrence(today.getFullYear(), month, day);
  if (next < today) next = occurrence(today.getFullYear() + 1, month, day);
  return Math.round((next.getTime() - today.getTime()) / 864e5);
}

/** "Today", "Tomorrow", "In 5 days" up to 30 days; null after that (the date alone is shown). */
export function whenWords(days: number): string | null {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return days <= 30 ? `In ${days} days` : null;
}

/** What a date is called: "Grandma Jo's birthday", "Mia's birthday", "Chase and Alex's anniversary", "Family reunion". */
export function dateName(d: Pick<FamilyDate, 'kind' | 'label' | 'member_name'>): string {
  const who = (d.member_name ?? d.label ?? '').trim();
  if (d.kind === 'birthday') return `${who}'s birthday`;
  if (d.kind === 'anniversary') return `${who}'s anniversary`;
  return who;
}

/** Every date, soonest first from today (CAL-14). */
export function soonestFirst<T extends Pick<FamilyDate, 'month' | 'day'>>(dates: T[], now: Date = new Date()): (T & { days: number })[] {
  return dates.map((d) => ({ ...d, days: daysUntil(d.month, d.day, now) })).sort((a, b) => a.days - b.days);
}

/** The Gallery line (CAL-16): "Today is Grandma Jo's birthday", or "Today: Grandma Jo's birthday and 1 more". */
export function todayLine(dates: FamilyDate[], now: Date = new Date()): string | null {
  const today = dates.filter((d) => daysUntil(d.month, d.day, now) === 0);
  if (!today.length) return null;
  const first = dateName(today[0]!);
  return today.length === 1 ? `Today is ${first}` : `Today: ${first} and ${today.length - 1} more`;
}
