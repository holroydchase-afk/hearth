// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// RD-51 (Chase, Nov 17, DEC-65): a post's time reads like Instagram's, in the phone's local time.
// Written first (red). The engineer's contract: `relativeTime(iso: string, now: Date): string` in src/ui/format.ts.
// Loaded at run time so typecheck stays clean before it exists.

type Rel = (iso: string, now: Date) => string;
/* eslint-disable @typescript-eslint/no-require-imports */
const rel: Rel = (iso, now) => {
  const f = (require('../format') as { relativeTime?: Rel }).relativeTime;
  if (typeof f !== 'function') throw new Error('RD-51 relativeTime is not exported from src/ui/format.ts');
  return f(iso, now);
};

const NOW = new Date(2026, 10, 17, 18, 30, 0); // Tue Nov 17 2026, 6:30 pm local
const MIN = 60e3;
const HOUR = 60 * MIN;
const before = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m, d, h, 0, 0).toISOString();

describe('RD-51 relative time on a post', () => {
  it.each([
    ['now', 0, 'Just now'],
    ['30 seconds ago', 30e3, 'Just now'],
    ['1 minute ago', MIN, '1 minute ago'],
    ['5 minutes ago', 5 * MIN, '5 minutes ago'],
    ['59 minutes ago', 59 * MIN, '59 minutes ago'],
    ['1 hour ago', HOUR, '1 hour ago'],
    ['3 hours ago', 3 * HOUR, '3 hours ago'],
    ['18 hours ago (still today)', 18 * HOUR, '18 hours ago'],
  ])('RD-51 under a day: %s', (_n, ms, want) => {
    expect(rel(before(ms as number), NOW)).toBe(want);
  });

  it('RD-51 a clock that runs ahead (a time in the future) reads "Just now", never "-2 minutes ago"', () => {
    expect(rel(new Date(NOW.getTime() + 2 * MIN).toISOString(), NOW)).toBe('Just now');
  });

  it.each([
    ['yesterday morning', at(2026, 10, 16, 9), 'Yesterday'],
    ['two days back', at(2026, 10, 15, 9), '2 days ago'],
    ['six days back', at(2026, 10, 11, 9), '6 days ago'],
  ])('RD-51 a day or more: %s', (_n, iso, want) => {
    expect(rel(iso, NOW)).toBe(want);
  });

  it('RD-51 a week or more this year reads the month and day, "Nov 3"', () => {
    expect(rel(at(2026, 10, 10), NOW)).toBe('Nov 10');
    expect(rel(at(2026, 10, 3), NOW)).toBe('Nov 3');
    expect(rel(at(2026, 0, 2), NOW)).toBe('Jan 2');
  });

  it('RD-51 another year adds the year, "Nov 3, 2025"', () => {
    expect(rel(at(2025, 10, 3), NOW)).toBe('Nov 3, 2025');
    expect(rel(at(2025, 11, 31, 20), new Date(2026, 0, 9, 9))).toBe('Dec 31, 2025');
  });

  it('RD-51 across New Year, a few days back still reads "2 days ago"', () => {
    expect(rel(at(2025, 11, 31, 9), new Date(2026, 0, 2, 9))).toBe('2 days ago');
  });

  it('RD-51 a bad date reads nothing rather than "NaN"', () => {
    expect(rel('not a date', NOW)).toBe('');
  });
});
