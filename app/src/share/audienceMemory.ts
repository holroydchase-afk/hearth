// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// BETA-AUD-2 / B8: the share sheet preselects THIS user's last audience, never anyone else's.
// The key includes the user id so two people on one phone never inherit each other's choice.
import type { KV } from '../platform/kv';

const key = (userId: string) => `hearth.lastAudience.v1.${userId}`;

export async function loadLastAudience(kv: KV, userId: string, available: string[]): Promise<string[]> {
  try {
    const raw = await kv.getItem(key(userId));
    if (!raw) return [];
    const ids: unknown = JSON.parse(raw);
    if (!Array.isArray(ids)) return [];
    const ok = new Set(available);
    return ids.filter((x): x is string => typeof x === 'string' && ok.has(x));
  } catch {
    return [];
  }
}

export async function saveLastAudience(kv: KV, userId: string, ids: string[]): Promise<void> {
  try {
    await kv.setItem(key(userId), JSON.stringify(ids));
  } catch {
    // Not worth bothering anyone about.
  }
}

// SHARE-ST-16 (DEC-79): "Last shared <day>, to <names>" under Share's empty postcard. When the last post went and to
// which groups (ids only), on this phone, per user. Never names, captions or photos.
const sentKey = (userId: string) => `hearth.lastShared.v1.${userId}`;
export interface LastShared { at: string; ids: string[] }

export async function saveLastShared(kv: KV, userId: string, ids: string[], at: Date = new Date()): Promise<void> {
  try {
    await kv.setItem(sentKey(userId), JSON.stringify({ at: at.toISOString(), ids }));
  } catch {
    // Not worth bothering anyone about.
  }
}

export async function loadLastShared(kv: KV, userId: string): Promise<LastShared | null> {
  try {
    const raw = await kv.getItem(sentKey(userId));
    if (!raw) return null;
    const v: unknown = JSON.parse(raw);
    if (!v || typeof v !== 'object') return null;
    const { at, ids } = v as Record<string, unknown>;
    if (typeof at !== 'string' || Number.isNaN(Date.parse(at)) || !Array.isArray(ids)) return null;
    return { at, ids: ids.filter((x): x is string => typeof x === 'string') };
  } catch {
    return null;
  }
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "today", a weekday within the last 6 days ("Tuesday"), else the date ("Nov 3"), in the phone's time zone. */
export function sharedDay(at: Date, now: Date = new Date()): string {
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(now) - day(at)) / 86_400_000);
  if (days <= 0) return 'today';
  if (days < 7) return DAYS[at.getDay()]!;
  return `${MONTHS[at.getMonth()]} ${at.getDate()}`;
}
