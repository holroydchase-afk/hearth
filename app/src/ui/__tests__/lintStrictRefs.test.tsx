// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// LINT-STRICT-1..3 (intake #204, qa-tdd Nov 26): the strict lint pass moved latest-value refs into layout effects and
// Animated/PanResponder/Symbol seeds into lazy useState. These pin the behaviour that could silently regress:
// a gesture handler built once must still call the LATEST onClose / read the LATEST zoom, and a field's id must stay
// the same across re-renders.
import { act, render, renderHook, screen } from '@testing-library/react-native';
import React from 'react';
import { Platform, Text } from 'react-native';
import { FakeBackend } from '../../api/fake/FakeBackend';
import { ViewerScreen } from '../../screens/ViewerScreen';
import { renderApp } from '../../test/renderApp';
import { seedPost } from '../../test/seed';
import { BottomSheet } from '../kit';
import { SHOW_AGAIN_MS, useTyping, useTypingField } from '../typing';

const touch = (pageX: number, pageY = 0) => ({ pageX, pageY, identifier: 0, timestamp: 0 });
const fingers = (gap: number, at = 0) => ({
  nativeEvent: { touches: [touch(0), touch(gap)] },
  touchHistory: { touchBank: [], numberActiveTouches: 2, indexOfSingleActiveTouch: -1, mostRecentTimeStamp: at },
});

describe('LINT-STRICT-1 a sheet built once still calls the latest onClose', () => {
  it('LINT-STRICT-1 after a re-render with a new onClose, a drag down of 100 pt closes through the new one', () => {
    const first = jest.fn();
    const second = jest.fn();
    const view = render(<BottomSheet testID="sheet" onClose={first}><Text>hi</Text></BottomSheet>);
    view.rerender(<BottomSheet testID="sheet" onClose={second}><Text>hi</Text></BottomSheet>);
    const sheet = screen.getByTestId('sheet');
    const at = (y: number, active: boolean) => ({
      touchHistory: {
        indexOfSingleActiveTouch: 0, numberActiveTouches: active ? 1 : 0, mostRecentTimeStamp: 1,
        touchBank: [{ touchActive: active, startPageX: 0, startPageY: 0, startTimeStamp: 0, currentPageX: 0, currentPageY: y, currentTimeStamp: 1, previousPageX: 0, previousPageY: 0, previousTimeStamp: 0 }],
      },
      nativeEvent: { touches: [] },
    });
    act(() => { sheet.props.onResponderGrant(at(0, true)); });
    act(() => { sheet.props.onResponderMove(at(100, true)); });
    act(() => { sheet.props.onResponderRelease(at(100, false)); });
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });
});

describe('LINT-STRICT-2 the viewer pinch reads the latest zoom', () => {
  const pinch = async (area: { props: Record<string, (e: unknown) => unknown> }, from: number, to: number) => {
    act(() => { area.props.onResponderGrant!(fingers(from)); });
    act(() => { area.props.onResponderMove!(fingers(to, 5)); });
    act(() => { area.props.onResponderRelease!(fingers(to, 6)); });
  };
  afterEach(() => { jest.restoreAllMocks(); });
  it('LINT-STRICT-2 spreading zooms in, then pinching back out of the same handler zooms out (not stuck on the first render\'s zoom)', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const be = FakeBackend.withFixture();
    const p = await seedPost(be, { caption: 'At the lake' });
    await renderApp(<ViewerScreen postId={p.id} index={0} />, { be, user: 'jo' });
    const area = await screen.findByTestId('viewer-gestures');
    expect(screen.queryByTestId('viewer-zoomed')).toBeNull();
    await pinch(area as never, 100, 200);
    expect(await screen.findByTestId('viewer-zoomed')).toBeTruthy();
    await pinch(screen.getByTestId('viewer-gestures') as never, 200, 100);
    expect(screen.queryByTestId('viewer-zoomed')).toBeNull();
  });
  it('LINT-STRICT-2 a small pinch while zoomed keeps the zoom (it needs the latest value, false would unzoom)', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const be = FakeBackend.withFixture();
    const p = await seedPost(be, { caption: 'At the lake' });
    await renderApp(<ViewerScreen postId={p.id} index={0} />, { be, user: 'jo' });
    await pinch(await screen.findByTestId('viewer-gestures') as never, 100, 200);
    await screen.findByTestId('viewer-zoomed');
    await pinch(screen.getByTestId('viewer-gestures') as never, 100, 105);
    expect(screen.getByTestId('viewer-zoomed')).toBeTruthy();
  });
});

describe('LINT-STRICT-3 a text field keeps one id across re-renders', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });
  it('LINT-STRICT-3 focus, re-render, blur: the tab bar comes back after SHOW_AGAIN_MS, not before', () => {
    const typing = renderHook(() => useTyping());
    const field = renderHook(() => useTypingField());
    act(() => { field.result.current.onFocus(); });
    expect(typing.result.current).toBe(true);
    field.rerender({});
    act(() => { field.result.current.onBlur(); });
    expect(typing.result.current).toBe(true);
    act(() => { jest.advanceTimersByTime(SHOW_AGAIN_MS); });
    expect(typing.result.current).toBe(false);
  });
  it('LINT-STRICT-3 a field that unmounts while focused never leaves the tab bar hidden', () => {
    const typing = renderHook(() => useTyping());
    const field = renderHook(() => useTypingField());
    act(() => { field.result.current.onFocus(); });
    field.rerender({});
    expect(typing.result.current).toBe(true);
    field.unmount();
    expect(typing.result.current).toBe(false);
  });
});
