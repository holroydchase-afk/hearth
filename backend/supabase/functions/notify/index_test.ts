// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// deno test --allow-env supabase/functions/notify/
// The sender against a mocked PostgREST, Expo Push and Resend (no network).
import { buildEmail, buildPush, handler, joinNames, type Batch } from "./index.ts";

const env: Record<string, string> = {
  SUPABASE_URL: "https://proj.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  RESEND_API_KEY: "re_test",
  RESEND_FROM: "Hearth <hello@hearth.family>",
  APP_LINK_BASE: "https://hearth.family",
};
for (const [k, v] of Object.entries(env)) Deno.env.set(k, v);

const P1 = "55555555-0000-0000-0000-0000000000a1";
const P2 = "55555555-0000-0000-0000-0000000000a2";
const pushBatch = (over: Partial<Batch> = {}): Batch => ({
  recipient_id: "a0000000-0000-0000-0000-0000000000a1", channel: "push", actor_names: ["Alex"],
  post_ids: [P1], latest_post_id: P1, post_count: 1, comment_count: 0, heart_count: 0,
  outbox_ids: ["o1"], push_tokens: ["ExponentPushToken[gma]"], email: null, ...over,
});
const emailBatch = (over: Partial<Batch> = {}): Batch => pushBatch({
  recipient_id: "a0000000-0000-0000-0000-0000000000a2", channel: "email", push_tokens: [],
  email: "grandpa@example.com", outbox_ids: ["o2"], ...over,
});

function assert(cond: unknown, msg: string): asserts cond { if (!cond) throw new Error(msg); }
function eq(a: unknown, b: unknown, msg: string) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg}\n  got ${JSON.stringify(a)}\n  want ${JSON.stringify(b)}`);
}

// ---------- wording (grandparent UX: plain words, first names only) ----------
Deno.test("names: 1, 2, 3 and 4+ people read naturally", () => {
  eq(joinNames(["Alex"]), "Alex", "one");
  eq(joinNames(["Alex", "Blair"]), "Alex and Blair", "two");
  eq(joinNames(["Alex", "Blair", "Jo"]), "Alex, Blair and Jo", "three");
  eq(joinNames(["A", "B", "C", "D"]), "A, B and 2 others", "four");
});

Deno.test("BETA-NOTIFY-2: push says who and opens the post; no image, caption or child's name", () => {
  const [m] = buildPush(pushBatch());
  eq(m.to, ["ExponentPushToken[gma]"], "only this member's tokens");
  eq(m.body, "Alex shared new photos. Tap to see them.", "body");
  eq(m.data, { post_id: P1 }, "data is the post id only");
  const keys = Object.keys(m).sort();
  eq(keys, ["body", "data", "sound", "title", "to"], "no image/attachment fields at all");
  assert(!JSON.stringify(m).includes("http"), "no URL in a push");
});

Deno.test("BETA-NOTIFY-4: 3 posts in one batch are 1 push that opens the newest", () => {
  const ms = buildPush(pushBatch({ post_ids: [P1, P2], latest_post_id: P2, post_count: 3 }));
  eq(ms.length, 1, "one message");
  eq(ms[0].data, { post_id: P2 }, "newest post");
});

Deno.test("BETA-REPLY-3: replies read as replies", () => {
  const [m] = buildPush(pushBatch({ actor_names: ["Grandma", "Grandpa"], post_count: 0, comment_count: 1, heart_count: 1 }));
  eq(m.body, "Grandma and Grandpa replied to your photos. Tap to see.", "reply body");
});

Deno.test("BETA-NOTIFY-5: email links to the post and carries no photo or caption", () => {
  const e = buildEmail(emailBatch())!;
  eq(e.to, ["grandpa@example.com"], "to");
  eq(e.subject, "Alex shared new photos on Hearth", "subject");
  assert(e.text.includes(`https://hearth.family/p/${P1}`), "link to the post");
  assert(!/<img/i.test(e.html), "no image in the email");
  assert(e.html.includes(`https://hearth.family/p/${P1}`), "html has the link");
});

