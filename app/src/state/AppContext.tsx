// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Session, family space, prefs and the long-lived stores (feed, upload queue, media cache).
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AccessibilityInfo, AppState, Appearance, Platform } from 'react-native';
import type { HearthApi, Session, Space } from '../api/HearthApi';
import { FeedStore, clearFeedCache, type FeedState } from '../feed/store';
import { MediaCache, type VideoFiles } from '../media/cache';
import type { MediaStore } from '../media/diskCache';
import { stopChats } from '../messenger/client';
import { clearArrivals, recordArrival } from '../notify/latency';
import { listenForArrivals, pushStatus, registerForPush } from '../notify/push';
import type { KV } from '../platform/kv';
import type { PickedAsset } from '../share/bulk';
import { BigTextContext, LookContext, PhoneA11yContext, ThemeContext, nativeScheme, type PhoneA11y } from '../ui/theme';
import { UploadQueue, type Job, type Prepared, type QueueItem } from '../upload/queue';
import { defaultDataPrefs, loadDataPrefs, saveDataPrefs, type DataPrefs } from './dataPrefs';
import { defaultPrefs, loadPrefs, savePrefs, serverPrefs, type NotifyChoice, type Prefs } from './prefs';

export interface AppDeps {
  api: HearthApi;
  kv: KV;
  /** Phone number behind "Call Chase" (EXPO_PUBLIC_HELP_PHONE). */
  helpPhone?: string | null;
  /** START-ON-1/2: where "Email Hearth" writes to (EXPO_PUBLIC_HEARTH_HELP_EMAIL). Absent or null: Help has no
   *  "Something wrong?" section and nobody can start a family. */
  helpEmail?: string | null;
  prepare: (item: QueueItem) => Promise<Prepared>;
  /** videos: offer videos too (only when the server says video_posting is on: FLAG-5). */
  pickPhotos: (opts: { videos: boolean }) => Promise<{ items: QueueItem[] } | { denied: true }>;
  /** BETA-BULK-1: up to 100 photos with EXIF, read on the phone only (media/pick.ts pickBulk). */
  pickBulk?: (opts?: { videos: boolean }) => Promise<{ assets: PickedAsset[] } | { denied: true }>;
  /** R15 photo helpers: a small JPEG preview of a picked photo, read on the phone only (media/preview.ts). */
  previewBytes?: (uri: string) => Promise<Uint8Array | null>;
  saveToPhone: (bytes: Uint8Array, name: string) => Promise<'saved' | 'denied'>;
  openUrl: (url: string) => Promise<unknown>;
  /** A3: where viewed photos are kept (ciphertext files + keychain-backed keys). Absent or null: nothing kept (web). */
  mediaDisk?: { store: MediaStore; keys: KV } | null;
  /** VID-18: where a decrypted video goes for the player (platform/videoFiles.ts). Absent: a data: URI (tests). */
  videoFiles?: VideoFiles | null;
  /** WEB-APP-6: wipes the sealed session store (session, messenger store, its key) at sign-out. Web only. */
  clearSessionStore?: () => Promise<void>;
  /** WEB-APP-34: the real-backend web build never offers or sends video (the Fake/demo build and phones do). */
  noVideo?: boolean;
  /**
   * HRT-WEB.3: web only. Where a picked photo's CLEANED bytes are kept (sealed, IndexedDB) so a post survives Chrome
   * closing. stage() prepares each photo before its job is saved; the rest is what the queue and QueueStatus need.
   */
  uploadStore?: {
    stage: (items: QueueItem[], onProgress?: (done: number, total: number) => void) => Promise<{ items: QueueItem[]; durable: boolean }>;
    has: (uri: string) => Promise<boolean>;
    release: (job: { items: { uri: string }[] }) => Promise<void>;
    sweep: (liveUris: string[]) => Promise<void>;
    memoryOnly: (uri: string) => boolean;
  } | null;
}

/** offline (ENG-R1): signed in, but the family couldn't be read and this phone has none saved. */
export type AppStatus = 'loading' | 'signedOut' | 'noSpace' | 'offline' | 'ready';

