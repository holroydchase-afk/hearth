// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// VID-12 (engineer-found, Nov 10; qa-tdd to review): expo-image-picker gives a video's length in ms on phones but
// in seconds on the web, so the 60 s limit and the poster time read it through pickedDurationMs.
import { pickedDurationMs } from '../pick';

it('VID-12 a picked video\'s length is ms on iOS/Android and seconds turned into ms on the web', () => {
  expect(pickedDurationMs(12_000, 'ios')).toBe(12_000);
  expect(pickedDurationMs(12_000, 'android')).toBe(12_000);
  expect(pickedDurationMs(12.4, 'web')).toBe(12_400);
  expect(pickedDurationMs(61, 'web')).toBe(61_000); // so the web refuses a 61 s video too
  expect(pickedDurationMs(null, 'web')).toBeNull();
  expect(pickedDurationMs(undefined, 'ios')).toBeNull();
});