Deno.test("email: names are HTML-escaped", () => {
  const e = buildEmail(emailBatch({ actor_names: ["<b>Al"] }))!;
  assert(!e.html.includes("<b>Al"), "escaped");
});

Deno.test("BETA-NOTIFY-7: push and email name the real sender, never a generic notice", () => {
  const [m] = buildPush(pushBatch({ actor_names: ["Chase"] }));
  eq(m.title, "From Chase on Hearth", "push title names the sender");
  const [m2] = buildPush(pushBatch({ actor_names: ["Chase", "Mom"] }));
  eq(m2.title, "From Chase and Mom on Hearth", "two senders");
  const e = buildEmail(emailBatch({ actor_names: ["Chase"] }))!;
  eq(e.from, "Chase on Hearth <hello@hearth.family>", "email From shows the sender's name");
  for (const t of [m.title, m.body, e.subject, e.text]) {
    assert(!/new notification/i.test(t), "no generic wording: " + t);
  }
});

Deno.test("BETA-NOTIFY-7: an email never goes out without a real person's name", () => {
  eq(buildEmail(emailBatch({ actor_names: ["<>"] })), null, "no usable name -> no email");
});

Deno.test("email: with no website yet (APP_LINK_BASE unset), there is no dead link, just plain words", () => {
  const saved = Deno.env.get("APP_LINK_BASE");
  Deno.env.delete("APP_LINK_BASE");
  try {
    const e = buildEmail(emailBatch())!;
    assert(!e.text.includes("http") && !e.html.includes("http") && !/<a /.test(e.html), "no link at all");
    assert(e.text.includes("Open Hearth on your phone to see them."), "plain words: " + e.text);
  } finally { if (saved) Deno.env.set("APP_LINK_BASE", saved); }
});

Deno.test("email: a reply email says 'see it', new photos say 'see them'", () => {
  assert(buildEmail(emailBatch({ actor_names: ["Grandma June"], post_count: 0, comment_count: 1 }))!.text.includes("Open Hearth to see it:"), "reply");
  assert(buildEmail(emailBatch())!.text.includes("Open Hearth to see them:"), "photos");
});

Deno.test("BETA-NOTIFY-7: a sender name can't break the email subject either", () => {
  const e = buildEmail(emailBatch({ actor_names: ["Al\r\nBcc: x@evil.com"] }))!;
  assert(!/[\r\n]/.test(e.subject) && !e.subject.includes("@"), "subject is one clean line: " + JSON.stringify(e.subject));
});

Deno.test("BETA-NOTIFY-7: a sender name can't break the email From header", () => {
  const e = buildEmail(emailBatch({ actor_names: ['Al"<x@evil.com>'] }))!;
  assert(e.from.endsWith("<hello@hearth.family>") && (e.from.match(/</g) ?? []).length === 1, "one address only: " + e.from);
});

// ---------- handler: one run of the cron ----------
type Call = { url: string; body: unknown; auth: string | null };
function mockFetch(opts: { batches: Batch[]; expo?: (body: unknown) => Response; resend?: () => Response }) {
  const calls: Call[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ url, body, auth: new Headers(init?.headers).get("authorization") });
    const ok = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
    if (url.endsWith("/rpc/claim_notification_batches")) return ok(opts.batches);
    if (url.endsWith("/rpc/release_notifications") || url.endsWith("/rpc/forget_push_tokens")) return ok(null);
    if (url === "https://exp.host/--/api/v2/push/send") {
      return opts.expo ? opts.expo(body) : ok({ data: (body as unknown[]).map(() => ({ status: "ok", id: "t" })) });
    }
    if (url === "https://api.resend.com/emails/batch") return opts.resend ? opts.resend() : ok({ data: [{ id: "e" }] });
    throw new Error("unexpected fetch " + url);
  }) as typeof fetch;
  return calls;
}
const run = (auth = "Bearer service") =>
  handler(new Request("https://fn/notify", { method: "POST", headers: { authorization: auth } }));

