// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// RD-108 / RD-109 (Chase, Nov 19, DEC-72): the web demo shows a lookalike of iOS 26's floating glass tab bar while
// Easy view is Off; Easy view On keeps the fixed bar with words. Screens leave room under the floating bar.
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { HearthTabBar, floatingTabBar, nextMinimized, type TabName } from '../TabBar';
import { Screen } from '../../ui/kit';
import { PhoneA11yContext } from '../../ui/theme';
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

  it('RD-110 shrunk, the bar is a small glass oval holding only the picked tab, spoken "<tab>, show all tabs"', () => {
    render(<HearthTabBar role="owner" current={'feed' as string as TabName} onNavigate={() => {}} floating minimized onExpand={() => {}} />);
    const s = flat(tablist().props.style);
    expect(s.maxWidth).toBe(64);
    expect({ left: s.left, right: s.right }).toEqual({ left: 16, right: 16 }); // pinned left by its max width
    expect(String(s.backdropFilter)).toMatch(/blur\(/);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(1);
    expect(tabs[0]!.props.accessibilityLabel).toBe('Feed, show all tabs');
  });

  // RD-110-R1 (review of PR 138, Nov 19): the tap only brings the bar back. Acting as a tap on More too threw away
  // the parent's place inside More (Groups back to the menu) when they only wanted the tabs.
  it('RD-110-R1 tapping the shrunk oval brings the full bar back and does not act as a tap on the tab', () => {
    const expand = jest.fn();
    const go = jest.fn();
    render(<HearthTabBar role="owner" current={'more' as string as TabName} onNavigate={go} floating minimized onExpand={expand} />);
    fireEvent.press(screen.getAllByRole('tab')[0]!);
    expect(expand).toHaveBeenCalledTimes(1);
    expect(go).not.toHaveBeenCalled();
  });

  // RD-110-R4: the width change can really animate (a max width that is a length both ways, not "auto"), and with
  // Reduce Motion there is no animation at all.
  it('RD-110-R4 the shrink animates between two lengths; Reduce Motion turns the animation off', () => {
    const { unmount } = render(<HearthTabBar role="owner" current={'gallery' as string as TabName} onNavigate={() => {}} floating minimized={false} />);
    const full = flat(tablist().props.style);
    expect(String(full.maxWidth)).toMatch(/^calc\(100% - 32px\)$/);
    expect(String(full.transition)).toMatch(/max-width 220ms/);
    unmount();
    render(
      <PhoneA11yContext.Provider value={{ highContrast: false, reduceMotion: true }}>
        <HearthTabBar role="owner" current={'gallery' as string as TabName} onNavigate={() => {}} floating minimized={false} />
      </PhoneA11yContext.Provider>,
    );
    expect(flat(tablist().props.style).transition).toBeUndefined();
  });
});
