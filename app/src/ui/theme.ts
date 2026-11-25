// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Native first (docs/product/DESIGN-SYSTEM.md): each phone's own type ramp and controls, Hearth's own font
// (Atkinson Hyperlegible Next, DEC-78) on the owner's theme (Paper by default; RD-94..RD-99, DEC-68), plus Hearth's
// overrides (DS-1..DS-9). Nothing under 17 pt (DS-2). RN Text scales with the phone's text size (Dynamic Type /
// Android font scale): we never turn allowFontScaling off.
// One bundled file per weight (no network, no Google Fonts CDN), so Light, Bold and italics never ship in the app.
import { AtkinsonHyperlegibleNext_400Regular } from '@expo-google-fonts/atkinson-hyperlegible-next/400Regular';
import { AtkinsonHyperlegibleNext_500Medium } from '@expo-google-fonts/atkinson-hyperlegible-next/500Medium';
import { AtkinsonHyperlegibleNext_600SemiBold } from '@expo-google-fonts/atkinson-hyperlegible-next/600SemiBold';
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

// RD-94..RD-96 (DEC-68) and FRUIT-1 (DEC-80, Chase Nov 23 2026): Paper (the default) plus nine cut-open fruits,
// each its own page, grays and accent. Paper is an off-white page with white sheets and warm grays. Body text is 7:1
// or better; muted 4.5:1 on the page and fill; the accent 4.5:1 on the page, fills and its own soft tint, light
// and dark (RD-96; themes.test.ts). Status colors (safe, danger) are shared by every theme, except dark dangerText
// (FRUIT-5: #FF6961 on every fruit, Paper keeps #FF453A).
export type ThemeName = 'paper' | 'avocado' | 'pomegranate' | 'blood-orange' | 'kiwi' | 'fig' | 'dragon-fruit' | 'watermelon' | 'beet' | 'red-cabbage';
export const THEME_NAMES: readonly ThemeName[] = ['paper', 'avocado', 'pomegranate', 'blood-orange', 'kiwi', 'fig', 'dragon-fruit', 'watermelon', 'beet', 'red-cabbage'];
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

type Given = Omit<Base, 'surface' | 'line'>;
/** FRUIT-2: surface = page and fill 50/50; line = page mixed toward ink 12% light, 16% dark (as Avocado). */
function fruit(light: Given, dark: Given): { light: Base; dark: Base } {
  const full = (g: Given, t: number): Base => ({ ...g, surface: mix(g.bg, g.fill, 0.5), line: mix(g.bg, g.ink, t) });
  return { light: full(light, 0.12), dark: full(dark, 0.16) };
}

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
  // FRUIT-2 (DEC-80): the Cut-Open Palettes values (page, fill, ink, muted, accent); surface and line by Avocado's rules.
  pomegranate: fruit(
    { bg: '#FBF5E9', fill: '#F4E5CA', ink: '#9C1F2E', muted: '#9D5157', accent: '#B3122F' },
    { bg: '#1C0608', fill: '#2F090E', ink: '#F7EBD2', muted: '#B5A695', accent: '#F07C8A' },
  ),
  'blood-orange': fruit(
    { bg: '#FBF5EB', fill: '#F7DEC7', ink: '#6F1323', muted: '#91535A', accent: '#B4232F' },
    { bg: '#2A070D', fill: '#3D0A13', ink: '#F7EAD6', muted: '#BAA69A', accent: '#E46F2C' },
  ),
  kiwi: fruit(
    { bg: '#F9F8EC', fill: '#E6EEC0', ink: '#1E1912', muted: '#786750', accent: '#497522' },
    { bg: '#1F170D', fill: '#302314', ink: '#F3F1D8', muted: '#B3B09B', accent: '#8DBB3C' },
  ),
  fig: fruit(
    { bg: '#F6F1E5', fill: '#F0DBC9', ink: '#4A2A4C', muted: '#715C6E', accent: '#B12F45' },
    { bg: '#1E111E', fill: '#29172A', ink: '#ECDFC6', muted: '#AEA194', accent: '#DE9A73' },
  ),
  'dragon-fruit': fruit(
    { bg: '#FBF9F5', fill: '#F8DDE4', ink: '#1B1A1C', muted: '#5E5D5D', accent: '#B92A66' },
    { bg: '#262527', fill: '#363537', ink: '#F8F5EE', muted: '#B9B7B2', accent: '#F4AFC9' },
  ),
  watermelon: fruit(
    { bg: '#F4F7E9', fill: '#F4DFD5', ink: '#2A1C17', muted: '#536C4F', accent: '#B93340' },
    { bg: '#0A1409', fill: '#101F0F', ink: '#E7EDCF', muted: '#A5AC94', accent: '#F58C8C' },
  ),
  beet: fruit(
    { bg: '#FDF6F9', fill: '#F7DAE5', ink: '#7E2D4A', muted: '#865668', accent: '#AB3960' },
    { bg: '#210C13', fill: '#30111C', ink: '#F8E6EC', muted: '#B8A5AB', accent: '#E3779E' },
  ),
  'red-cabbage': fruit(
    { bg: '#F7F2F8', fill: '#E4D7E7', ink: '#47245A', muted: '#70587B', accent: '#6C3482' },
    { bg: '#170C1D', fill: '#211129', ink: '#EEE3F1', muted: '#AEA3B1', accent: '#A481B2' },
  ),
};

