// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// RD-11 (SPEC-REDESIGN 1b): Gallery's large title. "Good morning" before noon, "Good afternoon" 12:00-16:59,
// "Good evening" from 17:00, then the name the family gave this person. No name yet: the greeting alone.

export function greeting(now: Date, name: string | null): string {
  const h = now.getHours();
  const part = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  const who = name?.trim();
  return who ? `Good ${part}, ${who}` : `Good ${part}`;
}
