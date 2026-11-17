// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// UX-R1 / RD-35 (P0): while any text field is focused, Hearth's tab bar steps aside so the keyboard never covers the
// field (Apple's own apps hide the tab bar while typing). Focus is the trigger, not Keyboard events, so the web build
// (iPhone Safari) behaves the same. One small shared store: fields say focus and blur; the tab bar listens.
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

const focused = new Set<symbol>();
const listeners = new Set<() => void>();
const emit = () => { keepInView(); listeners.forEach((l) => l()); };

/** Web (iPhone Safari): the keyboard shrinks the visual viewport but the page doesn't move the field for us, so
 *  while a field is focused, each resize scrolls it back into view. Native uses KeyboardAvoidingView instead. */
type VV = { addEventListener: (t: string, f: () => void) => void; removeEventListener: (t: string, f: () => void) => void };
let watching: (() => void) | null = null;
function keepInView(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  const g = window as unknown as { visualViewport?: VV; addEventListener: VV['addEventListener']; removeEventListener: VV['removeEventListener'] };
  const target: VV = g.visualViewport ?? g;
  if (focused.size && !watching) {
    const onResize = () => {
      const el = (globalThis as { document?: { activeElement?: { scrollIntoView?: (o: object) => void } | null } }).document?.activeElement;
      el?.scrollIntoView?.({ block: 'nearest' });
    };
    target.addEventListener('resize', onResize);
    if (target !== g) g.addEventListener('resize', onResize);
    watching = () => { target.removeEventListener('resize', onResize); if (target !== g) g.removeEventListener('resize', onResize); };
  } else if (!focused.size && watching) {
    watching();
    watching = null;
  }
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
const snapshot = () => focused.size > 0;

/** True while any text field is focused. */
export function useTyping(): boolean {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** How long the tab bar waits after a blur before it comes back: about the keyboard's own closing time, and long
 *  enough that a tap which moved focus (caption field → a checkbox) lands before the layout shifts under it. */
export const SHOW_AGAIN_MS = 250;

/** Focus and blur handlers for one text field; an unmounted field never keeps the tab bar hidden. */
export function useTypingField(): { onFocus: () => void; onBlur: () => void } {
  const id = useRef(Symbol('field')).current;
  const later = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancel = () => { if (later.current) { clearTimeout(later.current); later.current = null; } };
  useEffect(() => () => { cancel(); if (focused.delete(id)) emit(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const onFocus = useCallback(() => { cancel(); if (!focused.has(id)) { focused.add(id); emit(); } }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const onBlur = useCallback(() => {
    cancel();
    later.current = setTimeout(() => { later.current = null; if (focused.delete(id)) emit(); }, SHOW_AGAIN_MS);
  }, [id]);
  return { onFocus, onBlur };
}
