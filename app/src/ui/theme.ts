// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Native first (docs/product/DESIGN-SYSTEM.md): each phone's own type ramp, font and controls, on the owner's theme
// (Paper by default; RD-94..RD-99, DEC-68), plus Hearth's overrides (DS-1..DS-9). Nothing under 17 pt (DS-2).
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
  /** GUX-R18: the tab bar's top line, c.line nudged toward the ink by the least step that is 3:1 against both the
   *  tab bar (surface) and the page (bg). Still a quiet grey; c.line itself stays subtle for other dividers. */
  tabLine: string;
}

// RD-94..RD-96 (DEC-68, Chase Nov 18 2026): three themes with plain names, each its own page, grays and accent.
// Paper (the default) is an off-white page with white sheets and warm grays; Avocado a soft green page; Pomegranate
// a soft blush page. Was one tan paper with three accent-only family colors (RD-84..RD-86, DEC-67). Body text is 7:1
// or better; muted 4.5:1 on the page and fill; the accent 4.5:1 on the page, fills and its own soft tint, light
// and dark (RD-96; themes.test.ts). Status colors (safe, danger) are shared by every theme.
export type ThemeName = 'paper' | 'avocado' | 'pomegranate';
export const THEME_NAMES: readonly ThemeName[] = ['paper', 'avocado', 'pomegranate'];
export const ThemeContext = createContext<ThemeName>('paper');

/** How far a soft tint (accentSoft; safeSoft, the "sent" tint) mixes its color into the page. */
export const SOFT = { light: 0.93, dark: 0.82 } as const;

// RD-114 / RD-115 (DEC-76, Chase Nov 20): a picked reaction is a 2 pt accent outline with an accent count, no fill,
// so GUX-R15's accentPicked capsule tint is gone.

/** GUX-R17: safeSoft is safe mixed into the theme's page like accentSoft. */
const SAFE = { light: '#1C6E31', dark: '#7DD394' } as const;
const STATUS = {
  light: { safe: SAFE.light, danger: '#B3261E', dangerText: '#B3261E', onDanger: '#FFFFFF', scrim: 'rgba(0,0,0,0.4)' },
  dark: { safe: SAFE.dark, danger: '#F2B8B5', dangerText: '#FF453A', onDanger: '#601410', scrim: 'rgba(0,0,0,0.6)' },
};

/** A theme's own colors: page (bg), sheets (surface), words (ink, muted), hairlines (line), fills and the accent.
 *  photo (the empty photo tile) is the fill. */
interface Base { bg: string; surface: string; ink: string; muted: string; line: string; fill: string; accent: string }

/** RD-94 / RD-95: the given values (RD-105: Paper light page is Linen #F7F7F4, Chase Nov 19). Paper's surface is white; the others' sits halfway between page and fill. */
const BASES: Record<ThemeName, { light: Base; dark: Base }> = {
  paper: {
    light: { bg: '#F7F7F4', surface: '#FFFFFF', ink: '#1E1B17', muted: '#5C564E', line: '#E3DED4', fill: '#EFECE5', accent: '#AD371D' },
    dark: { bg: '#131210', surface: '#1C1A17', ink: '#F1EEE8', muted: '#B2ACA2', line: '#2E2B27', fill: '#24221E', accent: '#FF8A65' },
  },
  // RD-111 / RD-112 (DEC-76, Chase Nov 20): a Hass avocado, layer by layer. Ripe skin → light ink and the dark page
  // (a dark skin brown); just under the skin → light accent; middle flesh → fill; inner flesh → light page. Dark accent
  // is "Fresh leaf". line is the page mixed toward the ink (12% light, 16% dark).
  avocado: {
    light: { bg: '#F6F5E4', surface: mix('#F6F5E4', '#E7ECC6', 0.5), ink: '#1F1A1B', muted: '#4F4A42', line: '#DCDBCC', fill: '#E7ECC6', accent: '#2F5419' },
    dark: { bg: '#2A2426', surface: mix('#2A2426', '#3A3335', 0.5), ink: '#F3F1DA', muted: '#C2BDA8', line: '#4A4543', fill: '#3A3335', accent: '#7ED69B' },
  },
  pomegranate: {
    light: { bg: '#F5EADF', surface: mix('#F5EADF', '#EBDDD0', 0.5), ink: '#22161A', muted: '#62504F', line: '#DDCDBE', fill: '#EBDDD0', accent: '#A3172F' },
    dark: { bg: '#170D10', surface: mix('#170D10', '#24171A', 0.5), ink: '#F5E9E6', muted: '#BBA7A6', line: '#3A272B', fill: '#24171A', accent: '#FF8597' },
  },
};

