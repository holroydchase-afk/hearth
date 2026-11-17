// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Tabs: the phone's own tab bar on Android (see app/(tabs)/_layout.tsx), this bar on iPhone and the web.
// Every tab has a system symbol and a word (HIG Tab bars; DS-3), 17 pt labels (DS-2), labels that never
// hide (DS-5) and 48 pt+ targets (DS-1). RD-9 (SPEC-REDESIGN 1b, DEC-59): parents Gallery, Share, Feed, More;
// viewers Gallery, Feed, More. RD-14: a new message puts an accent dot on More.
import { SymbolView } from 'expo-symbols';
import React from 'react';
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

/** LIVE-1 (Chase, Nov 5): the iPhone's glass tab bar has no room for 17 pt words (DS-2) and drew them over
 *  the icons, so iPhone uses this bar too. Android's bar keeps its own. */
export function usesNativeTabs(os: string): boolean {
  return os === 'android';
}

/** Options for the native tab bar (expo-router NativeTabs). */
export const NATIVE_TAB_OPTIONS = {
  minimizeBehavior: 'never', // DS-5: iOS 26 can shrink the bar on scroll; the way back stays visible
  labelVisibilityMode: 'labeled', // DS-5: Android shows every label, not only the selected one
  labelStyle: { fontSize: 17 }, // DS-2: platform tab labels are 10–12 pt; RD-2 the phone's own font
} as const;

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

export function HearthTabBar({ role, current, onNavigate, newMessages = 0 }: {
  role: Role; current: TabName; onNavigate: (t: TabName) => void; newMessages?: number;
}) {
  const { c, bigText } = useTheme();
  const t = typeScale(bigText);
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  // UX-R1 / RD-35: while a text field is focused the bar is not drawn, so the field can sit right above the keyboard.
  const typing = useTyping();
  if (typing) return null;
  return (
    <View accessibilityRole="tablist" style={[styles.bar, { backgroundColor: c.bg, borderTopColor: c.line, paddingBottom: Math.max(insets.bottom, 6) }]}>
      {tabsFor(role).map((tab) => {
        const on = tab.name === current;
        const color = on ? c.accent : c.muted;
        const dot = tab.name === 'more' && newMessages > 0;
        return (
          <Pressable
            key={tab.name}
            accessibilityRole="tab"
            accessibilityLabel={tabSpoken(tab, newMessages)}
            accessibilityState={{ selected: on }}
            aria-selected={on} // the web build reads aria-selected, not accessibilityState
            // HIG-3: at the largest text sizes a long press shows the tab's name big, as Apple's own tab bars do.
            accessibilityShowsLargeContentViewer
            accessibilityLargeContentTitle={tab.label}
            onPress={() => onNavigate(tab.name)}
            style={({ pressed }) => [styles.tab, { opacity: pressed ? 0.7 : 1 }]}
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
            <Text maxFontSizeMultiplier={LABEL_SCALE_CAP} style={{ fontSize: t.base, fontWeight: on ? WEIGHT.semibold : WEIGHT.regular, color }}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 6, paddingHorizontal: 8, gap: 6 },
  dot: { position: 'absolute', top: -2, right: -6, width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  tab: { flex: 1, minHeight: MIN_TARGET + 12, minWidth: MIN_TARGET, alignItems: 'center', justifyContent: 'center', paddingVertical: 4, gap: 2 },
});
