// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// RD-18 (SPEC-REDESIGN 1c): Gallery's grid. Every ready photo by month, newest first. A post sorts by the date its
// photos were taken when the phone knew it, otherwise the date it was shared (QA-R2, like Apple Photos), so a
// bulk import of old photos lands in its own months instead of on top. A post's photos keep their order.
// Months are the phone's local time with plain Date math (like feed/timeline.ts).
import type { FeedPost } from '../api/HearthApi';
import { shortDate } from '../ui/format';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export interface GridTile { postId: string; mediaId: string; index: number; label: string }
export interface GridMonth { key: string; title: string; tiles: GridTile[] }

/** When a post sits in the grid: taken if known and valid, else shared. */
export function gridDate(p: Pick<FeedPost, 'taken_at' | 'published_at'>): string {
  return p.taken_at && !Number.isNaN(Date.parse(p.taken_at)) ? p.taken_at : p.published_at;
}

export function galleryMonths(posts: FeedPost[]): GridMonth[] {
  const sorted = posts
    .map((p, i) => ({ p, i, at: Date.parse(gridDate(p)) }))
    .sort((a, b) => b.at - a.at || a.i - b.i) // ties keep the feed's order
    .map((x) => x.p);
  const out: GridMonth[] = [];
  for (const p of sorted) {
    const iso = gridDate(p);
    const d = new Date(iso);
    const title = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    let m = out[out.length - 1];
    if (!m || m.title !== title) out.push((m = { key: title, title, tiles: [] }));
    // OPEN-10: the spoken label names the sender and the day.
    const label = `Open photo from ${p.author_name}, ${shortDate(iso)}, full screen`;
    p.media.filter((x) => x.status === 'ready').forEach((x, index) => m!.tiles.push({ postId: p.post_id, mediaId: x.media_id, index, label }));
  }
  return out.filter((m) => m.tiles.length);
}
