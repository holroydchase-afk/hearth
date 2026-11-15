// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// RD-11..RD-13 (SPEC-REDESIGN 1b): Gallery's top. A large title greets the person by the name the family gave them
// ("Good morning, Grandma Jo"); when Gallery scrolls, it folds into the top bar on the left, on the screen's own
// solid color (DS-6), and comes back when scrolled to the top. The bar's right side is exactly Search and By date,
// each a thin icon with its word. One look on iPhone, Android and the web (the iPhone's native large-title header
// is checked by hand, RD-28). Reduce Motion: the titles fade instead of shrinking (DS-14).
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useApp } from '../state/AppContext';
import { greeting } from '../ui/greeting';
import { IconButton, Txt } from '../ui/kit';
import { useTheme } from '../ui/theme';

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
  return (
    <Animated.View style={style}>
      <Txt variant="display" role="header">{words}</Txt>
    </Animated.View>
  );
}

/** The solid top bar: the folded greeting on the left, Search and By date on the right. */
export function GalleryTopBar({ words, folded, onSearch, onByDate }: { words: string | null; folded: boolean; onSearch: () => void; onByDate: () => void }) {
  const { c } = useTheme();
  const show = useRef(new Animated.Value(folded ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(show, { toValue: folded ? 1 : 0, duration: 160, useNativeDriver: false }).start();
  }, [folded, show]);
  return (
    <View testID="top-bar" style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.bg, paddingHorizontal: 12, gap: 8,
      borderBottomWidth: folded ? StyleSheet.hairlineWidth : 0, borderBottomColor: c.line }}>
      <View style={{ flex: 1 }}>
        {folded && words ? (
          <Animated.View style={{ opacity: show }}>
            <Txt testID="top-bar-title" variant="strong" numberOfLines={1}>{words}</Txt>
          </Animated.View>
        ) : null}
      </View>
      <IconButton label="Search the photos" text="Search" icon={{ sf: 'magnifyingglass', md: 'search' }} onPress={onSearch} />
      <IconButton label="Show photos by the date they were taken" text="By date" icon={{ sf: 'arrow.up.arrow.down', md: 'sort' }} onPress={onByDate} />
    </View>
  );
}

export { greeting };
