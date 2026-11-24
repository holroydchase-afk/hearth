// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// PRIV-R1 (P1) / PRIV-R2 (P2), privacy-security review of DEC-87 autoplay: a decrypted video file must never stay on
// the phone after a Feed card lets it go, and one caller's abort must not break another caller's shared download.
import { FakeBackend, FIXTURE } from '../../api/fake/FakeBackend';
import { seedVideoPost } from '../../test/seed';
import { MediaCache } from '../cache';

const flush = () => new Promise((r) => setTimeout(r, 0));

async function setup(write?: (name: string) => Promise<string>) {
  const be = FakeBackend.withFixture();
  const v = await seedVideoPost(be, { circles: [FIXTURE.circles.dadSide.id] });
  const api = be.clientFor(FIXTURE.users.jo.id);
  const files = {
    write: jest.fn(write ?? (async (name: string) => `file:///cache/video/${name}`)),
    remove: jest.fn(async (_name: string) => {}),
  };
  const cache = new MediaCache(api, { videoFiles: files });
  return { v, files, cache };
}

describe('PRIV-R1 the decrypted .mp4 is deleted when a quiet Feed video is let go', () => {
  it('PRIV-R1a downloaded with a signal, then aborted (scrolled past), then releaseVideo: the file is removed once', async () => {
    const { v, files, cache } = await setup();
    const ac = new AbortController();
    await expect(cache.videoUri(v.id, v.mediaId, { signal: ac.signal })).resolves.toMatch(/\.mp4$/);
    expect(files.write).toHaveBeenCalledWith(`${v.mediaId}.mp4`, expect.anything());
    ac.abort(); // the card's cleanup aborts first…
    cache.releaseVideo(v.mediaId); // …then lets the file go
    await flush();
    expect(files.remove).toHaveBeenCalledTimes(1);
    expect(files.remove).toHaveBeenCalledWith(`${v.mediaId}.mp4`);
  });

  it('PRIV-R1b aborted while the file is being written: AbortError, and the half-made file is removed', async () => {
    let finish!: (uri: string) => void;
    const { v, files, cache } = await setup((name) => new Promise<string>((r) => { finish = () => r(`file:///cache/video/${name}`); }));
    const ac = new AbortController();
    const p = cache.videoUri(v.id, v.mediaId, { signal: ac.signal });
    const settled = p.then(() => 'resolved', (e: { name?: string }) => e.name);
    for (let i = 0; i < 50 && !files.write.mock.calls.length; i++) await flush();
    expect(files.write).toHaveBeenCalledTimes(1);
    ac.abort();
    cache.releaseVideo(v.mediaId);
    finish('');
    expect(await settled).toBe('AbortError');
    await flush();
    expect(files.remove).toHaveBeenCalledWith(`${v.mediaId}.mp4`);
  });
});

describe('PRIV-R2 one caller aborting does not break another caller sharing the download', () => {
  it('PRIV-R2 a signalled caller starts the download, a no-signal caller (full-screen Play) shares it; the abort rejects only the first', async () => {
    const { v, files, cache } = await setup();
    const ac = new AbortController();
    const quiet = cache.videoUri(v.id, v.mediaId, { signal: ac.signal });
    const full = cache.videoUri(v.id, v.mediaId);
    const quietDone = quiet.then(() => 'resolved', (e: { name?: string }) => e.name);
    ac.abort();
    await expect(full).resolves.toMatch(/\.mp4$/);
    expect(await quietDone).toBe('AbortError');
    await flush();
    expect(files.remove).not.toHaveBeenCalled(); // the full-screen player is still using it
  });

  it('PRIV-R2 the other order: the no-signal caller first, then a signalled one that aborts', async () => {
    const { v, cache } = await setup();
    const ac = new AbortController();
    const full = cache.videoUri(v.id, v.mediaId);
    const quiet = cache.videoUri(v.id, v.mediaId, { signal: ac.signal });
    const quietDone = quiet.then(() => 'resolved', (e: { name?: string }) => e.name);
    ac.abort();
    await expect(full).resolves.toMatch(/\.mp4$/);
    expect(await quietDone).toBe('AbortError');
  });
});
