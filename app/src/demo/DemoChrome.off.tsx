// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// ENG-R5: what Metro puts in place of DemoChrome.tsx outside the demo build (metro.config.js): just the app.
import React, { type ReactNode } from 'react';

export function DemoChrome({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
