// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// QA-R3 (qa-tdd review of pickDuration.test.ts, Nov 10): expo-image-picker 58 on the web reports duration 0 when
// it can't read a video's metadata (getVideoMetadata's onerror). 0 ms passes checkVideo's 60 s limit, so a long
// video whose length is unknown would be sent. An unknown length must be null, which checkVideo refuses.
import { checkVideo } from '../pipeline';
import { pickedDurationMs } from '../pick';

it('VID-12 (QA-R3) the web picker\'s 0 for "metadata unreadable" is an unknown length, refused like null', () => {
  expect(pickedDurationMs(0, 'web')).toBeNull();
  expect(() => checkVideo({ durationMs: pickedDurationMs(0, 'web') })).toThrow(expect.objectContaining({ code: 'VIDEO_TOO_LONG' }));
});