/** FRUIT-5: #FF453A is under 4.5:1 on some fruit darks (Avocado, Dragon fruit), so they use Apple's
 *  high-contrast systemRed. Paper keeps #FF453A. */
const DANGER_TEXT_DARK_FRUIT = '#FF6961';

function build(b: Base, dark: boolean, name: ThemeName): Colors {
  const mode = dark ? 'dark' : 'light';
  return {
    ...STATUS[mode],
    ...(dark && name !== 'paper' ? { dangerText: DANGER_TEXT_DARK_FRUIT } : {}),
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
  palettes ??= Object.fromEntries(THEME_NAMES.map((n) => [n, { light: build(BASES[n].light, false, n), dark: build(BASES[n].dark, true, n) }])) as Record<ThemeName, { light: Colors; dark: Colors }>;
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

// FONT-1..FONT-3 (DEC-78, Chase Nov 21; replaces RD-2 / DEC-59's phone font): Atkinson Hyperlegible Next on
// iPhone, Android and the web. Regular for reading; SemiBold for names, titles, buttons, the picked tab and the large
// title; Medium for a person's name on a post (RD-48). The weight comes from the family, never fontWeight: Android
// can't synthesize a weight from one family. No Bold anywhere (RD-55, DEC-65), never Light, italics or all caps.
export const FONT = {
  regular: 'AtkinsonHyperlegibleNext_400Regular',
  medium: 'AtkinsonHyperlegibleNext_500Medium',
  semibold: 'AtkinsonHyperlegibleNext_600SemiBold',
} as const;
export type FontWeightName = keyof typeof FONT;

/** For expo-font's useFonts in the root layout (bundled assets, loaded once). */
export const FONT_FILES: Record<string, number> = {
  [FONT.regular]: AtkinsonHyperlegibleNext_400Regular,
  [FONT.medium]: AtkinsonHyperlegibleNext_500Medium,
  [FONT.semibold]: AtkinsonHyperlegibleNext_600SemiBold,
};

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

/** SPEC-VIEWER: the full-screen viewer's iPhone text styles, in one place until the named type scale lands
 *  (headline 17 SemiBold, caption1 12, body 17, title3 20, title2 22). They still grow with the phone's text size. */
export const VIEWER_TYPE = { headline: 17, caption1: 12, body: 17, title3: 20, title2: 22 } as const;

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
