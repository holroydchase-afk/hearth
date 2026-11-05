// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Native first (docs/product/DESIGN-SYSTEM.md): each phone's own type ramp and controls, Hearth's own font and colors,
// plus Hearth's overrides (DS-1..DS-9). Nothing under 17 pt (DS-2). RN Text scales with the
// phone's text size (Dynamic Type / Android font scale) because we never turn allowFontScaling off.
// One file per weight, so the other 11 (Light, Bold, italics) never ship in the app.
import { AtkinsonHyperlegibleNext_400Regular } from '@expo-google-fonts/atkinson-hyperlegible-next/400Regular';
import { AtkinsonHyperlegibleNext_500Medium } from '@expo-google-fonts/atkinson-hyperlegible-next/500Medium';
import { AtkinsonHyperlegibleNext_600SemiBold } from '@expo-google-fonts/atkinson-hyperlegible-next/600SemiBold';
import { createContext, useContext } from 'react';
import { Platform, useColorScheme } from 'react-native';

export type OS = 'ios' | 'android' | 'web';

export interface Colors {
  bg: string; surface: string; ink: string; muted: string; line: string;
  accent: string; accentInk: string; accentSoft: string; fill: string;
  safe: string; safeSoft: string; danger: string; onDanger: string; scrim: string; photo: string;
}

// DS-11 (Chase, Nov 1 2026): warm Hearth colors on every phone, replacing the cold system grays.
// Off-white and charcoal tinted to match (never pure black, which glares next to bright photos at night).
// COLOR-1 (Chase, Nov 5 2026: "I'd like all three color options"): Ember, Sage and Plum, each light and dark,
// replacing the Nov 1 blue. Body text is 7:1 or better (WCAG AAA); everything else is 4.5:1 or better
// (designSystem.test.tsx, colors.test.tsx). Shapes and fonts stay each phone's own.
export type ColorName = 'ember' | 'sage' | 'plum';
export const COLOR_NAMES: readonly ColorName[] = ['ember', 'sage', 'plum'];
export const ColorContext = createContext<ColorName>('ember');

const status = {
  light: { safe: '#1C6E31', safeSoft: '#E3F3E7', danger: '#B3261E', onDanger: '#FFFFFF', scrim: 'rgba(0,0,0,0.4)' },
  dark: { safe: '#7DD394', safeSoft: '#173322', danger: '#F2B8B5', onDanger: '#601410', scrim: 'rgba(0,0,0,0.6)' },
};

const PALETTES: Record<ColorName, { light: Colors; dark: Colors }> = {
  ember: {
    light: { ...status.light, bg: '#FAF6F1', surface: '#FFFFFF', ink: '#1F1A17', muted: '#5E5650', line: '#DDD3C9',
      accent: '#A4421F', accentInk: '#FFFFFF', accentSoft: '#F6E5DC', fill: '#EFE8E1', photo: '#EAE3DB' },
    dark: { ...status.dark, bg: '#171311', surface: '#241E1B', ink: '#F6EFE9', muted: '#BDB2A9', line: '#40362F',
      accent: '#F4A47F', accentInk: '#4A1606', accentSoft: '#3A231A', fill: '#352C27', photo: '#2F2723' },
  },
  sage: {
    light: { ...status.light, bg: '#F5F7F3', surface: '#FFFFFF', ink: '#1A1D1A', muted: '#555B55', line: '#D2D8D0',
      accent: '#2D6A4E', accentInk: '#FFFFFF', accentSoft: '#E0EDE5', fill: '#E8EDE6', photo: '#E3E8E1' },
    dark: { ...status.dark, bg: '#121513', surface: '#1F2420', ink: '#EEF3EE', muted: '#B0B9B1', line: '#353D37',
      accent: '#8FD1AE', accentInk: '#0B3220', accentSoft: '#1C3328', fill: '#2C332E', photo: '#29302B' },
  },
  plum: {
    light: { ...status.light, bg: '#F8F6FA', surface: '#FFFFFF', ink: '#1C1A1F', muted: '#5A5560', line: '#D8D2DE',
      accent: '#5A3EA6', accentInk: '#FFFFFF', accentSoft: '#ECE6F7', fill: '#EEEAF2', photo: '#E8E3EE' },
    dark: { ...status.dark, bg: '#141317', surface: '#221F27', ink: '#F2EFF6', muted: '#B7B0C0', line: '#3B3642',
      accent: '#C5B3F5', accentInk: '#2A1660', accentSoft: '#2D2541', fill: '#312C38', photo: '#2C2832' },
  },
};

