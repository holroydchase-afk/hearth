// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Life calendar v1 (CAL-12..17): the family's dates, shared by Gallery (the card and the "Today is" line), More (the
// Birthdays row) and the Birthdays screen, one list per API client and family. CAL-17: a server without 0029 answers
// "no such function"; the calendar then hides quietly (status 'missing'): no error words, no error report.
// CAL-18: nothing here logs, and no label goes into a report.
import { useCallback, useEffect, useState } from 'react';
import { isApiError, type FamilyDate, type HearthApi } from '../api/HearthApi';

export type DatesStatus = 'loading' | 'ready' | 'missing' | 'error';
interface Entry { status: DatesStatus; dates: FamilyDate[]; subs: Set<() => void>; inflight: Promise<void> | null; loaded: boolean }

const stores = new WeakMap<HearthApi, Map<string, Entry>>();

function entry(api: HearthApi, space: string): Entry {
  let m = stores.get(api);
  if (!m) stores.set(api, (m = new Map()));
  let e = m.get(space);
  if (!e) m.set(space, (e = { status: 'loading', dates: [], subs: new Set(), inflight: null, loaded: false }));
  return e;
}
const tell = (e: Entry) => e.subs.forEach((f) => f());

/** True when the error means this server has no calendar yet (CAL-17). */
export const calendarMissing = (err: unknown): boolean => {
  if (isApiError(err)) return err.code === 'MISSING';
  const code = typeof err === 'object' && err && 'code' in err ? String((err as { code: unknown }).code) : '';
  return code === 'PGRST202' || code === '42883';
};

/** Reads the family's dates again; everyone showing them updates. Never throws. */
export function reloadDates(api: HearthApi, space: string): Promise<void> {
  const e = entry(api, space);
  if (e.inflight) return e.inflight;
  e.inflight = api.familyDates(space).then(
    (dates) => { e.status = 'ready'; e.dates = dates; },
    (err) => { e.status = calendarMissing(err) ? 'missing' : e.loaded ? e.status : 'error'; },
  ).then(() => { e.loaded = true; e.inflight = null; tell(e); });
  return e.inflight;
}

/** Marks the calendar missing on this server (a save answered "no such function"). */
export function markMissing(api: HearthApi, space: string): void {
  const e = entry(api, space);
  e.status = 'missing';
  tell(e);
}

/** The family's dates. `refresh` reads them again on mount; otherwise only when never read. */
export function useFamilyDates(api: HearthApi, space: string | null, { refresh = true }: { refresh?: boolean } = {}) {
  const [, bump] = useState(0);
  useEffect(() => {
    if (!space) return;
    const e = entry(api, space);
    const f = () => bump((n) => n + 1);
    e.subs.add(f);
    if (refresh || !e.loaded) void reloadDates(api, space);
    return () => { e.subs.delete(f); };
  }, [api, space, refresh]);
  const reload = useCallback(() => (space ? reloadDates(api, space) : Promise.resolve()), [api, space]);
  const e = space ? entry(api, space) : null;
  return { status: e?.status ?? 'loading', dates: e?.dates ?? [], loaded: e?.loaded ?? false, reload };
}
