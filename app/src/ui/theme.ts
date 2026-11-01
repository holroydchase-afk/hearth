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

// DS-11 (Chase, Nov 1 2026): one warm Hearth palette on every phone, replacing the cold system grays.
// Warm off-white and warm charcoal (never pure black, which glares next to bright photos at night),
// one calm blue for everything you can tap. Body text is 7:1 or better (WCAG AAA) in both looks;
// everything else is 4.5:1 or better (designSystem.test.tsx). Shapes and fonts stay each phone's own.
const hearth: { light: Colors; dark: Colors } = {
  light: {
    bg: '#F7F5F2', surface: '#FFFFFF', ink: '#1C1B19', muted: '#5D5953', line: '#D6D1CA',
    accent: '#0B57D0', accentInk: '#FFFFFF', accentSoft: '#E4ECFA', fill: '#ECE8E3',
    safe: '#1C6E31', safeSoft: '#E3F3E7', danger: '#B3261E', onDanger: '#FFFFFF', scrim: 'rgba(0,0,0,0.4)', photo: '#E8E4DE',
  },
  dark: {
    bg: '#151413', surface: '#232120', ink: '#F4F1EC', muted: '#B9B3AB', line: '#3D3A36',
    accent: '#8AB4F8', accentInk: '#0A2558', accentSoft: '#1F2D45', fill: '#33302D',
    safe: '#7DD394', safeSoft: '#173322', danger: '#F2B8B5', onDanger: '#601410', scrim: 'rgba(0,0,0,0.6)', photo: '#2E2B28',
  },
};

/** Same colors on iPhone, Android and the web (DS-11); os stays so a phone can differ later. */
export function paletteFor(_os: OS, dark: boolean): Colors {
  return dark ? hearth.dark : hearth.light;
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
  const dark = isDark(look, scheme);
  const os = Platform.OS as OS;
  return { c: paletteFor(os, dark), t: typeScale(bigText), bigText, dark, os };
}
