// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Share (BETA-SHARE-1, BETA-AUD-1): pick photos, then one "New post" postcard (DEC-72, SPEC-REDESIGN 1j, SHARE-PC-1..14):
// the big photo, a note, and "To:" face tiles on one card, with a pinned "Send to <names>" button. Nothing is
// picked to start (SHARE-PC-7; was BETA-AUD-2's preselect). Parents can still pick lots of photos (bulk review).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Circle } from '../api/HearthApi';
import { messageFor } from '../errors/messages';
import { saveLastAudience } from '../share/audienceMemory';
import { planBatch, type PickedAsset } from '../share/bulk';
import { applyHelpers, findLookAlikes, helperLines, helperSwitches, type LookResult } from '../share/helpers';
import { othersIn, recipientsLine, tileName } from '../share/postcard';
import { loadSent, recordSent } from '../share/sentBefore';
import { useApp } from '../state/AppContext';
import { useNav } from '../state/nav';
import { Button, FaceTile, Field, Loading, Notice, Screen, SystemIcon, Txt } from '../ui/kit';
import { photos } from '../ui/format';
import { LABEL_SCALE_CAP, RADIUS, WEIGHT, photoShadow, useTheme } from '../ui/theme';
import type { QueueItem } from '../upload/queue';
import { AppGate } from './AppGate';
import { BatchReview } from './BatchReview';
import { QueueStatus } from './QueueStatus';

const MAX = 10;

/** BETA-AUD-17 (SPEC-GROUPS): Everyone first (1 tap), then groups and households, then events. */
const KIND_ORDER: Record<string, number> = { everyone: 0, group: 1, household: 2, event: 3 };
export function shareOrder(list: Circle[]): Circle[] {
  return list
    .map((x, i) => ({ x, i }))
    .sort((a, b) => (KIND_ORDER[a.x.kind ?? 'group'] ?? 1) - (KIND_ORDER[b.x.kind ?? 'group'] ?? 1) || a.i - b.i)
    .map((a) => a.x);
}

