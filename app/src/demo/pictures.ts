// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// DEMO-2: the sample pictures ship in public/demo-pictures/ (web export only, so phone builds don't
// carry them) and are read like a picked photo would be. DEMO-PHOTO-1: they are Chase's own photos
// (Nov 16), re-saved with no camera data; scripts/make-demo-pictures.py drew the old ones.
import type { DemoPicture } from './seed';

const BASE = (process.env.EXPO_BASE_URL ?? '').replace(/\/$/, '');

async function bytes(path: string): Promise<Uint8Array> {
  const res = await fetch(`${BASE}/demo-pictures/${path}`);
  if (!res.ok) throw new Error(`demo picture ${path}: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

/** DEMO-PHOTO-2: each picture's own shape, so tall photos aren't squashed into 4:3. */
export const DEMO_PICTURE_SIZES: Record<string, { width: number; height: number }> = {
  beach: { width: 900, height: 1200 },
  dunes: { width: 1200, height: 900 },
  museum: { width: 900, height: 1200 },
  playground: { width: 1200, height: 900 },
  porch: { width: 900, height: 1200 },
  bike: { width: 900, height: 1200 },
  splash: { width: 1200, height: 900 },
  bridge: { width: 900, height: 1200 },
  overlook: { width: 900, height: 1200 },
  hug: { width: 1200, height: 900 },
};

export async function loadDemoPicture(name: string): Promise<DemoPicture> {
  const [display, thumb] = await Promise.all([bytes(`${name}.jpg`), bytes(`${name}-thumb.jpg`)]);
  return { display, thumb, ...(DEMO_PICTURE_SIZES[name] ?? { width: 1200, height: 900 }) };
}
