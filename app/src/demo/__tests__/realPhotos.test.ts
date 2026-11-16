// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// DEMO-PHOTO-1..3 (Chase, Nov 16: "give me a demo I can use"): the demo shows Chase's own photos,
// each one cleaned of camera data and loaded at its own shape, with captions that match the picture.
import * as fs from 'fs';
import * as path from 'path';
import { DEMO_POSTS } from '../seed';
import { DEMO_PICTURE_SIZES } from '../pictures';

const DIR = path.join(__dirname, '..', '..', '..', 'public', 'demo-pictures');
const names = [...new Set(DEMO_POSTS.flatMap((p) => p.pictures))];

// JPEG segment walk: returns the marker bytes of every segment before the image data.
function markers(buf: Buffer): number[] {
  const out: number[] = [];
  let i = 2;
  while (i < buf.length && buf[i] === 0xff) {
    const m = buf[i + 1] ?? 0;
    out.push(m);
    if (m === 0xda) break;
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return out;
}
function jpegSize(buf: Buffer): { width: number; height: number } {
  let i = 2;
  while (i < buf.length) {
    const m = buf[i + 1] ?? 0;
    if (m >= 0xc0 && m <= 0xc2) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    i += 2 + buf.readUInt16BE(i + 2);
  }
  throw new Error('no size');
}

describe('DEMO-PHOTO real photos in the demo', () => {
  it('DEMO-PHOTO-1 every demo picture is a photo with no camera data (no EXIF, GPS or XMP block)', () => {
    expect(names.length).toBeGreaterThanOrEqual(10);
    for (const n of names) {
      for (const f of [`${n}.jpg`, `${n}-thumb.jpg`]) {
        const m = markers(fs.readFileSync(path.join(DIR, f)));
        expect({ f, app1: m.includes(0xe1) }).toEqual({ f, app1: false }); // APP1 holds EXIF, GPS and XMP
      }
    }
  });

  it('DEMO-PHOTO-2 each picture loads at its own shape, so tall photos are not squashed', () => {
    let tall = 0;
    for (const n of names) {
      const real = jpegSize(fs.readFileSync(path.join(DIR, `${n}.jpg`)));
      expect({ n, ...DEMO_PICTURE_SIZES[n] }).toEqual({ n, ...real });
      if (real.height > real.width) tall++;
    }
    expect(tall).toBeGreaterThan(0);
  });

  it('DEMO-PHOTO-3 the old drawn pictures are gone from the posts', () => {
    for (const old of ['bus', 'kite', 'sunflowers', 'lake', 'cake', 'balloons', 'pumpkins', 'apples', 'snow']) {
      expect(names).not.toContain(old);
    }
  });
});