export function ShareScreen() {
  const app = useApp();
  const nav = useNav();
  const [circles, setCircles] = useState<Circle[] | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [note, setNote] = useState('');
  // CAP-9 / QA-R3: bulk review keeps its one Title box for now; new single posts have no title (DEC-72).
  const [title, setTitle] = useState('');
  // SHARE-PC-2: which picked photo is the big one.
  const [cur, setCur] = useState(0);
  // SHARE-PC-9: my own name, so the To: line names the others, not me.
  const [myName, setMyName] = useState<string | null>(null);
  const scroller = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const { c, t, os, dark, bigText } = useTheme();
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const userId = app.session?.userId;
  // BETA-BULK-3: a bulk pick waiting on the review screen (dates only; EXIF already dropped).
  // R15: the bulk pick as picked; photo helpers set some aside (never deleted), and putBack brings them back.
  const [picked, setPicked] = useState<PickedAsset[] | null>(null);
  const [putBack, setPutBack] = useState<Set<string>>(() => new Set());
  const [looks, setLooks] = useState<LookResult | null>(null);
  // HELP-R4: the server's off-switches (my_features); off until read, like every feature (FLAG-5).
  const switches = useMemo(() => helperSwitches(app.features), [app.features]);
  const helped = useMemo(() => (picked ? applyHelpers(picked, { on: switches, putBack, looks }) : null), [picked, switches, putBack, looks]);
  const plan = useMemo(() => (helped ? planBatch(helped.kept, {}, { videos: app.features.includes('video_posting') }) : null), [helped, app.features]);
  const setPlan = (assets: PickedAsset[] | null) => { setPicked(assets); setPutBack(new Set()); setLooks(null); };
  // HELP-DUP-2/3, HELP-BLUR: read small previews after the review screen shows; Send never waits for them.
  const previewBytes = app.deps.previewBytes;
  useEffect(() => {
    if (!picked || !previewBytes || (!switches.duplicates && !switches.screensBlur)) return;
    let alive = true;
    const candidates = applyHelpers(picked, { on: switches }).kept;
    void (async () => {
      const sentIds = userId ? await loadSent(app.deps.kv, userId) : new Set<string>();
      const r = await findLookAlikes(candidates, previewBytes, { sentIds });
      if (alive) setLooks(r);
    })().catch(() => {});
    return () => { alive = false; };
  }, [picked, previewBytes, switches]); // eslint-disable-line react-hooks/exhaustive-deps
  const spaceId = app.space?.space_id;
  const canPost = !!app.space?.can_post;
  // Oct 17 decision: "Pick lots of photos" is for parents only, never a relative allowed to post.
  const isParent = app.space?.role === 'owner' || app.space?.role === 'adult';
  // FLAG-5: video is offered only when the server has video_posting on for me.
  const videos = app.features.includes('video_posting');

  useEffect(() => {
    if (!spaceId || !userId || !canPost) return;
    let alive = true;
    (async () => {
      try {
        // BETA-AUD-21 (grandparent-ux UX-G3): only parents send to Everyone, so a relative is never offered it.
        // SHARE-PC-7 (DEC-72): nothing is picked to start, even when a last audience is saved.
        const [all, me] = await Promise.all([
          app.deps.api.myCircles(spaceId),
          app.deps.api.myProfile().then((p) => p.display_name).catch(() => null),
        ]);
        const list = shareOrder(all).filter((x) => isParent || x.kind !== 'everyone');
        if (!alive) return;
        setMyName(me);
        setCircles(list);
      } catch (e) {
        if (alive) { setCircles([]); setNotice(messageFor(e, { inviter: app.helper })); }
      }
    })();
    return () => { alive = false; };
  }, [spaceId, userId, canPost]); // eslint-disable-line react-hooks/exhaustive-deps

  if (app.status !== 'ready' || !app.space) return <AppGate />;
  if (!canPost || !app.queue) return <Screen><Txt variant="title">You can't do that here.</Txt></Screen>;

  const pick = async () => {
    setNotice(null);
    const r = await app.deps.pickPhotos({ videos });
    if ('denied' in r) setNotice('Hearth needs your OK to see your photos. Tap "Allow" when your phone asks.');
    else {
      // HARD-2: never drop photos silently; say how many were left out.
      const left = items.length + r.items.length - MAX;
      setItems((cur) => [...cur, ...r.items].slice(0, MAX));
      if (left > 0) setNotice(`You can send ${MAX} at a time, so ${photos(left)} ${left === 1 ? 'was' : 'were'} left out.${isParent && app.deps.pickBulk ? ' For more, tap Cancel, then "Pick lots of photos".' : ''}`);
    }
  };

  const pickMany = async () => {
    if (!app.deps.pickBulk) return;
    setNotice(null);
    const r = await app.deps.pickBulk({ videos });
    if ('denied' in r) setNotice('Hearth needs your OK to see your photos. Tap "Allow" when your phone asks.');
    else if (r.assets.length) setPlan(r.assets);
  };

  const sendBatch = async () => {
    if (!plan || !plan.posts.length || !chosen.length || !app.queue || !userId) return;
    setBusy(true);
    try {
      await saveLastAudience(app.deps.kv, userId, chosen);
      await app.queue.enqueueBatch({
        space: app.space!.space_id, circleIds: chosen, title,
        posts: plan.posts.map((p) => ({ takenAt: p.takenAt, items: p.items })),
      });
      // HELP-DUP-2: remember what went, by preview fingerprint, on this phone only.
      if (looks && helped) await recordSent(app.deps.kv, userId, helped.kept.flatMap((a) => looks.ids.get(a.uri) ?? [])).catch(() => {});
      setPlan(null);
      nav.goPhotos();
    } catch (e) {
      setNotice(messageFor(e, { inviter: app.helper, action: 'post' }));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: string) => setChosen((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const list = circles ?? [];
  const toLine = recipientsLine(list, chosen, myName);
  const ready = items.length > 0 && chosen.length > 0 && !!toLine;

  const reset = () => { setItems([]); setNote(''); setChosen([]); setCur(0); setNotice(null); };

  // SHARE-PC-11: Send goes through today's upload queue, then Feed shows the post on top and "Shared with <names>."
  const send = async () => {
    if (!ready || !app.queue || !userId) return;
    setBusy(true);
    try {
      await saveLastAudience(app.deps.kv, userId, chosen);
      await app.queue.enqueue({ space: app.space!.space_id, caption: note.trim() || null, title: null, circleIds: chosen, items });
      app.setShared(`Shared with ${toLine}.`);
      reset();
      nav.goFeed();
    } catch (e) {
      // SHARE-PC-12: say what went wrong at the top of the page; the photos, note and picks stay.
      setNotice(messageFor(e, { inviter: app.helper, action: 'post' }));
      scroller.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setBusy(false);
    }
  };

  if (plan && helped) {
    const bringBack = (uris: string[]) => setPutBack((cur) => new Set([...cur, ...uris]));
    return (
      <BatchReview plan={plan} circles={circles} chosen={chosen} onToggle={toggle} busy={busy} title={title} onTitle={setTitle}
        onSend={() => void sendBatch()} onCancel={() => setPlan(null)}
        helpers={{
          lines: helperLines(helped),
          setAside: helped.setAside.flatMap((s) => s.items),
          onSendToo: (reason) => bringBack(helped.setAside.filter((s) => s.reason === reason).flatMap((s) => s.items.map((a) => a.uri))),
          onPutBack: (uri) => bringBack([uri]),
        }} />
    );
  }

  if (!items.length) {
    // Before any photo is picked: one main tap word (the phone's own picker opens from it; a browser won't open a
    // file chooser by itself), and for parents the bulk pick.
    return (
      <Screen>
        <Txt variant="display" role="header">Share photos</Txt>
        <QueueStatus />
        {notice ? <Notice text={notice} onClose={() => setNotice(null)} /> : null}
        <View style={styles.section}>
          <Txt>{videos ? 'Pick photos or videos, add a note, then pick who gets them.' : 'Pick photos, add a note, then pick who gets them.'}</Txt>
          {/* GUX-R2 / R19: a plain accent text button on the 16 pt edge, never a box inside a box. */}
          <Button variant="quiet" style={styles.flush} icon={{ sf: 'photo.on.rectangle', md: 'add_photo_alternate' }}
            label={videos ? 'Pick photos or videos from your phone' : 'Pick photos from your phone'}
            text={videos ? 'Pick photos or videos' : 'Pick photos'} onPress={() => void pick()} />
        </View>
        {app.deps.pickBulk && isParent ? (
          <View style={styles.section}>
            <Txt variant="title" role="header">Lots of photos?</Txt>
            <Txt>Pick up to 100. Hearth puts them in order by the day they were taken.</Txt>
            <Button label="Pick up to 100 photos at once" text="Pick lots of photos" variant="quiet" style={styles.flush} onPress={() => void pickMany()} />
          </View>
        ) : null}
      </Screen>
    );
  }

  const shown = Math.min(cur, items.length - 1);
  const big = items[shown]!;
  const removeShown = () => { setItems((all) => all.filter((_, j) => j !== shown)); setCur((i) => Math.max(0, Math.min(i, items.length - 2))); };
  const across = bigText ? 2 : 3;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: c.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={os === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scroller} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
          <Button variant="quiet" label="Cancel this post" text="Cancel" style={styles.flush} onPress={reset} />
          <Txt variant="display" role="header">New post</Txt>
          <QueueStatus />
          {notice ? <Notice text={notice} onClose={() => setNotice(null)} /> : null}

          {/* SHARE-PC-1: one card holds the post as the family will see it, and who it goes to. */}
          <View testID="share-card" style={[styles.card, { backgroundColor: c.surface }, photoShadow(dark)]}>
              <View>
                <Image source={{ uri: big.uri }} style={styles.big} resizeMode="cover"
                  accessibilityLabel={items.length > 1 ? `Photo ${shown + 1} of ${items.length}` : 'Your photo'} accessibilityIgnoresInvertColors />
                {items.length > 1 ? (
                  <View style={styles.count} pointerEvents="none">
                    <Text style={{ color: '#FFFFFF', fontSize: t.base, fontWeight: WEIGHT.semibold }}>{`${shown + 1} of ${items.length}`}</Text>
                  </View>
                ) : null}
              </View>

              {/* SHARE-PC-2: small photos to pick the big one, then Add (the phone's picker again, 10 at most). */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs} keyboardShouldPersistTaps="handled">
                {items.length > 1 ? items.map((it, i) => (
                  <Pressable key={`${it.uri}-${i}`} accessibilityRole="button" accessibilityLabel={`Show photo ${i + 1}`}
                    accessibilityState={{ selected: i === shown }} onPress={() => setCur(i)}
                    style={[styles.thumb, { borderColor: i === shown ? c.ink : 'transparent' }]}>
                    <Image source={{ uri: it.uri }} style={styles.thumbImg} accessibilityIgnoresInvertColors />
                  </Pressable>
                )) : null}
                {items.length < MAX ? (
                  <Pressable accessibilityRole="button" accessibilityLabel={videos ? 'Add photos or videos' : 'Add photos'} onPress={() => void pick()}
                    style={({ pressed }) => [styles.add, { backgroundColor: c.fill, opacity: pressed ? 0.7 : 1 }]}>
                    <SystemIcon icon={{ sf: 'plus', md: 'add' }} color={c.ink} />
                    <Text maxFontSizeMultiplier={LABEL_SCALE_CAP} style={{ color: c.ink, fontSize: t.base, fontWeight: WEIGHT.semibold }}>Add</Text>
                  </Pressable>
                ) : null}
              </ScrollView>
              {items.length > 1 ? (
                <View style={styles.inset}>
                  {/* QA-R2 (staff-pm): the photo showing can be taken out, with a labelled button. */}
                  <Button variant="quiet" ink label={`Remove photo ${shown + 1}`} text="Remove" style={styles.flush}
                    icon={{ sf: 'trash', md: 'delete' }} onPress={removeShown} />
                </View>
              ) : null}

              {/* SHARE-PC-3: one note, its label always shown; no title on new posts (DEC-72 amends DEC-39). */}
              <View style={styles.words}>
                <Field label="Add a note (optional)" placeholder="Like: Pumpkin patch day" value={note} onChangeText={setNote} multiline maxLength={2000} />
              </View>

              <View style={styles.dashClip}>
                <View style={[styles.dash, { borderColor: c.line }]} />
              </View>

              {/* SHARE-PC-5..9: To: names the people; the tiles fill it in. Nothing is picked to start (SHARE-PC-7). */}
              <View testID="share-to" style={styles.to}>
                <View style={styles.toLine}>
                  <Text style={{ color: c.muted, fontSize: t.base, lineHeight: t.line }}>To:</Text>
                  {toLine ? <Text style={{ flexShrink: 1, color: c.ink, fontSize: t.base, lineHeight: t.line, fontWeight: WEIGHT.semibold }}>{toLine}</Text> : null}
                </View>
                {circles === null ? <Loading words="Loading your groups…" /> : null}
                {circles?.length === 0 && !notice ? (
                  <View style={styles.inset}>
                    <Txt variant="strong">{isParent ? 'There is no group to send to yet. Make one on the Groups tab.' : `There is no group to send to yet. Ask ${app.helper ?? 'a parent'} to add you to one.`}</Txt>
                  </View>
                ) : null}
                <View style={styles.grid}>
                  {list.map((g) => (
                    <FaceTile key={g.circle_id} name={tileName(g, myName, isParent)} count={g.member_count} faces={othersIn(g, myName)}
                      picked={chosen.includes(g.circle_id)} onPress={() => toggle(g.circle_id)} across={across} />
                  ))}
                </View>
              </View>
          </View>
        </ScrollView>

        {/* SHARE-PC-10: pinned under the page, above the keyboard and the tab bar. */}
        <View style={[styles.dock, { backgroundColor: c.bg, borderTopColor: c.line }]}>
          <Button label={ready ? `Send to ${toLine}` : 'Pick who gets it'} onPress={() => void send()} disabled={!ready} busy={busy} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  page: { padding: 16, gap: 16, paddingBottom: 24 },
  // No overflow clip on the card, so its shadow is never cut; the big photo rounds its own top corners.
  card: { borderRadius: RADIUS.photo },
  big: { width: '100%', aspectRatio: 4 / 3, borderTopLeftRadius: RADIUS.photo, borderTopRightRadius: RADIUS.photo },
  count: { position: 'absolute', right: 10, bottom: 10, borderRadius: RADIUS.pill, paddingHorizontal: 12, paddingVertical: 2, backgroundColor: 'rgba(0,0,0,0.6)' },
  thumbs: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 },
  thumb: { width: 64, height: 64, borderRadius: RADIUS.medium, borderWidth: 3, overflow: 'hidden' },
  thumbImg: { width: '100%', height: '100%' },
  add: { minWidth: 64, minHeight: 64, borderRadius: RADIUS.medium, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  inset: { paddingHorizontal: 16 },
  words: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  // A dashed line on one side only isn't drawn the same on every phone, so a dashed box is clipped to its top edge.
  dashClip: { height: 2, overflow: 'hidden' },
  dash: { height: 6, borderWidth: 2, borderStyle: 'dashed', marginHorizontal: -2 },
  to: { paddingTop: 12, paddingBottom: 10, gap: 4 },
  toLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 8, paddingHorizontal: 16, minHeight: 32 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10 },
  dock: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, borderTopWidth: StyleSheet.hairlineWidth },
  // A text button whose words start on the 16 pt edge, like the title above it.
  flush: { alignSelf: 'flex-start', paddingHorizontal: 0 },
});