Deno.test("security: only the service role (cron) may run the sender", async () => {
  const calls = mockFetch({ batches: [pushBatch()] });
  const res = await run("Bearer some-user-jwt");
  eq(res.status, 401, "status");
  eq(calls.length, 0, "nothing claimed");
});

Deno.test("run: claims, sends 1 push and 1 email, reports counts only", async () => {
  const calls = mockFetch({ batches: [pushBatch(), emailBatch()] });
  const res = await run();
  eq(res.status, 200, "status");
  eq(await res.json(), { push: 1, email: 1, failed: 0 }, "summary has counts only");
  const expo = calls.find((c) => c.url.includes("exp.host"))!;
  eq((expo.body as unknown[]).length, 1, "one push message");
  const resend = calls.find((c) => c.url.includes("resend"))!;
  eq(resend.auth, "Bearer re_test", "Resend key used");
  eq(calls.filter((c) => c.url.includes("release")).length, 0, "nothing released");
});

Deno.test("run: a failed Expo call puts those notices back for the next run", async () => {
  const calls = mockFetch({ batches: [pushBatch()], expo: () => new Response("down", { status: 503 }) });
  const res = await run();
  eq(await res.json(), { push: 0, email: 0, failed: 1 }, "counted as failed");
  const rel = calls.find((c) => c.url.endsWith("/rpc/release_notifications"))!;
  eq(rel.body, { p_ids: ["o1"] }, "released the claimed ids");
});

Deno.test("run: a failed Resend call puts the email back", async () => {
  const calls = mockFetch({ batches: [emailBatch()], resend: () => new Response("no", { status: 500 }) });
  await run();
  const rel = calls.find((c) => c.url.endsWith("/rpc/release_notifications"))!;
  eq(rel.body, { p_ids: ["o2"] }, "released");
});

Deno.test("run: DeviceNotRegistered tokens are forgotten", async () => {
  const calls = mockFetch({
    batches: [pushBatch()],
    expo: () => new Response(JSON.stringify({ data: [{ status: "error", details: { error: "DeviceNotRegistered", expoPushToken: "ExponentPushToken[gma]" } }] }), { status: 200 }),
  });
  await run();
  const f = calls.find((c) => c.url.endsWith("/rpc/forget_push_tokens"))!;
  eq(f.body, { p_tokens: ["ExponentPushToken[gma]"] }, "forgot the dead token");
});

Deno.test("privacy: the sender never logs tokens, emails or URLs", async () => {
  const logged: string[] = [];
  const orig = { log: console.log, error: console.error, warn: console.warn };
  console.log = console.error = console.warn = (...a: unknown[]) => { logged.push(a.map(String).join(" ")); };
  try {
    mockFetch({ batches: [pushBatch(), emailBatch()], expo: () => new Response("down", { status: 503 }) });
    await run();
  } finally { Object.assign(console, orig); }
  const all = logged.join("\n");
  assert(!all.includes("ExponentPushToken"), "no token in logs");
  assert(!all.includes("@example.com"), "no email in logs");
  assert(!all.includes("http"), "no URL in logs");
});

// ---------- BETA-BULK-6: one notice per bulk import (migration 0010 adds the claim columns) ----------
// Cast through unknown: until 0010 the Batch type has no batch fields, and this must stay a red test, not a compile error.
const bulk = (over: Record<string, unknown>): Batch => pushBatch({
  post_ids: [P1, P2], post_count: 5, is_batch: true, photo_count: 48,
  taken_from: "2024-07-04T14:00:00Z", taken_to: "2024-07-06T19:00:00Z", ...over,
} as unknown as Partial<Batch>);

Deno.test("BETA-BULK-6: a bulk import push reads 'Alex added 48 photos from July 2024' (full month: grandparent-ux)", () => {
  const [m] = buildPush(bulk({}));
  eq(m.title, "From Alex on Hearth", "title still names the sender");
  eq(m.body, "Alex added 48 photos from July 2024. Tap to see them.", "one line for the whole batch");
  eq(Object.keys(m).sort(), ["body", "data", "sound", "title", "to"], "no image/attachment fields");
});

