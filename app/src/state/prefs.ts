// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Per-user, on-this-phone choices. Viewers start with Bigger text ON (UX-REVIEW #3, #15).
import type { Role } from '../api/HearthApi';
import type { NotificationPrefs } from '../api/types';
import type { KV } from '../platform/kv';
import { COLOR_NAMES, SCREEN_LOOKS, type ColorName, type ScreenLook } from '../ui/theme';

export type NotifyChoice = 'push' | 'evening' | 'sunday';
/** look (DS-10): light or dark screen; 'system' follows the phone. color (COLOR-3): Ember, Sage or Plum. */
export interface Prefs { bigText: boolean; notify: NotifyChoice; look: ScreenLook; color: ColorName }

/** What the server needs for each Help choice (AE-2, set_notification_prefs). */
export function serverPrefs(choice: NotifyChoice): NotificationPrefs {
  if (choice === 'evening') return { push: false, emailDigest: 'daily' };
  if (choice === 'sunday') return { push: false, emailDigest: 'weekly' };
  return { push: true, emailDigest: 'off' };
}

const key = (u: string) => `hearth.prefs.v1.${u}`;

export function defaultPrefs(role: Role): Prefs {
  return { bigText: role === 'viewer', notify: 'push', look: 'system', color: 'ember' };
}

export async function loadPrefs(kv: KV, userId: string, role: Role): Promise<Prefs> {
  const d = defaultPrefs(role);
  try {
    const raw = await kv.getItem(key(userId));
    if (!raw) return d;
    const p = JSON.parse(raw) as Partial<Prefs>;
    return {
      bigText: typeof p.bigText === 'boolean' ? p.bigText : d.bigText,
      notify: p.notify === 'evening' || p.notify === 'sunday' || p.notify === 'push' ? p.notify : d.notify,
      look: SCREEN_LOOKS.includes(p.look as ScreenLook) ? (p.look as ScreenLook) : d.look,
      color: COLOR_NAMES.includes(p.color as ColorName) ? (p.color as ColorName) : d.color,
    };
  } catch {
    return d;
  }
}

export async function savePrefs(kv: KV, userId: string, p: Prefs): Promise<void> {
  try { await kv.setItem(key(userId), JSON.stringify(p)); } catch { /* ignore */ }
}
