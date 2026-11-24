// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// The no-login sample-data demo (RR-1..3, RR-10 in docs/reviews/2026-10-22-recruiter-ready.md).
// Fills the in-memory FakeBackend with a made-up family's posts, signs the visitor in as the parent,
// and lets them switch to Grandma Jo's view. Everything stays in the browser; no real backend.
import { FIXTURE, type FakeBackend } from '../api/fake/FakeBackend';
import { encryptMediaAsync } from '../crypto/media';
import type { KV } from '../platform/kv';
import { loadLastSeen, saveLastSeen } from '../state/lastSeen';

const F = FIXTURE;
const DAY = 864e5;

/** DEMO-3, DEMO-PHOTO-9 (DEC-82, Nov 24; was DEC-64): the parent is "Kevin", since the stock photos show a model; everyone
 *  is made up and no surname appears. The fixture's user id keeps its old key. */
export const DEMO_NAMES: Record<string, string> = {
  [F.users.chase.id]: 'Kevin',
  [F.users.alex.id]: 'Alex',
};

export interface DemoPicture { display: Uint8Array; thumb: Uint8Array; width: number; height: number }

type Who = 'jo' | 'ruth' | 'earl' | 'alex';
export interface DemoPost {
  caption: string;
  /** CAP-12: an optional title on a few moments. */
  title?: string;
  pictures: string[];
  to: 'everyone' | 'dadSide' | 'momSide';
  daysAgo: number;
  /** DEMO-NEW-2: who sent it; Kevin (the visitor) when left out. */
  from?: 'alex';
  hearts: Who[];
  replies: { who: Who; body: string }[];
}

/** DEMO-PHOTO-8 (SPEC-DEMO-PHOTOS): oldest first, three seasons of free Pexels stock photos. Same-day posts keep the
 *  table's order by a small offset. Grandma Jo is on Dad's side, so she never sees the Mom's-side post (DEMO-10). */
export const DEMO_POSTS: DemoPost[] = [
  { title: 'Apple blossoms at the orchard', caption: 'Everything was in bloom, and the kids ran the whole time.',
    pictures: ['orchard-4543640', 'orchard-4543633', 'orchard-4543718', 'orchard-4543714', 'orchard-4543720', 'orchard-4543719'],
    to: 'everyone', daysAgo: 190, from: 'alex',
    hearts: ['jo', 'ruth', 'earl'], replies: [{ who: 'ruth', body: 'Look at all those blossoms!' }, { who: 'jo', body: 'So pretty. Save me some apples this fall.' }] },
  { title: 'Shoulder rides all afternoon', caption: 'Nobody wanted to walk', pictures: ['orchard-4543671', 'orchard-4543672', 'orchard-4543642'],
    to: 'dadSide', daysAgo: 189.9,
    hearts: ['jo', 'earl'], replies: [{ who: 'jo', body: 'Your dad used to carry you just like that.' }] },
  { caption: 'My two sweethearts', pictures: ['orchard-4543661'], to: 'momSide', daysAgo: 189.8, from: 'alex',
    hearts: ['ruth'], replies: [{ who: 'ruth', body: 'Three of my favorite faces.' }] },
  { title: 'Pancake morning', caption: 'Aunt Bea taught the kids to make pancakes', pictures: ['baking-3807194', 'baking-3807115', 'baking-3806951', 'baking-3807313'],
    to: 'dadSide', daysAgo: 40,
    hearts: ['jo', 'earl'], replies: [{ who: 'earl', body: 'Save me a stack next time.' }] },
  { caption: 'Then we all sat down for tea and pancakes.', pictures: ['baking-3807394'], to: 'everyone', daysAgo: 39.9,
    hearts: ['jo', 'ruth', 'earl', 'alex'], replies: [{ who: 'jo', body: 'What a sweet morning.' }] },
  // DEMO-NEW-2, DEMO-PHOTO-12: Alex's post since the demo's last visit, so New for you opens on the bike ride.
  { title: 'First ride on the balance bike', caption: 'All the way down the path on the first try',
    pictures: ['bike-6209917', 'bike-6209856', 'bike-6209923'], to: 'everyone', daysAgo: 2, from: 'alex',
    hearts: ['jo', 'ruth', 'earl'], replies: [{ who: 'ruth', body: 'Look at that little yellow coat go!' }, { who: 'jo', body: 'Watch out, world!' }] },
  { caption: 'A ride under the big yellow tree', pictures: ['bike-6209901'], to: 'dadSide', daysAgo: 1.2,
    hearts: ['jo'], replies: [{ who: 'jo', body: "That's a lot of leaves!" }] },
];

/** CAL-19: the demo family's dates. Grandma Jo's and Grandpa Earl's birthdays are counted from the visit (days from
 *  today), so the Gallery line always shows; Mia (a made-up kid) and the parents' anniversary are fixed. */
export const DEMO_DATES = {
  members: [{ who: 'jo', inDays: 0 }, { who: 'earl', inDays: 9 }] as { who: 'jo' | 'earl'; inDays: number }[],
  labelled: [
    { kind: 'birthday', label: 'Mia', month: 3, day: 14 },
    { kind: 'anniversary', label: 'Kevin and Alex', month: 6, day: 20 },
  ] as { kind: 'birthday' | 'anniversary'; label: string; month: number; day: number }[],
};

/** CAL-19: puts the demo's dates in (again): Grandma Jo's birthday today, Grandpa Earl's in 9 days, counted from now.
 *  Also run on a saved demo family each visit, so a returning visitor still sees the line. */
