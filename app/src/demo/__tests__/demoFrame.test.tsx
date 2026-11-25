// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// DEMO-6 (RR-6): on a laptop the demo shows the app in a phone-width column beside a short panel that
// tells a hiring manager what Hearth is and what to try; on a phone it's just the app.
import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { APP_COLUMN, DemoFrame } from '../DemoFrame';
import { BigTextContext, useTheme } from '../../ui/theme';
import { DEMO_NAMES, DEMO_POSTS } from '../seed';
import { FIXTURE } from '../../api/fake/FakeBackend';

describe('DEMO-6 laptop frame', () => {
  it('DEMO-6 at 1280 px: a story panel and the app in a 430 px column', () => {
    render(<DemoFrame width={1280}><Text>the app</Text></DemoFrame>);
    expect(screen.getByRole('header', { name: 'A private photo app for split families' })).toBeTruthy();
    expect(screen.getByText(/See it as Grandma Jo/)).toBeTruthy();
    expect(screen.getByText(/Built test-first by Chase Holroyd/)).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('demo-app-column').props.style).width).toBe(APP_COLUMN);
    expect(APP_COLUMN).toBe(430);
    expect(screen.getByText('the app')).toBeTruthy();
  });

  it('DEMO-6 at 390 px: only the app, full width', () => {
    render(<DemoFrame width={390}><Text>the app</Text></DemoFrame>);
    expect(screen.queryByText(/A private photo app/)).toBeNull();
    expect(screen.queryByTestId('demo-app-column')).toBeNull();
    expect(screen.getByText('the app')).toBeTruthy();
  });

  it('DEMO-NEW-6, T40 Try this walks the newest features in order: New for you, Grandma Jo, Search orchard', () => {
    render(<DemoFrame width={1280}><Text>the app</Text></DemoFrame>);
    expect(screen.getByText(/^1\. .*New for you/)).toBeTruthy(); // RD-21: the "See the new photos" button is gone in 1c
    expect(screen.queryByText(/See the new photos/)).toBeNull();
    expect(screen.getByText(/^2\. .*See it as Grandma Jo/)).toBeTruthy();
    // T40 (live check, Nov 24): after the Kevin/orchard demo (DEC-82) 'lake' found nothing; 'orchard' finds 1 photo
    // (site.spec.js DEMO-LIVE-2).
    expect(screen.getByText(/^3\. .*Search and type orchard\b/)).toBeTruthy();
  });

  // DEMO-KINDS-6 (Chase, Nov 25: post_kinds on in the web demo so he can tap through Photos / Event / News / Saying).
  // Written first (red) by qa-tdd: Try this gains a step 4 naming Share and the three kinds; nothing in it says the demo has no kinds.
  it('DEMO-KINDS-6 Try this step 4 sends people to Share to try News, Event or Saying', () => {
    render(<DemoFrame width={1280}><Text>the app</Text></DemoFrame>);
    const step = String(screen.getByText(/^4\. /).props.children);
    for (const w of ['Share', 'Event', 'News', 'Saying']) expect(step).toContain(w);
    expect(screen.queryByText(/no (kinds|news|events|sayings)|photos only|not in the demo/i)).toBeNull();
  });

  it('T40 the word step 3 hints really finds a demo post (title, caption or sender name, as demo search reads)', () => {
    render(<DemoFrame width={1280}><Text>the app</Text></DemoFrame>);
    const step = String(screen.getByText(/^3\. /).props.children);
    const word = /\btype (\w+)/.exec(step)?.[1]?.toLowerCase();
    expect(word).toBeTruthy();
    const sender = (p: (typeof DEMO_POSTS)[number]) => DEMO_NAMES[p.from === 'alex' ? FIXTURE.users.alex.id : FIXTURE.users.chase.id];
    const hits = DEMO_POSTS.filter((p) => `${p.title ?? ''} ${p.caption} ${sender(p)}`.toLowerCase().includes(word!));
    expect(hits.length).toBeGreaterThan(0);
  });

  it('DEMO-BAR-LAPTOP-1 (Chase, Nov 19) at 1280 px the panel holds the demo controls, under Try this; at 390 px it does not', () => {
    const { rerender } = render(<DemoFrame width={1280} controls={<Text>the controls</Text>}><Text>the app</Text></DemoFrame>);
    expect(screen.getByText('the controls')).toBeTruthy();
    expect(screen.getByText(/^2\. Tap See it as Grandma Jo below/)).toBeTruthy();
    rerender(<DemoFrame width={390} controls={<Text>the controls</Text>}><Text>the app</Text></DemoFrame>);
    expect(screen.queryByText('the controls')).toBeNull();
  });

  // DEMO-EASY-1 (Chase, Nov 19): "its a poor experience that clicking grandma jo makes the screen much larger".
  // Easy view enlarges only the app inside the phone column, never the story panel around it.
  it('DEMO-EASY-1 Easy view (Grandma Jo) leaves the laptop panel at its normal size; the app inside still gets it', () => {
    let inside: boolean | undefined;
    const Probe = () => { inside = useTheme().bigText; return <Text>the app</Text>; };
    const size = (big: boolean) => {
      const r = render(<BigTextContext.Provider value={big}><DemoFrame width={1280} controls={<Text>controls</Text>}><Probe /></DemoFrame></BigTextContext.Provider>);
      const fs = StyleSheet.flatten(screen.getByRole('header', { name: 'A private photo app for split families' }).props.style).fontSize;
      const body = StyleSheet.flatten(screen.getByText(/^1\. /).props.style).fontSize;
      r.unmount();
      return { fs, body };
    };
    const normal = size(false);
    expect(size(true)).toEqual(normal);
    expect(inside).toBe(true);
  });
});