export interface AppValue {
  status: AppStatus;
  deps: AppDeps;
  session: Session | null;
  space: Space | null;
  /** Name of the person to call for help: who invited me, or me if I own the space. */
  helper: string | null;
  feed: FeedStore | null;
  queue: UploadQueue | null;
  media: MediaCache | null;
  prefs: Prefs;
  /** FLAG-5: features the server has on for me in this family (my_features). Empty until read, or if the read fails. */
  features: string[];
  setPrefs: (p: Partial<Prefs>) => void;
  saveNotify: (notify: NotifyChoice) => Promise<boolean>;
  /** HELP-R6: the owner turns a family feature on or off, then features are read again. False if it didn't save. */
  setFamilyFeature: (feature: string, enabled: boolean) => Promise<boolean>;
  /** Re-read session + spaces (after sign-in or joining). */
  reload: () => Promise<void>;
  signOut: () => Promise<void>;
  /** HIG-1: show the "Get a notice…" card: the phone hasn't been asked yet and nobody tapped Not now. */
  pushAsk: boolean;
  /** HIG-1: the card's one button: now the phone asks. */
  askPush: () => Promise<void>;
  /** HIG-1: Not now. Hidden for good on this phone; How should we tell you (Help or Me) still works. */
  skipPushAsk: () => void;
  /** SHARE-PC-11 (DEC-73): "Shared with <names>." after a Send, shown on Feed until closed or the next Send. */
  shared: string | null;
  setShared: (line: string | null) => void;
  /** DEC-87 (SPEC-MEDIA 5): Videos and data, this phone's own (never per account, never sent anywhere). Read
   *  before the first screen shows, signed in or not. */
  dataPrefs: DataPrefs;
  /** Changes it at once and saves it on this phone only. */
  setDataPrefs: (p: Partial<DataPrefs>) => void;
}

const Ctx = createContext<AppValue | null>(null);

export function useApp(): AppValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('AppProvider missing');
  return v;
}

/** DEC-87 (SPEC-MEDIA 5): Save data is on, so Feed cards and the Timeline show thumbnails until a photo is opened. */
export function useSaveData(): boolean {
  return useContext(Ctx)?.dataPrefs.saveData === true;
}

const EMPTY_FEED: FeedState = { posts: [], status: 'loading', loaded: false, hasMore: false, notice: null, comments: {}, drafts: {}, opened: {}, fetchedAt: null };

export function useFeed(): FeedState {
  const { feed } = useApp();
  return useSyncExternalStore(
    feed ? feed.subscribe : noopSubscribe,
    feed ? feed.getState : () => EMPTY_FEED,
    feed ? feed.getState : () => EMPTY_FEED,
  );
}

/** ENG-R3: one slice of the feed. The component redraws only when that slice changes (by reference), so a post
 *  card follows its own comments and draft instead of every change to the whole feed. */
export function useFeedSelect<T>(select: (s: FeedState) => T): T {
  const { feed } = useApp();
  const get = feed ? () => select(feed.getState()) : () => select(EMPTY_FEED);
  return useSyncExternalStore(feed ? feed.subscribe : noopSubscribe, get, get);
}

const noopSubscribe = () => () => {};
const NO_JOBS: Job[] = [];

export function useJobs(): Job[] {
  const { queue } = useApp();
  const cache = useRef<{ q: UploadQueue | null; v: Job[] }>({ q: null, v: NO_JOBS });
  const get = useCallback(() => {
    if (!queue) return NO_JOBS;
    if (cache.current.q !== queue) cache.current = { q: queue, v: queue.jobs() };
    return cache.current.v;
  }, [queue]);
  const sub = useCallback((fn: () => void) => {
    if (!queue) return () => {};
    return queue.subscribe(() => { cache.current = { q: queue, v: queue.jobs() }; fn(); });
  }, [queue]);
  return useSyncExternalStore(sub, get, get);
}

interface Loaded {
  status: AppStatus;
  session: Session | null;
  space: Space | null;
  feed: FeedStore | null;
  queue: UploadQueue | null;
  media: MediaCache | null;
  prefs: Prefs;
  features: string[];
}

const NO_FEATURES: string[] = [];
const SIGNED_OUT: Loaded = { status: 'signedOut', session: null, space: null, feed: null, queue: null, media: null, prefs: defaultPrefs('owner'), features: NO_FEATURES };

