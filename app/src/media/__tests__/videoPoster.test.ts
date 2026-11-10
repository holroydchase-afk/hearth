// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// SPEC-MEDIA 4.1 (VID-14..17, scoped Nov 10): a video item is the cleaned MP4 as `display` plus a JPEG poster as
// `thumb`. The poster is expo-video's frame at about 1 s (the first frame for shorter clips), re-encoded through
// the image manipulator and the photo thumb steps, so it carries no EXIF. If no frame can be made, a bundled
// placeholder JPEG is used and the video still sends, with nothing about the file logged.
//
// Seams the engineer builds (named here so the tests can drive them):
//   prepareItem(item, deps?)  deps: PrepareDeps = { readBytes, manipulator, makePoster, placeholderPoster }
//   makePoster(videoUri, atMs) -> local JPEG uri of the frame, or null   (expo impl: src/media/expoPoster.ts)
//   placeholderPoster() -> bytes of app/assets/video-poster.jpg
//   MediaCache option videoFiles.write(name, bytes) -> local uri; MediaCache.videoUri(postId, mediaId)
import { readFileSync } from 'fs';
import { join } from 'path';
import { FakeBackend, FIXTURE } from '../../api/fake/FakeBackend';
import type { HearthApi, UploadItemSpec } from '../../api/HearthApi';
import { encryptMedia, encryptedSize } from '../../crypto/media';
import { memoryKV } from '../../platform/kv';
import { APP0_JFIF, APP1_IOS_EXIF, imageData, iosReencode, jpeg } from '../../test/jpeg';
import { movie, SAMSUNG_TRAILER, contains as mp4Contains } from '../../test/mp4';
import { seedVideoPost } from '../../test/seed';
import { UploadQueue, type QueueItem } from '../../upload/queue';
import { MediaCache } from '../cache';
import { verifyClean } from '../clean';
import { cleanVideo, verifyVideoClean } from '../cleanVideo';
import { memoryMediaStore } from '../diskCache';
import { THUMB_LONG_EDGE, THUMB_MAX_BYTES, hasExif, type Manipulator } from '../pipeline';
import * as prepare from '../prepare';

const CHASE = FIXTURE.users.chase.id;

/** The long edge of a JPEG, read from its SOF0/SOF2 segment. */
function jpegSize(b: Uint8Array): { width: number; height: number } {
  let i = 2;
  while (i + 9 < b.length && b[i] === 0xff) {
    const m = b[i + 1]!;
    const len = (b[i + 2]! << 8) | b[i + 3]!;
    if (m === 0xc0 || m === 0xc2) return { height: (b[i + 5]! << 8) | b[i + 6]!, width: (b[i + 7]! << 8) | b[i + 8]! };
    i += 2 + len;
  }
  throw new Error('no SOF');
}

/**
 * The phone: picked files and every manipulator output live in `files`. makePoster writes a frame JPEG that still
 * carries an iOS Exif block (as the native encoder can), at `frame` size; render re-encodes like iOS does.
 */
function phone(o: { frame?: { width: number; height: number }; poster?: 'ok' | 'throws' | 'null' } = {}) {
  const files = new Map<string, Uint8Array>();
  const frame = o.frame ?? { width: 640, height: 360 };
  let n = 0;
  const manipulator: Manipulator = {
    load: jest.fn(async (uri: string) => {
      if (!files.has(uri)) throw new Error('no file');
      return { width: frame.width, height: frame.height, handle: uri };
    }),
    render: jest.fn(async (_img, size) => {
      const uri = `file:///cache/ImageManipulator/${++n}.jpg`;
      files.set(uri, iosReencode(size.width, size.height, 400));
      return { uri, ...size };
    }),
  };
  const makePoster = jest.fn(async (_videoUri: string, _atMs: number): Promise<string | null> => {
    if (o.poster === 'throws') throw new Error('AVAssetImageGenerator failed for file:///picked/MOV_0001.mov');
    if (o.poster === 'null') return null;
    const uri = `file:///cache/VideoThumbnails/${++n}.jpg`;
    files.set(uri, iosReencode(frame.width, frame.height, 400));
    return uri;
  });
  const placeholder = jpeg(APP0_JFIF, imageData(480, 270, 64));
  const placeholderPoster = jest.fn(async () => placeholder);
  const readBytes = jest.fn(async (uri: string) => {
    const b = files.get(uri);
    if (!b) throw new Error('no file');
    return b;
  });
  const deps = { readBytes, manipulator, makePoster, placeholderPoster };
  return { files, deps, placeholder, makePoster, manipulator };
}

