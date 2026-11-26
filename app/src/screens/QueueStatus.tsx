// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
import React from 'react';
import { Platform, View } from 'react-native';
import { ApiError } from '../api/HearthApi';
import { messageFor } from '../errors/messages';
import { useApp, useJobs } from '../state/AppContext';
import { Button, Card, Txt } from '../ui/kit';
import { photos } from '../ui/format';
import { batchLabel, jobLabel, type Job } from '../upload/queue';
import { JobProblemDetails } from './ProblemDetails';

// HRT-WEB.3 (SPEC-WEB-APP.md "Words (grandparent-ux)"): "Chrome" only on the web; phones keep "Hearth".
const KEEP_OPEN = 'Keep Chrome open until this is sent. Closing Chrome now would stop it.';
const WAIT_SAVED = "We'll keep trying. You can close Chrome. It will finish when you open Hearth again.";
const WAIT_MEMORY = "We'll keep trying while Chrome stays open. Closing Chrome now would stop it.";
const WAIT_PHONE = "We'll keep trying. You can close Hearth; it will finish when you open it again.";
const GONE = "This photo is no longer on this phone, so we can't send it. Go to Share to pick it again.";

/** Shares that haven't finished: progress, "Waiting to send", or what went wrong. */
export function QueueStatus({ full = false }: { full?: boolean } = {}) {
  const { queue, helper, deps } = useApp();
  const all = useJobs();
  const jobs = all.filter((j) => j.state !== 'published');
  if (!queue || jobs.length === 0) return null;
  // BETA-BULK-4: a bulk pick is one line, "Sending 12 of 48 photos…", not one card per post.
  const batches = [...new Set(jobs.filter((j) => j.batchId && j.state !== 'failed').map((j) => j.batchId!))];
  const single = jobs.filter((j) => !j.batchId || j.state === 'failed');
  // A post is memory-only when nothing of it was saved (blocked or full storage, or a Fake-build video): closing Chrome loses it.
  const web = Platform.OS === 'web';
  const memoryOnly = (j: Job) => web && j.items.some((i) => !i.uri.startsWith('hearth-q:') || !!deps.uploadStore?.memoryOnly(i.uri));
  // Every tab keeps its own QueueStatus mounted, so the "closing Chrome would stop it" sentence is said once, on Share
  // (`full`); the other tabs say only the first half (UX-WEB3-1: exactly once).
  const waitLine = (mem: boolean) => (!web ? WAIT_PHONE : mem ? (full ? WAIT_MEMORY : WAIT_MEMORY.split('. ')[0]! + '.') : WAIT_SAVED);
  // One line, once: while a memory-only post sends. A waiting card says it in its own words instead, never both.
  const memWaiting = jobs.some((j) => j.state === 'failed-retryable' && memoryOnly(j));
  const warn = full && !memWaiting && jobs.some((j) => (j.state === 'draft' || j.state === 'uploading' || j.state === 'finalizing') && memoryOnly(j));
  return (
    <View style={{ gap: 12 }} accessibilityLiveRegion="polite">
      {warn ? <Txt tone="muted">{KEEP_OPEN}</Txt> : null}
      {batches.map((b) => {
        const p = queue.batchProgress(b);
        const waiting = jobs.some((j) => j.batchId === b && j.state === 'failed-retryable');
        return (
          <Card key={b} testID={`batch-${b}`}>
            <Txt variant="headline">
              {!waiting ? batchLabel(p) : p.done > 0 ? `Sent ${p.done} of ${photos(p.total)}. Waiting to send the rest.` : `${photos(p.total)} waiting to send`}
            </Txt>
            {waiting ? <Txt tone="muted">{waitLine(jobs.some((j) => j.batchId === b && j.state === 'failed-retryable' && memoryOnly(j)))}</Txt> : null}
          </Card>
        );
      })}
      {single.map((j) => {
        const what = j.caption ? `"${j.caption}"` : photos(j.items.length);
        return (
          <Card key={j.id} testID={`job-${j.id}`}>
            <Txt variant="headline">{`${what}: ${jobLabel(j)}`}</Txt>
            {j.state === 'failed-retryable' ? <Txt tone="muted">{waitLine(memoryOnly(j))}</Txt> : null}
            {j.state === 'failed' && j.photoGone ? (
              <>
                <Txt>{GONE}</Txt>
                <Button label="Remove this from the list" text="Remove" variant="secondary" onPress={() => queue.remove(j.id)} />
              </>
            ) : null}
            {j.state === 'failed' && !j.photoGone ? (
              <>
                <Txt>{messageFor(new ApiError(j.errorCode ?? 'UNKNOWN'), { inviter: helper, action: 'post' })}</Txt>
                <JobProblemDetails jobId={j.id} />
                <Button variant="secondary" label="Try sending again" text="Try again" onPress={() => queue.retry(j.id)} />
                <Button label="Remove this from the list" text="Remove" variant="secondary" onPress={() => queue.remove(j.id)} />
              </>
            ) : null}
          </Card>
        );
      })}
    </View>
  );
}
