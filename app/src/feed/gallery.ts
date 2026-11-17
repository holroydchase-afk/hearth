// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// RD-18, RD-44, RD-45 (SPEC-REDESIGN; DEC-65): Gallery's months, like the newest Apple Photos. Every ready photo by
// month, newest first, then by day within the month. A post sorts by the date its photos were taken when the phone
// knew it, otherwise the date it was shared (QA-R2, like Apple Photos), so a bulk import of old photos lands in its
// own months instead of on top. Each day group opens on one wide photo (the most-loved post's first photo, else the
// newest), then the rest as squares three across, newest first. Months and days are the phone's local time with
// plain Date math (like feed/timeline.ts). Pure: the screen only draws what this returns.
import type { FeedPost } from '../api/HearthApi';
import { LONG_MONTHS, longDay } from '../ui/format';

export interface GridTile {
  postId: string; mediaId: string; index: number; label: string;
  /** The group's first photo: full width, 3:2, with the day number on it. */
  wide: boolean;
  /** The day number shown on the wide tile ("17"); null on the squares. */
  day: string | null;
}
export interface GridGroup { key: string; tiles: GridTile[] }
export interface GridMonth { key: string; title: string; groups: GridGroup[]; tiles: GridTile[] }

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
  // Month, then day: posts newest first in each.
  const months: { key: string; title: string; days: { key: string; date: Date; posts: FeedPost[] }[] }[] = [];
  for (const p of sorted) {
    const d = new Date(gridDate(p));
    const title = `${LONG_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    let m = months[months.length - 1];
    if (!m || m.title !== title) months.push((m = { key: title, title, days: [] }));
    let g = m.days[m.days.length - 1];
    if (!g || g.key !== dayKey(d)) m.days.push((g = { key: dayKey(d), date: d, posts: [] }));
    g.posts.push(p);
  }
  return months.map((m) => {
    const groups = m.days.map((g) => ({ key: g.key, tiles: dayTiles(g.posts, g.date) }));
    return { key: m.key, title: m.title, groups, tiles: groups.flatMap((g) => g.tiles) };
  });
}

/** One day's photos: the wide opener first, then the rest newest first. posts are newest first. */
export function dayTiles(posts: FeedPost[], date: Date): GridTile[] {
  const all: GridTile[] = [];
  for (const p of posts) {
    // OPEN-10 and RD-45: the spoken label names the sender and the full date.
    const label = `Open photo from ${p.author_name}, ${longDay(gridDate(p))}, full screen`;
    p.media.filter((x) => x.status === 'ready').forEach((x, index) =>
      all.push({ postId: p.post_id, mediaId: x.media_id, index, label, wide: false, day: null }));
  }
  if (!all.length) return all;
  // The most-loved post wins the wide tile (its first photo); a tie, or no love at all, goes to the newest.
  let best = posts[0]!;
  for (const p of posts) if (loveOf(p) > loveOf(best)) best = p;
  const at = Math.max(0, all.findIndex((t) => t.postId === best.post_id));
  const [hero] = all.splice(at, 1);
  return [{ ...hero!, wide: true, day: String(date.getDate()) }, ...all];
}

/** The rows a group draws: the wide tile alone, then squares three to a row (the last row may be short). */
export function mosaicRows<T extends { wide: boolean }>(tiles: T[], across = 3): T[][] {
  const rows: T[][] = [];
  for (const t of tiles) {
    const last = rows[rows.length - 1];
    if (t.wide || !last || last[0]!.wide || last.length >= across) rows.push([t]);
    else last.push(t);
  }
  return rows;
}
