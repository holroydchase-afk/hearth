// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
import React, { forwardRef, memo, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, type TextInputInstance, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { REACTIONS, type FeedPost, type Reaction } from '../api/HearthApi';
import type { CommentView } from '../feed/store';
import { useApp, useFeed } from '../state/AppContext';
import { Button, Card, Confirm, Field, Notice, Txt } from '../ui/kit';
import { andList, initialOf, people, shortDate } from '../ui/format';
import { FONT, MIN_TARGET, RADIUS, SPACE, fontFamily, useTheme } from '../ui/theme';
import { PhotoCollage } from './PhotoCollage';

/** MOMENT-1..8 (UAT 9): one upload as one compact card, like a standard photo feed. Who and when, the caption,
 *  a photo collage, one row of Love, Haha, Like and Comment icons (REACT-7), the newest comment, and the reply box as one row with Send
 *  beside it (DEC-30 keeps the box on the card). Older comments, who can see it and Delete are one worded tap
 *  away (See all, More), so the card no longer stacks full-width rows.
 *  Prototype: prototype/moments.html. No "Seen by" count (DEC-21, RV-U1): it counts who didn't look (A2). */
const LABEL: Record<Reaction, string> = { '❤️': 'Love it', '😂': 'Haha', '👍': 'Like it', '🎉': 'Hooray' };
const WORD: Record<Reaction, string> = { '❤️': 'love', '😂': 'haha', '👍': 'like', '🎉': 'hooray' };
// REACT-11 (Chase, Nov 5: "the standard, not 3D emojis, not line icons"): the phone's own emoji, the same
// ones on its keyboard. This replaces REACT-10's flat line icons.

export const PostCard = memo(function PostCard({ post }: { post: FeedPost }) {
  const { feed, session } = useApp();
  const state = useFeed();
  const { c } = useTheme();
  const ready = post.media.filter((m) => m.status === 'ready');
  const mine = post.author_id === session?.userId;
  const [sheet, setSheet] = useState<'comments' | 'more' | 'delete' | 'words' | null>(null);
  const box = useRef<TextInputInstance>(null);

  useEffect(() => {
    feed?.markSeen(post);
  }, [feed, post.post_id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (post.comment_count > 0) void feed?.loadComments(post.post_id);
  }, [feed, post.post_id, post.comment_count > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const list: CommentView[] = state.comments[post.post_id] ?? [];
  const newest = list[list.length - 1];
  const nComments = Math.max(list.length, post.comment_count);
  // REACT-2: my reaction and each kind's count, most first; hearts only until reaction_summary answers.
  const mineNow = post.my_reaction !== undefined ? post.my_reaction : post.i_hearted ? '❤️' : null;
  const counts = post.reaction_counts ?? (post.heart_count ? { '❤️': post.heart_count } : {});
  const kinds = REACTIONS.map((e) => [e, counts[e] ?? 0] as const).filter(([, k]) => k > 0).sort((a, b) => b[1] - a[1]);
  const many = ready.length > 1;
  const these = many ? `these ${ready.length} photos` : 'this photo';
  // MOMENT-1: the sender sees which groups it went to, by name.
  // LOOK-1: on its own line under the date, so a long group name doesn't wrap the date with it.
  const to = mine && post.audience?.length ? `Sent to ${andList(post.audience.map((a) => a.name))}` : null;
  // WHO-6/10 (Chase, Nov 4-5): small initial circles say who can see it, by name, never the group's name.
  const viewers = post.viewers?.length ? post.viewers : null;
  const [whoOpen, setWhoOpen] = useState(false);
  // CAP-6: "Edited" after the date once the sender changed the words.
  const when = [shortDate(post.published_at), post.words_edited_at ? 'Edited' : null].filter(Boolean).join(' · ');

  return (
    <Card testID={`post-${post.post_id}`} style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
      <View testID={`card-head-${post.post_id}`} style={styles.head}>
        <View style={[styles.avatar, { backgroundColor: c.accentSoft }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Txt variant="strong" style={{ color: c.accent }}>{initialOf(post.author_name)}</Txt>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt variant="strong">{post.author_name}</Txt>
          <Txt variant="muted" testID={`when-${post.post_id}`}>{when}</Txt>
          {to ? <Txt variant="muted" testID={`to-${post.post_id}`}>{to}</Txt> : null}
        </View>
        <Button
          label={`More for ${many ? 'these photos' : 'this photo'}`}
          text="More"
          icon={{ sf: 'ellipsis.circle', md: 'more_horiz' }}
          variant="quiet"
          style={styles.more}
          onPress={() => setSheet('more')}
        />
      </View>
      {post.title ? <Txt variant="title" role="header" testID={`post-title-${post.post_id}`} style={styles.title}>{post.title}</Txt> : null}
      {post.caption ? <Caption text={post.caption} /> : null}
      <PhotoCollage postId={post.post_id} media={ready} />
      {/* REACT-11 and WHO-10: under the photo, emoji chips on the left and who can see it on the right,
          like the "liked by" row of a photo app. */}
      {kinds.length || viewers ? (
        <View style={styles.summary}>
          {kinds.length ? (
            <View testID={`reactions-${post.post_id}`} accessible accessibilityLabel={kinds.map(([e, k]) => `${k} ${WORD[e]}`).join(', ')} style={styles.counts}>
              {kinds.map(([e, k]) => (
                <View key={e} testID={`chip-${e}-${post.post_id}`} style={[styles.chip, { backgroundColor: c.fill }]}>
                  <Txt>{`${e} ${k}`}</Txt>
                </View>
              ))}
            </View>
          ) : <View />}
          {viewers ? <Faces post={post} viewers={viewers} me={session?.userId} onPress={() => setWhoOpen(true)} /> : null}
        </View>
      ) : null}
      {/* REACT-7 (Chase, Oct 25): icons only, no words under them (his call over DS-3); each keeps its spoken label.
          REACT-11 (Nov 5): the phone's own emoji. */}
      <View testID={`actions-${post.post_id}`} style={[styles.actions, { borderColor: c.line }]}>
        {REACTIONS.map((e) => (
          <Button
            key={e}
            label={LABEL[e]}
            text={<Text style={styles.emoji}>{e}</Text>}
            selected={mineNow === e}
            variant="quiet"
            // LIVE-3 (Chase, Nov 5): mine is a soft fill, without the heavy outline other picked buttons get.
            style={mineNow === e ? [{ flex: 1 }, styles.mine] : { flex: 1 }}
            onPress={() => void feed?.react(post.post_id, e)}
          />
        ))}
        <Button label="Write a comment" text={<Text style={styles.emoji}>💬</Text>} variant="quiet" style={{ flex: 1 }} onPress={() => box.current?.focus()} />
      </View>
      <View style={[styles.newest, { borderColor: c.line }]}>
        {newest ? <CommentList post={post} list={[newest]} /> : null}
        {nComments > 1 ? (
          <Button label={`See all ${nComments} comments`} variant="quiet" style={styles.seeAll} onPress={() => setSheet('comments')} />
        ) : null}
        <ReplyBox ref={box} post={post} mine={mine} />
      </View>

      {/* Mounted only while open: a hidden Modal stays in the web page and its Close button with it. */}
      {sheet === 'comments' ? (
        <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSheet(null)}>
          <SafeAreaView testID={`comments-${post.post_id}`} style={{ flex: 1, backgroundColor: c.bg }}>
            <View style={styles.sheetHead}>
              <Txt variant="title" role="header" style={{ flex: 1 }}>Comments</Txt>
              <Button label="Close comments" text="Close" variant="secondary" onPress={() => setSheet(null)} />
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
              <CommentList post={post} list={list} />
            </ScrollView>
          </SafeAreaView>
        </Modal>
      ) : null}

      <MoreMenu
        visible={sheet === 'more'}
        post={post}
        mine={mine}
        these={these}
        onDelete={() => setSheet('delete')}
        onChangeWords={() => setSheet('words')}
        onClose={() => setSheet(null)}
      />
      {whoOpen && viewers ? <WhoSheet post={post} viewers={viewers} me={session?.userId} onClose={() => setWhoOpen(false)} /> : null}
      {sheet === 'words' ? <WordsSheet post={post} onClose={() => setSheet(null)} /> : null}
      <Confirm
        visible={sheet === 'delete'}
        title={`Delete ${these} for everyone?`}
        body={`${many ? 'They' : 'It'} will be gone from everyone's phone. This can't be undone.`}
        yes={many ? 'Yes, delete them' : 'Yes, delete it'}
        no={many ? 'No, keep them' : 'No, keep it'}
        onNo={() => setSheet(null)}
        onYes={() => { setSheet(null); void feed?.deletePost(post.post_id); }}
      />
    </Card>
  );
});

/** WHO-6/9: "You, Alex, Chase and 2 others can see this". You first, then names in order; past `most` names
 *  the rest are counted, so a big family stays one line. */
export function whoCanSee(viewers: { user_id: string; name: string }[], me: string | undefined, most = Infinity): string {
  const names = [...(viewers.some((v) => v.user_id === me) ? ['You'] : []), ...viewers.filter((v) => v.user_id !== me).map((v) => v.name)];
  const rest = names.length - most;
  const list = rest > 1 ? `${names.slice(0, most).join(', ')} and ${rest} others` : andList(names);
  return `${list} can see this`;
}

type Viewer = { user_id: string; name: string };

/** WHO-10: You first, then everyone else in order. */
function ordered(viewers: Viewer[], me: string | undefined): { id: string; name: string }[] {
  const you = viewers.filter((v) => v.user_id === me).map((v) => ({ id: v.user_id, name: 'You' }));
  return [...you, ...viewers.filter((v) => v.user_id !== me).map((v) => ({ id: v.user_id, name: v.name }))];
}

/** WHO-10 (Chase, Nov 5: "a contact circle component or chips... a discreet icon somewhere"): up to three small
 *  overlapping initials and "+n", beside More. One 48 pt button that reads every name out; a tap shows them all. */
function Faces({ post, viewers, me, onPress }: { post: FeedPost; viewers: Viewer[]; me: string | undefined; onPress: () => void }) {
  const { c } = useTheme();
  const list = ordered(viewers, me);
  const shown = list.slice(0, 3);
  const rest = list.length - shown.length;
  return (
    <Pressable testID={`who-${post.post_id}`} accessibilityRole="button" accessibilityLabel={whoCanSee(viewers, me, 3)}
      accessibilityHint="Shows everyone who can see this" onPress={onPress} hitSlop={4} style={styles.faces}>
      {/* LIVE-4 (Chase, Nov 5): a word with the circles, so a lone initial isn't a mystery. */}
      <Text style={[styles.faceWord, { color: c.muted }]}>Can see</Text>
      {shown.map((p, i) => (
        <View key={p.id} testID={`face-${p.id}`}
          style={[styles.face, { backgroundColor: c.accentSoft, borderColor: c.surface, marginLeft: i ? -SPACE.sm : 0 }]}>
          <Text style={[styles.faceText, { color: c.accent }]}>{initialOf(p.name === 'You' ? viewers.find((v) => v.user_id === me)?.name ?? 'You' : p.name)}</Text>
        </View>
      ))}
      {rest > 0 ? <Text style={[styles.faceMore, { color: c.muted }]}>{`+${rest}`}</Text> : null}
    </Pressable>
  );
}

/** WHO-10: everyone who can see it, one chip each (initial and name). Never the group's name. */
function WhoSheet({ post, viewers, me, onClose }: { post: FeedPost; viewers: Viewer[]; me: string | undefined; onClose: () => void }) {
  const { c, os } = useTheme();
  return (
    <Modal transparent visible animationType="slide" onRequestClose={onClose}>
      <View style={[styles.scrim, { backgroundColor: c.scrim }]}>
        <SafeAreaView edges={['bottom']} testID={`who-sheet-${post.post_id}`} accessibilityViewIsModal
          style={[styles.menu, { backgroundColor: c.surface, borderTopLeftRadius: os === 'android' ? 28 : 14, borderTopRightRadius: os === 'android' ? 28 : 14 }]}>
          <Txt variant="title" role="header">Who can see this</Txt>
          <View style={styles.people}>
            {ordered(viewers, me).map((p) => (
              <View key={p.id} testID={`person-${p.id}`} style={[styles.person, { backgroundColor: c.fill }]}>
                <View style={[styles.face, { backgroundColor: c.accentSoft, borderColor: c.fill }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  <Text style={[styles.faceText, { color: c.accent }]}>{initialOf(p.name === 'You' ? viewers.find((v) => v.user_id === me)?.name ?? 'You' : p.name)}</Text>
                </View>
                <Txt testID="person-name">{p.name}</Txt>
              </View>
            ))}
          </View>
          <Button label="Close who can see this" text="Close" variant="secondary" onPress={onClose} />
        </SafeAreaView>
      </View>
    </Modal>
  );
}

/** MOMENT-6: "More" says who can see it (BETA-AUD-1) and holds, for the sender only, Change the words (CAP-6)
 *  and Delete (BETA-AUD-5). */
function MoreMenu({ visible, post, mine, these, onDelete, onChangeWords, onClose }: {
  visible: boolean; post: FeedPost; mine: boolean; these: string; onDelete: () => void; onChangeWords: () => void; onClose: () => void;
}) {
  const { c, os } = useTheme();
  const { session } = useApp();
  if (!visible) return null;
  // WHO-7: everyone but the sender gets every name here; the group's name stays with the sender (parents).
  const audience = post.audience
    ? `Shared with ${post.audience.map((a) => `${a.name} · ${people(a.member_count)}`).join(', ')}`
    : post.viewers?.length ? whoCanSee(post.viewers, session?.userId) : 'Shared with you';
  return (
    <Modal transparent visible animationType="slide" onRequestClose={onClose}>
      <View style={[styles.scrim, { backgroundColor: c.scrim }]}>
        <SafeAreaView edges={['bottom']} testID={`more-${post.post_id}`} accessibilityViewIsModal
          style={[styles.menu, { backgroundColor: c.surface, borderTopLeftRadius: os === 'android' ? 28 : 14, borderTopRightRadius: os === 'android' ? 28 : 14 }]}>
          <Txt variant="title" role="header">Who can see this</Txt>
          <Txt style={{ color: post.audience ? c.ink : c.safe }}>{audience}</Txt>
          {mine ? (
            <>
              <Button label="Change the words" variant="secondary" onPress={onChangeWords} />
              <Button label={`Delete ${these}`} variant="danger" onPress={onDelete} />
            </>
          ) : null}
          <Button label="Close this menu" text="Close" variant="secondary" onPress={onClose} />
        </SafeAreaView>
      </View>
    </Modal>
  );
}

/** CAP-6: one sheet with the same two boxes as Share, filled in, plus Save and Cancel. Photos never change here.
 *  No notice goes out (CAP-8); a refusal shows its reason in plain words and keeps the old words (CAP-7). */
function WordsSheet({ post, onClose }: { post: FeedPost; onClose: () => void }) {
  const { feed } = useApp();
  const { c } = useTheme();
  const [title, setTitle] = useState(post.title ?? '');
  const [caption, setCaption] = useState(post.caption ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    if (!feed) return;
    setBusy(true);
    setError(null);
    const why = await feed.editWords(post.post_id, title, caption);
    setBusy(false);
    if (why) setError(why);
    else onClose();
  };
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView testID={`words-${post.post_id}`} style={{ flex: 1, backgroundColor: c.bg }}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
          <Txt variant="title" role="header">Change the words</Txt>
          <Txt variant="muted">The photos stay as they are. Nobody gets a notice.</Txt>
          <Field label="Title (optional)" value={title} onChangeText={setTitle} maxLength={80} />
          <Field label="What's happening?" value={caption} onChangeText={setCaption} multiline maxLength={2000} />
          {error ? <Notice text={error} /> : null}
          <Button label="Save the new words" text="Save" busy={busy} onPress={() => void save()} />
          <Button label="Cancel, keep the words" text="Cancel" variant="secondary" onPress={onClose} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

/** REPLY-11: "Memaw, Pawpaw, Granny, Chase and Mom"; a long list ends "and 6 more people". */
function readerNames(names: string[]): string {
  if (names.length <= 6) return andList(names);
  return `${names.slice(0, 5).join(', ')} and ${names.length - 5} more people`;
}

/** Comments in order, each saying when it is still sending or didn't send (with Try again). */
function CommentList({ post, list }: { post: FeedPost; list: CommentView[] }) {
  const { feed } = useApp();
  return (
    <>
      {list.map((c) => (
        <View key={c.client_id ?? c.comment_id} style={{ gap: 4 }}>
          <Txt numberOfLines={list.length === 1 ? 2 : undefined}><Txt variant="strong">{`${c.author_name} `}</Txt>{c.body}</Txt>
          {c.status === 'sending' ? <Txt variant="muted">Sending…</Txt> : null}
          {c.status === 'failed' ? (
            <>
              <Txt variant="muted">Didn't send.</Txt>
              <Button label="Try sending this again" text="Try again" variant="secondary" onPress={() => void feed?.retryComment(post.post_id, c.client_id!)} />
            </>
          ) : null}
        </View>
      ))}
    </>
  );
}

/** DEC-30: the reply box stays on every card with its "who will read this" line (no extra tap for LG),
 *  now as one row: the box with Send beside it (MOMENT-4). */
const ReplyBox = forwardRef<TextInputInstance, { post: FeedPost; mine: boolean }>(function ReplyBox({ post, mine }, ref) {
  const { feed, session, deps } = useApp();
  const { c, t, os } = useTheme();
  // REPLY-11 (0011): the server names exactly who will read my reply; until it answers (or on an older
  // server) the box falls back to the reply_scope words.
  const [names, setNames] = useState<string[] | null>(null);
  useEffect(() => {
    if (mine) return undefined;
    let alive = true;
    Promise.resolve(deps.api.replyReaders?.(post.post_id))
      .then((n) => { if (alive && Array.isArray(n) && n.length) setNames(n); })
      .catch(() => {});
    return () => { alive = false; };
  }, [deps.api, post.post_id, mine]);
  const state = useFeed();
  const draft = state.drafts[post.post_id] ?? '';
  const [sent, setSent] = useState(false);
  const prompt = mine ? 'Write something back' : `Write something back to ${post.author_name}`;
  // BETA-REPLY-6 + grandparent-ux: name who can read it; never a vague "everyone", never group names.
  // AUD-8/9/10: the server says who will read my reply on this post.
  const scope = post.reply_scope ?? 'everyone';
  const readers = mine
    ? 'The family you shared this photo with can read this.'
    : names ? `${readerNames(names)} will read this.`
    : scope === 'parents' ? "Only the kids' parents can read this."
    : scope === 'group' ? "The kids' parents and your part of the family can read this."
    : `${post.author_name} and the family ${post.author_name} shared this photo with can read this.`;
  const sentWords = mine
    ? 'Sent. The family you shared this photo with can read it.'
    : names ? `Sent. ${readerNames(names)} will read it.`
    : scope === 'parents' ? "Sent. Only the kids' parents can read it."
    : scope === 'group' ? "Sent. The kids' parents and your part of the family can read it."
    : `Sent. ${post.author_name} and the family who got this photo can read it.`;

  const send = async () => {
    if (!feed || !session) return;
    setSent(false);
    await feed.addComment(post.post_id, draft, { id: session.userId, name: 'You' });
    const after = feed.getState().comments[post.post_id] ?? [];
    if (after.some((x) => x.status === 'sent' && x.author_id === session.userId)) setSent(true);
  };

  // iPhone: a rounded field like a grouped-list cell. Android: Material's outlined field (as kit Field).
  const box = os === 'android'
    ? { borderWidth: 1, borderColor: c.muted, borderRadius: 4 }
    : { borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, borderRadius: 20 };
  return (
    <View style={{ gap: 6 }}>
      <View testID={`reply-${post.post_id}`} style={styles.replyRow}>
        <TextInput
          ref={ref}
          accessibilityLabel={prompt}
          placeholder={prompt}
          placeholderTextColor={c.muted}
          value={draft}
          onChangeText={(v) => { setSent(false); feed?.setDraft(post.post_id, v); }}
          multiline
          maxLength={500}
          style={[{ flex: 1, minHeight: MIN_TARGET, color: c.ink, paddingHorizontal: 14, paddingVertical: 12, fontSize: t.base, fontFamily }, box]}
        />
        <Button label="Send" onPress={() => void send()} disabled={!draft.trim()} />
      </View>
      {/* BETA-REPLY-6: say who can read it, matching the server (everyone the post was shared with). */}
      <Txt variant="muted">{sent ? sentWords : readers}</Txt>
    </View>
  );
});

/** CAP-4: past about 4 lines the caption folds, with a worded Read more / Show less (no tap on the text needed). */
const FOLD_LINES = 4;
const foldable = (t: string) => t.split('\n').length > FOLD_LINES || t.length > 220;

function Caption({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const fold = foldable(text);
  return (
    <View style={styles.caption}>
      <Txt numberOfLines={fold && !open ? FOLD_LINES : undefined}>{text}</Txt>
      {fold ? (
        <Button
          label={open ? 'Show less of this caption' : 'Read more of this caption'}
          text={open ? 'Show less' : 'Read more'}
          variant="quiet"
          style={styles.fold}
          onPress={() => setOpen((o) => !o)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md, paddingTop: SPACE.md, paddingBottom: SPACE.sm, paddingLeft: SPACE.lg, paddingRight: SPACE.xs },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  more: { paddingHorizontal: SPACE.md },
  title: { paddingHorizontal: SPACE.lg, paddingBottom: SPACE.xs },
  caption: { paddingHorizontal: SPACE.lg, paddingBottom: SPACE.md },
  fold: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  summary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.sm, paddingHorizontal: SPACE.lg, paddingTop: SPACE.sm },
  counts: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, flexShrink: 1 },
  chip: { borderRadius: RADIUS.pill, paddingHorizontal: SPACE.md, paddingVertical: SPACE.xs },
  mine: { borderWidth: 0 },
  faceWord: { fontFamily, fontSize: 17, marginRight: SPACE.xs },
  faces: { flexDirection: 'row', alignItems: 'center', minHeight: MIN_TARGET, minWidth: MIN_TARGET, paddingHorizontal: SPACE.xs },
  face: { width: 36, height: 36, borderRadius: RADIUS.pill, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  faceText: { fontFamily: FONT.semibold, fontSize: 17, lineHeight: 20 },
  emoji: { fontSize: 24, lineHeight: 30, textAlign: 'center' },
  faceMore: { fontFamily, fontSize: 17, marginLeft: SPACE.xs },
  people: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  person: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, borderRadius: RADIUS.pill, paddingLeft: SPACE.xs, paddingRight: SPACE.md, minHeight: MIN_TARGET },
  actions: { flexDirection: 'row', gap: SPACE.sm, marginHorizontal: SPACE.sm, marginTop: SPACE.sm, paddingVertical: SPACE.xs, borderTopWidth: StyleSheet.hairlineWidth },
  newest: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: SPACE.lg, paddingTop: SPACE.md, paddingBottom: SPACE.lg, gap: SPACE.sm },
  seeAll: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  replyRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 12 },
  scrim: { flex: 1, justifyContent: 'flex-end' },
  menu: { padding: 20, gap: 14 },
});