export function AppProvider({ deps, children }: { deps: AppDeps; children: ReactNode }) {
  const [s, setS] = useState<Loaded>({ ...SIGNED_OUT, status: 'loading' });
  const live = useRef<Loaded>(s);
  const unlisten = useRef<(() => void) | null>(null);
  live.current = s;

  const [pushAsk, setPushAsk] = useState(false);
  const [shared, setShared] = useState<string | null>(null);
  const register = useCallback(async (ask: boolean) => {
    try {
      const token = await registerForPush({ ask });
      if (token) await deps.api.registerPushToken(token, Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web');
    } catch { /* silent; the next launch retries */ }
  }, [deps.api]);
  const askPush = useCallback(async () => {
    setPushAsk(false);
    await register(true);
  }, [register]);
  const skipPushAsk = useCallback(() => {
    setPushAsk(false);
    const who = live.current.session?.userId;
    if (who) void deps.kv.setItem(pushSkipKey(who), '1').catch(() => {});
  }, [deps.kv]);
  const a11y = usePhoneA11y();
  const [dataPrefs, setDataPrefsState] = useState<DataPrefs>(defaultDataPrefs);
  const dataPrefsRef = useRef<DataPrefs | null>(null);
  const setDataPrefs = useCallback((p: Partial<DataPrefs>) => {
    const next = { ...(dataPrefsRef.current ?? defaultDataPrefs()), ...p };
    dataPrefsRef.current = next;
    setDataPrefsState(next);
    void saveDataPrefs(deps.kv, next);
  }, [deps.kv]);

  const load = useCallback(async () => {
    live.current.queue?.stop();
    // PRIV-R1: wipe any decrypted video a crash left behind before anything else, whoever is (or isn't) signed in.
    // load() runs again only from signed-out, sign-in or the offline screen, where no player is open (privacy review PRIV-R2).
    deps.videoFiles?.clear?.().catch(() => {});
    if (!dataPrefsRef.current) {
      // DEC-87: read once, before any screen leaves 'loading', so Save data holds from the first photo.
      const dp = await loadDataPrefs(deps.kv);
      if (!dataPrefsRef.current) {
        dataPrefsRef.current = dp;
        setDataPrefsState(dp);
      }
    }
    const session = await deps.api.getSession().catch(() => null);
    if (!session) {
      setS(SIGNED_OUT);
      return;
    }
    // ENG-R1: only an empty, successful answer means "no family". A failed read (no signal, a server error)
    // opens the family this phone opened last, so the saved feed shows; with none saved, say so and retry.
    const savedKey = lastSpaceKey(session.userId);
    let space: Space | null;
    try {
      space = (await deps.api.mySpaces())[0] ?? null;
      if (space) void deps.kv.setItem(savedKey, JSON.stringify(space)).catch(() => {});
      else void deps.kv.removeItem(savedKey).catch(() => {});
    } catch {
      space = await deps.kv.getItem(savedKey).then((v) => (v ? (JSON.parse(v) as Space) : null)).catch(() => null);
      if (!space) {
        setS({ ...SIGNED_OUT, status: 'offline', session });
        return;
      }
    }
    if (!space) {
      setS({ ...SIGNED_OUT, status: 'noSpace', session });
      return;
    }
    // PRIV-FL-R1: the old "Last shared" line's key is never read now; delete the orphan once at startup.
    void deps.kv.removeItem(`hearth.lastShared.v1.${session.userId}`).catch(() => {});
    const prefs = await loadPrefs(deps.kv, session.userId, space.role);
    const media = new MediaCache(deps.api, { disk: deps.mediaDisk ? { ...deps.mediaDisk, userId: session.userId } : null, videoFiles: deps.videoFiles ?? null });
    media.clearVideos(); // VID-18: any decrypted video a crash left behind
    // A3: kept photo files follow the feed: a deleted post or lost access drops its files and keys.
    const feed = new FeedStore({
      api: deps.api, kv: deps.kv, userId: session.userId, spaceId: space.space_id, inviter: space.inviter_name,
      onRefreshed: (posts) => { void media.prune(new Set(posts.flatMap((p) => p.media.map((m) => m.media_id)))); },
    });
    let queue: UploadQueue | null = null;
    if (space.can_post) {
      queue = await UploadQueue.open({
        api: deps.api, kv: deps.kv, userId: session.userId, prepare: deps.prepare,
        ...(deps.uploadStore ? { store: deps.uploadStore } : {}),
        onPublished: (job) => { void feed.refresh().then(() => queue?.remove(job.id)); },
      });
    }
    setS({ status: 'ready', session, space, feed, queue, media, prefs, features: NO_FEATURES });
    // FLAG-5: the server decides features (default off). A failed read leaves them off; the next launch retries.
    void deps.api.myFeatures(space.space_id).then((features) => {
      setS((cur) => (cur.space?.space_id === space.space_id ? { ...cur, features } : cur));
    }).catch(() => {});
    await feed.hydrate();
    void feed.refresh();
    // AE-10: note when each notice reaches this phone (kept on the phone only).
    unlisten.current?.();
    unlisten.current = listenForArrivals((postId, at) => { void recordArrival(deps.kv, session.userId, postId, at); });
    // AE-2: tell the server where to send notices. Failures are silent; the next launch retries.
    // HIG-1: only if the phone already said yes. Asking happens on the Photos card, after the first photo.
    void register(false);
    void Promise.all([pushStatus(), deps.kv.getItem(pushSkipKey(session.userId))]).then(([st, skipped]) => {
      setPushAsk(st === 'undetermined' && !skipped);
    }).catch(() => {});
  }, [deps, register]);

  useEffect(() => {
    void load();
  }, [load]);

  // Unmount (sign-out, tests): no timers or retries may outlive the provider.
  useEffect(() => () => { live.current.queue?.stop(); unlisten.current?.(); }, []);

  // DS-10: the phone's own parts (tab bar, keyboard, alerts) match the light or dark screen picked on Help or Me.
  useEffect(() => {
    if (Platform.OS === 'web' || typeof Appearance.setColorScheme !== 'function') return;
    try { Appearance.setColorScheme(nativeScheme(s.prefs.look)); } catch { /* older phones: Hearth's own colors still switch */ }
  }, [s.prefs.look]);

  // HRT-WEB.1 (QA-R6): once signed in on web, ask the browser to keep Hearth's storage (the sealed session and
  // its IndexedDB key) so Chrome is less likely to clear it under storage pressure. Never on phones.
  const signedInAs = s.session?.userId ?? null;
  useEffect(() => {
    if (Platform.OS !== 'web' || !signedInAs) return;
    try {
      const storage = (globalThis as { navigator?: { storage?: { persist?: () => Promise<boolean> } } }).navigator?.storage;
      if (typeof storage?.persist === 'function') void storage.persist().catch(() => {});
    } catch { /* not offered: the session still works, it may just be cleared sooner */ }
  }, [signedInAs]);

  // Back in front: retry waiting uploads and fetch new photos (BETA-SHARE-4).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active') return;
      if (live.current.status === 'offline') { void load(); return; }
      live.current.queue?.kick();
      void live.current.feed?.refresh();
    });
    return () => sub.remove();
  }, [load]);

  const setPrefs = useCallback((p: Partial<Prefs>) => {
    setS((cur) => {
      const prefs = { ...cur.prefs, ...p };
      if (cur.session) void savePrefs(deps.kv, cur.session.userId, prefs);
      return { ...cur, prefs };
    });
  }, [deps.kv]);

  // HARD-11: how to be told is only "Saved" once the server has it; otherwise it goes back to what is set.
  const saveNotify = useCallback(async (notify: NotifyChoice): Promise<boolean> => {
    const cur = live.current;
    const before = cur.prefs.notify;
    if (notify === before) return true;
    setPrefs({ notify });
    if (!cur.space) return true;
    try {
      await deps.api.setNotificationPrefs(cur.space.space_id, serverPrefs(notify));
      return true;
    } catch {
      setPrefs({ notify: before });
      return false;
    }
  }, [deps.api, setPrefs]);

  const setFamilyFeature = useCallback(async (feature: string, enabled: boolean): Promise<boolean> => {
    const space = live.current.space?.space_id;
    if (!space) return false;
    try {
      await deps.api.setFamilyFeature(space, feature, enabled);
    } catch {
      return false;
    }
    const features = await deps.api.myFeatures(space).catch(() => null);
    if (features) setS((cur) => (cur.space?.space_id === space ? { ...cur, features } : cur));
    return true;
  }, [deps.api]);

  const signOut = useCallback(async () => {
    // PRIV-WEB-R5: open chats stop writing before the store is cleared, so nothing is sealed again after it.
    stopChats();
    live.current.queue?.stop();
    unlisten.current?.();
    unlisten.current = null;
    const who = live.current.session?.userId;
    if (who) await clearArrivals(deps.kv, who);
    const space = live.current.space?.space_id;
    if (who && space) await clearFeedCache(deps.kv, who, space);
    if (who) await deps.kv.removeItem(lastSpaceKey(who)).catch(() => {});
    await live.current.media?.clearDisk().catch(() => {});
    await deps.api.signOut().catch(() => {});
    await deps.clearSessionStore?.().catch(() => {});
    setS(SIGNED_OUT);
  }, [deps]);

  const value = useMemo<AppValue>(() => ({
    ...s,
    deps,
    helper: s.space ? (s.space.role === 'owner' ? null : s.space.inviter_name) : null,
    setPrefs,
    saveNotify,
    setFamilyFeature,
    reload: load,
    signOut,
    pushAsk: pushAsk && s.status === 'ready',
    askPush,
    skipPushAsk,
    shared: s.status === 'ready' ? shared : null,
    setShared,
    dataPrefs,
    setDataPrefs,
  }), [dataPrefs, setDataPrefs, s, deps, setPrefs, saveNotify, setFamilyFeature, load, signOut, pushAsk, askPush, skipPushAsk, shared]);

  return (
    <Ctx.Provider value={value}>
      <LookContext.Provider value={s.prefs.look}>
        <ThemeContext.Provider value={s.space?.role === 'owner' ? s.prefs.theme : 'paper'}>
          <BigTextContext.Provider value={s.prefs.easyView}>
            <PhoneA11yContext.Provider value={a11y}>{children}</PhoneA11yContext.Provider>
          </BigTextContext.Provider>
        </ThemeContext.Provider>
      </LookContext.Provider>
    </Ctx.Provider>
  );
}