Deno.test("BETA-BULK-6: a batch across months or years names the span; no dates, no month", () => {
  eq(buildPush(bulk({ taken_from: "2024-06-29T15:00:00Z", taken_to: "2024-07-02T15:00:00Z" }))[0]!.body,
     "Alex added 48 photos from June to July 2024. Tap to see them.", "two months");
  eq(buildPush(bulk({ taken_from: "2023-12-30T15:00:00Z", taken_to: "2024-01-02T15:00:00Z" }))[0]!.body,
     "Alex added 48 photos from December 2023 to January 2024. Tap to see them.", "two years");
  eq(buildPush(bulk({ taken_from: null, taken_to: null }))[0]!.body,
     "Alex added 48 photos. Tap to see them.", "no capture dates");
  eq(buildPush(bulk({ photo_count: 1, taken_from: null, taken_to: null }))[0]!.body,
     "Alex added 1 photo. Tap to see it.", "one photo");
});

Deno.test("BETA-BULK-6: the month follows Eastern time (a Jul 31, 11 pm photo is July)", () => {
  eq(buildPush(bulk({ taken_from: "2024-08-01T03:00:00Z", taken_to: "2024-08-01T03:00:00Z" }))[0]!.body,
     "Alex added 48 photos from July 2024. Tap to see them.", "Eastern month");
});

Deno.test("BETA-BULK-6: an ordinary post batch still says 'shared new photos'", () => {
  eq(buildPush(pushBatch({ ...({ is_batch: false, photo_count: 3 } as unknown as Partial<Batch>) }))[0]!.body,
     "Alex shared new photos. Tap to see them.", "not a bulk import");
});

// ---------- BETA-SMS-13: a phone-only account has no email address ----------
Deno.test("BETA-SMS-13: an email batch with a null address is skipped; the run still sends the push and succeeds", async () => {
  const calls = mockFetch({ batches: [pushBatch(), emailBatch({ email: null, recipient_id: "e0000000-0000-0000-0000-0000000000e6" })] });
  const res = await run();
  eq(res.status, 200, "the run does not fail");
  eq(await res.json(), { push: 1, email: 0, failed: 0 }, "one push, no email, nothing failed");
  const resend = calls.filter((c) => c.url.includes("resend"));
  assert(resend.every((c) => !JSON.stringify(c.body).includes("null")), "no email is addressed to null");
  eq(calls.filter((c) => c.url.includes("release")).length, 0, "nothing released for retry");
});

// ---------- R89: news, event and saying notices never say "shared new photos" (written first, Nov 24, qa-tdd) ----------
// claim_notification_batches gains post_kinds (0034's posts.kind of the batch's new posts). The exact words come from
// grandparent-ux; these checks hold only that each kind gets its own, true wording, still naming who sent it.
// The cast keeps this file type-checking before Batch has the fields, so only the R89 / NOTIFY-K tests go red.
// Contract (NOTIFY-K, SPEC-VISIBILITY-CORE "Notices (GUX-VC-R11)"): each claimed batch carries
//   kind_counts: { photos?: n, news?: n, event?: n, saying?: n }  new posts per kind (counts only; {} for replies only)
//   post_kinds:  string[]  the kinds of every post the batch is about (new posts and posts replied to or reacted on)
// A batch without them (an older claim) reads as photos, as today.
const withKinds = (b: Batch, kinds: string[]): Batch =>
  ({ ...b, post_kinds: kinds, kind_counts: Object.fromEntries(kinds.map((k) => [k, b.post_count])) } as Batch);
const NOT_PHOTOS = ["news", "event", "saying"];

Deno.test("R89 push for a news, event or saying post never mentions photos and still names who sent it", () => {
  for (const k of NOT_PHOTOS) {
    const [m] = buildPush(withKinds(pushBatch(), [k]));
    assert(m, `${k}: a push is sent`);
    assert(!/photo/i.test(`${m.title} ${m.body}`), `${k}: push says photos: ${JSON.stringify(m.body)}`);
    assert(m.body.includes("Alex"), `${k}: push names the sender`);
    eq(m.data, { post_id: P1 }, `${k}: data is the post id only`);
  }
});

