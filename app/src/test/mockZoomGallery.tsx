// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// VIEWER-* (SPEC-VIEWER, qa-tdd Nov 24): a jest stand-in for react-native-zoom-toolkit's `Gallery`. jest can't drive
// real pinches and swipes, so Hearth's decisions are tested through the callbacks the real Gallery calls
// (onIndexChange, onTap, onVerticalPull, onUpdate) and the ref it exposes (setIndex, reset, getState, plus the
// `zoom` the spec's pinned patch adds). The web demo e2e drives the real library with the mouse.
//
// Use it in a test file with:
//   jest.mock('react-native-zoom-toolkit', () => require('../../test/mockZoomGallery').zoomToolkitMock, { virtual: true });
// and drive it with `gallery` (swipeTo, tap, doubleTap, pinchTo, pull).
import React, { forwardRef, useImperativeHandle, useLayoutEffect, useState } from 'react';
import { View } from 'react-native';

type AnyProps = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- a stand-in for the library's Gallery: it forwards whatever props the screen passes

interface Driver {
  /** The latest props the screen gave the Gallery (null before it rendered). */
  props: AnyProps | null;
  /** The photo the Gallery shows. */
  index: number;
  /** The Gallery's zoom (1 = fit). */
  scale: number;
  calls: { setIndex: number[]; reset: unknown[]; zoom: unknown[][] };
  /** A finished swipe to photo i, as the real Gallery reports it (onIndexChange). */
  swipeTo(i: number): void;
  /** One tap the Gallery recognized as a single tap (after its double-tap window). */
  tap(): void;
  /** A double tap: the real Gallery zooms to maxScale (or back to fit) itself and never calls onTap. */
  doubleTap(): void;
  /** A pinch that ends at `scale` (clamped to 1..maxScale). */
  pinchTo(scale: number): void;
  /** A vertical pull, as onVerticalPull reports it. */
  pull(translateY: number, released: boolean, velocityY?: number): void;
  reset(): void;
}

let setIndexState: ((i: number) => void) | null = null;

function emitUpdate(d: Driver) {
  const state = {
    containerSize: { width: 390, height: 844 }, childSize: { width: 390, height: 292 }, maxScale: d.props?.maxScale ?? 6,
    translateX: 0, translateY: 0, scale: d.scale,
  };
  d.props?.onUpdate?.(state);
}

function setScale(d: Driver, s: number) {
  const max = typeof d.props?.maxScale === 'number' ? d.props.maxScale : 6;
  const before = d.scale;
  d.scale = Math.max(1, Math.min(max, s));
  if (before === 1 && d.scale > 1) d.props?.onZoomBegin?.(d.index);
  emitUpdate(d);
  if (before > 1 && d.scale === 1) d.props?.onZoomEnd?.(d.index);
}

function moveTo(d: Driver, i: number) {
  const n = d.props?.data?.length ?? 0;
  const to = Math.max(0, Math.min(n - 1, i));
  d.scale = 1; // each photo starts unzoomed in the real Gallery
  d.index = to;
  setIndexState?.(to);
  d.props?.onIndexChange?.(to);
}

export const gallery: Driver = {
  props: null,
  index: 0,
  scale: 1,
  calls: { setIndex: [], reset: [], zoom: [] },
  swipeTo(i) { moveTo(gallery, i); },
  tap() { gallery.props?.onTap?.({ x: 195, y: 422, absoluteX: 195, absoluteY: 422 }, gallery.index); },
  doubleTap() { setScale(gallery, gallery.scale > 1 ? 1 : (typeof gallery.props?.maxScale === 'number' ? gallery.props.maxScale : 6)); },
  pinchTo(s) { setScale(gallery, s); },
  pull(translateY, released, velocityY = 0) { gallery.props?.onVerticalPull?.({ translateY, released, velocityY }); },
  reset() {
    gallery.props = null;
    gallery.index = 0;
    gallery.scale = 1;
    gallery.calls = { setIndex: [], reset: [], zoom: [] };
    setIndexState = null;
  },
};

const Gallery = forwardRef<unknown, AnyProps>(function MockGallery(props, ref) {
  const n = props.data?.length ?? 0;
  const start = Math.max(0, Math.min(n - 1, props.initialIndex ?? 0));
  const [index, setIndex] = useState(start);
  // React Compiler (INTAKE-80-3): the driver is updated after each render, never during it.
  useLayoutEffect(() => {
    setIndexState = setIndex;
    gallery.props = props;
    gallery.index = index;
  });
  useImperativeHandle(ref, () => ({
    setIndex: (i: number) => { gallery.calls.setIndex.push(i); moveTo(gallery, i); },
    reset: (animate?: boolean) => { gallery.calls.reset.push(animate); setScale(gallery, 1); },
    getState: () => ({ containerSize: { width: 390, height: 844 }, childSize: { width: 390, height: 292 }, maxScale: props.maxScale, translateX: 0, translateY: 0, scale: gallery.scale }),
    // The pinned patch (SPEC-VIEWER build approach): ResumableZoom's zoom(newScale, position?) on the Gallery ref.
    zoom: (newScale: number, position?: unknown) => { gallery.calls.zoom.push([newScale, position]); setScale(gallery, newScale); },
  }));
  // The real Gallery renders the photo on screen and its neighbors, so a finger can pull them in.
  const shown = [index - 1, index, index + 1].filter((i) => i >= 0 && i < n);
  return (
    <View testID="viewer-gallery">
      {shown.map((i) => (
        <View key={props.keyExtractor ? props.keyExtractor(props.data[i], i) : String(i)} testID={`gallery-item-${i}`}>
          {props.renderItem(props.data[i], i)}
        </View>
      ))}
    </View>
  );
});

export const zoomToolkitMock = { __esModule: true, Gallery, default: { Gallery } };