const pushSkipKey = (userId: string) => `hearth.pushAsk.skipped.${userId}`;
const lastSpaceKey = (userId: string) => `hearth.lastSpace.${userId}`;

/** HIG-7 / HIG-8: follow the phone's Increase Contrast (iPhone: darker system colors; Android: high contrast
 *  text) and Reduce Motion, live, so Hearth's own colors and sheets change with the phone. */
function usePhoneA11y(): PhoneA11y {
  const [v, setV] = useState<PhoneA11y>({ highContrast: false, reduceMotion: false });
  useEffect(() => {
    let alive = true;
    const set = (p: Partial<PhoneA11y>) => { if (alive) setV((cur) => ({ ...cur, ...p })); };
    const read = (f: (() => Promise<boolean>) | undefined) => (typeof f === 'function' ? f().catch(() => false) : Promise.resolve(false));
    const ios = Platform.OS === 'ios';
    void read(ios ? AccessibilityInfo.isDarkerSystemColorsEnabled?.bind(AccessibilityInfo) : AccessibilityInfo.isHighTextContrastEnabled?.bind(AccessibilityInfo))
      .then((on) => set({ highContrast: !!on }));
    void read(AccessibilityInfo.isReduceMotionEnabled?.bind(AccessibilityInfo)).then((on) => set({ reduceMotion: !!on }));
    const subs = [
      AccessibilityInfo.addEventListener?.(ios ? 'darkerSystemColorsChanged' : 'highTextContrastChanged', (on: boolean) => set({ highContrast: on })),
      AccessibilityInfo.addEventListener?.('reduceMotionChanged', (on: boolean) => set({ reduceMotion: on })),
    ];
    return () => { alive = false; subs.forEach((x) => x?.remove()); };
  }, []);
  return v;
}
