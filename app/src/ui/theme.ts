// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Native first (docs/product/DESIGN-SYSTEM.md): each phone's own type ramp, font and controls, in black and white
// with one family accent (RD-1..RD-8, DEC-59), plus Hearth's overrides (DS-1..DS-9). Nothing under 17 pt (DS-2).
// RN Text scales with the phone's text size (Dynamic Type / Android font scale): we never turn allowFontScaling off.
import { createContext, useContext } from 'react';
import { Platform, useColorScheme } from 'react-native';

export type OS = 'ios' | 'android' | 'web';

export interface Colors {
  bg: string; surface: string; ink: string; muted: string; line: string;
  accent: string; accentInk: string; accentSoft: string; fill: string;
  safe: string; safeSoft: string; danger: string; onDanger: string;
  /** RD-72 (UX-R29): red words on the page or a sheet (Delete post, the alert's Delete); iOS systemRed in dark. */
  dangerText: string; scrim: string; photo: string;
}

// RD-1 (DEC-59, Chase Nov 14 2026: "black and white and an accent"): a white screen with near-black words in light
// mode, true black with near-white words in dark mode, and neutral grays in between (Apple's own system grays).
// RD-3: one accent per palette, from one setting, the family color (RD-24): Ember (default), Forest or Plum.
// Only the accent changes between them. Body text is 7:1 or better; the accent 4.5:1 on the screen, rows and
// fills, light and dark (RD-5; redesignLook.test.tsx).
export type ColorName = 'ember' | 'forest' | 'plum';
export const COLOR_NAMES: readonly ColorName[] = ['ember', 'forest', 'plum'];
export const ColorContext = createContext<ColorName>('ember');

const status = {
  light: { safe: '#1C6E31', safeSoft: '#E3F3E7', danger: '#B3261E', dangerText: '#B3261E', onDanger: '#FFFFFF', scrim: 'rgba(0,0,0,0.4)' },
  dark: { safe: '#7DD394', safeSoft: '#173322', danger: '#F2B8B5', dangerText: '#FF453A', onDanger: '#601410', scrim: 'rgba(0,0,0,0.6)' },
};

const NEUTRAL = {
  light: { ...status.light, bg: '#FFFFFF', surface: '#F7F7F9', ink: '#1C1C1E', muted: '#5F5F64', line: '#D1D1D6', fill: '#F2F2F7', photo: '#EFEFF4' },
  dark: { ...status.dark, bg: '#000000', surface: '#1C1C1E', ink: '#F5F5F7', muted: '#AEAEB2', line: '#38383A', fill: '#2C2C2E', photo: '#1C1C1E' },
};

/** The family color: the one accent, light and dark, and the words that sit on it. */
const ACCENTS: Record<ColorName, { light: string; dark: string }> = {
  ember: { light: '#B23A1E', dark: '#FF8A65' },
  forest: { light: '#2E7D4F', dark: '#6FCF97' },
  plum: { light: '#8E3A8F', dark: '#D9A0E0' },
};

function build(name: ColorName): { light: Colors; dark: Colors } {
  const a = ACCENTS[name];
  return {
    light: { ...NEUTRAL.light, accent: a.light, accentInk: '#FFFFFF', accentSoft: mix(a.light, '#FFFFFF', 0.93) },
    dark: { ...NEUTRAL.dark, accent: a.dark, accentInk: '#000000', accentSoft: mix(a.dark, '#000000', 0.82) },
  };
}

let palettes: Record<ColorName, { light: Colors; dark: Colors }> | null = null;
function allPalettes() {
  palettes ??= { ember: build('ember'), forest: build('forest'), plum: build('plum') };
  return palettes;
}

/** Same colors on iPhone, Android and the web (RD-1); os stays so a phone can differ later.
 *  high: the phone's Increase Contrast (iPhone) or High contrast text (Android) is on (HIG-7). */
export function paletteFor(_os: OS, dark: boolean, color: ColorName = 'ember', high = false): Colors {
  const all = allPalettes();
  const p = all[color] ?? all.ember;
  const base = dark ? p.dark : p.light;
  return high ? highContrast(base) : base;
}

