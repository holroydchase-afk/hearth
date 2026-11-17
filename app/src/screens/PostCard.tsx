// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
import React, { memo, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { REACTIONS, type FeedPost, type Reaction } from '../api/HearthApi';
import type { CommentView } from '../feed/store';
import { useApp, useFeed } from '../state/AppContext';
import { BottomSheet, Button, Card, Confirm, Field, Notice, SystemIcon, Txt } from '../ui/kit';
import { useTypingField } from '../ui/typing';
import { haptic } from '../platform/haptics';
import { andList, initialOf, people, relativeTime, shortDate } from '../ui/format';
import { MIN_TARGET, RADIUS, SPACE, WEIGHT, useTheme } from '../ui/theme';
import { PhotoCollage } from './PhotoCollage';

/** MOMENT-1..8 (UAT 9): one upload as one compact card, like a standard photo feed. Who and when, the caption,
 *  a photo collage, one row of Love, Haha, Like and Hooray emoji (REACT-7; no 💬 since DEC-63), the newest comment, and the comment field as one row with Post
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
  const { c, t, reduceMotion } = useTheme();
  const ready = post.media.filter((m) => m.status === 'ready');
  const mine = post.author_id === session?.userId;
  const [sheet, setSheet] = useState<'comments' | 'more' | 'delete' | 'words' | null>(null);

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
  const many = ready.length > 1;
  const these = many ? `these ${ready.length} photos` : 'this photo';
  // MOMENT-1: the sender sees which groups it went to, by name (RD-48: under the who-can-see line, not by the name).
  const to = mine && post.audience?.length ? `Sent to ${andList(post.audience.map((a) => a.name))}` : null;
  // WHO-6 / GUX-R6 (Chase, Nov 16, DEC-60): one line names who can see it, people only, never the group's name.
  const viewers = post.viewers?.length ? post.viewers : null;
  const [whoOpen, setWhoOpen] = useState(false);
  // CAP-6: "Edited" after the time once the sender changed the words. RD-51: the time reads like Instagram's.
  const when = [relativeTime(post.published_at, new Date()), post.words_edited_at ? 'Edited' : null].filter(Boolean).join(' · ');

  return (
    // RD-48 (DEC-65): Instagram's order. RD-52: no lines; 32 pt of space between posts (the list's gap plus this
    // card's 16 pt below it), so each post's face and name is the divider.
    <Card testID={`post-${post.post_id}`} style={styles.card}>
      <View testID={`card-head-${post.post_id}`} style={styles.head}>
        {/* RD-49: the person's round profile photo once there is one; initials until then. LOOK-2: everything sits
            at the top of one 48 pt row, so the face and the name line up. */}
        <View style={[styles.avatar, { backgroundColor: c.line }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text maxFontSizeMultiplier={FACE_MAX_SCALE} style={[styles.faceText, { color: c.ink }]}>{initialOf(post.author_name)}</Text>
        </View>
        <View style={styles.nameBox}>
          <Txt style={styles.name} numberOfLines={1}>{post.author_name}</Txt>
        </View>
        {/* RD-50: icon only, spoken "Post options", 48 pt; the menu holds who can see it, and Edit and Delete for mine. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Post options"
          onPress={() => setSheet('more')}
          hitSlop={4}
          style={({ pressed }) => [styles.more, { opacity: pressed ? 0.6 : 1 }]}
        >
          <SystemIcon icon={{ sf: 'ellipsis', md: 'more_horiz' }} color={c.ink} size={24} />
        </Pressable>
      </View>
      {/* RD-54: the photos inset 16 pt with 16 pt corners, like Gallery. */}
      <View style={styles.inset}>
        <PhotoCollage postId={post.post_id} media={ready} from={`${post.author_name}, ${shortDate(post.published_at)}`} />
      </View>
      <View testID={`actions-${post.post_id}`} style={styles.actions}>
        {REACTIONS.map((e) => {
          const n = counts[e] ?? 0;
          const on = mineNow === e;
          return (
            <Pressable
              key={e}
              accessibilityRole="button"
              accessibilityLabel={LABEL[e]}
              accessibilityState={{ selected: on }}
              accessibilityValue={n ? { text: String(n) } : undefined}
              onPress={() => { haptic('tap'); void feed?.react(post.post_id, e); }}
              style={({ pressed }) => [styles.react, { backgroundColor: on ? c.accentSoft : 'transparent', opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={styles.emoji}>{e}</Text>
              {n ? <Text style={[styles.count, { color: c.ink, fontSize: t.base }]}>{String(n)}</Text> : null}
            </Pressable>
          );
        })}
      </View>
      <View style={styles.words}>
        {post.title ? <Txt variant="title" role="header" testID={`post-title-${post.post_id}`}>{post.title}</Txt> : null}
        {post.caption ? <Caption testID={`desc-${post.post_id}`} name={post.author_name} text={post.caption} /> : null}
        {/* RD-51: "Just now", "3 hours ago", "Yesterday", "Nov 3"; CAP-6's "· Edited" after it. */}
        <Txt variant="muted" testID={`when-${post.post_id}`}>{when}</Txt>
        {/* WHO-6 / DEC-60: the quiet privacy line stays on every post. */}
        {viewers ? <WhoLine post={post} viewers={viewers} me={session?.userId} onPress={() => setWhoOpen(true)} /> : null}
        {to ? <Txt variant="muted" testID={`to-${post.post_id}`}>{to}</Txt> : null}
      </View>
      <View style={styles.newest}>
        {/* UX-R5/R6 (Chase, Nov 17, DEC-63): a standard comment area on every post, under a visible "Comments" label. */}
        <Txt variant="strong" role="header">Comments</Txt>
        {newest ? <CommentList post={post} list={[newest]} /> : null}
        {nComments > 1 ? (
          <Button label={`See all ${nComments} comments`} variant="quiet" style={styles.seeAll} onPress={() => setSheet('comments')} />
        ) : null}
        <ReplyBox post={post} mine={mine} />
      </View>

      {/* Mounted only while open: a hidden Modal stays in the web page and its Close button with it. */}
      {sheet === 'comments' ? (
        <Modal visible animationType={reduceMotion ? 'fade' : 'slide'} presentationStyle="pageSheet" onRequestClose={() => setSheet(null)}>
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

/** GUX-R1: two letters in a fixed 36 pt circle; past 1.3x they would clip. The name beside a chip carries full size. */
const FACE_MAX_SCALE = 1.3;

/** GUX-R6 (Chase, Nov 16: "Names", DEC-60): the others who can see it, in words. Up to three are all named;
 *  past that, two names and "N more". People only, never a group's title (DEC-49). */
export function namesLine(viewers: Viewer[], me: string | undefined): string {
  const others = viewers.filter((v) => v.user_id !== me).map((v) => v.name);
  if (!others.length) return 'Only you can see this.';
  const list = others.length <= 3 ? andList(others) : `${others.slice(0, 2).join(', ')} and ${others.length - 2} more`;
  return `${list} can see this.`;
}

/** GUX-R6: one 48 pt button with the names line; a tap shows everyone (the Who sheet). Replaces WHO-10's circles. */
function WhoLine({ post, viewers, me, onPress }: { post: FeedPost; viewers: Viewer[]; me: string | undefined; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable testID={`who-${post.post_id}`} accessibilityRole="button" accessibilityLabel={whoCanSee(viewers, me, 3)}
      accessibilityHint="Shows everyone who can see this" onPress={onPress} hitSlop={4} style={styles.who}>
      <Txt style={{ color: c.muted }}>{namesLine(viewers, me)}</Txt>
    </Pressable>
  );
}

/** WHO-10: everyone who can see it, one chip each (initial and name). Never the group's name. */
function WhoSheet({ post, viewers, me, onClose }: { post: FeedPost; viewers: Viewer[]; me: string | undefined; onClose: () => void }) {
  const { c } = useTheme();
  return (
    <BottomSheet testID={`who-sheet-${post.post_id}`} onClose={onClose}>
          <Txt variant="title" role="header">Who can see this</Txt>
          <View style={styles.people}>
            {ordered(viewers, me).map((p) => (
              <View key={p.id} testID={`person-${p.id}`} style={[styles.person, { backgroundColor: c.fill }]}>
                <View style={[styles.face, { backgroundColor: c.line, borderColor: c.fill }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  <Text maxFontSizeMultiplier={FACE_MAX_SCALE} style={[styles.faceText, { color: c.ink }]}>{initialOf(p.name === 'You' ? viewers.find((v) => v.user_id === me)?.name ?? 'You' : p.name)}</Text>
                </View>
                <Txt testID="person-name">{p.name}</Txt>
              </View>
            ))}
          </View>
          <Button label="Close who can see this" text="Close" variant="secondary" onPress={onClose} />
    </BottomSheet>
  );
}

/** MOMENT-6: "More" says who can see it (BETA-AUD-1) and holds, for the sender only, Change the words (CAP-6)
 *  and Delete (BETA-AUD-5). */
function MoreMenu({ visible, post, mine, onDelete, onChangeWords, onClose }: {
  visible: boolean; post: FeedPost; mine: boolean; onDelete: () => void; onChangeWords: () => void; onClose: () => void;
}) {
  const { c } = useTheme();
  const { session } = useApp();
  if (!visible) return null;
  // WHO-7: everyone but the sender gets every name here; the group's name stays with the sender (parents).
  const audience = post.audience
    ? `Shared with ${post.audience.map((a) => `${a.name} · ${people(a.member_count)}`).join(', ')}`
    : post.viewers?.length ? whoCanSee(post.viewers, session?.userId) : 'Shared with you';
  return (
    <BottomSheet testID={`more-${post.post_id}`} onClose={onClose}>
          <Txt variant="title" role="header">Who can see this</Txt>
          <Txt style={{ color: post.audience ? c.ink : c.safe }}>{audience}</Txt>
          {mine ? (
            <>
              {/* RD-50 (DEC-65): the standard words, "Edit description" and "Delete post" (which asks first). */}
              <Button label="Edit description" variant="secondary" onPress={onChangeWords} />
              <Button label="Delete post" variant="danger" onPress={onDelete} />
            </>
          ) : null}
          <Button label="Close this menu" text="Close" variant="secondary" onPress={onClose} />
    </BottomSheet>
  );
}

/** CAP-6: one sheet with the same two boxes as Share, filled in, plus Save and Cancel. Photos never change here.
 *  No notice goes out (CAP-8); a refusal shows its reason in plain words and keeps the old words (CAP-7). */
function WordsSheet({ post, onClose }: { post: FeedPost; onClose: () => void }) {
  const { feed } = useApp();
  const { c, reduceMotion } = useTheme();
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
    <Modal visible animationType={reduceMotion ? 'fade' : 'slide'} presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView testID={`words-${post.post_id}`} style={{ flex: 1, backgroundColor: c.bg }}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
          <Txt variant="title" role="header">Change the words</Txt>
          <Txt variant="muted">The photos stay as they are. Nobody gets a notice.</Txt>
          <Field label="Title (optional)" value={title} onChangeText={setTitle} maxLength={80} />
          <Field label="What's happening?" value={caption} onChangeText={setCaption} multiline maxLength={2000} />
          {error ? <Notice text={error} /> : null}
          <Button variant="secondary" label="Save the new words" text="Save" busy={busy} onPress={() => void save()} />
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
          <Txt numberOfLines={list.length === 1 ? 2 : undefined}><Txt style={{ fontWeight: WEIGHT.medium }}>{c.author_name}</Txt>{` ${c.body}`}</Txt>
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
 *  as one row: the "Add a comment…" field with Post beside it (MOMENT-4, UX-R5/R6, DEC-63). */
function ReplyBox({ post, mine }: { post: FeedPost; mine: boolean }) {
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
  // UX-R5/R6 (DEC-63): the standard "Add a comment…" field; spoken with whose post it is.
  const spoken = mine ? 'Add a comment' : `Add a comment for ${post.author_name}`;
  const typing = useTypingField(); // UX-R1: the tab bar steps aside while typing
  // UX-R10 (RD-42): when exactly the people who can see the post will read my comment, say so in one line
  // (the names are already on the "can see this" line above).
  const others = (post.viewers ?? []).filter((v) => v.user_id !== session?.userId).map((v) => v.name).sort();
  const same = !mine && !!names && others.length > 0 && others.length === names.length && [...names].sort().every((n, i) => n === others[i]);
  // BETA-REPLY-6 + grandparent-ux: name who can read it; never a vague "everyone", never group names.
  // AUD-8/9/10: the server says who will read my reply on this post.
  const scope = post.reply_scope ?? 'everyone';
  const readers = mine
    ? 'The family you shared this photo with can read this.'
    : same ? 'Your comment goes to the same people.'
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
    : { borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, borderRadius: RADIUS.medium };
  return (
    <View style={{ gap: 6 }}>
      <View testID={`reply-${post.post_id}`} style={styles.replyRow}>
        <TextInput
          accessibilityLabel={spoken}
          placeholder="Add a comment…"
          onFocus={typing.onFocus}
          onBlur={typing.onBlur}
          placeholderTextColor={c.muted}
          value={draft}
          onChangeText={(v) => { setSent(false); feed?.setDraft(post.post_id, v); }}
          multiline
          maxLength={500}
          style={[{ flex: 1, minHeight: MIN_TARGET, color: c.ink, paddingHorizontal: 14, paddingVertical: 12, fontSize: t.base }, box]}
        />
        {/* UX-R6: Post is a text button, grey and off while empty, accent once there are words. */}
        <Button variant="quiet" label="Post" onPress={() => void send()} disabled={!draft.trim()} />
      </View>
      {/* BETA-REPLY-6: say who can read it, matching the server (everyone the post was shared with). */}
      <Txt variant="muted">{sent ? sentWords : readers}</Txt>
    </View>
  );
}

/** CAP-4: past about 4 lines the caption folds, with a worded Read more / Show less (no tap on the text needed). */
const FOLD_LINES = 4;
const foldable = (t: string) => t.split('\n').length > FOLD_LINES || t.length > 220;

/** RD-48: the description is one line of text: the sender's name in Medium, then the words in their own Text. */
function Caption({ name, text, testID }: { name: string; text: string; testID: string }) {
  const [open, setOpen] = useState(false);
  const fold = foldable(text);
  return (
    <View style={styles.caption}>
      <Txt testID={testID} numberOfLines={fold && !open ? FOLD_LINES : undefined}>
        <Txt style={{ fontWeight: WEIGHT.medium }}>{name}</Txt>{' '}<Txt>{text}</Txt>
      </Txt>
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
  // The card is edge to edge; its parts keep one 16 pt edge (UX-R8), so Feed's list has no side padding.
  card: { padding: 0, gap: SPACE.sm, marginBottom: SPACE.lg },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md, paddingTop: SPACE.md, paddingBottom: SPACE.xs, paddingLeft: SPACE.lg, paddingRight: SPACE.xs },
  // RD-48: a round 36 pt face; GUX-R1: two letters stop growing past 1.3x so they never clip.
  avatar: { width: 36, height: 36, borderRadius: 18, marginTop: 6, alignItems: 'center', justifyContent: 'center' },
  nameBox: { flex: 1, minWidth: 0, minHeight: MIN_TARGET, justifyContent: 'center' },
  name: { fontSize: 17, fontWeight: WEIGHT.medium },
  more: { minHeight: MIN_TARGET, minWidth: MIN_TARGET, alignItems: 'center', justifyContent: 'center' },
  inset: { paddingHorizontal: SPACE.lg },
  caption: { gap: SPACE.xs },
  fold: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.xs, paddingHorizontal: SPACE.lg },
  react: { minHeight: MIN_TARGET, minWidth: MIN_TARGET, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: SPACE.sm, borderRadius: RADIUS.pill },
  count: { fontVariant: ['tabular-nums'] },
  words: { gap: SPACE.xs, paddingHorizontal: SPACE.lg },
  who: { minHeight: MIN_TARGET, justifyContent: 'center', alignSelf: 'stretch' },
  face: { width: 36, height: 36, borderRadius: RADIUS.pill, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  // FIRSTMIN-1: two letters ("GJ") fit the 32 pt inside the ring at 17 pt with slightly tighter tracking.
  faceText: { fontWeight: WEIGHT.semibold, fontSize: 17, lineHeight: 20, letterSpacing: -0.5 },
  emoji: { fontSize: 22, lineHeight: 28, textAlign: 'center' },
  people: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  person: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, borderRadius: RADIUS.pill, paddingLeft: SPACE.xs, paddingRight: SPACE.md, minHeight: MIN_TARGET },
  newest: { paddingTop: SPACE.sm, paddingHorizontal: SPACE.lg, gap: SPACE.sm },
  seeAll: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  replyRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 12 },
});
