// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Per-user, on-this-phone choices. RD-74 / RD-75 (DEC-66): Easy view (words under the tabs, bigger text) replaces
// Bigger text; viewers start with it On, owners and adults Off. A saved `bigText` from before becomes `easyView`.
import type { Role } from '../api/HearthApi';
import type { NotificationPrefs } from '../api/types';
import type { KV } from '../platform/kv';
import { COLOR_NAMES, SCREEN_LOOKS, type ColorName, type ScreenLook } from '../ui/theme';

export type NotifyChoice = 'push' | 'evening' | 'sunday';
/** look (DS-10): light or dark screen; 'system' follows the phone. color (RD-25): the family color, Ember, Forest or
 *  Plum, picked by the family's owner and saved on the owner's phone only (phase 1). */
export interface Prefs { easyView: boolean; notify: NotifyChoice; look: ScreenLook; color: ColorName }

/** What the server needs for each Help choice (AE-2, set_notification_prefs). */
export function serverPrefs(choice: NotifyChoice): NotificationPrefs {
  if (choice === 'evening') return { push: false, emailDigest: 'daily' };
  if (choice === 'sunday') return { push: false, emailDigest: 'weekly' };
  return { push: true, emailDigest: 'off' };
}

const key = (u: string) => `hearth.prefs.v1.${u}`;

export function defaultPrefs(role: Role): Prefs {
  return { easyView: role === 'viewer', notify: 'push', look: 'system', color: 'ember' };
}

/** RD-25: only the owner's saved pick counts; COLOR-1's old Sage is now Forest; anything else is Ember. */
function familyColor(saved: unknown, role: Role): ColorName {
  if (role !== 'owner') return 'ember';
  const v = saved === 'sage' ? 'forest' : saved;
  return COLOR_NAMES.includes(v as ColorName) ? (v as ColorName) : 'ember';
}

export async function loadPrefs(kv: KV, userId: string, role: Role): Promise<Prefs> {
  const d = defaultPrefs(role);
  try {
    const raw = await kv.getItem(key(userId));
    if (!raw) return d;
    const p = JSON.parse(raw) as Partial<Prefs> & { bigText?: unknown };
    return {
      easyView: typeof p.easyView === 'boolean' ? p.easyView : typeof p.bigText === 'boolean' ? p.bigText : d.easyView,
      notify: p.notify === 'evening' || p.notify === 'sunday' || p.notify === 'push' ? p.notify : d.notify,
      look: SCREEN_LOOKS.includes(p.look as ScreenLook) ? (p.look as ScreenLook) : d.look,
      color: familyColor(p.color, role),
    };
  } catch {
    return d;
  }
}

export async function savePrefs(kv: KV, userId: string, p: Prefs): Promise<void> {
  const { easyView, notify, look, color } = p; // only today's fields: an old bigText is never written back (RD-75)
  try { await kv.setItem(key(userId), JSON.stringify({ easyView, notify, look, color })); } catch { /* ignore */ }
}
