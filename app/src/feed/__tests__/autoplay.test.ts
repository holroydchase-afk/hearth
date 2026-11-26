// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// DEC-87 (SPEC-MEDIA 5): the pure parts of Feed autoplay and Save data, red until the engineer adds them.
//
// Seams (loaded at run time so typecheck stays clean before they exist):
//   src/feed/autoplay.ts    export const AUTOPLAY_VIEWABILITY = { itemVisiblePercentThreshold: 80, minimumViewTime: 1000, waitForInteraction: true }
//                           (the ONE constant; Feed's FlatList passes it as viewabilityConfig, and the hook's own
//                           "still again after a scroll" wait reads minimumViewTime from it)
//   src/state/dataPrefs.ts  export const DATA_PREFS_KEY = 'hearth.dataPrefs.v1'   (per phone; no user id in it)
//                           export interface DataPrefs { autoplay: boolean; saveData: boolean | null }  (null = never asked)
//                           export function defaultDataPrefs(): DataPrefs           -> { autoplay: true, saveData: null }
//                           export function loadDataPrefs(kv: KV): Promise<DataPrefs>
//                           export function saveDataPrefs(kv: KV, p: DataPrefs): Promise<void>
//                           export function autoplayOn(p: DataPrefs, reduceMotion: boolean): boolean
import { memoryKV, type KV } from '../../platform/kv';
import { DATA_PREFS_KEY } from '../../test/renderApp';

type Viewability = { itemVisiblePercentThreshold?: number; viewAreaCoveragePercentThreshold?: number; minimumViewTime?: number; waitForInteraction?: boolean };
type DataPrefs = { autoplay: boolean; saveData: boolean | null };
const autoplay = () => require('../autoplay') as { AUTOPLAY_VIEWABILITY: Viewability };
const dataPrefs = () => require('../../state/dataPrefs') as {
  DATA_PREFS_KEY: string;
  defaultDataPrefs(): DataPrefs;
  loadDataPrefs(kv: KV): Promise<DataPrefs>;
  saveDataPrefs(kv: KV, p: DataPrefs): Promise<void>;
  autoplayOn(p: DataPrefs, reduceMotion: boolean): boolean;
};

describe('AUTO-9 one named viewability constant', () => {
  it('AUTO-9 AUTOPLAY_VIEWABILITY is 80% / 1000 ms / waitForInteraction true, and nothing else', () => {
    expect(autoplay().AUTOPLAY_VIEWABILITY).toEqual({ itemVisiblePercentThreshold: 80, minimumViewTime: 1000, waitForInteraction: true });
  });
});

// The phone's own list does the dwell: React Native's ViewabilityHelper with Hearth's constant. These drive it with
// fake timers and fake cell sizes (one 600 pt card per row on a 800 pt screen), the way FlatList calls it on scroll.
describe('AUTO-8 nothing is reported viewable (so nothing downloads) without a 1 s still pause at 80%', () => {
  type Helper = { onUpdate(...a: unknown[]): void; recordInteraction(): void; dispose(): void };
  const ViewabilityHelper = (require('@react-native/virtualized-lists/Lists/ViewabilityHelper') as { default: new (c: Viewability) => Helper }).default;
  const ROW = 600;
  const VIEWPORT = 800;
  const props = { data: [0, 1, 2, 3, 4], getItemCount: (d: number[]) => d.length };
  const metrics = { getCellMetrics: (i: number) => ({ offset: i * ROW, length: ROW, isMounted: true }) };
  const token = (index: number, isViewable: boolean) => ({ index, isViewable, item: index, key: String(index) });

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  function list() {
    const helper = new ViewabilityHelper(autoplay().AUTOPLAY_VIEWABILITY);
    const seen: number[][] = [];
    const cb = ({ viewableItems }: { viewableItems: { index: number }[] }) => seen.push(viewableItems.map((v) => v.index));
    const at = (y: number) => helper.onUpdate(props, y, VIEWPORT, metrics, token, cb);
    return { helper, seen, at };
  }

  it('AUTO-8 before any scroll (waitForInteraction), the first video is not reported, even after 5 s', () => {
    const { seen, at } = list();
    at(0);
    jest.advanceTimersByTime(5000);
    expect(seen).toEqual([]);
  });

  it('AUTO-8 scrolling past a card in under 1 s never reports it', () => {
    const { helper, seen, at } = list();
    helper.recordInteraction();
    at(ROW); // row 1 fully on screen
    jest.advanceTimersByTime(400);
    at(ROW * 2); // row 2
    jest.advanceTimersByTime(400);
    at(ROW * 3); // row 3, then 1 s still
    jest.advanceTimersByTime(999);
    expect(seen).toEqual([]);
    jest.advanceTimersByTime(1);
    expect(seen).toEqual([[3]]); // only the one she stopped on
  });

  it('AUTO-8 a card under 80% on screen is never reported, however long the list is still', () => {
    const { helper, seen, at } = list();
    helper.recordInteraction();
    at(ROW + ROW * 0.25); // row 1 is 75% on screen, row 2 is 58%
    jest.advanceTimersByTime(5000);
    expect(seen.flat()).toEqual([]);
  });
});

describe('DATA-6 / AUTO-1 the two settings are saved on this phone only', () => {
  it('AUTO-1 / DATA-1 a fresh install: Play videos as I scroll on, Save data not yet asked (null)', async () => {
    expect(dataPrefs().defaultDataPrefs()).toEqual({ autoplay: true, saveData: null });
    expect(await dataPrefs().loadDataPrefs(memoryKV())).toEqual({ autoplay: true, saveData: null });
  });

  it('DATA-6 one key for the phone (no account id in it); save then load round-trips', async () => {
    expect(dataPrefs().DATA_PREFS_KEY).toBe(DATA_PREFS_KEY);
    expect(DATA_PREFS_KEY).not.toMatch(/[0-9a-f]{8}-/); // never a user id
    const kv = memoryKV();
    await dataPrefs().saveDataPrefs(kv, { autoplay: false, saveData: true });
    expect(JSON.parse(kv.dump()[DATA_PREFS_KEY]!)).toEqual({ autoplay: false, saveData: true });
    expect(await dataPrefs().loadDataPrefs(kv)).toEqual({ autoplay: false, saveData: true });
    expect(Object.keys(kv.dump())).toEqual([DATA_PREFS_KEY]);
  });

  it('DATA-6 a damaged or odd saved value falls back to the defaults, never throws', async () => {
    expect(await dataPrefs().loadDataPrefs(memoryKV({ [DATA_PREFS_KEY]: '{not json' }))).toEqual({ autoplay: true, saveData: null });
    expect(await dataPrefs().loadDataPrefs(memoryKV({ [DATA_PREFS_KEY]: '{"autoplay":"yes","saveData":3}' }))).toEqual({ autoplay: true, saveData: null });
  });

  it.each([
    [{ autoplay: true, saveData: false }, false, true],
    [{ autoplay: true, saveData: null }, false, true],
    [{ autoplay: false, saveData: false }, false, false],
    [{ autoplay: true, saveData: true }, false, false],
    [{ autoplay: true, saveData: false }, true, false],
  ] as const)('AUTO-5 autoplayOn(%j, reduceMotion %s) is %s', (p, reduceMotion, on) => {
    expect(dataPrefs().autoplayOn(p, reduceMotion)).toBe(on);
  });
});