export function seedDemoDates(be: FakeBackend, now: Date = new Date()): void {
  const space = F.space.id;
  const parent = F.users.chase.id;
  for (const m of DEMO_DATES.members) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + m.inDays);
    be.saveFamilyDate(parent, { space, id: null, kind: 'birthday', label: null, month: d.getMonth() + 1, day: d.getDate(), memberId: F.users[m.who].id });
  }
  const have = be.familyDates(parent, space);
  for (const l of DEMO_DATES.labelled) {
    if (have.some((d) => d.kind === l.kind && d.label === l.label)) continue;
    be.saveFamilyDate(parent, { space, id: null, kind: l.kind, label: l.label, month: l.month, day: l.day, memberId: null });
  }
}

/** DEMO-NEW-1: the demo's pretend last visit, so a first-time visitor sees New for you (DEC-58). */
export const DEMO_LAST_VISIT_DAYS = 3;

const userOf = (w: Who): string => F.users[w].id;
const iso = (t: number) => new Date(t).toISOString();

/** Seeds the demo family into a fixture backend (made with joIsMember: true). */
export async function seedDemo(be: FakeBackend, load: (name: string) => Promise<DemoPicture>, kv?: KV): Promise<void> {
  // DEMO-NEW-1: a last visit 3 days ago for Kevin and Grandma Jo, written first so Photos reads it; a saved one is kept.
  if (kv) {
    const last = new Date(Date.now() - DEMO_LAST_VISIT_DAYS * DAY).toISOString();
    for (const u of [F.users.chase.id, F.users.jo.id]) {
      if (!(await loadLastSeen(kv, u))) await saveLastSeen(kv, u, last);
    }
  }
  for (const [id, name] of Object.entries(DEMO_NAMES)) {
    be.state.users[id]!.name = name;
    be.state.users[id]!.email = `${name.toLowerCase()}@example.com`;
  }
  const parent = F.users.chase.id;
  const now = Date.now();
  let n = 0;
  for (const p of DEMO_POSTS) {
    n += 1;
    const at = now - p.daysAgo * DAY - 3 * 3600e3;
    let pics: DemoPicture[];
    try {
      pics = await Promise.all(p.pictures.map(load));
    } catch {
      continue; // a picture that didn't load skips its post; the rest of the family still shows
    }
    const author = p.from ? F.users[p.from].id : parent;
    const post = be.createPost(author, { clientId: `demo-${n}`, space: F.space.id, caption: p.caption, title: p.title ?? null, circleIds: [F.circles[p.to].id] });
    const grant = be.signUpload(author, post, pics.map((pic) => ({
      kind: 'photo', mime_type: 'image/jpeg', width: pic.width, height: pic.height, byte_size: 0, thumb_byte_size: 0, exif_stripped: true,
    })));
    for (const [i, pic] of pics.entries()) {
      const g = grant.items[i]!;
      const display = await encryptMediaAsync(pic.display, g.dek);
      const thumb = await encryptMediaAsync(pic.thumb, g.dek);
      const m = be.state.media[g.media_id]!;
      m.byte_size = display.length;
      m.thumb_byte_size = thumb.length;
      be.putObject(g.display_put_url, display, g.required_headers);
      be.putObject(g.thumb_put_url, thumb, g.required_headers);
    }
    be.finalizeMedia(author, grant.items.map((g) => g.media_id));
    be.publishPost(author, post);
    const row = be.state.posts[post]!;
    row.created_at = iso(at);
    row.published_at = iso(at);
    row.taken_at = iso(at);
    for (const w of p.hearts) be.state.hearts.push({ post, user: userOf(w) });
    p.replies.forEach((r, k) => {
      const c = be.addComment(userOf(r.who), { post, body: r.body, clientId: `demo-${n}-${k}` });
      be.state.comments[c.comment_id]!.created_at = iso(at + (k + 1) * 47 * 60e3);
    });
  }
  seedDemoDates(be);
  setDemoViewer(be, 'parent');
}

/** RR-10: whose eyes the demo shows. The app reloads after a switch to pick up the new session. */
export function setDemoViewer(be: FakeBackend, who: 'parent' | 'grandma'): void {
  be.state.appSession = who === 'parent' ? F.users.chase.id : F.users.jo.id;
  be.changed();
}

export function demoViewer(be: FakeBackend): 'parent' | 'grandma' {
  return be.state.appSession === F.users.jo.id ? 'grandma' : 'parent';
}

/** Start over: only Hearth's own keys. chaseholroyd.com hosts other demos on the same origin. */
export function demoKeysToClear(keys: string[]): string[] {
  return keys.filter((k) => k.startsWith('hearth.') || k.startsWith('hs_'));
}

/** DEMO-FRESH-1..3: names the sample family a browser saved, so a changed demo replaces an old copy. */
export const DEMO_SEED_KEY = 'hearth.demoSeed';

export function demoSeedVersion(src: { posts: DemoPost[]; names: Record<string, string> } = { posts: DEMO_POSTS, names: DEMO_NAMES }): string {
  // CAL-19: the dates are part of the sample family, so adding them moves the version and returning visitors get them.
  const s = JSON.stringify([src.posts, src.names, DEMO_LAST_VISIT_DAYS, DEMO_DATES]);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

type DemoStorage = { readonly length: number; key(i: number): string | null; getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void };

/** Clears Hearth's saved demo keys (as Start over does) when they came from another sample family. True if it cleared. */
export function freshenDemoStorage(ls: DemoStorage): boolean {
  const now = demoSeedVersion();
  if (ls.getItem(DEMO_SEED_KEY) === now) return false;
  const keys = Array.from({ length: ls.length }, (_, i) => ls.key(i)).filter((k): k is string => k != null);
  for (const k of demoKeysToClear(keys)) ls.removeItem(k);
  ls.setItem(DEMO_SEED_KEY, now);
  return true;
}
