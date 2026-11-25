// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// deno test --allow-env supabase/functions/sign-media/
// Smoke test of the handler against a mocked PostgREST (no network).
import { handler } from "./index.ts";

const env: Record<string, string> = {
  SUPABASE_URL: "https://proj.supabase.co",
  SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  B2_ENDPOINT: "https://s3.us-east-005.backblazeb2.com",
  B2_REGION: "us-east-005",
  B2_BUCKET: "hearth-media",
  B2_KEY_ID: "keyid",
  B2_APP_KEY: "appkey",
  MEDIA_KEK: btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))),
};
for (const [k, v] of Object.entries(env)) Deno.env.set(k, v);

const POST = "55555555-0000-0000-0000-0000000000a1";
const MEDIA = "66666666-0000-0000-0000-000000000001";
let canView = true;
let storedKey = "";
// FLAG-4: what the 0013 database answers when video_posting is off for the family (prepare_media_upload refuses)
let videoPostingOff = false;
const calls: string[] = [];
// QA-R4: knobs for the branches below.
let prepareError: { status: number; body: unknown } | null = null; // what prepare_media_upload answers instead
let viewError: { status: number; body: unknown } | null = null; // what can_view_post answers instead
let pendingRows: unknown[] = []; // the caller's pending rows the finalize query returns
const b2Length: Record<string, number> = {}; // object key suffix -> content-length B2 reports on HEAD
const marked: { p_media: string; p_ok: boolean }[] = [];

globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input);
  calls.push(`${init?.method ?? "GET"} ${url}`);
  const ok = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
  if (url.startsWith("https://s3.us-east-005.backblazeb2.com/") && init?.method === "HEAD") {
    const key = Object.keys(b2Length).find((k) => new URL(url).pathname.endsWith(k));
    return key === undefined ? new Response(null, { status: 404 })
      : new Response(null, { status: 200, headers: { "content-length": String(b2Length[key]) } });
  }
  if (url.endsWith("/rpc/mark_media_upload_result")) {
    marked.push(JSON.parse(String(init?.body)));
    return ok(null);
  }
  if (url.endsWith("/rpc/can_view_post")) {
    return viewError ? new Response(JSON.stringify(viewError.body), { status: viewError.status }) : ok(canView);
  }
  if (url.endsWith("/rpc/prepare_media_upload") && prepareError) {
    return new Response(JSON.stringify(prepareError.body), { status: prepareError.status });
  }
  if (url.includes("/media_items") && url.includes("upload_status=eq.pending")) return ok(pendingRows);
  if (url.endsWith("/rpc/prepare_media_upload")) {
    const items = JSON.parse(String(init?.body ?? "{}")).p_items ?? [];
    if (videoPostingOff && items.some((i: { kind?: string }) => i?.kind === "video")) {
      return new Response(JSON.stringify({ code: "42501", message: "video_posting_off", details: null, hint: null }), { status: 403 });
    }
    return ok([{ media_id: MEDIA, item_index: 0, kind: "photo", display_key: `s/x/p/${POST}/m/${MEDIA}/display`, thumb_key: `s/x/p/${POST}/m/${MEDIA}/thumb` }]);
  }
  if (url.includes("/media_keys") && init?.method === "POST") {
    storedKey = JSON.parse(String(init.body))[0].wrapped_dek;
    return new Response("", { status: 201 });
  }
  if (url.includes("/media_keys")) return ok([{ media_id: MEDIA, wrapped_dek: storedKey }]);
  if (url.includes("/media_items")) {
    return ok([{ id: MEDIA, post_id: POST, position: 0, kind: "photo", mime_type: "image/jpeg",
      display_key: `s/x/p/${POST}/m/${MEDIA}/display`, thumb_key: `s/x/p/${POST}/m/${MEDIA}/thumb`,
      width: 10, height: 10, duration_ms: null, byte_size: 100, thumb_byte_size: 10, enc_scheme: "aes-256-gcm-chunked-v1", upload_status: "ready" }]);
  }
  return new Response("not mocked", { status: 500 });
}) as typeof fetch;

