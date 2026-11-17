// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// RD-18, RD-44, RD-56 (SPEC-REDESIGN; DEC-65, UX-R13): Gallery's months, like the newest Apple Photos. Every ready
// photo by month, newest first, then by day within the month. A post sorts by the date its photos were taken when the
// phone knew it, otherwise the date it was shared (QA-R2, like Apple Photos), so a bulk import of old photos lands in
// its own months instead of on top. Each MONTH opens on one wide photo (the month's most-loved post's first photo,
// else the newest), then squares. Days with fewer than 3 photos join the next older days into one group ("Nov 11–15");
// a group never crosses a month, and no square is left alone in a row. Months and days are the phone's local time with
// plain Date math (like feed/timeline.ts). Pure: the screen only draws what this returns.
import type { FeedPost } from '../api/HearthApi';
import { LONG_MONTHS, SHORT_MONTHS, longDay } from '../ui/format';

export interface GridTile {
  postId: string; mediaId: string; index: number; label: string;
  /** The month's first photo: full width, 3:2. */
  wide: boolean;
  /** When the photo sits in the grid (ms): the group's date label is built from these. */
  at: number;
}
/** A day, or a range of quiet days, with its date label ("Oct 17", "Nov 11–15"). */
export interface GridGroup { key: string; label: string; tiles: GridTile[] }
export interface GridMonth { key: string; title: string; groups: GridGroup[]; tiles: GridTile[] }

/** A group holds at least this many photos before the next older day starts its own (UX-R13). */
const FULL_GROUP = 3;

/** When a post sits in the grid: taken if known and valid, else shared. */
export function gridDate(p: Pick<FeedPost, 'taken_at' | 'published_at'>): string {
  return p.taken_at && !Number.isNaN(Date.parse(p.taken_at)) ? p.taken_at : p.published_at;
}

/** How loved a post is: every reaction counts once (hearts only on an older server). */
export function loveOf(p: Pick<FeedPost, 'reaction_counts' | 'heart_count'>): number {
  const counts = p.reaction_counts ? Object.values(p.reaction_counts) : [p.heart_count ?? 0];
  return counts.reduce<number>((a, b) => a + (Number(b) || 0), 0);
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export function galleryMonths(posts: FeedPost[]): GridMonth[] {
  const sorted = posts
    .map((p, i) => ({ p, i, at: Date.parse(gridDate(p)) }))
    .sort((a, b) => b.at - a.at || a.i - b.i) // ties keep the feed's order
    .map((x) => x.p)
    .filter((p) => p.media.some((m) => m.status === 'ready'));
  const months: { key: string; title: string; posts: FeedPost[] }[] = [];
  for (const p of sorted) {
    const d = new Date(gridDate(p));
    const title = `${LONG_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    let m = months[months.length - 1];
    if (!m || m.title !== title) months.push((m = { key: title, title, posts: [] }));
    m.posts.push(p);
  }
  return months.map((m) => {
    const groups = monthGroups(m.posts).map((tiles) => ({ key: `${m.key}-${tiles[0]!.mediaId}`, label: groupLabel(tiles), tiles }));
    return { key: m.key, title: m.title, groups, tiles: groups.flatMap((g) => g.tiles) };
  });
}

/** One month's photos (posts newest first) as groups of tiles; the first tile of the first group is the wide one. */
function monthGroups(posts: FeedPost[]): GridTile[][] {
  // By day, newest first.
  const days: { key: string; tiles: GridTile[] }[] = [];
  for (const p of posts) {
    const at = Date.parse(gridDate(p));
    const key = dayKey(new Date(at));
    let d = days[days.length - 1];
    if (!d || d.key !== key) days.push((d = { key, tiles: [] }));
    // OPEN-10 and RD-45: the spoken label names the sender and the full date.
    const label = `Open photo from ${p.author_name}, ${longDay(gridDate(p))}, full screen`;
    p.media.filter((x) => x.status === 'ready').forEach((x, index) =>
      d!.tiles.push({ postId: p.post_id, mediaId: x.media_id, index, label, wide: false, at }));
  }
  // UX-R13: a quiet day joins the next older days until the group holds FULL_GROUP photos.
  const groups: GridTile[][] = [];
  for (const d of days) {
    const last = groups[groups.length - 1];
    if (last && last.length < FULL_GROUP) last.push(...d.tiles);
    else groups.push([...d.tiles]);
  }
  // The most-loved post wins the month's wide tile (its first photo); a tie, or no love at all, goes to the newest.
  let best = posts[0]!;
  for (const p of posts) if (loveOf(p) > loveOf(best)) best = p;
  const gi = Math.max(0, groups.findIndex((g) => g.some((t) => t.postId === best.post_id)));
  const ti = Math.max(0, groups[gi]!.findIndex((t) => t.postId === best.post_id));
  const [hero] = groups[gi]!.splice(ti, 1);
  groups[0]!.unshift({ ...hero!, wide: true });
  // No lone square: a later group left with one photo (or none) joins the group before it.
  for (let i = groups.length - 1; i >= 1; i--) {
    if (groups[i]!.length < 2) groups.splice(i - 1, 2, [...groups[i - 1]!, ...groups[i]!]);
  }
  return groups;
}

/** "Oct 17" for one day; "Nov 11–15" for a range (a group never crosses a month). */
function groupLabel(tiles: GridTile[]): string {
  const days = tiles.map((t) => new Date(t.at).getDate());
  const first = Math.min(...days);
  const last = Math.max(...days);
  const month = SHORT_MONTHS[new Date(tiles[0]!.at).getMonth()];
  return first === last ? `${month} ${first}` : `${month} ${first}–${last}`;
}

/** How many squares go in each row: three across, and never one alone (a 4 becomes 2 + 2). */
function squareRows(n: number, across: number): number[] {
  if (n <= across) return n ? [n] : [];
  const sizes: number[] = [];
  let left = n;
  while (left > across + 1) { sizes.push(across); left -= across; }
  // left is now 2..across+1: split a 4 into 2 + 2 so no row holds one square.
  if (left === across + 1) sizes.push(2, left - 2);
  else sizes.push(left);
  return sizes;
}

/** The rows a group draws: a wide tile alone, then squares up to three to a row, never one square alone (UX-R13). */
export function mosaicRows<T extends { wide: boolean }>(tiles: T[], across = 3): T[][] {
  const rows: T[][] = [];
  let run: T[] = [];
  const flush = () => {
    let at = 0;
    for (const k of squareRows(run.length, across)) { rows.push(run.slice(at, at + k)); at += k; }
    run = [];
  };
  for (const t of tiles) {
    if (t.wide) { flush(); rows.push([t]); } else run.push(t);
  }
  flush();
  return rows;
}
