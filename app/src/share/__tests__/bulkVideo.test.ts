// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// VID-21 (SPEC-MEDIA 4.1): with video_posting on, a bulk pick's videos are planned and sent like photos; with it
// off, BETA-BULK-5's "left out" line is unchanged. Seam: planBatch(assets, zone, { videos }) — the third argument
// is new, so it is called through a loose type here and a missing option shows as a red assertion.
import { planBatch as realPlanBatch, skippedVideosLine, type BatchPlan, type PickedAsset } from '../bulk';
import type { PhoneZone } from '../../media/captureDate';

const planBatch = realPlanBatch as unknown as (a: PickedAsset[], o: PhoneZone, opts: { videos: boolean }) => BatchPlan;
const NY = { timeZone: 'America/New_York' };

let n = 0;
const photo = (date: string): PickedAsset => ({
  uri: `file:///picked/IMG_${++n}.jpg`, type: 'image', mimeType: 'image/jpeg', width: 4032, height: 3024,
  exif: { DateTimeOriginal: date, OffsetTimeOriginal: '-04:00', GPSLatitude: 35.2271, GPSLongitude: -80.8431 },
});
const video = (date: number): PickedAsset => ({
  uri: `file:///picked/MOV_${++n}.mov`, type: 'video', mimeType: 'video/quicktime', width: 1280, height: 720, duration: 12_000,
  creationTime: date, exif: null,
});
const JULY4_NOON = Date.UTC(2024, 6, 4, 16, 0, 0);
const pick = () => [photo('2024:07:04 09:00:00'), video(JULY4_NOON), photo('2024:07:04 10:00:00'), video(JULY4_NOON + 60_000), video(JULY4_NOON + 120_000)];

describe('VID-21 bulk pick with videos', () => {
  it('VID-21 video_posting on: the 3 videos are planned as video items (size, length) and nothing is left out', () => {
    const plan = planBatch(pick(), NY, { videos: true });
    expect(plan.skippedVideos).toBe(0);
    expect(skippedVideosLine(plan.skippedVideos)).toBeNull();
    const items = plan.posts.flatMap((p) => p.items);
    const vids = items.filter((i) => i.kind === 'video');
    expect(vids).toHaveLength(3);
    for (const v of vids) expect(v).toMatchObject({ kind: 'video', width: 1280, height: 720, durationMs: 12_000 });
    expect(items).toHaveLength(5);
    expect(JSON.stringify(plan)).not.toMatch(/GPS|35\.22/); // still only the date leaves the planner
  });

  it('VID-21 video_posting off: BETA-BULK-5 is unchanged ("so 3 videos were left out", photos only)', () => {
    const plan = planBatch(pick(), NY, { videos: false });
    expect(plan.skippedVideos).toBe(3);
    expect(plan.posts.flatMap((p) => p.items).every((i) => i.kind === 'photo')).toBe(true);
    expect(skippedVideosLine(plan.skippedVideos)).toBe("Hearth can't send videos yet, so 3 videos were left out.");
  });
});
