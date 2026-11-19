// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { HearthTabBar, nativeTabLook, tabsFor, usesNativeTabs, type TabName } from '../TabBar';
import { expectGrandparentSafe } from '../../test/renderApp';
import { BigTextContext } from '../../ui/theme';

describe('tabs', () => {
  // RD-9 (SPEC-REDESIGN 1b) replaced Photos/Help (viewers) and Photos/Share/Groups/Me (posters).
  it('RD-9 viewers get exactly Gallery, Feed and More (no Share tab)', () => {
    expect(tabsFor('viewer').map((t) => t.label)).toEqual(['Gallery', 'Feed', 'More']);
    render(<HearthTabBar role="viewer" current={'gallery' as string as TabName} onNavigate={() => {}} />);
    for (const name of ['Gallery', 'Feed', 'More']) expect(screen.getByRole('tab', { name })).toBeTruthy();
    for (const name of ['Share', 'Photos', 'Groups', 'Me', 'Help']) expect(screen.queryByRole('tab', { name })).toBeNull();
  });

  it('RD-9 posters get Gallery, Share, Feed and More', () => {
    expect(tabsFor('owner').map((t) => t.label)).toEqual(['Gallery', 'Share', 'Feed', 'More']);
    expect(tabsFor('adult').map((t) => t.label)).toEqual(['Gallery', 'Share', 'Feed', 'More']);
  });

  // engineer, flagged for qa-tdd: words under the icons only with Easy view On (RD-77, DEC-66); Off is easyView.test.tsx.
  it('words under icons (Easy view On), 48 pt, and it navigates', () => {
    const go = jest.fn();
    render(<BigTextContext.Provider value><HearthTabBar role="owner" current={'gallery' as string as TabName} onNavigate={go} /></BigTextContext.Provider>);
    expect(screen.getByText('Share')).toBeTruthy();
    fireEvent.press(screen.getByRole('tab', { name: 'Share' }));
    expect(go).toHaveBeenCalledWith('share');
    expect(screen.getByRole('tab', { name: 'Gallery' }).props.accessibilityState).toMatchObject({ selected: true });
    expectGrandparentSafe();
  });

  it('RD-106 iPhone with Easy view Off uses the phone\'s own tab bar (glass on iOS 26, classic before); Easy view On keeps Hearth\'s fixed bar with words (Chase, Nov 19, DEC-70)', () => {
    expect(usesNativeTabs('ios', false)).toBe(true);
    expect(usesNativeTabs('ios', true)).toBe(false);
    expect(usesNativeTabs('android', false)).toBe(true);
    expect(usesNativeTabs('android', true)).toBe(true);
    expect(usesNativeTabs('web', false)).toBe(false);
    expect(usesNativeTabs('web', true)).toBe(false);
  });

  it('RD-107 the iPhone\'s own bar is icons only with spoken names and the system\'s glass (no Hearth color behind it); Android keeps its words rule and page color', () => {
    expect(nativeTabLook('ios', false)).toMatchObject({ labelHidden: true, themedBackground: false });
    expect(nativeTabLook('android', false)).toMatchObject({ labelHidden: false, themedBackground: true });
    expect(nativeTabLook('android', true)).toMatchObject({ labelHidden: false, themedBackground: true });
  });

  it('RD-110 the iPhone\'s own bar shrinks to its glass oval on scroll down and comes back on scroll up (Chase, Nov 19, DEC-75); Android\'s never shrinks', () => {
    expect(nativeTabLook('ios', false).minimize).toBe('onScrollDown');
    expect(nativeTabLook('android', false).minimize).toBe('never');
    expect(nativeTabLook('android', true).minimize).toBe('never');
  });
});