Deno.test("R89 email for a news, event or saying post never mentions photos and still names who sent it", () => {
  for (const k of NOT_PHOTOS) {
    const e = buildEmail(withKinds(emailBatch(), [k]))!;
    assert(e, `${k}: an email is built`);
    assert(!/photo/i.test(`${e.subject} ${e.text} ${e.html}`), `${k}: email says photos: ${JSON.stringify(e.subject)}`);
    assert(e.subject.includes("Alex"), `${k}: subject names the sender`);
  }
});

Deno.test("R89 each kind gets its own wording (not one generic line for all three)", () => {
  const bodies = NOT_PHOTOS.map((k) => buildPush(withKinds(pushBatch(), [k]))[0].body);
  eq(new Set(bodies).size, 3, `three different push bodies: ${JSON.stringify(bodies)}`);
});

Deno.test("R89 a photos batch (post_kinds ['photos']) keeps today's words", () => {
  eq(buildPush(withKinds(pushBatch(), ["photos"]))[0].body, "Alex shared new photos. Tap to see them.", "photos body");
  eq(buildEmail(withKinds(emailBatch(), ["photos"]))!.subject, "Alex shared new photos on Hearth", "photos subject");
});

Deno.test("R89 the kind wording carries no caption, what, where or saying words (the batch has none to give)", () => {
  for (const k of NOT_PHOTOS) {
    const [m] = buildPush(withKinds(pushBatch(), [k]));
    const e = buildEmail(withKinds(emailBatch(), [k]))!;
    eq(Object.keys(m).sort(), ["body", "data", "sound", "title", "to"], `${k}: no extra push fields`);
    assert(!/<img/i.test(e.html), `${k}: no image in the email`);
  }
});

// ---------- NOTIFY-K-1..5: the exact words (grandparent-ux, GUX-VC-R11, 44d935c; written first, Nov 24, qa-tdd) ----------
const kinds = (b: Batch, counts: Record<string, number>, postKinds?: string[]): Batch =>
  ({ ...b, kind_counts: counts, post_kinds: postKinds ?? Object.keys(counts) } as Batch);
// Words a leaky claim might carry. None may ever reach a notice (privacy note at the top of index.ts).
const LEAK = { caption: "Gammy is coming for Thanksgiving", title: "Pawpaw's 80th birthday picnic", what: "Pawpaw's 80th birthday picnic",
  when: "2026-12-12", on_date: "2026-12-12", where: "the church hall", place: "the church hall",
  words: "your hair went on vacation", who: "Mia", age: 4 };
const LEAK_RX = /Thanksgiving|picnic|80th|2026-12-12|December|Dec 12|church|hair went|vacation|\bMia\b|\b4\b|age 4/i;
const leaky = (b: Batch): Batch => ({ ...b, ...LEAK } as unknown as Batch);
const allText = (b: Batch) => {
  const [m] = buildPush(b);
  const e = buildEmail({ ...b, channel: "email", email: "grandpa@example.com" } as Batch)!;
  return { m, e, text: `${m.title}\n${m.body}\n${e.subject}\n${e.text}\n${e.html}` };
};

Deno.test("NOTIFY-K-1 one news post: 'Alex shared some news. Tap to read it.', subject and email 'read it'", () => {
  const b = kinds(pushBatch(), { news: 1 });
  const [m] = buildPush(b);
  eq(m.title, "From Alex on Hearth", "push title unchanged");
  eq(m.body, "Alex shared some news. Tap to read it.", "push body");
  const e = buildEmail(kinds(emailBatch(), { news: 1 }))!;
  eq(e.subject, "Alex shared some news on Hearth", "subject");
  assert(e.text.startsWith("Alex shared some news.\n"), "email first line: " + JSON.stringify(e.text));
  assert(e.text.includes("Open Hearth to read it:"), "email verb read it: " + JSON.stringify(e.text));
  assert(e.html.includes("Alex shared some news.") && e.html.includes("Open Hearth to read it"), "html line and verb");
});

