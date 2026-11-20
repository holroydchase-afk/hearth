// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Tabs: the phone's own tab bar on Android and on iPhone with Easy view Off (see app/(tabs)/_layout.tsx);
// this bar on iPhone with Easy view On and on the web.
// Every tab has a system symbol and a word (HIG Tab bars; DS-3), 17 pt labels (DS-2), labels that never
// hide (DS-5) and 48 pt+ targets (DS-1). RD-9 (SPEC-REDESIGN 1b, DEC-59): parents Gallery, Share, Feed, More;
// viewers Gallery, Feed, More. RD-14: a new message puts an accent dot on More. RD-76 / RD-77 (DEC-66): the words
// show only with Easy view On; Off, the tabs are icons only and keep their spoken names, role, state and 48 pt.
import { SymbolView } from 'expo-symbols';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Role } from '../api/HearthApi';
import { useTyping } from '../ui/typing';
import { WEIGHT, LABEL_SCALE_CAP, MIN_TARGET, iconSize, typeScale, useTheme } from '../ui/theme';

export type TabName = 'gallery' | 'share' | 'feed' | 'more';
export interface TabDef { name: TabName; label: string }

/** SF Symbols on iPhone, Material Symbols on Android and the web. */
export const TAB_ICONS: Record<TabName, { sf: string; md: string }> = {
  gallery: { sf: 'photo.on.rectangle', md: 'photo_library' },
  share: { sf: 'plus.circle', md: 'add_circle' },
  feed: { sf: 'list.bullet.rectangle', md: 'view_agenda' },
  more: { sf: 'ellipsis.circle', md: 'more_horiz' },
};

/** RD-106 (Chase, Nov 19, DEC-70): the phone's own tab bar on Android, and on iPhone while Easy view is Off, so
 *  iOS 26 draws its floating glass bar and older iPhones keep the classic one. LIVE-1 (Nov 5): that bar has no room
 *  for 17 pt words (DS-2), so with Easy view On (words under icons) iPhone keeps this fixed bar. The web keeps it too. */
export function usesNativeTabs(os: string, easyView: boolean): boolean {
  if (os === 'android') return true;
  if (os === 'ios') return !easyView;
  return false;
}

/** RD-107: on iPhone the own bar is icons only (DEC-66) with spoken names, on the system's glass, so no Hearth
 *  color behind it. Android shows words per nativeLabelMode and sits on the page color. */
export function nativeTabLook(os: string, easyView: boolean): { labelHidden: boolean; themedBackground: boolean; minimize: 'onScrollDown' | 'never' } {
  // RD-110 (Chase, Nov 19, DEC-75): the iPhone's bar shrinks to its glass oval on scroll down, back on scroll up.
  // Only parents see it (Easy view Off); Android's bar never shrinks (DS-5).
  return os === 'ios'
    ? { labelHidden: true, themedBackground: false, minimize: easyView ? 'never' : 'onScrollDown' } // RD-110-R5
    : { labelHidden: false, themedBackground: true, minimize: 'never' };
}

/** RD-110: shrink after a scroll down of more than 8 pt once past the top 40 pt; grow back on a scroll up of more
 *  than 8 pt or at the top. Smaller moves keep it as it is. */
export function nextMinimized(prev: boolean, lastY: number, y: number): boolean {
  if (y < 40) return false;
  if (y - lastY > 8) return true;
  if (lastY - y > 8) return false;
  return prev;
}

/** RD-110 on the web: follow the app's own up-and-down scrolling (Gallery, Feed, More's lists) and shrink or grow
 *  the floating bar. RD-110-R2: only scrolling areas beside the bar count (never the demo's story panel), and a
 *  sideways strip (New for you, the photo swiper, Share's thumbnails) changes nothing. RD-110-R3: changing tabs
 *  brings the whole bar back. While a tab has keyboard focus the bar never shrinks, so focus is never lost. */
function useMinimizeOnScroll(enabled: boolean, current: TabName, bar: React.RefObject<React.ComponentRef<typeof View> | null>): [boolean, () => void] {
  const [min, setMin] = useState(false);
  useEffect(() => { setMin(false); }, [current]);
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') { setMin(false); return undefined; }
    const last = new WeakMap<Element, number>();
    const onScroll = (e: Event) => {
      const el = e.target;
      const node = bar.current as unknown as HTMLElement | null;
      const area = node?.parentElement;
      if (!(el instanceof Element) || !area || !area.contains(el) || node.contains(el)) return;
      const y = el.scrollTop;
      const prevY = last.get(el) ?? y;
      last.set(el, y);
      if (y === prevY) return; // sideways only
      if (node.contains(document.activeElement)) return;
      setMin((m) => nextMinimized(m, prevY, y));
    };
    document.addEventListener('scroll', onScroll, true);
    return () => document.removeEventListener('scroll', onScroll, true);
  }, [enabled, bar]);
  return [enabled && min, () => setMin(false)];
}

/** RD-108 (Chase, Nov 19, DEC-72): the web can't use iOS 26's own glass bar, so with Easy view Off the web draws a
 *  lookalike: a floating, see-through, blurred capsule. Easy view On keeps the fixed bar with words. */
export function floatingTabBar(os: string, easyView: boolean): boolean {
  return os === 'web' && !easyView;
}

/** '#RRGGBB' at an alpha, for the glass capsule. */
function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** Options for the native tab bar (expo-router NativeTabs). */
export const NATIVE_TAB_OPTIONS = {
  minimizeBehavior: 'never', // DS-5: iOS 26 can shrink the bar on scroll; the way back stays visible
  labelVisibilityMode: 'labeled', // DS-5: Android shows every label, not only the selected one
  labelStyle: { fontSize: 17 }, // DS-2: platform tab labels are 10–12 pt; RD-2 the phone's own font
} as const;

