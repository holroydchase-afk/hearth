// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// DEMO-BAR review (ux-reviewer P1): Grandma Jo's view lives in the demo bar's Details drawer, so on a phone
// the parent's Photos points to it. Beside the laptop story panel it isn't needed.
// FIRSTMIN-3 (Chase, Nov 6): the one tip line became three short numbered steps.
import React from 'react';
import { Platform, View } from 'react-native';
import type { FakeBackend } from '../api/fake/FakeBackend';
import { Txt } from '../ui/kit';
import { SPACE } from '../ui/theme';
import { WIDE } from './DemoFrame';
import { DEMO_MODE } from './flags';
import { demoViewer } from './seed';

export const DEMO_STEPS = ["You're seeing a parent's Photos.", 'Tap Details at the top.', 'Tap See it as Grandma Jo.'] as const;

export function demoTip(width: number, viewer: 'parent' | 'grandma'): string[] | null {
  return width < WIDE && viewer === 'parent' ? [...DEMO_STEPS] : null;
}

/** The phone tip: numbered steps, or one muted line (`text`). Every line uses Txt, so 17 pt or more. */
export function DemoTip({ steps, text }: { steps?: readonly string[]; text?: string }) {
  if (!steps?.length) return <Txt variant="muted" testID="demo-tip">{text ?? ''}</Txt>;
  return (
    <View testID="demo-tip" style={{ gap: SPACE.xs }}>
      {steps.map((s, i) => (
        <Txt key={s} variant="muted">{`${i + 1}. ${s}`}</Txt>
      ))}
    </View>
  );
}

/** Photos header: the steps in the demo build on the web, else nothing. */
export function PhotosDemoTip({ width }: { width: number }) {
  const be = (globalThis as { __hearthFake?: FakeBackend }).__hearthFake;
  if (!DEMO_MODE || Platform.OS !== 'web' || !be) return null;
  const steps = demoTip(width, demoViewer(be));
  return steps ? <DemoTip steps={steps} /> : null;
}