Deno.test("NOTIFY-K-1 one event: 'Alex added an event. Tap to see it.', email 'see it'", () => {
  eq(buildPush(kinds(pushBatch(), { event: 1 }))[0].body, "Alex added an event. Tap to see it.", "push body");
  const e = buildEmail(kinds(emailBatch(), { event: 1 }))!;
  eq(e.subject, "Alex added an event on Hearth", "subject");
  assert(e.text.startsWith("Alex added an event.\n") && e.text.includes("Open Hearth to see it:"), "email: " + JSON.stringify(e.text));
});

Deno.test("NOTIFY-K-1 one saying: 'Alex shared a saying. Tap to read it.', email 'read it'", () => {
  eq(buildPush(kinds(pushBatch(), { saying: 1 }))[0].body, "Alex shared a saying. Tap to read it.", "push body");
  const e = buildEmail(kinds(emailBatch(), { saying: 1 }))!;
  eq(e.subject, "Alex shared a saying on Hearth", "subject");
  assert(e.text.startsWith("Alex shared a saying.\n") && e.text.includes("Open Hearth to read it:"), "email: " + JSON.stringify(e.text));
});

Deno.test("NOTIFY-K-1 the email with no website link says 'Open Hearth on your phone to read it.'", () => {
  const saved = Deno.env.get("APP_LINK_BASE");
  Deno.env.delete("APP_LINK_BASE");
  try {
    const e = buildEmail(kinds(emailBatch(), { news: 1 }))!;
    assert(e.text.includes("Open Hearth on your phone to read it."), "plain words: " + JSON.stringify(e.text));
  } finally { if (saved) Deno.env.set("APP_LINK_BASE", saved); }
});

Deno.test("NOTIFY-K-1 no post words, day, place, saying, child's name or age anywhere in push or email", () => {
  for (const c of [{ news: 1 }, { event: 1 }, { saying: 1 }, { photos: 1, news: 1, event: 2, saying: 1 }] as Record<string, number>[]) {
    const { m, text } = allText(leaky(kinds(pushBatch(), c)));
    assert(!LEAK_RX.test(text), `${JSON.stringify(c)} leaked: ${JSON.stringify(text)}`);
    eq(Object.keys(m).sort(), ["body", "data", "sound", "title", "to"], "no extra push fields");
    eq(m.data, { post_id: P1 }, "data is the post id only");
  }
  for (const pk of [["news"], ["event"], ["saying"], ["news", "event"]]) {
    const { text } = allText(leaky(kinds(pushBatch({ post_count: 0, comment_count: 1 }), {}, pk)));
    assert(!LEAK_RX.test(text), `reply ${pk} leaked: ${JSON.stringify(text)}`);
  }
});

Deno.test("NOTIFY-K-2 two events or two sayings: 'added 2 events' / 'shared 2 sayings' and 'Tap to see them.'", () => {
  eq(buildPush(kinds(pushBatch({ post_count: 2 }), { event: 2 }))[0].body, "Alex added 2 events. Tap to see them.", "2 events");
  eq(buildPush(kinds(pushBatch({ post_count: 2 }), { saying: 2 }))[0].body, "Alex shared 2 sayings. Tap to see them.", "2 sayings");
  eq(buildPush(kinds(pushBatch({ post_count: 2 }), { news: 2 }))[0].body, "Alex shared some news. Tap to read it.", "news has no plural");
  const e = buildEmail(kinds(emailBatch({ post_count: 2 }), { event: 2 }))!;
  eq(e.subject, "Alex added 2 events on Hearth", "subject");
  assert(e.text.includes("Open Hearth to see them:"), "email see them");
});

