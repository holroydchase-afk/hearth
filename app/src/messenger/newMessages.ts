// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// RD-14 (SPEC-REDESIGN 1b): how many messages came in from others since this phone last opened each chat. It
// counts relay rows only (who sent a row and its number), never decrypts or reads the words. "Last opened" is
// the highest row number seen, one KV key per person and chat, kept on this phone only (like lastSeen, OPEN-5).
// A2: nothing is sent back to anyone; no read receipts.
import { useCallback, useEffect, useState } from 'react';
import type { HearthApi } from '../api/HearthApi';
import type { KV } from '../platform/kv';
import { useApp } from '../state/AppContext';

const key = (user: string, circle: string) => `hearth.chatSeen.v1.${user}.${circle}`;
const PAGE = 500;
const POLL_MS = 120_000;

async function seenUpTo(kv: KV, user: string, circle: string): Promise<number> {
  try {
    const n = Number(await kv.getItem(key(user, circle)));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

/** New messages from others in each of my chats, by circle id (chats with none are left out). */
export async function countNewMessages(api: HearthApi, kv: KV, user: string, space: string): Promise<Record<string, number>> {
  const chats = await api.chatList(space);
  const out: Record<string, number> = {};
  await Promise.all(chats.map(async (c) => {
    try {
      const rows = await api.chatFetch(c.circle_id, await seenUpTo(kv, user, c.circle_id), PAGE);
      const n = rows.filter((r) => r.kind === 'message' && r.sender_id !== user).length;
      if (n) out[c.circle_id] = n;
    } catch { /* one chat that can't be read right now doesn't hide the others */ }
  }));
  return out;
}

/** Opening a chat marks everything in it as seen on this phone. */
export async function markChatSeen(api: HearthApi, kv: KV, user: string, circle: string): Promise<void> {
  try {
    let after = await seenUpTo(kv, user, circle);
    for (;;) {
      const rows = await api.chatFetch(circle, after, PAGE);
      if (!rows.length) break;
      after = Math.max(after, ...rows.map((r) => r.id));
      if (rows.length < PAGE) break;
    }
    await kv.setItem(key(user, circle), String(after));
  } catch { /* the count just stays until the next open */ }
  changed.forEach((f) => f());
}

const changed = new Set<() => void>();

/** The total for the More tab's dot and Messages row. Refreshes on open, every two minutes, and when a chat is opened. */
export function useNewMessages(): { total: number; refresh: () => void } {
  const app = useApp();
  const api = app.deps.api;
  const kv = app.deps.kv;
  const user = app.session?.userId ?? null;
  const space = app.space?.space_id ?? null;
  const [total, setTotal] = useState(0);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((n) => n + 1), []);
  useEffect(() => {
    if (!user || !space) return;
    let live = true;
    countNewMessages(api, kv, user, space)
      .then((m) => { if (live) setTotal(Object.values(m).reduce((a, b) => a + b, 0)); })
      .catch(() => {});
    return () => { live = false; };
  }, [api, kv, user, space, tick]);
  useEffect(() => {
    changed.add(refresh);
    const t = setInterval(refresh, POLL_MS);
    return () => { changed.delete(refresh); clearInterval(t); };
  }, [refresh]);
  return { total, refresh };
}
