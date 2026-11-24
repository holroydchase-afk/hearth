// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// AUTO-3 (DEC-86, SPEC-MEDIA 5): a Feed video scrolled away stops downloading. Seam: MediaCache.videoUri takes an
// optional third argument `{ signal?: AbortSignal }`; once the signal is aborted the fetch stops, the promise
// rejects with an error named 'AbortError', nothing is written or kept, and a later call fetches again.
import { FakeBackend, FIXTURE } from '../../api/fake/FakeBackend';
import { seedVideoPost } from '../../test/seed';
import { MediaCache } from '../cache';

type VideoUri = (postId: string, mediaId: string, opts?: { signal?: AbortSignal }) => Promise<string>;

async function setup() {
  const be = FakeBackend.withFixture();
  const v = await seedVideoPost(be, { circles: [FIXTURE.circles.dadSide.id] });
  const api = be.clientFor(FIXTURE.users.jo.id);
  const getObject = jest.spyOn(api, 'getObject');
  const write = jest.fn(async (name: string) => `file:///cache/video/${name}`);
  const cache = new MediaCache(api, { videoFiles: { write, remove: jest.fn(async () => {}) } });
  return { v, getObject, write, videoUri: (cache.videoUri as VideoUri).bind(cache) };
}

describe('AUTO-3 a video download stops when it is scrolled away', () => {
  it('AUTO-3 already aborted: rejects with AbortError and never downloads the video file', async () => {
    const { v, getObject, write, videoUri } = await setup();
    const ac = new AbortController();
    ac.abort();
    await expect(videoUri(v.id, v.mediaId, { signal: ac.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(getObject).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it('AUTO-3 aborted mid-download: rejects, nothing is written, and the next call downloads again', async () => {
    const { v, getObject, write, videoUri } = await setup();
    const ac = new AbortController();
    const p = videoUri(v.id, v.mediaId, { signal: ac.signal });
    ac.abort(); // she scrolled on before the file arrived
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
    expect(write).not.toHaveBeenCalled();
    const before = getObject.mock.calls.length;
    await expect(videoUri(v.id, v.mediaId)).resolves.toMatch(/\.mp4$/); // not a cached failure
    expect(getObject.mock.calls.length).toBe(before + 1);
    expect(write).toHaveBeenCalledTimes(1);
  });
});
