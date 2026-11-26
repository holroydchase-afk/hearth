// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// LINT-STRICT-1..3 (intake #204, qa-tdd Nov 26): the strict lint pass moved latest-value refs into layout effects and
// Animated/PanResponder/Symbol seeds into lazy useState. These pin the behaviour that could silently regress:
// a gesture handler built once must still call the LATEST onClose / read the LATEST zoom, and a field's id must stay
// the same across re-renders.
import { act, render, renderHook, screen } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import { BottomSheet } from '../kit';
import { SHOW_AGAIN_MS, useTyping, useTypingField } from '../typing';

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
