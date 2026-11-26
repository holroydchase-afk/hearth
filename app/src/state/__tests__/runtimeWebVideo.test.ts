// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// HRT-WEB.3 WEB-APP-34 (SPEC-WEB-APP.md, architect call: "gates on the real backend (runtime.ts build kind), not on
// Platform.OS"): the real-backend web build never offers video, even with video_posting on; the Fake/demo web build
// keeps it (VID-18, e2e-web/video.spec.js), and phones are unchanged.
//
// The contract: createRuntime() in a web build with a real backend hands back pickPhotos/pickBulk that ask the browser
// for images only, whatever `videos` they are called with. A video the browser still returns is left to the bulk
// planner (planBatch skips it and counts it for the "videos skipped" line).
import { Platform } from 'react-native';

jest.mock('expo-image-picker', () => ({
  VideoExportPreset: { Passthrough: 0, H264_1280x720: 6 },
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
}));

let launch: jest.Mock;

function runtimeFor(os: 'web' | 'ios', fake: boolean) {
  process.env.EXPO_PUBLIC_HEARTH_FAKE = fake ? '1' : '0';
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-test-key';
  let rt: unknown;
  jest.isolateModules(() => {
    const RN = require('react-native') as { Platform: { OS: string } };
    RN.Platform.OS = os;
    launch = (require('expo-image-picker') as { launchImageLibraryAsync: jest.Mock }).launchImageLibraryAsync;
    rt = (require('../runtime') as { createRuntime: () => unknown }).createRuntime();
  });
  return rt as { error?: string; pickPhotos: (o: { videos: boolean }) => Promise<unknown>; pickBulk: (o?: { videos: boolean }) => Promise<unknown> };
}

describe('WEB-APP-34 no video on the real-backend web build', () => {
  const realOS = Platform.OS;
  afterEach(() => { (Platform as { OS: string }).OS = realOS; });

  it('WEB-APP-34 real web: pickPhotos({ videos: true }) asks the browser for images only', async () => {
    const rt = runtimeFor('web', false);
    expect(rt.error).toBeUndefined();
    await rt.pickPhotos({ videos: true });
    expect(launch).toHaveBeenLastCalledWith(expect.objectContaining({ mediaTypes: ['images'] }));
  });

  it('WEB-APP-34 real web: the bulk pick asks for images only too', async () => {
    const rt = runtimeFor('web', false);
    await rt.pickBulk({ videos: true });
    expect(launch).toHaveBeenLastCalledWith(expect.objectContaining({ mediaTypes: ['images'] }));
  });

  it('WEB-APP-34 guard: the Fake/demo web build keeps video (VID-18 still posts one)', async () => {
    const rt = runtimeFor('web', true);
    await rt.pickPhotos({ videos: true });
    expect(launch).toHaveBeenLastCalledWith(expect.objectContaining({ mediaTypes: ['images', 'videos'] }));
  });

  it('WEB-APP-34 guard: a phone with a real backend still offers video when video_posting is on', async () => {
    const rt = runtimeFor('ios', false);
    await rt.pickPhotos({ videos: true });
    expect(launch).toHaveBeenLastCalledWith(expect.objectContaining({ mediaTypes: ['images', 'videos'] }));
  });
});