const VIDEO_URI = 'file:///picked/MOV_0001.mov';
const videoItem = (over: Partial<QueueItem> = {}): QueueItem => ({ uri: VIDEO_URI, kind: 'video', width: 1280, height: 720, durationMs: 12_000, ...over });

// The deps argument is new; call through `any` so a missing parameter shows as a red assertion, not a type error only.
const prepareItem = (item: QueueItem, deps: unknown) => (prepare.prepareItem as (i: QueueItem, d: unknown) => ReturnType<typeof prepare.prepareItem>)(item, deps);

describe('VID-14 prepareItem for a video', () => {
  it('VID-14 returns the cleaned MP4 as display and a poster JPEG as thumb, and no longer throws EXIF', async () => {
    const p = phone();
    const src = movie({ trailer: SAMSUNG_TRAILER });
    p.files.set(VIDEO_URI, src);
    const out = await prepareItem(videoItem(), p.deps);
    expect(out.display).toEqual(cleanVideo(src));
    expect(() => verifyVideoClean(out.display)).not.toThrow();
    expect(mp4Contains(out.display, '+35.6895')).toBe(false);
    expect([out.thumb[0], out.thumb[1]]).toEqual([0xff, 0xd8]); // a JPEG
    expect(p.makePoster).toHaveBeenCalledWith(VIDEO_URI, 1000);
  });

  it('VID-14 a clip shorter than 1 s uses its first frame', async () => {
    const p = phone();
    p.files.set(VIDEO_URI, movie());
    await prepareItem(videoItem({ durationMs: 600 }), p.deps);
    expect(p.makePoster).toHaveBeenCalledWith(VIDEO_URI, 0);
  });

  it('VID-14 a video over 60 s is still refused (VIDEO_TOO_LONG) before anything is read or a poster made', async () => {
    const p = phone();
    p.files.set(VIDEO_URI, movie());
    await expect(prepareItem(videoItem({ durationMs: 61_000 }), p.deps)).rejects.toMatchObject({ code: 'VIDEO_TOO_LONG' });
    expect(p.deps.readBytes).not.toHaveBeenCalled();
    expect(p.makePoster).not.toHaveBeenCalled();
  });

  it('VID-14 a file the cleaner can\'t read still fails closed with EXIF (never sent as is)', async () => {
    const p = phone();
    p.files.set(VIDEO_URI, new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
    await expect(prepareItem(videoItem(), p.deps)).rejects.toMatchObject({ code: 'EXIF' });
  });
});

describe('VID-15 the poster', () => {
  it('VID-15 is a JPEG with no APP1/EXIF, XMP or MakerNote, at most 48 KB, long edge at most the photo thumb edge', async () => {
    const p = phone({ frame: { width: 1280, height: 720 } });
    p.files.set(VIDEO_URI, movie());
    const { thumb } = await prepareItem(videoItem(), p.deps);
    expect(hasExif(thumb)).toBe(false);
    expect(() => verifyClean(thumb)).not.toThrow();
    expect(thumb.length).toBeLessThanOrEqual(THUMB_MAX_BYTES);
    const s = jpegSize(thumb);
    expect(Math.max(s.width, s.height)).toBeLessThanOrEqual(THUMB_LONG_EDGE);
    expect(p.manipulator.load).toHaveBeenCalled(); // re-encoded, never the native frame as is
  });

  it('VID-15 the bundled placeholder (app/assets/video-poster.jpg) is itself a clean JPEG within the thumb limits', () => {
    const b = new Uint8Array(readFileSync(join(__dirname, '../../../assets/video-poster.jpg')));
    expect([b[0], b[1]]).toEqual([0xff, 0xd8]);
    expect(hasExif(b)).toBe(false);
    expect(() => verifyClean(b)).not.toThrow();
    expect(b.length).toBeLessThanOrEqual(THUMB_MAX_BYTES);
    const s = jpegSize(b);
    expect(Math.max(s.width, s.height)).toBeLessThanOrEqual(THUMB_LONG_EDGE);
  });
});

describe('VID-16 the upload spec for a video', () => {
  it.each([
    ['iPhone .mov (qt brand)', movie(), 'video/quicktime'],
    ['Android .mp4 (isom brand)', movie({ brand: 'isom', moovFirst: true }), 'video/mp4'],
  ])('VID-16 %s: kind video, mime from the file, duration, the video\'s own size, encrypted sizes, exif_stripped', async (_n, src, mime) => {
    const p = phone({ frame: { width: 640, height: 360 } }); // the frame is smaller than the video
    p.files.set(VIDEO_URI, src);
    const out = await prepareItem(videoItem(), p.deps);
    expect(out.spec).toEqual({
      kind: 'video', mime_type: mime, width: 1280, height: 720, duration_ms: 12_000,
      byte_size: encryptedSize(out.display.length), thumb_byte_size: encryptedSize(out.thumb.length), exif_stripped: true,
    });
  });
});

describe('VID-17 no poster frame', () => {
  const quiet = () => (['log', 'info', 'warn', 'error', 'debug'] as const).map((k) => jest.spyOn(console, k).mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it.each(['throws', 'null'] as const)('VID-17 when making the frame %s, the placeholder poster is used and nothing is logged', async (how) => {
    const spies = quiet();
    const p = phone({ poster: how });
    p.files.set(VIDEO_URI, movie());
    const out = await prepareItem(videoItem(), p.deps);
    expect(p.deps.placeholderPoster).toHaveBeenCalled();
    expect(out.thumb).toEqual(p.placeholder);
    expect(out.spec.thumb_byte_size).toBe(encryptedSize(p.placeholder.length));
    for (const s of spies) expect(s).not.toHaveBeenCalled();
  });

  it('VID-17 a placeholder with an Exif block is still cleaned before it leaves the phone', async () => {
    const p = phone({ poster: 'throws' });
    p.files.set(VIDEO_URI, movie());
    p.deps.placeholderPoster.mockResolvedValue(jpeg(APP0_JFIF, APP1_IOS_EXIF, imageData(480, 270, 64)));
    const out = await prepareItem(videoItem(), p.deps);
    expect(hasExif(out.thumb)).toBe(false);
  });

  it('VID-17 the video still sends: create_post -> sign-media -> published, kind video, no error report, no logs', async () => {
    const spies = quiet();
    const p = phone({ poster: 'throws' });
    p.files.set(VIDEO_URI, movie());
    const be = FakeBackend.withFixture();
    const api = be.clientFor(CHASE);
    const signed: UploadItemSpec[][] = [];
    const real = api.signUpload.bind(api);
    jest.spyOn(api as HearthApi, 'signUpload').mockImplementation(async (postId, items) => { signed.push(items); return real(postId, items); });
    const q = await UploadQueue.open({
      api, kv: memoryKV(), userId: CHASE, prepare: (item) => prepareItem(item, p.deps), setTimer: () => () => {},
      encrypt: (plain, dek) => encryptMedia(plain, dek),
    });
    await q.enqueue({ space: FIXTURE.space.id, caption: 'Leo on the slide', circleIds: [FIXTURE.circles.dadSide.id], items: [videoItem()] });
    await q.idle();
    q.stop();
    const job = q.jobs()[0]!;
    expect({ state: job.state, errorCode: job.errorCode }).toEqual({ state: 'published', errorCode: undefined });
    expect(signed[0]![0]).toMatchObject({ kind: 'video', exif_stripped: true });
    expect(be.state.clientErrors ?? []).toEqual([]);
    for (const s of spies) expect(s).not.toHaveBeenCalled();
  });
});

describe('VID-18 the player gets a local .mp4 file', () => {
  it('VID-18 MediaCache.videoUri decrypts the video into a file whose name ends in .mp4 (even for a .mov), never into the kept-file store', async () => {
    const be = FakeBackend.withFixture();
    const v = await seedVideoPost(be, { mime: 'video/quicktime' });
    const api = be.clientFor(FIXTURE.users.jo.id);
    const store = memoryMediaStore();
    const write = jest.fn(async (name: string, _bytes: Uint8Array) => `file:///cache/video/${name}`);
    const Cache = MediaCache as unknown as new (a: HearthApi, o: object) => MediaCache & { videoUri(p: string, m: string): Promise<string> };
    const cache = new Cache(api, { disk: { store, keys: memoryKV(), userId: FIXTURE.users.jo.id }, videoFiles: { write } });
    expect(typeof cache.videoUri).toBe('function');
    const uri = await cache.videoUri(v.id, v.mediaId);
    expect(write).toHaveBeenCalledTimes(1);
    const [name, bytes] = write.mock.calls[0]!;
    expect(name).toMatch(/\.mp4$/);
    expect(name).toContain(v.mediaId);
    expect(bytes).toEqual(v.video);
    expect(uri).toBe(`file:///cache/video/${name}`);
    await cache.flush();
    for (const kept of Object.values(store.dump())) expect(kept).not.toEqual(v.video); // only ciphertext is ever kept
  });
});