function assert(c: unknown, msg: string) { if (!c) throw new Error(msg); }
const auth = { authorization: "Bearer user-jwt" };

Deno.test("upload then view round-trips the data key; URLs are 10-minute SigV4", async () => {
  const up = await handler(new Request("https://fn/sign-media", { method: "POST", headers: auth,
    body: JSON.stringify({ action: "upload", post_id: POST, items: [{ kind: "photo", mime_type: "image/jpeg",
      width: 10, height: 10, byte_size: 100, thumb_byte_size: 10, exif_stripped: true }] }) }));
  assert(up.status === 200, `upload status ${up.status}`);
  const u = await up.json();
  const put = new URL(u.items[0].display_put_url);
  assert(put.host === "s3.us-east-005.backblazeb2.com", "B2 host");
  assert(put.searchParams.get("X-Amz-Expires") === "600", "10 min TTL");
  assert(put.searchParams.get("X-Amz-SignedHeaders") === "content-type;host", "content-type signed on PUT");

  const view = await handler(new Request(`https://fn/sign-media?post_id=${POST}`, { headers: auth }));
  assert(view.status === 200, `view status ${view.status}`);
  const v = await view.json();
  assert(v.items[0].dek === u.items[0].dek, "unwrapped DEK equals issued DEK");
  assert(new URL(v.items[0].display_url).searchParams.get("X-Amz-Expires") === "600", "GET TTL");
});

Deno.test("view denied -> 404, no key lookups", async () => {
  canView = false; calls.length = 0;
  const r = await handler(new Request(`https://fn/sign-media?post_id=${POST}`, { headers: auth }));
  assert(r.status === 404, `status ${r.status}`);
  assert(!calls.some((c) => c.includes("media_keys")), "must not touch keys when denied");
  canView = true;
});

Deno.test("exif not stripped -> 422; no auth -> 401", async () => {
  const r = await handler(new Request("https://fn/sign-media", { method: "POST", headers: auth,
    body: JSON.stringify({ action: "upload", post_id: POST, items: [{ kind: "photo", exif_stripped: false }] }) }));
  assert(r.status === 422, `status ${r.status}`);
  const r2 = await handler(new Request(`https://fn/sign-media?post_id=${POST}`));
  assert(r2.status === 401, `status ${r2.status}`);
});

Deno.test("FLAG-4 video_posting off -> sign-media refuses a video upload (403 video_posting_off), signs nothing", async () => {
  videoPostingOff = true; calls.length = 0;
  const r = await handler(new Request("https://fn/sign-media", { method: "POST", headers: auth,
    body: JSON.stringify({ action: "upload", post_id: POST, items: [{ kind: "video", mime_type: "video/mp4",
      width: 1920, height: 1080, duration_ms: 5000, byte_size: 100000, thumb_byte_size: 1000, exif_stripped: true }] }) }));
  videoPostingOff = false;
  assert(r.status === 403, `status ${r.status}`);
  const body = await r.json();
  assert(body.error === "video_posting_off", `error ${body.error}`);
  assert(!JSON.stringify(body).includes("X-Amz-"), "no presigned URL in the refusal");
  assert(!calls.some((c) => c.startsWith("POST") && c.includes("media_keys")), "must not store a key for a refused upload");
});

// ---------- QA-R4: every branch of the handler ----------
const photo = { kind: "photo", mime_type: "image/jpeg", width: 10, height: 10, byte_size: 100, thumb_byte_size: 10, exif_stripped: true };
const upload = (items: unknown) => handler(new Request("https://fn/sign-media", { method: "POST", headers: auth,
  body: JSON.stringify({ action: "upload", post_id: POST, items }) }));
const finalize = (media_ids: unknown) => handler(new Request("https://fn/sign-media", { method: "POST", headers: auth,
  body: JSON.stringify({ action: "finalize", media_ids }) }));
const M2 = "66666666-0000-0000-0000-000000000002";
const pending = (id: string) => ({ id, display_key: `s/x/p/${POST}/m/${id}/display`, thumb_key: `s/x/p/${POST}/m/${id}/thumb`,
  byte_size: 100, thumb_byte_size: 10, uploader_id: "u1" });

