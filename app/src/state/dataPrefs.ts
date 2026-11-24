// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// DEC-82 (SPEC-MEDIA 5): More → "Videos and data". Two choices, kept on this phone only (one key, no account id in
// it, never sent to the server): "Play videos as I scroll" (default on) and "Save data" (null until the sign-up
// question is answered on this phone).
import type { KV } from '../platform/kv';

export const DATA_PREFS_KEY = 'hearth.dataPrefs.v1';

export interface DataPrefs {
  autoplay: boolean;
  /** null: the prepaid question (DATA-1) was never answered on this phone. */
  saveData: boolean | null;
}

export function defaultDataPrefs(): DataPrefs {
  return { autoplay: true, saveData: null };
}

export async function loadDataPrefs(kv: KV): Promise<DataPrefs> {
  const d = defaultDataPrefs();
  try {
    const raw = await kv.getItem(DATA_PREFS_KEY);
    if (!raw) return d;
    const p = JSON.parse(raw) as Partial<Record<keyof DataPrefs, unknown>> | null;
    if (!p || typeof p !== 'object') return d;
    return {
      autoplay: typeof p.autoplay === 'boolean' ? p.autoplay : d.autoplay,
      saveData: typeof p.saveData === 'boolean' ? p.saveData : d.saveData,
    };
  } catch {
    return d;
  }
}

export async function saveDataPrefs(kv: KV, p: DataPrefs): Promise<void> {
  const { autoplay, saveData } = p;
  try { await kv.setItem(DATA_PREFS_KEY, JSON.stringify({ autoplay, saveData })); } catch { /* ignore */ }
}

/** AUTO-5: Feed videos play by themselves only with the switch on, Save data off and the phone's reduce motion off. */
export function autoplayOn(p: DataPrefs, reduceMotion: boolean): boolean {
  return p.autoplay && p.saveData !== true && !reduceMotion;
}
