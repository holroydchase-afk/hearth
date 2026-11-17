// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// RD-11..RD-13 (SPEC-REDESIGN 1b): Gallery's top. A large title greets the person by the name the family gave them
// ("Good morning, Grandma Jo"); when Gallery scrolls, it folds into the top bar on the left, on the screen's own
// solid color (DS-6), and comes back when scrolled to the top. RD-47 (DEC-65): no buttons up top any more; Search is
// a "Search photos" field under the greeting that pins under the bar once Gallery scrolls. One look on iPhone,
// Android and the web (the iPhone's native large-title header is checked by hand, RD-28). Reduce Motion: the
// titles fade instead of shrinking (DS-14).
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../state/AppContext';
import { greeting } from '../ui/greeting';
import { SystemIcon, Txt } from '../ui/kit';
import { GALLERY_TYPE, MIN_TARGET, RADIUS, SPACE, WEIGHT, useTheme } from '../ui/theme';

/** How the greeting moves between large and small. */
export function titleMotion(reduceMotion: boolean): 'fade' | 'shrink' {
  return reduceMotion ? 'fade' : 'shrink';
}

/** Past this much scroll, the greeting sits in the top bar. */
export const FOLD_AT = 44;

/** The name the family gave me, or null when it isn't set yet (never an email). undefined while loading. */
export function useFamilyName(enabled = true): string | null | undefined {
  const app = useApp();
  const api = app.deps.api;
  const [name, setName] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    api.myProfile()
      .then((p) => { if (live) setName(p.name_set && p.display_name.trim() ? p.display_name.trim() : null); })
      .catch(() => { if (live) setName(null); });
    return () => { live = false; };
  }, [api, enabled]);
  return name;
}

/** The large title at the top of Gallery's list. It shrinks (or fades, with Reduce Motion) as the list scrolls. */
export function LargeGreeting({ words, scrollY }: { words: string; scrollY: Animated.Value }) {
  const { reduceMotion } = useTheme();
  const fade = scrollY.interpolate({ inputRange: [0, FOLD_AT], outputRange: [1, 0], extrapolate: 'clamp' });
  const scale = scrollY.interpolate({ inputRange: [-80, 0, FOLD_AT], outputRange: [1.06, 1, 0.82], extrapolate: 'clamp' });
  const style = titleMotion(reduceMotion) === 'fade'
    ? { opacity: fade }
    : { opacity: fade, transform: [{ scale }], transformOrigin: 'left center' as const };
  const { c } = useTheme();
  const size = GALLERY_TYPE.largeTitle;
  return (
    <Animated.View style={style}>
      {/* RD-55: Apple's Large Title, 34 pt Semibold (never Bold). */}
      <Text accessibilityRole="header" {...{ 'aria-level': 1 }} style={{ fontSize: size, lineHeight: Math.round(size * 1.2), fontWeight: WEIGHT.semibold, color: c.ink }}>
        {words}
      </Text>
    </Animated.View>
  );
}

/** RD-47: the "Search photos" field. Drawn as a field, it is a 48 pt button: a tap opens today's Search screen
 *  (SEARCH-*), where the typing happens. Never the accent (RD-4): a quiet gray fill, the icon and words in gray. */
export function SearchField({ onPress, testID }: { onPress: () => void; testID?: string }) {
  const { c } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel="Search photos"
      accessibilityHint="Opens search"
      onPress={onPress}
      style={({ pressed }) => [styles.field, { backgroundColor: c.fill, opacity: pressed ? 0.7 : 1 }]}
    >
      <SystemIcon icon={{ sf: 'magnifyingglass', md: 'search' }} color={c.muted} />
      <Txt variant="muted" numberOfLines={1}>Search photos</Txt>
    </Pressable>
  );
}

/** The solid top bar: the folded greeting, once Gallery scrolls past it. No buttons (RD-47). */
export function GalleryTopBar({ words, folded }: { words: string | null; folded: boolean }) {
  const { c } = useTheme();
  const show = useRef(new Animated.Value(folded ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(show, { toValue: folded ? 1 : 0, duration: 160, useNativeDriver: false }).start();
  }, [folded, show]);
  return (
    <View testID="top-bar" style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.bg, paddingHorizontal: SPACE.lg, minHeight: folded ? 44 : 0 }}>
      <View style={{ flex: 1 }}>
        {folded && words ? (
          <Animated.View style={{ opacity: show }}>
            <Txt testID="top-bar-title" variant="strong" numberOfLines={1}>{words}</Txt>
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, minHeight: MIN_TARGET, paddingHorizontal: SPACE.md, borderRadius: RADIUS.medium },
});

export { greeting };
