// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// OPEN-1/2/5/8 (docs/product/SPEC-OPENING.md, DEC-58): what's new since this person's last visit on this phone.

const LONG_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Others' posts published after the last visit, oldest first so the story reads in order. None on a first open. */
export function newForYou<T extends { author_id: string; published_at: string }>(posts: T[], lastSeen: string | null, me: string): T[] {
  const since = lastSeen ? Date.parse(lastSeen) : NaN;
  if (Number.isNaN(since)) return [];
  return posts
    .filter((p) => p.author_id !== me && Date.parse(p.published_at) > since)
    .sort((a, b) => Date.parse(a.published_at) - Date.parse(b.published_at));
}

/** "Today", "Yesterday", a weekday within 6 days, else "Nov 4": calendar days in the phone's local time. */
export function newSinceDay(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const back = Math.round((day(now) - day(d)) / 864e5);
  if (back <= 0) return 'Today';
  if (back === 1) return 'Yesterday';
  if (back <= 6) return LONG_DAYS[d.getDay()]!;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}