Deno.test("NOTIFY-K-3 several kinds: one line in the fixed order photos, news, events, sayings", () => {
  const b = kinds(pushBatch({ post_count: 5 }), { saying: 1, event: 2, news: 1, photos: 1 });   // order given scrambled
  eq(buildPush(b)[0].body, "Alex shared new photos, some news, 2 events and a saying. Tap to see them.", "mixed body");
  eq(buildPush(kinds(pushBatch({ post_count: 2 }), { event: 1, photos: 1 }))[0].body,
     "Alex shared new photos and an event. Tap to see them.", "two kinds");
  eq(buildPush(kinds(pushBatch({ actor_names: ["Mom", "Chase"], post_count: 3 }), { photos: 1, news: 1, saying: 2 }))[0].body,
     "Mom and Chase shared new photos, some news and 2 sayings. Tap to see them.", "two names, three kinds");
  const e = buildEmail(kinds(emailBatch({ post_count: 2 }), { photos: 1, event: 1 }))!;
  eq(e.subject, "Alex shared new photos and an event on Hearth", "subject");
  assert(e.text.includes("Open Hearth to see them:"), "email see them");
  const long = buildPush(kinds(pushBatch({ actor_names: ["Mom", "Chase", "A", "B", "C"], post_count: 6 }), { photos: 1, news: 1, event: 2, saying: 2 }))[0].body;
  eq(long, "Mom, Chase and 3 others shared new photos, some news, 2 events and 2 sayings. Tap to see them.", "longest line");
  assert(long.length <= 95, "fits two lock-screen lines: " + long.length);
});

Deno.test("NOTIFY-K-4 replies name the kind: your news / your event / your saying / your posts", () => {
  const reply = (pk: string[]) => buildPush(kinds(pushBatch({ actor_names: ["Grandma"], post_count: 0, comment_count: 1 }), {}, pk))[0].body;
  eq(reply(["news"]), "Grandma replied to your news. Tap to see.", "news");
  eq(reply(["event"]), "Grandma replied to your event. Tap to see.", "event");
  eq(reply(["saying"]), "Grandma replied to your saying. Tap to see.", "saying");
  eq(reply(["news", "saying"]), "Grandma replied to your posts. Tap to see.", "mixed kinds");
  eq(reply(["photos", "event"]), "Grandma replied to your posts. Tap to see.", "photos and an event");
  eq(reply(["photos"]), "Grandma replied to your photos. Tap to see.", "photos unchanged");
  const e = buildEmail(kinds(emailBatch({ actor_names: ["Grandma"], post_count: 0, comment_count: 1 }), {}, ["event"]))!;
  eq(e.subject, "Grandma replied to your event on Hearth", "reply subject");
});

Deno.test("NOTIFY-K-4 posts and replies together: 'New posts and replies from' unless every post is photos", () => {
  eq(buildPush(kinds(pushBatch({ comment_count: 1 }), { news: 1 }, ["news", "photos"]))[0].body,
     "New posts and replies from Alex. Tap to see them.", "news plus a reply");
  eq(buildPush(kinds(pushBatch({ comment_count: 1 }), { photos: 1 }, ["photos"]))[0].body,
     "New photos and replies from Alex. Tap to see them.", "all photos: unchanged");
});

Deno.test("NOTIFY-K-5 photo-only batches keep today's words (with and without the new fields, bulk too)", () => {
  for (const b of [pushBatch(), kinds(pushBatch(), { photos: 1 }), kinds(pushBatch({ post_count: 3 }), { photos: 3 })]) {
    eq(buildPush(b)[0].body, "Alex shared new photos. Tap to see them.", "photos body");
  }
  eq(buildEmail(kinds(emailBatch(), { photos: 1 }))!.subject, "Alex shared new photos on Hearth", "photos subject");
  eq(buildPush(kinds(pushBatch({ post_count: 0, comment_count: 1 }), {}, ["photos"]))[0].body, "Alex replied to your photos. Tap to see.", "photo reply");
  const bulkB = { ...pushBatch({ post_count: 48 }), is_batch: true, photo_count: 48, taken_from: "2024-07-04T15:00:00Z",
                  taken_to: "2024-07-20T15:00:00Z", kind_counts: { photos: 48 }, post_kinds: ["photos"] } as Batch;
  eq(buildPush(bulkB)[0].body, "Alex added 48 photos from July 2024. Tap to see them.", "bulk unchanged");
});
