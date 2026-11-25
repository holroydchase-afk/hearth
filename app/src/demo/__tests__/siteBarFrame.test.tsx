// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// SITEBAR-3 (intake #183): the portfolio's shared top bar sits on a white page (data-page="white"), so in the light
// look the laptop demo frame's page is plain white (#FFFFFF), not the theme's page color, and the bar and the demo
// read as one page. Dark is unchanged (the page is c.bg), and the phone column keeps its own color and shadow.
import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { Platform, StyleSheet, Text } from 'react-native';
import { DemoFrame } from '../DemoFrame';
import { LookContext, ThemeContext, paletteFor, type ThemeName } from '../../ui/theme';

const flat = (s: unknown) => (StyleSheet.flatten(s as never) ?? {}) as Record<string, unknown>;
const pal = (dark: boolean, theme: ThemeName) => paletteFor(Platform.OS as 'ios', dark, theme);
const frame = (dark: boolean, theme: ThemeName) => {
  const r = render(
    <LookContext.Provider value={dark ? 'dark' : 'light'}>
      <ThemeContext.Provider value={theme}>
        <DemoFrame width={1280}><Text>the app</Text></DemoFrame>
      </ThemeContext.Provider>
    </LookContext.Provider>,
  );
  const out = { row: flat(screen.getByTestId('demo-frame').props.style), column: flat(screen.getByTestId('demo-app-column').props.style) };
  r.unmount();
  return out;
};

describe('SITEBAR-3 the laptop demo frame matches the white site bar in light', () => {
  for (const theme of ['paper', 'avocado', 'pomegranate'] as ThemeName[]) {
    it(`SITEBAR-3 (${theme}, light) the demo-frame row is #FFFFFF, not the theme page color`, () => {
      const { row } = frame(false, theme);
      expect({ theme, bg: String(row.backgroundColor).toUpperCase() }).toEqual({ theme, bg: '#FFFFFF' });
    });

    it(`SITEBAR-3 (${theme}, dark) unchanged: the demo-frame row is the theme page color (c.bg)`, () => {
      const { row } = frame(true, theme);
      expect(row.backgroundColor).toBe(pal(true, theme).bg);
    });

    it(`SITEBAR-3 (${theme}) the phone column is unchanged: c.bg with the soft shadow in light, c.surface in dark`, () => {
      const light = frame(false, theme).column;
      expect(light.backgroundColor).toBe(pal(false, theme).bg);
      expect(String(light.boxShadow)).toBe('0 12px 40px rgba(0,0,0,0.18)');
      expect(light.width).toBe(430);
      const dark = frame(true, theme).column;
      expect(dark.backgroundColor).toBe(pal(true, theme).surface);
      expect(dark.boxShadow).toBeUndefined();
    });
  }
});