Deno.test("QA-R4 upload takes 1..20 items: 0 and 21 are 400, nothing signed or stored", async () => {
  calls.length = 0;
  for (const items of [[], Array(21).fill(photo), "nope"]) {
    const r = await upload(items);
    assert(r.status === 400, `status ${r.status} for ${Array.isArray(items) ? items.length : items}`);
    assert(!(await r.text()).includes("X-Amz-"), "no presigned URL");
  }
  assert(!calls.some((c) => c.includes("prepare_media_upload") || c.includes("media_keys")), "no database calls");
});

Deno.test("QA-R4 ENG-R11 free video cap (HF002) -> 402 free_video_cap_reached, no key stored", async () => {
  prepareError = { status: 400, body: { code: "HF002", message: "free_video_cap_reached", details: null, hint: null } };
  calls.length = 0;
  const r = await upload([{ ...photo, kind: "video", mime_type: "video/mp4", duration_ms: 5000 }]);
  prepareError = null;
  assert(r.status === 402, `status ${r.status}`);
  assert((await r.json()).error === "free_video_cap_reached", "error name");
  assert(!calls.some((c) => c.startsWith("POST") && c.includes("media_keys")), "no key stored");
});

// ENG-R11: branch on the code, never the message (rule 7). HF001 is family_full (0024), not the video cap.
Deno.test("ENG-R11 a P0001 whose message mentions free_video_cap_reached is NOT a 402", async () => {
  prepareError = { status: 400, body: { code: "P0001", message: "trigger said free_video_cap_reached somewhere", details: null, hint: null } };
  const r = await upload([{ ...photo, kind: "video", mime_type: "video/mp4", duration_ms: 5000 }]);
  prepareError = null;
  assert(r.status !== 402, `status ${r.status}`);
  assert((await r.json()).error !== "free_video_cap_reached", "not reported as the video cap");
});

Deno.test("ENG-R11 family_full (HF001) is not reported as the video cap", async () => {
  prepareError = { status: 400, body: { code: "HF001", message: "family_full", details: null, hint: null } };
  const r = await upload([{ ...photo, kind: "video", mime_type: "video/mp4", duration_ms: 5000 }]);
  prepareError = null;
  assert(r.status !== 402, `status ${r.status}`);
  assert((await r.json()).error !== "free_video_cap_reached", "not reported as the video cap");
});

Deno.test("QA-R4 not the author (42501) -> 403 forbidden; bad row (23514) -> 400 invalid", async () => {
  prepareError = { status: 403, body: { code: "42501", message: "not_author", details: null, hint: null } };
  const r = await upload([photo]);
  assert(r.status === 403 && (await r.json()).error === "forbidden", `forbidden status ${r.status}`);
  prepareError = { status: 400, body: { code: "23514", message: "check violated", details: null, hint: null } };
  const r2 = await upload([photo]);
  prepareError = null;
  assert(r2.status === 400 && (await r2.json()).error === "invalid", `invalid status ${r2.status}`);
});

Deno.test("QA-R4 expired session (PGRST301) -> 401, never 500", async () => {
  viewError = { status: 401, body: { code: "PGRST301", message: "JWT expired", details: null, hint: null } };
  const r = await handler(new Request(`https://fn/sign-media?post_id=${POST}`, { headers: auth }));
  viewError = null;
  assert(r.status === 401, `status ${r.status}`);
});

Deno.test("QA-R4 an unknown database error is 500 'internal' and logs no message text", async () => {
  viewError = { status: 500, body: { code: "XX000", message: "row secret-caption-text", details: null, hint: null } };
  const logged: string[] = [];
  const orig = console.error;
  console.error = (...a: unknown[]) => { logged.push(a.map(String).join(" ")); };
  const r = await handler(new Request(`https://fn/sign-media?post_id=${POST}`, { headers: auth }));
  console.error = orig;
  viewError = null;
  assert(r.status === 500 && (await r.json()).error === "internal", `status ${r.status}`);
  assert(!logged.join("\n").includes("secret-caption-text"), "database message must not be logged");
});

