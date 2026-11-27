// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// DEMO-DRAWER-1..: the bottom demo drawer the portfolio's top bar opens. Contract: window event 'hearth-demo-drawer'
// TOGGLES it; the app answers with documentElement.dataset.hearthDemoDrawer ('open'|'closed') and a CustomEvent
// 'hearth-demo-drawer-state' {open}. Demo build, web only.
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Platform, Text } from 'react-native';
import { FakeBackend } from '../../api/fake/FakeBackend';
import { DemoDrawer } from '../DemoDrawer';
import { PHOTO_CREDIT, PORTFOLIO_URL } from '../DemoBar';

let mockWidth = 390;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 844, scale: 1, fontScale: 1 }),
}));
let mockBar = false;
jest.mock('../flags', () => ({
  __esModule: true,
  get DEMO_MODE() { return true; },
  get DEMO_BAR() { return mockBar; },
}));

// The jest-expo native environment has no DOM: give the drawer the little it uses (window and document events,
// documentElement.dataset). Focus is checked in the browser, by DEMO-DRAWER-E2E-4.
const os = Platform.OS;
const g = globalThis as unknown as Record<string, unknown>;
const saved = { window: g.window, document: g.document };
function installDom() {
  const win = new EventTarget();
  const doc = Object.assign(new EventTarget(), { documentElement: { dataset: {} as Record<string, string | undefined> }, activeElement: null });
  g.window = Object.assign(win, { addEventListener: win.addEventListener.bind(win), removeEventListener: win.removeEventListener.bind(win), dispatchEvent: win.dispatchEvent.bind(win) });
  g.document = doc;
  g.CustomEvent = g.CustomEvent ?? class extends Event { detail: unknown; constructor(t: string, i?: { detail?: unknown }) { super(t); this.detail = i?.detail; } };
}
beforeEach(() => {
  installDom();
  Object.defineProperty(Platform, 'OS', { get: () => 'web', configurable: true });
  mockBar = false;
  mockWidth = 390;
});
afterEach(() => {
  g.window = saved.window;
  g.document = saved.document;
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true, writable: true });
  delete (globalThis as { __hearthFake?: unknown }).__hearthFake;
});

// RNTL's getByRole skips a View that isn't `accessible`; the web sheet is a named dialog, so check its props.
const isDialog = () => {
  const s = screen.getByTestId('demo-drawer-sheet');
  return (s.props.role ?? s.props.accessibilityRole) === 'dialog' && (s.props['aria-label'] ?? s.props.accessibilityLabel) === 'Demo info';
};
const esc = () => act(() => { document.dispatchEvent(Object.assign(new Event('keydown'), { key: 'Escape' })); });
const toggle = () => act(() => { window.dispatchEvent(new Event('hearth-demo-drawer')); });
const states = () => {
  const seen: boolean[] = [];
  const on = (e: Event) => seen.push((e as CustomEvent<{ open: boolean }>).detail.open);
  window.addEventListener('hearth-demo-drawer-state', on);
  return { seen, stop: () => window.removeEventListener('hearth-demo-drawer-state', on) };
};

function drawer(extra: Partial<React.ComponentProps<typeof DemoDrawer>> = {}) {
  const be = FakeBackend.withFixture({ joIsMember: true });
  const props = { be, reload: jest.fn(), startOver: jest.fn(), open: jest.fn(), ...extra };
  render(<DemoDrawer {...props} />);
  return props;
}

