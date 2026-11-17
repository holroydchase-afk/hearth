// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// RD-47 (DEC-65, Nov 17): Gallery's top-right Search and By date buttons are gone. Search is a "Search photos" field
// under the greeting; By date (BETA-TIME-2's timeline) is no longer on Gallery (the months are the by-date view) and
// stays reachable from Feed's "Older photos" card. Tests that only need those screens open them through these helpers.
import { fireEvent, screen } from '@testing-library/react-native';
import React from 'react';
import { TextInput } from 'react-native';
import { TimelineScreen } from '../screens/TimelineScreen';
import { useApp } from '../state/AppContext';

/** Tap Gallery's "Search photos" field (a TextInput gets focus; a field drawn as a button gets a press). */
export async function tapSearchField(): Promise<void> {
  const all = await screen.findAllByLabelText('Search photos');
  const field = all.find((n) => typeof n.type === 'string') ?? all[0]!;
  if ((field.type as unknown) === 'TextInput' || (field.type as unknown) === TextInput) fireEvent(field, 'focus');
  else fireEvent.press(field);
}

/** The timeline ("Photos by date") once the family has loaded, as PhotosScreen opens it. */
export function ByDate({ onClose = () => {} }: { onClose?: () => void }) {
  return useApp().status === 'ready' ? <TimelineScreen startAt={null} onClose={onClose} /> : null;
}
