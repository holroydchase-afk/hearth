// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// RD-108 / RD-109 (Chase, Nov 19, DEC-72): the web demo shows a lookalike of iOS 26's floating glass tab bar while
// Easy view is Off; Easy view On keeps the fixed bar with words. Screens leave room under the floating bar.
import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { HearthTabBar, floatingTabBar, nextMinimized, type TabName } from '../TabBar';
import { fireEvent } from '@testing-library/react-native';
import { Screen } from '../../ui/kit';
import { TabBarSpaceContext, TAB_BAR_FLOAT_SPACE } from '../../ui/tabBarSpace';

const flat = (s: unknown) => StyleSheet.flatten(s as never) as Record<string, unknown>;
const tablist = () => screen.UNSAFE_root.findAll((n) => typeof n.type === 'string' && n.props.accessibilityRole === 'tablist')[0]!;

describe('RD-108 web lookalike of the floating glass tab bar', () => {
  it('RD-108 floats only on the web with Easy view Off', () => {
    expect(floatingTabBar('web', false)).toBe(true);
    expect(floatingTabBar('web', true)).toBe(false);
    expect(floatingTabBar('ios', false)).toBe(false);
    expect(floatingTabBar('android', false)).toBe(false);
  });

  it('RD-108 the floating bar is a see-through, blurred capsule 16 pt in from the edges, with a pill behind the picked tab', () => {
    render(<HearthTabBar role="owner" current={'gallery' as string as TabName} onNavigate={() => {}} floating />);
    const s = flat(tablist().props.style);
    expect(s.position).toBe('absolute');
    expect({ left: s.left, right: s.right }).toEqual({ left: 16, right: 16 });
    expect(s.borderRadius as number).toBeGreaterThanOrEqual(28);
    expect(String(s.backgroundColor)).toMatch(/^rgba\(/);
    expect(String(s.backdropFilter)).toMatch(/blur\(/);
    const picked = flat(screen.getByRole('tab', { name: 'Gallery' }).props.style);
    const other = flat(screen.getByRole('tab', { name: 'Feed' }).props.style);
    expect(picked.backgroundColor).toBeTruthy();
    expect(other.backgroundColor ?? 'transparent').toBe('transparent');
    for (const name of ['Gallery', 'Share', 'Feed', 'More']) expect(screen.getByRole('tab', { name })).toBeTruthy();
  });

  it('RD-108 not floating, the bar stays fixed and full width (Easy view On, iPhone fallback)', () => {
    render(<HearthTabBar role="owner" current={'gallery' as string as TabName} onNavigate={() => {}} />);
    const s = flat(tablist().props.style);
    expect(s.position).not.toBe('absolute');
    expect(s.backdropFilter).toBeUndefined();
  });

  it('RD-109 a screen leaves room at the bottom for the floating bar, and none without it', () => {
    const { unmount } = render(<TabBarSpaceContext.Provider value={TAB_BAR_FLOAT_SPACE}><Screen><Text>x</Text></Screen></TabBarSpaceContext.Provider>);
    const pad = () => {
      const sv = screen.UNSAFE_getByType(require('react-native').ScrollView);
      return flat(sv.props.contentContainerStyle).paddingBottom as number;
    };
    expect(pad()).toBeGreaterThanOrEqual(TAB_BAR_FLOAT_SPACE);
    unmount();
    render(<Screen><Text>x</Text></Screen>);
    expect(pad()).toBeLessThan(TAB_BAR_FLOAT_SPACE);
  });

  // RD-110 (Chase, Nov 19, DEC-75): "the full iOS glass oval interaction on scroll".
  it('RD-110 scrolling down past the top shrinks the bar; scrolling up or reaching the top brings it back; small moves change nothing', () => {
    expect(nextMinimized(false, 100, 140)).toBe(true); // down
    expect(nextMinimized(true, 300, 260)).toBe(false); // up
    expect(nextMinimized(false, 0, 30)).toBe(false); // still near the top
    expect(nextMinimized(true, 200, 10)).toBe(false); // back at the top
    expect(nextMinimized(true, 200, 204)).toBe(true); // jitter
    expect(nextMinimized(false, 200, 196)).toBe(false);
  });

  it('RD-110 shrunk, the bar is a small glass oval holding only the picked tab; tapping it brings the full bar back and acts as a tap on that tab', () => {
    const expand = jest.fn();
    const go = jest.fn();
    render(<HearthTabBar role="owner" current={'feed' as string as TabName} onNavigate={go} floating minimized onExpand={expand} />);
    const s = flat(tablist().props.style);
    expect(s.width).toBe(64);
    expect(s.right).toBeUndefined();
    expect(String(s.backdropFilter)).toMatch(/blur\(/);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(1);
    expect(tabs[0]!.props.accessibilityLabel).toBe('Feed, show all tabs');
    // Like the phone's own bar, the tap also does what tapping the picked tab does (More goes back to its menu).
    fireEvent.press(tabs[0]!);
    expect(expand).toHaveBeenCalled();
    expect(go).toHaveBeenCalledWith('feed');
  });
});