/** Same colors on iPhone, Android and the web (DS-11); os stays so a phone can differ later. */
export function paletteFor(_os: OS, dark: boolean, color: ColorName = 'ember'): Colors {
  const p = PALETTES[color] ?? PALETTES.ember;
  return dark ? p.dark : p.light;
}

// DS-12 (Chase, Nov 1 2026): Atkinson Hyperlegible Next, the Braille Institute's typeface for low-vision
// readers (SIL OFL), on every phone and the web. Three weights only, each its own file, because a custom
// font can't be made bolder with fontWeight on Android (and the web would fake it):
//   regular  - everything you read: posts, comments, captions, dates, hints, typed words
//   medium   - Android buttons (Material's label weight) and tab labels not picked
//   semibold - names, titles, screen headings, buttons, the picked tab, On/Off
// Never Light or ExtraLight (thin strokes fade on old screens), never Bold or ExtraBold (Chase: "too bold"),
// never italics or all caps.

export const FONT = {
  regular: 'AtkinsonHyperlegibleNext_400Regular',
  medium: 'AtkinsonHyperlegibleNext_500Medium',
  semibold: 'AtkinsonHyperlegibleNext_600SemiBold',
} as const;
export type FontWeightName = keyof typeof FONT;

/** For expo-font's useFonts in the root layout. */
export const FONT_FILES: Record<string, number> = {
  [FONT.regular]: AtkinsonHyperlegibleNext_400Regular,
  [FONT.medium]: AtkinsonHyperlegibleNext_500Medium,
  [FONT.semibold]: AtkinsonHyperlegibleNext_600SemiBold,
};

export const fontFamily = FONT.regular;

export const MIN_TARGET = 48;

// DS-13 (Nov 1, 2026): one spacing scale and four corner sizes, so screens stop picking numbers by hand
// (the sweep found 13 different gaps and 9 corner sizes). New code uses these; older screens move over
// as they're touched (TRACKER R30).
/** Gaps and padding, on a 4 pt grid. Related things sit closer (sm) than unrelated ones (lg, xl). */
export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
/** Corners: small (checkbox, quiet field), medium (cards, choices, notices, fields), large (event card,
 *  reply box), pill (buttons, chips, avatars). */
export const RADIUS = { small: 4, medium: 12, large: 20, pill: 999 } as const;
/** The one exception: dialogs keep each phone's own corner (HIG alert 14 pt, Material 3 dialog 28 dp). */
export function dialogRadius(os: OS): number {
  return os === 'android' ? 28 : 14;
}

/** HIG text styles at the default size (Body 17, Title 2 22, Title 1 28); Material's ramp raised to match (DS-2). */
export function typeScale(bigText: boolean) {
  const base = bigText ? 21 : 17;
  return { base, title: Math.round(base * 1.3), display: Math.round(base * 1.65), line: Math.round(base * 1.3) };
}

/** WCAG 2 contrast ratio of two opaque #RRGGBB colors. */
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, b2] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b2!;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

export interface Theme { c: Colors; t: ReturnType<typeof typeScale>; bigText: boolean; dark: boolean; os: OS }

export const BigTextContext = createContext(false);

/** DS-10: light or dark screen. 'system' follows the phone (the default); Light and Dark ignore it. */
export type ScreenLook = 'system' | 'light' | 'dark';
export const SCREEN_LOOKS: readonly ScreenLook[] = ['system', 'light', 'dark'];
export const LookContext = createContext<ScreenLook>('system');

export function isDark(look: ScreenLook, phone: string | null | undefined): boolean {
  return look === 'system' ? phone === 'dark' : look === 'dark';
}

/** Status bar icons (clock, battery) that read on the screen behind them. */
export function statusBarStyle(dark: boolean): 'light' | 'dark' {
  return dark ? 'light' : 'dark';
}

/** What the phone's own parts (tab bar, keyboard, alerts) are told, so they match Hearth's screen. */
export function nativeScheme(look: ScreenLook): 'light' | 'dark' | 'unspecified' {
  return look === 'system' ? 'unspecified' : look;
}

export function useTheme(): Theme {
  const scheme = useColorScheme();
  const bigText = useContext(BigTextContext);
  const look = useContext(LookContext);
  const color = useContext(ColorContext);
  const dark = isDark(look, scheme);
  const os = Platform.OS as OS;
  return { c: paletteFor(os, dark, color), t: typeScale(bigText), bigText, dark, os };
}