Deno.test("QA-R4 finalize marks ok only when both objects exist at the promised sizes", async () => {
  pendingRows = [pending(MEDIA), pending(M2)];
  marked.length = 0;
  for (const k of Object.keys(b2Length)) delete b2Length[k];
  b2Length[`/m/${MEDIA}/display`] = 100; b2Length[`/m/${MEDIA}/thumb`] = 10; // right sizes
  b2Length[`/m/${M2}/display`] = 99; b2Length[`/m/${M2}/thumb`] = 10; // display one byte short
  const r = await finalize([MEDIA, M2]);
  assert(r.status === 200, `status ${r.status}`);
  const { results } = await r.json();
  const byId = Object.fromEntries(results.map((x: { media_id: string; ok: boolean }) => [x.media_id, x.ok]));
  assert(byId[MEDIA] === true && byId[M2] === false, `results ${JSON.stringify(results)}`);
  assert(marked.length === 2 && marked.find((m) => m.p_media === M2)?.p_ok === false, "both marked, M2 failed");

  delete b2Length[`/m/${MEDIA}/thumb`]; // thumbnail never arrived (404)
  pendingRows = [pending(MEDIA)];
  const r2 = await finalize([MEDIA]);
  assert((await r2.json()).results[0].ok === false, "missing thumb is not ok");
  pendingRows = [];
});

Deno.test("QA-R4 finalize takes 1..20 uuids; anything else is 400 and checks nothing", async () => {
  calls.length = 0;
  for (const ids of [[], Array(21).fill(MEDIA), ["not-a-uuid"], "nope"]) {
    const r = await finalize(ids);
    assert(r.status === 400, `status ${r.status} for ${JSON.stringify(ids).slice(0, 40)}`);
  }
  assert(calls.length === 0, `no calls, got ${calls.join(", ")}`);
});

Deno.test("QA-R4 finalize skips rows that aren't the caller's pending rows", async () => {
  pendingRows = []; // RLS hides someone else's row, or it is already ready
  marked.length = 0;
  const r = await finalize([MEDIA]);
  assert(r.status === 200, `status ${r.status}`);
  assert((await r.json()).results.length === 0 && marked.length === 0, "nothing marked");
});

Deno.test("QA-R4 CORS: only a listed origin is echoed; preflight is 204 without auth", async () => {
  Deno.env.set("ALLOWED_ORIGINS", "https://chaseholroyd.com, https://thefreighttrains-team-hearth.expo.app");
  const pre = await handler(new Request("https://fn/sign-media", { method: "OPTIONS", headers: { origin: "https://chaseholroyd.com" } }));
  assert(pre.status === 204, `preflight ${pre.status}`);
  assert(pre.headers.get("access-control-allow-origin") === "https://chaseholroyd.com", "listed origin echoed");
  const evil = await handler(new Request(`https://fn/sign-media?post_id=${POST}`, { headers: { ...auth, origin: "https://evil.example" } }));
  assert(evil.headers.get("access-control-allow-origin") === null, "unlisted origin not echoed");
  Deno.env.delete("ALLOWED_ORIGINS");
  const none = await handler(new Request("https://fn/sign-media", { method: "OPTIONS", headers: { origin: "https://chaseholroyd.com" } }));
  assert(none.headers.get("access-control-allow-origin") === null, "no list, no origin");
});

Deno.test("QA-R4 bad requests: missing post_id 400, unknown action 400, PUT 405", async () => {
  const a = await handler(new Request("https://fn/sign-media?post_id=nope", { headers: auth }));
  assert(a.status === 400, `bad post_id ${a.status}`);
  const b = await handler(new Request("https://fn/sign-media", { method: "POST", headers: auth, body: JSON.stringify({ action: "zap" }) }));
  assert(b.status === 400, `unknown action ${b.status}`);
  const c = await handler(new Request("https://fn/sign-media", { method: "PUT", headers: auth }));
  assert(c.status === 405, `PUT ${c.status}`);
});