/** Mix two #RRGGBB colors: t = 0 is a, 1 is b. */
export function mix(a: string, b: string, t: number): string {
  const ch = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16);
  return `#${[1, 3, 5].map((i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * t).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

/** The least nudge of `from` toward `to` that reaches `ratio` against `against` (at least `min`). */
function nudge(from: string, to: string, against: string, ratio: number, min = 0): string {
  for (let t = min; t < 1; t += 0.05) {
    const c = mix(from, to, t);
    if (contrast(c, against) >= ratio) return c;
  }
  return to;
}

// HIG-7 (Nov 6 2026): Apple asks for a high-contrast version of every custom color. Same hues, pulled toward the
// ink: secondary words reach 7:1 (body text's AAA), edges 4.5:1, and the tap color a clear step up.
const highCache = new Map<Colors, Colors>();
function highContrast(c: Colors): Colors {
  const hit = highCache.get(c);
  if (hit) return hit;
  let accent = nudge(c.accent, c.ink, c.bg, 0, 0.3);
  for (let t = 0.3; contrast(c.accentInk, accent) < 7 && t < 1; t += 0.05) accent = mix(c.accent, c.ink, t);
  const out: Colors = {
    ...c,
    muted: nudge(c.muted, c.ink, c.bg, 7),
    line: nudge(c.line, c.ink, c.surface, 4.5),
    accent,
  };
  highCache.set(c, out);
  return out;
}

// RD-2 (DEC-59): the phone's own font, SF Pro on iPhone, Roboto on Android, the system stack on the web, so no
// fontFamily is ever set and nothing is loaded. Regular for reading; Semibold for names, titles, buttons and the
// picked tab and the large title; Medium for a person's name on a post (RD-48). No Bold anywhere (RD-55, DEC-65),
// never Light, italics or all caps.
export const WEIGHT = { regular: '400', medium: '500', semibold: '600' } as const;

export const MIN_TARGET = 48;

/** HIG-3 (Nov 6 2026): tab and toolbar words grow with the phone's text size up to 1.5x, then stop, and the tab
 *  shows Apple's large pop-up label instead (as the phone's own tab bars do). Body text has no cap. */
export const LABEL_SCALE_CAP = 1.5;

/** HIG-11: an icon grows with the phone's text size (never shrinks), up to the same cap as its word. */
export function iconSize(base: number, fontScale: number): number {
  return Math.round(base * Math.min(Math.max(fontScale, 1), LABEL_SCALE_CAP));
}

/** QA-R1 (HIG-2 off iPhone): after a two-finger pinch, spread 25% or more to zoom in, squeeze 20% or more to
 *  zoom out; anything smaller keeps the zoom as it was. ratio = finger distance at the end / at the start. */
export function pinchZoom(ratio: number, zoomed: boolean): boolean {
  if (ratio >= 1.25) return true;
  if (ratio <= 0.8) return false;
  return zoomed;
}

/** HIG-10: a bottom sheet closes on a drag down of 80 pt or a quick flick down. */
export function sheetShouldClose(dy: number, vy: number): boolean {
  return dy > 80 || (dy > 0 && vy > 0.8);
}

// DS-13 (Nov 1, 2026): one spacing scale and four corner sizes, so screens stop picking numbers by hand
// (the sweep found 13 different gaps and 9 corner sizes). New code uses these; older screens move over
// as they're touched (TRACKER R30).
/** Gaps and padding, on a 4 pt grid. Related things sit closer (sm) than unrelated ones (lg, xl). */
export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
/** Corners (RD-8): small (checkbox, quiet field), medium (rows, cards, choices, notices, fields, New for you
 *  photos), photo (Gallery's months mosaic and a post's photos, like Apple Photos: RD-44, RD-54), pill (capsules,
 *  chips, avatars). */
export const RADIUS = { small: 4, medium: 12, photo: 16, pill: 999 } as const;
/** The one exception: dialogs keep each phone's own corner (HIG alert 14 pt, Material 3 dialog 28 dp). */
export function dialogRadius(os: OS): number {
  return os === 'android' ? 28 : 14;
}

/** HIG text styles at the default size (Body 17, Title 2 22, Title 1 28); Material's ramp raised to match (DS-2). */
export function typeScale(bigText: boolean) {
  const base = bigText ? 21 : 17;
  return { base, title: Math.round(base * 1.3), display: Math.round(base * 1.65), line: Math.round(base * 1.3) };
}

/** RD-44 / RD-55: Gallery's two big words, at Apple's sizes: the greeting is the Large Title (34) and each month's
 *  name 24. Already big, so Bigger text leaves them as they are; the phone's own text size still scales them. */
export const GALLERY_TYPE = { largeTitle: 34, month: 24 } as const;

/** WCAG 2 contrast ratio of two opaque #RRGGBB colors. */
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, b2] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b2!;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

export interface Theme {
  c: Colors; t: ReturnType<typeof typeScale>; bigText: boolean; dark: boolean; os: OS;
  /** HIG-7 / HIG-8: the phone's Increase Contrast and Reduce Motion. */
  highContrast: boolean; reduceMotion: boolean;
}

/** HIG-7 / HIG-8: the phone's accessibility settings that change how Hearth draws (AppProvider keeps it current). */
export interface PhoneA11y { highContrast: boolean; reduceMotion: boolean }
export const PhoneA11yContext = createContext<PhoneA11y>({ highContrast: false, reduceMotion: false });

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
  const { highContrast, reduceMotion } = useContext(PhoneA11yContext);
  const dark = isDark(look, scheme);
  const os = Platform.OS as OS;
  return { c: paletteFor(os, dark, color, highContrast), t: typeScale(bigText), bigText, dark, os, highContrast, reduceMotion };
}