describe('DEMO-DRAWER-1 the drawer component and its event contract', () => {
  it('DEMO-DRAWER-1 is closed by default: no sheet, no scrim, contents not in the tree, dataset closed', () => {
    drawer();
    expect(screen.queryByTestId('demo-drawer-sheet')).toBeNull();
    expect(screen.queryByTestId('demo-drawer-scrim')).toBeNull();
    expect(screen.queryByText(PHOTO_CREDIT)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reset demo' })).toBeNull();
    expect(document.documentElement.dataset.hearthDemoDrawer).toBe('closed');
  });

  it('DEMO-DRAWER-2 the toggle event opens it, sets dataset open and fires the state event {open:true}', () => {
    drawer();
    const s = states();
    toggle();
    s.stop();
    expect(screen.getByTestId('demo-drawer-sheet')).toBeTruthy();
    expect(document.documentElement.dataset.hearthDemoDrawer).toBe('open');
    expect(s.seen).toEqual([true]);
  });

  it('DEMO-DRAWER-3 the event TOGGLES: a second event closes it, dataset closed, state {open:false}', () => {
    drawer();
    toggle();
    const s = states();
    toggle();
    s.stop();
    expect(screen.queryByTestId('demo-drawer-sheet')).toBeNull();
    expect(document.documentElement.dataset.hearthDemoDrawer).toBe('closed');
    expect(s.seen).toEqual([false]);
  });

  it('DEMO-DRAWER-4 open: a dialog named Demo info with the copy, photo credit, Grandma Jo, Reset and the back link', () => {
    const p = drawer();
    toggle();
    expect(isDialog()).toBe(true);
    expect(screen.getByText(/This is the real Hearth, running on made-up sample data/)).toBeTruthy();
    expect(screen.getByText(PHOTO_CREDIT)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'See the photos as Grandma Jo sees them' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reset demo' })).toBeTruthy();
    fireEvent.press(screen.getByRole('link', { name: 'Back to the Hearth case study' }));
    expect(p.open).toHaveBeenCalledWith(PORTFOLIO_URL);
  });

  it('DEMO-DRAWER-5 the scrim closes it', () => {
    drawer();
    toggle();
    // The open sheet is aria-modal, so assistive tech skips its scrim sibling: include hidden elements for this one.
    fireEvent.press(screen.getByTestId('demo-drawer-scrim', { includeHiddenElements: true }));
    expect(screen.queryByTestId('demo-drawer-sheet')).toBeNull();
    expect(document.documentElement.dataset.hearthDemoDrawer).toBe('closed');
  });

  it('DEMO-DRAWER-6 Done closes it and is a 48 px target', () => {
    drawer();
    toggle();
    const done = screen.getByRole('button', { name: 'Done' });
    const flat = Object.assign({}, ...[([] as unknown[]).concat(done.props.style ?? [])].flat(3)) as { minHeight?: number; height?: number };
    expect(flat.minHeight ?? flat.height ?? 0).toBeGreaterThanOrEqual(48);
    fireEvent.press(done);
    expect(screen.queryByTestId('demo-drawer-sheet')).toBeNull();
    expect(document.documentElement.dataset.hearthDemoDrawer).toBe('closed');
  });

  it('DEMO-DRAWER-7 Escape closes it, and only while open', () => {
    drawer();
    toggle();
    esc();
    expect(screen.queryByTestId('demo-drawer-sheet')).toBeNull();
    expect(document.documentElement.dataset.hearthDemoDrawer).toBe('closed');
  });

  it('DEMO-DRAWER-8 Reset asks first and calls startOver only on the second press', () => {
    const p = drawer();
    toggle();
    fireEvent.press(screen.getByRole('button', { name: 'Reset demo' }));
    expect(p.startOver).not.toHaveBeenCalled();
    expect(screen.getByText(/Put the sample data back\?/)).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Reset' }));
    expect(p.startOver).toHaveBeenCalledTimes(1);
  });

  it('DEMO-DRAWER-10 stops listening when unmounted', () => {
    const { unmount } = render(<DemoDrawer be={FakeBackend.withFixture({ joIsMember: true })} reload={jest.fn()} startOver={jest.fn()} open={jest.fn()} />);
    unmount();
    const s = states();
    toggle();
    s.stop();
    expect(s.seen).toEqual([]);
  });
});

describe('DEMO-DRAWER-11 DemoChrome mounts it only for the public build', () => {
  const chrome = (bar: boolean, w: number) => {
    mockBar = bar;
    mockWidth = w;
    (globalThis as { __hearthFake?: unknown }).__hearthFake = FakeBackend.withFixture({ joIsMember: true });
    const { DemoChrome } = require('../DemoChrome');
    return render(<DemoChrome><Text>the app</Text></DemoChrome>);
  };

  it.each([390, 1280])('DEMO-DRAWER-11 flag off at %i px: the event opens the drawer and the app still shows', (w) => {
    chrome(false, w);
    expect(document.documentElement.dataset.hearthDemoDrawer).toBe('closed');
    toggle();
    expect(isDialog()).toBe(true);
    expect(screen.getByText('the app')).toBeTruthy();
  });

  it.each([390, 1280])('DEMO-DRAWER-12 flag on (old bar stays) at %i px: no drawer, the event does nothing', (w) => {
    chrome(true, w);
    toggle();
    expect(screen.queryByTestId('demo-drawer-sheet')).toBeNull();
    expect(document.documentElement.dataset.hearthDemoDrawer).toBeUndefined();
  });
});
