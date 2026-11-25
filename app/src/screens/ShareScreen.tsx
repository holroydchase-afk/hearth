// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Share (BETA-SHARE-1, BETA-AUD-1): pick photos, then one "New post" postcard (DEC-73, SPEC-REDESIGN 1j, SHARE-PC-1..14):
// the big photo, a note, and "To:" face tiles on one card, with a pinned "Send to <names>" button. Nothing is
// picked to start (SHARE-PC-7; was BETA-AUD-2's preselect). DEC-79 (SPEC-REDESIGN 1j-2, round 3 "Quiet postcard",
// SHARE-ST-19..27): before any photo is picked, Share is the same postcard, empty and wordless: the whole card is one
// "Add photos" button (a parent with Easy view off picks up to 100 and 11+ go to bulk review; anyone else up to 10),
// with a stamp in the photo spot and blank ruled lines where the note and To: go.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Keyboard, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Circle } from '../api/HearthApi';
import { messageFor } from '../errors/messages';
import { saveLastAudience } from '../share/audienceMemory';
import { pickedItems, planBatch, skippedVideosLine, type PickedAsset } from '../share/bulk';
import { applyHelpers, findLookAlikes, helperLines, helperSwitches, type LookResult } from '../share/helpers';
import { othersIn, recipientsLine, tileColumns, tileName } from '../share/postcard';
import { loadSent, recordSent } from '../share/sentBefore';
import { useApp } from '../state/AppContext';
import { useNav } from '../state/nav';
import { AddPhotoCard, AddTile, AlertDialog, PostcardStamp, Button, FaceTile, Field, Loading, Notice, Screen, Txt } from '../ui/kit';
import { photos } from '../ui/format';
import { RADIUS, photoShadow, useTheme } from '../ui/theme';
import type { QueueItem } from '../upload/queue';
import { useTabBarSpace } from '../ui/tabBarSpace';
import { AppGate } from './AppGate';
import { BatchReview } from './BatchReview';
import { QueueStatus } from './QueueStatus';
import { uuid } from '../crypto/random';
import { AGE_NOT_NUMBER, DAY_NOT_REAL, KIND_HINT, KindCard, KindsRow, kindDetails, kindFilled, kindHasWords, kindSendMessage, showsKinds, type KindWords, type PostKind } from './ShareKinds';

const MAX = 10;
const DENIED = 'Hearth needs your OK to see your photos. Tap "Allow" when your phone asks.';

/** BETA-AUD-17 (SPEC-GROUPS): Everyone first (1 tap), then groups and households, then events. */
const KIND_ORDER: Record<string, number> = { everyone: 0, group: 1, household: 2, event: 3 };
export function shareOrder(list: Circle[]): Circle[] {
  return list
    .map((x, i) => ({ x, i }))
    .sort((a, b) => (KIND_ORDER[a.x.kind ?? 'group'] ?? 1) - (KIND_ORDER[b.x.kind ?? 'group'] ?? 1) || a.i - b.i)
    .map((a) => a.x);
}