function build(b: Base, dark: boolean): Colors {
  const mode = dark ? 'dark' : 'light';
  return {
    ...STATUS[mode],
    ...b,
    photo: b.fill,
    safeSoft: mix(SAFE[mode], b.bg, SOFT[mode]),
    accentInk: dark ? '#000000' : '#FFFFFF',
    accentSoft: mix(b.accent, b.bg, SOFT[mode]),
    tabLine: edge(b.line, b.ink, b.surface, b.bg),
  };
}

/** GUX-R18: the least nudge (0.01 steps) of `line` toward `ink` that is 3:1 against both `surface` and `page`. */
function edge(line: string, ink: string, surface: string, page: string): string {
  for (let i = 0; i <= 100; i++) {
    const m = mix(line, ink, i / 100);
    if (contrast(m, surface) >= 3 && contrast(m, page) >= 3) return m;
  }
  return ink;
}

let palettes: Record<ThemeName, { light: Colors; dark: Colors }> | null = null;
function allPalettes() {
  palettes ??= Object.fromEntries(THEME_NAMES.map((n) => [n, { light: build(BASES[n].light, false), dark: build(BASES[n].dark, true) }])) as Record<ThemeName, { light: Colors; dark: Colors }>;
  return palettes;
}

/** Same colors on iPhone, Android and the web (RD-84); os stays so a phone can differ later.
 *  high: the phone's Increase Contrast (iPhone) or High contrast text (Android) is on (HIG-7). */
export function paletteFor(_os: OS, dark: boolean, theme: ThemeName = 'paper', high = false): Colors {
  const all = allPalettes();
  const p = (Object.prototype.hasOwnProperty.call(all, theme) ? all[theme] : undefined) ?? all.paper;
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
  const mode = c.accentInk === '#000000' ? 'dark' : 'light';
  let accent = nudge(c.accent, c.ink, c.bg, 0, 0.3);
  for (let t = 0.3; contrast(c.accentInk, accent) < 7 && t < 1; t += 0.05) accent = mix(c.accent, c.ink, t);
  const line = nudge(c.line, c.ink, c.surface, 4.5);
  const out: Colors = {
    ...c,
    muted: nudge(c.muted, c.ink, c.bg, 7),
    line,
    tabLine: edge(line, c.ink, c.surface, c.bg),
    accent,
    // RD-86: the soft tint follows the stronger accent, still mixed with the page.
    accentSoft: mix(accent, c.bg, SOFT[mode]),
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

/** RD-88 (DEC-67, kept by DEC-68): one soft warm shadow under a photo tile (Gallery, New for you, a post's photos),
 *  light mode only; none in dark. Goes on a wrapper around the tile, so the tile's own corners still clip the photo and the shadow
 *  isn't clipped with it. Paper's ink at 10% (RD-94), 2 pt down, 12 pt blur. boxShadow works on iPhone, Android and the web. */
export function photoShadow(dark: boolean): { boxShadow: string } | null {
  return dark ? null : { boxShadow: '0px 2px 12px rgba(30, 27, 23, 0.1)' };
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
  const theme = useContext(ThemeContext);
  const { highContrast, reduceMotion } = useContext(PhoneA11yContext);
  const dark = isDark(look, scheme);
  const os = Platform.OS as OS;
  return { c: paletteFor(os, dark, theme, highContrast), t: typeScale(bigText), bigText, dark, os, highContrast, reduceMotion };
}
