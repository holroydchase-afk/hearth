// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// DEC-87 (SPEC-MEDIA 5) Save data's full list: (1) no autoplay (autoplay.test.tsx AUTO-5), (2) Feed cards and the
// Timeline load the small thumbnail only until a photo is opened (DATA-3), (3) the viewer doesn't fetch the next
// photo's full size before the swipe (DATA-4). With Save data off nothing changes (DATA-5 controls, green today).
//
// Seam: app.dataPrefs.saveData (src/state/dataPrefs.ts, saved under DATA_PREFS_KEY). Feed cards (PhotoCollage,
// PhotoSwipe) and TimelineScreen pass MediaImage full={false} while it is on; ViewerScreen skips media.prefetch.
// Measured at MediaCache.uri(postId, mediaId, 'thumb' | 'display'), the one door every photo fetch goes through.
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import { MediaCache } from '../../media/cache';
import { ByDate } from '../../test/galleryEntry';
import { renderApp, type SeedDataPrefs } from '../../test/renderApp';
import { seedPost } from '../../test/seed';
import { PhotosScreen } from '../PhotosScreen';
import { ViewerScreen } from '../ViewerScreen';

const SAVING: SeedDataPrefs = { autoplay: true, saveData: true };
const NOT_SAVING: SeedDataPrefs = { autoplay: true, saveData: false };

let uri: jest.SpyInstance;
let prefetch: jest.SpyInstance;
beforeEach(() => {
  uri = jest.spyOn(MediaCache.prototype, 'uri');
  prefetch = jest.spyOn(MediaCache.prototype, 'prefetch');
});
afterEach(() => jest.restoreAllMocks());

const fetched = (which: 'thumb' | 'display') => uri.mock.calls.filter((c) => c[2] === which).map((c) => c[1] as string);

/** A one-photo post, a two-photo post and a four-photo post (collage shapes), plus an old photo for the Timeline. */
async function family() {
  const be = FakeBackend.withFixture();
  await seedPost(be, { caption: 'Christmas 2023', takenAt: '2023-12-25T17:00:00.000Z', photos: 1 });
  await seedPost(be, { caption: 'One at the park', photos: 1 });
  await seedPost(be, { caption: 'Two at the lake', photos: 2 });
  await seedPost(be, { caption: 'Four in the yard', photos: 4 });
  const posts = await be.clientFor(FIXTURE.users.jo.id).getFeed({ space: FIXTURE.space.id });
  return { be, posts };
}

/** Let every card's image requests start. */
async function settle(min: number) {
  await waitFor(() => expect(fetched('thumb').length).toBeGreaterThanOrEqual(min), { timeout: 5000 });
  await new Promise((r) => setTimeout(r, 100));
}

describe('DATA-3 Save data on: Feed cards and the Timeline load thumbnails only', () => {
  it('DATA-3 Feed: every card\'s photos are fetched as thumbnails; no full size at all', async () => {
    const { be } = await family();
    await renderApp(<PhotosScreen mode="feed" />, { be, user: 'jo', dataPrefs: SAVING });
    await screen.findByText('Four in the yard');
    await settle(4);
    expect(fetched('display')).toEqual([]);
  });

  it('DATA-3 Timeline: thumbnails only', async () => {
    const { be } = await family();
    await renderApp(<ByDate />, { be, user: 'jo', dataPrefs: SAVING });
    await screen.findByText('Christmas 2023');
    await settle(4);
    expect(fetched('display')).toEqual([]);
  });

  it('DATA-3 opening a photo fetches its full size (and only that one)', async () => {
    const { be, posts } = await family();
    const two = posts.find((p) => p.caption === 'Two at the lake')!;
    await renderApp(<ViewerScreen postId={two.post_id} index={0} />, { be, user: 'jo', dataPrefs: SAVING });
    await waitFor(() => expect(fetched('display')).toContain(two.media[0]!.media_id));
    expect(fetched('display')).toEqual([two.media[0]!.media_id]);
  });
});

describe('DATA-4 Save data on: the viewer fetches the next photo only on the swipe', () => {
  it('DATA-4 no look-ahead: the next photo\'s full size waits until Next', async () => {
    const { be, posts } = await family();
    const two = posts.find((p) => p.caption === 'Two at the lake')!;
    await renderApp(<ViewerScreen postId={two.post_id} index={0} />, { be, user: 'jo', dataPrefs: SAVING });
    await waitFor(() => expect(fetched('display')).toContain(two.media[0]!.media_id));
    await new Promise((r) => setTimeout(r, 100));
    expect(prefetch).not.toHaveBeenCalled();
    expect(fetched('display')).not.toContain(two.media[1]!.media_id);
    fireEvent.press(screen.getByRole('button', { name: 'Next photo' }));
    await waitFor(() => expect(fetched('display')).toContain(two.media[1]!.media_id));
  });
});

describe('DATA-5 Save data off: today\'s behaviour is unchanged (controls)', () => {
  it('DATA-5 Feed cards load full size, as today', async () => {
    const { be } = await family();
    await renderApp(<PhotosScreen mode="feed" />, { be, user: 'jo', dataPrefs: NOT_SAVING });
    await screen.findByText('Four in the yard');
    await waitFor(() => expect(fetched('display').length).toBeGreaterThan(0), { timeout: 5000 });
  });

  it('DATA-5 Timeline loads full size, as today', async () => {
    const { be } = await family();
    await renderApp(<ByDate />, { be, user: 'jo', dataPrefs: NOT_SAVING });
    await screen.findByText('Christmas 2023');
    await waitFor(() => expect(fetched('display').length).toBeGreaterThan(0), { timeout: 5000 });
  });

  it('DATA-5 the viewer still warms the next photo, as today', async () => {
    const { be, posts } = await family();
    const two = posts.find((p) => p.caption === 'Two at the lake')!;
    await renderApp(<ViewerScreen postId={two.post_id} index={0} />, { be, user: 'jo', dataPrefs: NOT_SAVING });
    await waitFor(() => expect(prefetch).toHaveBeenCalledWith(two.post_id, [two.media[1]!.media_id]));
  });
});