/** RD-76: Android's own bar shows its words only with Easy view On; the word stays the tab's spoken name. */
export function nativeLabelMode(easyView: boolean): 'labeled' | 'unlabeled' {
  return easyView ? 'labeled' : 'unlabeled';
}

const ALL: Record<TabName, TabDef> = {
  gallery: { name: 'gallery', label: 'Gallery' },
  share: { name: 'share', label: 'Share' },
  feed: { name: 'feed', label: 'Feed' },
  more: { name: 'more', label: 'More' },
};

export function tabsFor(role: Role): TabDef[] {
  return role === 'viewer' ? [ALL.gallery, ALL.feed, ALL.more] : [ALL.gallery, ALL.share, ALL.feed, ALL.more];
}

/** RD-14: More's spoken name says when there is a new message; the word on screen stays "More". */
export function tabSpoken(tab: TabDef, newMessages: number): string {
  return tab.name === 'more' && newMessages > 0 ? 'More, new message' : tab.label;
}

export function HearthTabBar({ role, current, onNavigate, newMessages = 0, floating = false, minimized, onExpand }: {
  role: Role; current: TabName; onNavigate: (t: TabName) => void; newMessages?: number; floating?: boolean;
  /** RD-110: shrunk to the small oval. Left out, the bar follows scrolling itself (web, floating only). */
  minimized?: boolean; onExpand?: () => void;
}) {
  const { c, dark, bigText: easyView, reduceMotion } = useTheme(); // the theme's big-text flag is Easy view (RD-77)
  const barRef = useRef<React.ComponentRef<typeof View>>(null);
  const [autoMin, autoExpand] = useMinimizeOnScroll(floating && minimized === undefined, current, barRef);
  const small = floating && (minimized ?? autoMin);
  const expand = onExpand ?? autoExpand;
  const t = typeScale(easyView);
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  // UX-R1 / RD-35: while a text field is focused the bar is not drawn, so the field can sit right above the keyboard.
  const typing = useTyping();
  if (typing) return null;
  return (
    <View ref={barRef} accessibilityRole="tablist" style={floating
      ? [styles.float, {
        bottom: Math.max(insets.bottom, 16),
        backgroundColor: alpha(c.surface, dark ? 0.62 : 0.6),
        borderColor: dark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(18px) saturate(1.6)',
        boxShadow: dark ? '0 6px 24px rgba(0, 0, 0, 0.5)' : '0 6px 24px rgba(0, 0, 0, 0.14)',
        // RD-110-R4: a max width that is a length in both states, so the shrink can animate (to or from "auto" can't).
        maxWidth: 'calc(100% - 32px)',
        transition: reduceMotion ? undefined : 'max-width 220ms ease',
      } as object, small ? styles.floatSmall : null]
      : [styles.bar, { backgroundColor: c.surface, borderTopColor: c.tabLine, paddingBottom: Math.max(insets.bottom, 6) }]}>
      {tabsFor(role).filter((tab) => !small || tab.name === current).map((tab) => {
        const on = tab.name === current;
        const color = on ? c.accent : c.muted;
        const dot = tab.name === 'more' && newMessages > 0;
        return (
          <Pressable
            key={tab.name}
            accessibilityRole="tab"
            accessibilityLabel={small ? `${tabSpoken(tab, newMessages)}, show all tabs` : tabSpoken(tab, newMessages)}
            accessibilityState={{ selected: on }}
            aria-selected={on} // the web build reads aria-selected, not accessibilityState
            // HIG-3: at the largest text sizes a long press shows the tab's name big, as Apple's own tab bars do.
            accessibilityShowsLargeContentViewer
            accessibilityLargeContentTitle={tab.label}
            onPress={() => (small ? expand() : onNavigate(tab.name))} // RD-110-R1: the oval's tap only brings the bar back
            style={({ pressed }) => [styles.tab, floating ? styles.floatTab : null, floating && on ? { backgroundColor: c.accentSoft } : null, { opacity: pressed ? 0.7 : 1 }]}
          >
            <View>
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <SymbolView
                  name={{ ios: TAB_ICONS[tab.name].sf as never, android: TAB_ICONS[tab.name].md as never, web: TAB_ICONS[tab.name].md as never }}
                  size={iconSize(28, fontScale)}
                  tintColor={color}
                />
              </View>
              {/* RD-14: the dot is spoken through the tab's name ("More, new message"), so it is only drawn. */}
              {dot ? <View testID="more-dot" accessible={false} style={[styles.dot, { backgroundColor: c.accent, borderColor: c.bg }]} /> : null}
            </View>
            {easyView ? <Text maxFontSizeMultiplier={LABEL_SCALE_CAP} style={{ fontSize: t.base, fontWeight: on ? WEIGHT.semibold : WEIGHT.regular, color }}>{tab.label}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: 1, paddingTop: 6, paddingHorizontal: 8, gap: 6 },
  // RD-108: 64 pt tall, 16 pt in from each edge; the screens leave TAB_BAR_FLOAT_SPACE under it (RD-109).
  float: { position: 'absolute', left: 16, right: 16, height: 64, borderRadius: 999, borderWidth: 1, flexDirection: 'row', alignItems: 'center', padding: 4, gap: 4 },
  floatTab: { minHeight: 56, borderRadius: 999 },
  // RD-110: shrunk, the oval holds only the picked tab at the left, like iOS 26.
  floatSmall: { maxWidth: 64 },
  dot: { position: 'absolute', top: -2, right: -6, width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  tab: { flex: 1, minHeight: MIN_TARGET + 12, minWidth: MIN_TARGET, alignItems: 'center', justifyContent: 'center', paddingVertical: 4, gap: 2 },
});
