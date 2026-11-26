// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// SPEC-VIEWER VIEWER-6 / VIEWER-17: the viewer's motion decisions as small pure functions, so jest can check them
// whatever the gallery library does inside. Marked 'worklet' so they also run on the UI thread.

/** How far a drag down has to go before letting go closes the viewer (VIEWER-6). */
export const CLOSE_DISTANCE = 120;
/** A flick down this fast (pt/s) closes it from any distance. */
export const CLOSE_VELOCITY = 1000;
/** The drag at which the backdrop has faded all the way. */
const FADE_DISTANCE = 300;

/** 0 at rest, rising with the drag down, never past 1; an upward drag fades nothing. */
export function closeProgress(dy: number): number {
  'worklet';
  if (!(dy > 0)) return 0;
  return Math.min(1, dy / FADE_DISTANCE);
}

/** Past 120 pt, or a fast flick down, closes; a short slow drag or an upward flick springs back. */
export function shouldClose(dy: number, vy: number): boolean {
  'worklet';
  if (dy > CLOSE_DISTANCE) return true;
  return dy > 0 && vy >= CLOSE_VELOCITY;
}

export interface ViewerMotion { change: 'slide' | 'fade'; close: 'slide' | 'fade'; zoomAnimated: boolean }

/** VIEWER-17: with Reduce Motion on, nothing slides and zoom jumps. */
export function viewerMotion(reduceMotion: boolean): ViewerMotion {
  return reduceMotion
    ? { change: 'fade', close: 'fade', zoomAnimated: false }
    : { change: 'slide', close: 'slide', zoomAnimated: true };
}
