// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// DEMO-PHOTO-4..9, 13, 14, 18 (docs/product/SPEC-DEMO-PHOTOS.md, DEC-82, Nov 24): the public demo shows free Pexels
// stock photos of a made-up family, with "Kevin" as the parent. Replaces DEMO-PHOTO-1..3 (DEC-62), which this file
// held before. Written FIRST (Nov 24, qa-tdd): red until the new photos, posts and credits land.
import * as fs from 'fs';
import * as path from 'path';
import { DEMO_DATES, DEMO_NAMES, DEMO_POSTS, DEMO_SEED_KEY, demoSeedVersion, freshenDemoStorage } from '../seed';
import { DEMO_PICTURE_SIZES } from '../pictures';

const ROOT = path.join(__dirname, '..', '..', '..', '..');
const DIR = path.join(ROOT, 'app', 'public', 'demo-pictures');

const orchard = (...ids: number[]) => ids.map((i) => `orchard-${i}`);
const baking = (...ids: number[]) => ids.map((i) => `baking-${i}`);
const bike = (...ids: number[]) => ids.map((i) => `bike-${i}`);

/** The spec's post table, oldest first. `text` is the quoted title or caption (null: the engineer writes it). */
const TABLE = [
  { from: 'Alex', to: 'everyone', days: 190, text: 'Apple blossoms at the orchard', pictures: orchard(4543640, 4543633, 4543718, 4543714, 4543720, 4543719) },
  { from: 'Kevin', to: 'dadSide', days: 190, text: 'Shoulder rides all afternoon', pictures: orchard(4543671, 4543672, 4543642) },
  { from: 'Alex', to: 'momSide', days: 190, text: null, pictures: orchard(4543661) },
  { from: 'Kevin', to: 'dadSide', days: 40, text: 'Aunt Bea taught the kids to make pancakes', pictures: baking(3807194, 3807115, 3806951, 3807313) },
  { from: 'Kevin', to: 'everyone', days: 40, text: null, pictures: baking(3807394) },
  { from: 'Alex', to: 'everyone', days: 0, text: 'First ride on the balance bike', pictures: bike(6209917, 6209856, 6209923) },
  { from: 'Kevin', to: 'dadSide', days: 0, text: null, pictures: bike(6209901) },
] as const;
const NAMES = TABLE.flatMap((r) => [...r.pictures]);
const OLD = ['beach', 'dunes', 'museum', 'playground', 'porch', 'bike', 'splash', 'bridge', 'overlook', 'hug'];

// JPEG segment walk: every segment before the image data, with its marker byte and body.
function segments(buf: Buffer): { marker: number; body: Buffer }[] {
  const out: { marker: number; body: Buffer }[] = [];
  let i = 2;
  while (i + 3 < buf.length && buf[i] === 0xff) {
    const m = buf[i + 1] ?? 0;
    const len = buf.readUInt16BE(i + 2);
    out.push({ marker: m, body: buf.subarray(i + 4, i + 2 + len) });
    if (m === 0xda) break;
    i += 2 + len;
  }
  return out;
}
function jpegSize(buf: Buffer): { width: number; height: number } {
  for (const s of segments(buf)) {
    if (s.marker >= 0xc0 && s.marker <= 0xc2) return { height: s.body.readUInt16BE(1), width: s.body.readUInt16BE(3) };
  }
  throw new Error('no size');
}
const read = (f: string) => fs.readFileSync(path.join(DIR, f));
const longSide = (s: { width: number; height: number }) => Math.max(s.width, s.height);

