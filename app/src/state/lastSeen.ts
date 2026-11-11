// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// OPEN-5: "last visit" is kept on this phone only (one KV key per person, an ISO time). Never sent to the server.
import type { KV } from '../platform/kv';

const key = (u: string) => `hearth.lastSeen.v1.${u}`;

/** The last visit, or null on a first open or when the stored value is damaged or unreadable. */
export async function loadLastSeen(kv: KV, userId: string): Promise<string | null> {
  try {
    const raw = await kv.getItem(key(userId));
    return raw && !Number.isNaN(Date.parse(raw)) ? raw : null;
  } catch {
    return null;
  }
}

export async function saveLastSeen(kv: KV, userId: string, iso: string): Promise<void> {
  try { await kv.setItem(key(userId), iso); } catch { /* ignore: the next open just shows a little more */ }
}