export function ShareScreen() {
  const under = useTabBarSpace(); // RD-109: the pinned Send sits above the web's floating tab bar
  const app = useApp();
  const nav = useNav();
  const [circles, setCircles] = useState<Circle[] | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [note, setNote] = useState('');
  const win = useWindowDimensions();
  const [gridW, setGridW] = useState<number | null>(null); // GUX-R1: the tile row's drawn width, once laid out
  // CAP-9 / QA-R3: bulk review keeps its one Title box for now; new single posts have no title (DEC-73).
  const [title, setTitle] = useState('');
  // SHARE-ST-31: the kind picked from the row under the empty postcard, and SHARE-U-17..19 its words, whether its
  // who-gets-it tiles are open, and one client id per draft (reused on a double tap or a Send again, so one post).
  const [kind, setKind] = useState<PostKind | null>(null);
  const [kindWords, setKindWords] = useState<KindWords>({});
  const [kindTo, setKindTo] = useState(false);
  const [askThrow, setAskThrow] = useState(false); // GUX-SK-R11: "Throw away this card?" is showing
  // PRIV-SK-R1: the draft remembers what its createPost was sent with (kind, words, groups); a Send with anything
  // different makes a new client id, so a changed pick or changed words never publish the old draft.
  const draft = useRef<{ clientId: string; sentWith: string } | null>(null);
  const sending = useRef(false);
  // SHARE-PC-2: which picked photo is the big one.
  const [cur, setCur] = useState(0);
  // SHARE-PC-9: my own name, so the To: line names the others, not me.
  const [myName, setMyName] = useState<string | null>(null);
  const scroller = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const { c, type, os, dark, bigText } = useTheme();
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
        // SHARE-PC-7 (DEC-73): nothing is picked to start, even when a last audience is saved.
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
  if (!canPost || !app.queue) return <Screen><Txt variant="title2">You can't do that here.</Txt></Screen>;

  const pick = async () => {
    setNotice(null);
    const r = await app.deps.pickPhotos({ videos });
    if ('denied' in r) setNotice(DENIED);
    else {
      // HARD-2: never drop photos silently; say how many were left out.
      const left = items.length + r.items.length - MAX;
      setItems((cur) => [...cur, ...r.items].slice(0, MAX));
      if (left > 0) setNotice(`You can send ${MAX} at a time, so ${photos(left)} ${left === 1 ? 'was' : 'were'} left out.`);
    }
  };

  // SHARE-ST-4 (DEC-79): a parent's one picker takes up to 100. 1 to 10 open the postcard in the order picked (dates
  // only; EXIF and GPS dropped here, SHARE-ST-7); 11 or more open bulk review. Nothing is picked or sent for them.
  const pickMany = async () => {
    if (!app.deps.pickBulk) return;
    setNotice(null);
    const r = await app.deps.pickBulk({ videos });
    if ('denied' in r) { setNotice(DENIED); return; }
    const count = r.assets.filter((a) => a.type !== 'pairedVideo').length;
    if (!count) return;
    if (count > MAX) { setPlan(r.assets); return; }
    const got = pickedItems(r.assets, {}, { videos });
    setItems(got.items);
    setCur(0);
    const skipped = skippedVideosLine(got.skippedVideos);
    if (skipped) setNotice(skipped);
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

  const reset = () => {
    setItems([]); setNote(''); setChosen([]); setCur(0); setNotice(null); setKind(null);
    setKindWords({}); setKindTo(false); draft.current = null;
  };
  const pickKind = (k: PostKind) => { setKind(k); setKindWords({}); setKindTo(false); setChosen([]); draft.current = null; };
  const typeKind = (label: string, text: string) => {
    // Words changed after a draft was made: sendKind sees they differ from the draft and makes a new one (PRIV-SK-R1).
    setKindWords((o) => ({ ...o, [label]: text }));
  };
  const kindOk = !!kind && kindFilled(kind, kindWords);
  // GUX-SK-R2: every notice on a kind card shows at the top of the page, so the page scrolls there.
  const sayKind = (words: string) => { setNotice(words); scroller.current?.scrollTo({ y: 0, animated: true }); };
  // GUX-SK-R1/R2: the day and the age are checked on "Pick who gets it", before the tiles open; GUX-SK-R4: then the
  // keyboard goes away and the page scrolls down to the "To:" tiles.
  const openKindTo = () => {
    if (!kind) return;
    const details = kindDetails(kind, kindWords);
    if (details === 'age') { sayKind(AGE_NOT_NUMBER); return; }
    if (details === 'day') { sayKind(DAY_NOT_REAL); return; }
    setNotice(null);
    Keyboard.dismiss();
    setKindTo(true);
    requestAnimationFrame(() => scroller.current?.scrollToEnd({ animated: true }));
  };
  // GUX-SK-R11: Cancel on a kind card with words asks first; an empty card (or the photo postcard) cancels at once.
  const cancel = () => { if (kind && !items.length && kindHasWords(kindWords)) setAskThrow(true); else reset(); };
  const kindReady = kindOk && kindTo && chosen.length > 0 && !!toLine;

  // SHARE-U-19: one post of this kind, no media: createPost then publishPost; Share empties and Feed shows it.
  // SHARE-U-22: a refusal says the words were kept, by error.code; the card and every word stay.
  const sendKind = async () => {
    if (!kind || !kindReady || !userId || sending.current) return;
    const details = kindDetails(kind, kindWords);
    if (details === 'age') { sayKind(AGE_NOT_NUMBER); return; }
    if (details === 'day') { sayKind(DAY_NOT_REAL); return; }
    sending.current = true;
    setBusy(true);
    setNotice(null);
    try {
      // PRIV-SK-R1: same kind, words and groups reuse the client id (one post on a retry); anything changed is a new one.
      const sentWith = JSON.stringify({ kind, details, groups: [...chosen].sort() });
      if (draft.current?.sentWith !== sentWith) draft.current = { clientId: uuid(), sentWith };
      const d = draft.current;
      const id = await app.deps.api.createPost({ ...details, clientId: d.clientId, space: app.space!.space_id, circleIds: chosen, title: null, takenAt: null });
      await app.deps.api.publishPost(id);
      await saveLastAudience(app.deps.kv, userId, chosen).catch(() => {});
      app.setShared(`Shared with ${toLine}.`);
      reset();
      void app.feed?.refresh().catch(() => {});
      nav.goFeed();
    } catch (e) {
      sayKind(kindSendMessage(e));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

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

  // SHARE-ST-19..26 (DEC-79 round 3, A "Quiet postcard"): before any photo is picked, the same page holds the empty
  // postcard, and the whole card is the one "Add photos" button (a browser won't open a file chooser by itself). No
  // words but "Add photos", "To:" and the stamp: blank ruled lines show where the note and To: go, hidden from screen
  // readers, and a tap on them opens the picker like the rest of the card. Same page as the postcard, so "New post"
  // stays put when photos arrive.
  const empty = !items.length;
  const bulkOk = isParent && !!app.deps.pickBulk && !bigText; // SHARE-ST-21: Easy view picks 10, like everyone else
  const limit = bulkOk ? 100 : MAX;
  const addWords = videos ? 'Add photos or videos' : 'Add photos';
  const rule = { height: 1, backgroundColor: c.tabLine }; // GUX-W4: c.line was too faint on the card
  const emptyCard = (
    <AddPhotoCard testID="share-card" spotTestID="share-spot" label={`${addWords}, up to ${limit} at a time`} title={addWords}
      cardStyle={[styles.card, { backgroundColor: c.surface }, photoShadow(dark)]} inSpot={<PostcardStamp testID="share-stamp" />}
      onPress={() => void (bulkOk ? pickMany() : pick())}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
        <View style={styles.lines}>
          <View testID="share-note-rule" style={rule} />
          <View testID="share-note-rule" style={rule} />
        </View>
        <View style={styles.toRow}>
          <Text accessible={false} style={{ color: c.muted, ...type.headline }}>To:</Text>
          <View testID="share-to-rule" style={[rule, styles.toRule]} />
        </View>
      </View>
    </AddPhotoCard>
  );

  const shown = Math.max(0, Math.min(cur, items.length - 1));
  const big = items[shown];
  const removeShown = () => { setItems((all) => all.filter((_, j) => j !== shown)); setCur((i) => Math.max(0, Math.min(i, items.length - 2))); };
  // GUX-R1: no name ever spills out of its tile. Until the row is laid out, its width comes from the window
  // (page padding 16 + grid padding 10, each side).
  const across = tileColumns({
    names: list.map((g) => tileName(g, myName, isParent)), rowWidth: gridW ?? win.width - 52,
    fontSize: type.headline.fontSize, fontScale: win.fontScale ?? 1, bigText,
  });

  // SHARE-PC-5..9: To: names the people; the tiles fill it in. Nothing is picked to start (SHARE-PC-7). The kind cards
  // use the same tiles once "Pick who gets it" opens them (SHARE-U-18).
  const toSection = (
    <View testID="share-to" style={styles.to}>
      <View style={styles.toLine}>
        <Text style={{ color: c.muted, ...type.body }}>To:</Text>
        {toLine ? <Text style={{ flexShrink: 1, color: c.ink, ...type.headline }}>{toLine}</Text> : null}
      </View>
      {circles === null ? <Loading words="Loading your groups…" /> : null}
      {circles?.length === 0 && !notice ? (
        <View style={styles.inset}>
          <Txt variant="headline">{isParent ? 'There is no group to send to yet. Make one on the Groups tab.' : `There is no group to send to yet. Ask ${app.helper ?? 'a parent'} to add you to one.`}</Txt>
        </View>
      ) : null}
      <View style={styles.grid} onLayout={(e) => setGridW(Math.max(0, e.nativeEvent.layout.width - 20))}>
        {list.map((g) => (
          <FaceTile key={g.circle_id} name={tileName(g, myName, isParent)} count={g.member_count} faces={othersIn(g, myName)}
            picked={chosen.includes(g.circle_id)} onPress={() => toggle(g.circle_id)} across={across} />
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: c.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={os === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scroller} contentContainerStyle={[styles.page, empty ? { flexGrow: 1, paddingBottom: 32 + under } : null]} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
          {/* GUX-W3: "New post" sits in one row in both states, so it never moves; Cancel joins it after photos. */}
          <View style={styles.head}>
            <View style={styles.headTitle}><Txt variant="title2" level={1} role="header">New post</Txt></View>
            {empty && !kind ? null : <Button variant="quiet" label="Cancel this post" text="Cancel" style={styles.headCancel} onPress={cancel} />}
          </View>
          <QueueStatus />
          {notice ? <Notice text={notice} onClose={() => setNotice(null)} /> : null}

          {/* SHARE-PC-1: one card holds the post as the family will see it, and who it goes to. */}
          {/* GUX-T2: the empty postcard sits right under "New post", the kinds row right under it. */}
          {!big && kind ? <KindCard kind={kind} values={kindWords} onChange={typeKind} to={kindTo ? toSection : undefined} /> : null}
          {!big && !kind ? (
            <View testID="share-empty-wrap" style={styles.emptyWrap}>
              {emptyCard}
              {/* SHARE-ST-30..33: Event, News and Saying under the postcard, for parents with post_kinds on. */}
              {showsKinds(app.features, app.space?.role) ? <KindsRow onPick={pickKind} /> : null}
            </View>
          ) : null}
          {!big ? null : (
          <View testID="share-card" style={[styles.card, { backgroundColor: c.surface }, photoShadow(dark)]}>
              <View>
                <Image source={{ uri: big.uri }} style={styles.big} resizeMode="cover"
                  accessibilityLabel={items.length > 1 ? `Photo ${shown + 1} of ${items.length}` : 'Your photo'} accessibilityIgnoresInvertColors />
                {items.length > 1 ? (
                  <View style={styles.count} pointerEvents="none">
                    <Text style={{ color: '#FFFFFF', ...type.headline }}>{`${shown + 1} of ${items.length}`}</Text>
                  </View>
                ) : null}
                {/* GUX-W2: the stamp stays on the filled postcard, top-right over the big photo. */}
                <PostcardStamp testID="share-stamp" />
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
                  <AddTile label={videos ? 'Add photos or videos' : 'Add photos'} onPress={() => void pick()} />
                ) : null}
              </ScrollView>
              {items.length > 1 ? (
                <View style={styles.inset}>
                  {/* QA-R2 (staff-pm): the photo showing can be taken out, with a labelled button. */}
                  <Button variant="quiet" ink label={`Remove photo ${shown + 1}`} text="Remove" style={styles.flush}
                    icon={{ sf: 'trash', md: 'delete' }} onPress={removeShown} />
                </View>
              ) : null}

              {/* SHARE-PC-3: one note, its label always shown; no title on new posts (DEC-73 amends DEC-39). */}
              <View style={styles.words}>
                <Field underline label="Add a note (optional)" value={note} onChangeText={setNote} multiline maxLength={2000} />
              </View>

              <View style={styles.dashClip}>
                <View style={[styles.dash, { borderColor: c.line }]} />
              </View>

              {toSection}
          </View>
          )}
        </ScrollView>

        {/* SHARE-PC-10: pinned under the page, above the keyboard and the tab bar. Not on the empty postcard (SHARE-ST-3). */}
        {/* SHARE-U-17..19: a kind card uses the same pinned button: "Pick who gets it" opens the tiles once the
            required fields hold words, then "Send to <names>" sends it. */}
        {empty && !kind ? null : (
          <View style={[styles.dock, { backgroundColor: c.bg, borderTopColor: c.line, paddingBottom: 12 + under }]}>
            {/* GUX-SK-R3: while the button is off, one line says what to fill in. */}
            {kind && !big && !kindTo && !kindOk ? <Txt tone="muted" style={styles.hint}>{KIND_HINT[kind]}</Txt> : null}
            {kind && !big ? (
              <Button label={kindReady ? `Send to ${toLine}` : 'Pick who gets it'} busy={busy}
                disabled={kindTo ? !kindReady : !kindOk}
                onPress={() => { if (kindTo) void sendKind(); else openKindTo(); }} />
            ) : (
              <Button label={ready ? `Send to ${toLine}` : 'Pick who gets it'} onPress={() => void send()} disabled={!ready} busy={busy} />
            )}
          </View>
        )}
      </KeyboardAvoidingView>
      {askThrow ? (
        <AlertDialog title="Throw away this card?" keep="Keep writing" destroy="Throw away"
          onKeep={() => setAskThrow(false)} onDestroy={() => { setAskThrow(false); reset(); }} />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // SHARE-ST-23: the empty card's blank note lines and To: line, as in the option A reference.
  lines: { paddingHorizontal: 6, paddingTop: 22, gap: 26 },
  toRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 6, paddingTop: 18, paddingBottom: 6 },
  toRule: { flex: 1, marginBottom: 6 },
  page: { padding: 16, gap: 16, paddingBottom: 24 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }, // same height with or without Cancel
  headTitle: { flex: 1, flexShrink: 1 },
  headCancel: { paddingHorizontal: 0 },
  emptyWrap: { flex: 1 }, // GUX-T2: top-aligned under "New post" (supersedes GUX-W1's centring)
  // No overflow clip on the card, so its shadow is never cut; the big photo rounds its own top corners.
  card: { borderRadius: RADIUS.photo },
  big: { width: '100%', aspectRatio: 4 / 3, borderTopLeftRadius: RADIUS.photo, borderTopRightRadius: RADIUS.photo },
  count: { position: 'absolute', right: 10, bottom: 10, borderRadius: RADIUS.pill, paddingHorizontal: 12, paddingVertical: 2, backgroundColor: 'rgba(0,0,0,0.6)' },
  thumbs: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 },
  thumb: { width: 64, height: 64, borderRadius: RADIUS.medium, borderWidth: 3, overflow: 'hidden' },
  thumbImg: { width: '100%', height: '100%' },
  inset: { paddingHorizontal: 16 },
  words: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, minHeight: 48 },
  // A dashed line on one side only isn't drawn the same on every phone, so a dashed box is clipped to its top edge.
  dashClip: { height: 2, overflow: 'hidden' },
  dash: { height: 6, borderWidth: 2, borderStyle: 'dashed', marginHorizontal: -2 },
  to: { paddingTop: 12, paddingBottom: 10, gap: 4 },
  toLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 8, paddingHorizontal: 16, minHeight: 32 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10 },
  hint: { marginBottom: 8 },
  dock: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, borderTopWidth: StyleSheet.hairlineWidth },
  // A text button whose words start on the 16 pt edge, like the title above it.
  flush: { alignSelf: 'flex-start', paddingHorizontal: 0 },
});
