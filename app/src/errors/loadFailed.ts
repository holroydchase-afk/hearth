// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// STATES-1/5/15 (SPEC-STATES, intake #208): the title and line for a list that failed to load. The kind comes from
// messageFor's own mapping (toApiError), so there is still one place that decides what an error is. Never the
// server's words, never a made-up contact: the helper's name only when there is one.
import { toApiError } from './messages';

export type LoadFailure = 'network' | 'other';

export function loadFailure(e: unknown): LoadFailure {
  return toApiError(e).code === 'NETWORK' ? 'network' : 'other';
}

/** `photos`: say "Your photos are safe." (photo lists only; Groups are not photos). */
export function loadFailedWords(kind: LoadFailure, opts: { helper?: string | null; photos?: boolean } = {}): { title: string; line: string } {
  const safe = opts.photos ? 'Your photos are safe. ' : '';
  if (kind === 'network') {
    return { title: 'No signal right now', line: `${safe}Check your Wi-Fi or signal, then tap Try again.` };
  }
  return { title: 'Something went wrong', line: `${safe}Tap Try again${opts.helper ? `, or call ${opts.helper}` : ''}.` };
}
