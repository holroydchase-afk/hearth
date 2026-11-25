// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// DEC-87 (SPEC-MEDIA 5): Feed videos play quietly, one at a time, once she stops on one. The phone's own list does
// the dwell (a card 80%+ on screen and the list still for 1 s, and only after she has scrolled once), so nothing
// downloads while she scrolls past. The list moving again pauses the video at once; it plays again once the list
// has been still for the same 1 s. Feed only: the Gallery grid never autoplays (no provider there).
import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import type { FeedPost } from '../api/HearthApi';
import type { PhotosRow } from './events';

type ViewToken = { item: unknown; index?: number | null; isViewable: boolean };

/** AUTO-9: the one place to tune when autoplay starts. */
export const AUTOPLAY_VIEWABILITY = { itemVisiblePercentThreshold: 80, minimumViewTime: 1000, waitForInteraction: true };

/** Which Feed video (by media id) may play now, and whether the list is still. */
export interface AutoplayNow { mediaId: string | null; still: boolean }
export const AutoplayContext = createContext<AutoplayNow>({ mediaId: null, still: false });

/** The first video a post's card actually draws (the collage shows 4 tiles; a 4th behind "+N" is not a poster). */
function shownVideo(post: FeedPost): string | null {
  const shown = post.media.length > 4 ? 3 : 4;
  return post.media.slice(0, shown).find((m) => m.kind === 'video')?.media_id ?? null;
}

export function rowVideo(r: PhotosRow): string | null {
  const posts = r.type === 'post' || r.type === 'event' ? [r.post] : r.type === 'session' ? r.posts : [];
  for (const p of posts) {
    const v = shownVideo(p);
    if (v) return v;
  }
  return null;
}

type Scroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => void;

/** Feed's list props and what its video posters read. `enabled`: autoplayOn(dataPrefs, reduce motion). */
export function useAutoplay(enabled: boolean) {
  const [picked, setPicked] = useState<string | null>(null);
  const [still, setStill] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  // FlatList refuses a new onViewableItemsChanged after mount, so this one never changes.
  const [onViewableItemsChanged] = useState(() => ({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const top = viewableItems.filter((v) => v.isViewable).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    let id: string | null = null;
    for (const v of top) {
      id = rowVideo(v.item as PhotosRow);
      if (id) break;
    }
    setPicked(id);
  });
  const moving = useCallback<Scroll>(() => {
    clear();
    setStill(false);
  }, []);
  const stopped = useCallback<Scroll>(() => {
    clear();
    timer.current = setTimeout(() => {
      timer.current = null;
      setStill(true);
    }, AUTOPLAY_VIEWABILITY.minimumViewTime);
  }, []);
  useEffect(() => clear, []);
  const now = useMemo<AutoplayNow>(() => ({ mediaId: enabled ? picked : null, still }), [enabled, picked, still]);
  const listProps = useMemo(() => ({
    viewabilityConfig: AUTOPLAY_VIEWABILITY,
    onViewableItemsChanged,
    onScrollBeginDrag: moving,
    onMomentumScrollBegin: moving,
    onScrollEndDrag: stopped,
    onMomentumScrollEnd: stopped,
  }), [onViewableItemsChanged, moving, stopped]);
  return { now, listProps };
}
