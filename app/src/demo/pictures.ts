// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// DEMO-2: the sample pictures ship in public/demo-pictures/ (web export only, so phone builds don't
// carry them) and are read like a picked photo would be. DEMO-PHOTO-4..7 (DEC-82, Nov 24): free stock photos from
// Pexels (credits in public/demo-pictures/CREDITS.md), 1200 px display and 400 px thumbs with no photo data.
import type { DemoPicture } from './seed';

const BASE = (process.env.EXPO_BASE_URL ?? '').replace(/\/$/, '');

async function bytes(path: string): Promise<Uint8Array> {
  const res = await fetch(`${BASE}/demo-pictures/${path}`);
  if (!res.ok) throw new Error(`demo picture ${path}: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

/** DEMO-PHOTO-2, DEMO-PHOTO-7: each picture's own shape, so tall photos aren't squashed into 4:3. */
export const DEMO_PICTURE_SIZES: Record<string, { width: number; height: number }> = {
  'orchard-4543640': { width: 1200, height: 800 },
  'orchard-4543633': { width: 1200, height: 800 },
  'orchard-4543718': { width: 800, height: 1200 },
  'orchard-4543714': { width: 800, height: 1200 },
  'orchard-4543720': { width: 800, height: 1200 },
  'orchard-4543719': { width: 1200, height: 800 },
  'orchard-4543671': { width: 800, height: 1200 },
  'orchard-4543672': { width: 800, height: 1200 },
  'orchard-4543642': { width: 1200, height: 800 },
  'orchard-4543661': { width: 1200, height: 800 },
  'baking-3807194': { width: 800, height: 1200 },
  'baking-3807115': { width: 800, height: 1200 },
  'baking-3806951': { width: 800, height: 1200 },
  'baking-3807313': { width: 800, height: 1200 },
  'baking-3807394': { width: 1200, height: 800 },
  'bike-6209917': { width: 1200, height: 800 },
  'bike-6209856': { width: 1200, height: 800 },
  'bike-6209923': { width: 1200, height: 800 },
  'bike-6209901': { width: 1200, height: 800 },
};

export async function loadDemoPicture(name: string): Promise<DemoPicture> {
  const [display, thumb] = await Promise.all([bytes(`${name}.jpg`), bytes(`${name}-thumb.jpg`)]);
  return { display, thumb, ...(DEMO_PICTURE_SIZES[name] ?? { width: 1200, height: 900 }) };
}