describe('DEMO-PHOTO stock photos in the public demo', () => {
  it('DEMO-PHOTO-4 public/demo-pictures holds exactly the 19 stock photos, each with a thumb, and none of the Nov 16 set', () => {
    expect(NAMES).toHaveLength(19);
    const jpgs = fs.readdirSync(DIR).filter((f) => f.toLowerCase().endsWith('.jpg')).sort();
    expect(jpgs).toEqual(NAMES.flatMap((n) => [`${n}.jpg`, `${n}-thumb.jpg`]).sort());
    for (const old of OLD) {
      expect(jpgs).not.toContain(`${old}.jpg`);
      expect(jpgs).not.toContain(`${old}-thumb.jpg`);
    }
  });

  it('DEMO-PHOTO-5 none of the 38 files carries APP1 (EXIF/XMP), APP2 or APP13, and no GPS tag before the image data', () => {
    for (const n of NAMES) {
      for (const f of [`${n}.jpg`, `${n}-thumb.jpg`]) {
        const segs = segments(read(f));
        const bad = segs.filter((s) => [0xe1, 0xe2, 0xed].includes(s.marker)).map((s) => s.marker.toString(16));
        const head = Buffer.concat(segs.filter((s) => s.marker !== 0xda).map((s) => s.body));
        const gps = head.includes('GPS') || head.includes('Exif\0') || head.includes(Buffer.from([0x88, 0x25])) || head.includes(Buffer.from([0x25, 0x88]));
        expect({ f, bad, gps }).toEqual({ f, bad: [], gps: false });
      }
    }
  });

  it('DEMO-PHOTO-6 each display file is 1200 px on its long side, each thumb 400 px, at the same shape (within 1%)', () => {
    for (const n of NAMES) {
      const d = jpegSize(read(`${n}.jpg`));
      const t = jpegSize(read(`${n}-thumb.jpg`));
      const ratio = (s: { width: number; height: number }) => s.width / s.height;
      expect({ n, display: Math.abs(longSide(d) - 1200) <= 1, thumb: Math.abs(longSide(t) - 400) <= 1, shape: Math.abs(ratio(d) / ratio(t) - 1) <= 0.01 })
        .toEqual({ n, display: true, thumb: true, shape: true });
    }
  });

  it('DEMO-PHOTO-7 DEMO_PICTURE_SIZES has one entry per shipped picture, each matching the file\'s real size', () => {
    expect(Object.keys(DEMO_PICTURE_SIZES).sort()).toEqual([...NAMES].sort());
    for (const n of NAMES) expect({ n, ...DEMO_PICTURE_SIZES[n] }).toEqual({ n, ...jpegSize(read(`${n}.jpg`)) });
  });

  it('DEMO-PHOTO-8 DEMO_POSTS is the 7 posts of the table in order: sender, group, pictures, day bucket; 19 pictures, each once', () => {
    const got = DEMO_POSTS.map((p) => ({ from: p.from === 'alex' ? 'Alex' : 'Kevin', to: p.to, pictures: p.pictures }));
    expect(got).toEqual(TABLE.map((r) => ({ from: r.from, to: r.to, pictures: [...r.pictures] })));
    for (const [i, r] of TABLE.entries()) {
      const p = DEMO_POSTS[i]!;
      const inBucket = r.days === 0 ? p.daysAgo > 0 && p.daysAgo <= 2.5 : Math.abs(p.daysAgo - r.days) <= 2;
      expect({ post: i + 1, daysAgo: p.daysAgo, inBucket }).toEqual({ post: i + 1, daysAgo: p.daysAgo, inBucket: true });
      if (r.text) expect({ post: i + 1, words: [p.title, p.caption].includes(r.text) }).toEqual({ post: i + 1, words: true });
      expect(p.caption.trim().length).toBeGreaterThan(0);
    }
    // Same-day posts keep the table's order by a small offset: oldest first, strictly.
    for (let i = 1; i < DEMO_POSTS.length; i++) expect(DEMO_POSTS[i]!.daysAgo).toBeLessThan(DEMO_POSTS[i - 1]!.daysAgo);
    const all = DEMO_POSTS.flatMap((p) => p.pictures);
    expect(all).toHaveLength(19);
    expect(new Set(all).size).toBe(19);
  });

  it('DEMO-PHOTO-9 the parent is "Kevin", and no demo name, caption, title, reply or date label says "Chase"', () => {
    const parent = Object.entries(DEMO_NAMES).find(([, n]) => n !== 'Alex');
    expect(parent?.[1]).toBe('Kevin');
    const words = [
      ...Object.values(DEMO_NAMES),
      ...DEMO_POSTS.flatMap((p) => [p.caption, p.title ?? '', ...p.replies.map((r) => r.body)]),
      ...DEMO_DATES.labelled.map((d) => d.label),
    ];
    expect(words.filter((w) => /Chase/i.test(w))).toEqual([]);
    expect(DEMO_DATES.labelled.find((d) => d.kind === 'anniversary')?.label).toBe('Kevin and Alex');
  });

  it('DEMO-PHOTO-13 the seed version moves on from the Nov 16 family, so a returning browser drops it and its bytes', () => {
    // demoSeedVersion() on main before DEMO-PHOTO (Nov 24, with CAL-19 dates) and before CAL-19.
    for (const old of ['u4ie58', '659ibx']) {
      expect(demoSeedVersion()).not.toBe(old);
      const m = new Map<string, string>([['hearth.fakeBackend.v1', '{"old":1}'], ['hearth.prefs.v1.u1', '{}'], [DEMO_SEED_KEY, old], ['role-radar.jobs', '[]']]);
      const ls = {
        get length() { return m.size; },
        key: (i: number) => [...m.keys()][i] ?? null,
        getItem: (k: string) => m.get(k) ?? null,
        setItem: (k: string, v: string) => void m.set(k, v),
        removeItem: (k: string) => void m.delete(k),
      };
      expect(freshenDemoStorage(ls)).toBe(true);
      expect([...m.keys()].sort()).toEqual([DEMO_SEED_KEY, 'role-radar.jobs'].sort());
    }
  });

  it('DEMO-PHOTO-14 CREDITS.md names Pexels, both photographers with their prefixes, and the license; README carries the credit line', () => {
    const credits = fs.readFileSync(path.join(DIR, 'CREDITS.md'), 'utf8');
    expect(credits).toMatch(/Pexels/);
    expect(credits).toMatch(/license/i);
    expect(credits).toMatch(/free to use/i);
    const line = (who: string) => credits.split('\n').find((l) => l.includes(who)) ?? '';
    expect(line('Elly Fairytale')).toMatch(/orchard/);
    expect(line('Elly Fairytale')).toMatch(/baking/);
    expect(line('Yan Krukov')).toMatch(/bike/);
    const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
    expect(readme.split('Sample photos: Pexels (Elly Fairytale, Yan Krukov)').length - 1).toBe(1);
  });

  it('DEMO-PHOTO-18 README, CASE-STUDY and code comments never say the demo photos are the founder\'s or Chase\'s own', () => {
    // Built so this file never matches itself.
    const own = new RegExp(["(the founder|Chase)['’]s own (family )?photos", "photos are (the founder|Chase)['’]s own"].join('|'), 'i');
    const files = [path.join(ROOT, 'README.md'), path.join(ROOT, 'docs', 'portfolio', 'CASE-STUDY.md')];
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p); } else if (/\.(ts|tsx|js|mjs|py|sh)$/.test(e.name)) files.push(p);
      }
    };
    for (const d of ['src', 'e2e-web', 'scripts']) walk(path.join(ROOT, 'app', d));
    const hits = files.flatMap((f) => fs.readFileSync(f, 'utf8').split('\n').map((l, i) => ({ f: path.relative(ROOT, f), line: i + 1, l })).filter((x) => own.test(x.l)));
    expect(hits.map((h) => `${h.f}:${h.line}`)).toEqual([]);
  });
});
