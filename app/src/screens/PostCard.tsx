// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
import React, { memo, useEffect, useRef, useState } from 'react';
import { Animated, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { REACTIONS, type FeedPost, type Reaction } from '../api/HearthApi';
import type { CommentView } from '../feed/store';
import { useApp, useFeedSelect } from '../state/AppContext';
import { AlertDialog, BottomSheet, Button, Card, Field, Notice, SystemIcon, Txt, noWebOutline, useWebFocusRing } from '../ui/kit';
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

const NO_COMMENTS: CommentView[] = [];

export const PostCard = memo(function PostCard({ post }: { post: FeedPost }) {
  const { feed, session } = useApp();
  const comments = useFeedSelect((s) => s.comments[post.post_id]); // ENG-R3: this post's comments only
  const { c, t, reduceMotion } = useTheme();
  const ready = post.media.filter((m) => m.status === 'ready');
  const mine = post.author_id === session?.userId;
  const [sheet, setSheet] = useState<'comments' | 'more' | 'delete' | 'words' | null>(null);

  useEffect(() => {
    if (post.comment_count > 0) void feed?.loadComments(post.post_id);
  }, [feed, post.post_id, post.comment_count > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const list: CommentView[] = comments ?? NO_COMMENTS;
  const newest = list[list.length - 1];
  const nComments = Math.max(list.length, post.comment_count);
  // REACT-2: my reaction and each kind's count, most first; hearts only until reaction_summary answers.
  const mineNow = post.my_reaction !== undefined ? post.my_reaction : post.i_hearted ? '❤️' : null;
  const counts = post.reaction_counts ?? (post.heart_count ? { '❤️': post.heart_count } : {});
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
        {REACTIONS.map((e) => (
          <ReactionButton
            key={e}
            emoji={e}
            n={counts[e] ?? 0}
            on={mineNow === e}
            first={e === REACTIONS[0]}
            onPress={() => { haptic('tap'); void feed?.react(post.post_id, e); }}
          />
        ))}
      </View>
      <View style={styles.words}>
        {/* RD-71 (UX-R28): no heading above the words; the title opens the description in Medium. */}
        {post.title || post.caption ? <Caption testID={`desc-${post.post_id}`} titleID={`post-title-${post.post_id}`} title={post.title ?? null} text={post.caption ?? ''} /> : null}
        {/* RD-51: "Just now", "3 hours ago", "Yesterday", "Nov 3"; CAP-6's "· Edited" after it. */}
        <Txt variant="muted" testID={`when-${post.post_id}`}>{when}</Txt>
        {/* WHO-6 / DEC-60: the quiet privacy line stays on every post. */}
        {viewers ? <WhoLine post={post} viewers={viewers} me={session?.userId} onPress={() => setWhoOpen(true)} /> : null}
      </View>
      <View style={styles.newest}>
        {/* UX-R5 (DEC-63), RD-59 (UX-R16): a standard comment area on every post, with no heading: the field's own
            words and spoken label say what it is. */}
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
      {/* RD-67 (UX-R24): the phone's own kind of alert, the same words for one photo or many. */}
      {sheet === 'delete' ? (
        <AlertDialog
          title="Delete this post?"
          body="It will be gone from everyone's phone."
          keep="Keep it"
          destroy="Delete"
          onKeep={() => setSheet(null)}
          onDestroy={() => { setSheet(null); void feed?.deletePost(post.post_id); }}
        />
      ) : null}
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

/** GUX-R6 (Chase, Nov 16: "Names", DEC-60): the others who can see it, in words. RD-70 (UX-R27): one line, so at
 *  most two names, then "and N more"; when two long names would wrap at default size on a 390 pt phone, one name
 *  and "N more". People only, never a group's title (DEC-49). The spoken label and the Who sheet keep everyone. */
export function namesLine(viewers: Viewer[], me: string | undefined, bigText = false): string {
  const others = viewers.filter((v) => v.user_id !== me).map((v) => v.name);
  if (!others.length) return 'Only you can see this.';
  const line = (shown: number) => {
    const rest = others.length - shown;
    const list = rest <= 0 ? andList(others) : `${others.slice(0, shown).join(', ')} and ${rest} more`;
    return `${list} can see this.`;
  };
  // UX-R35: Bigger text fits one name on the line, so it always names one person then "and N more".
  if (bigText && others.length > 2) return line(1);
  const two = line(Math.min(2, others.length));
  return two.length <= ONE_LINE_CHARS || others.length < 2 ? two : line(1);
}

/** About how many characters of 17 pt body text fit one line across a 390 pt phone inside the 16 pt edges. */
const ONE_LINE_CHARS = 44;

/** GUX-R6: one 48 pt button with the names line; a tap shows everyone (the Who sheet). Replaces WHO-10's circles. */
function WhoLine({ post, viewers, me, onPress }: { post: FeedPost; viewers: Viewer[]; me: string | undefined; onPress: () => void }) {
  const { c, bigText } = useTheme();
  return (
    <Pressable testID={`who-${post.post_id}`} accessibilityRole="button" accessibilityLabel={whoCanSee(viewers, me, 3)}
      accessibilityHint="Shows everyone who can see this" onPress={onPress} hitSlop={4} style={styles.who}>
      <Txt style={{ color: c.muted }}>{namesLine(viewers, me, bigText)}</Txt>
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
  // WHO-7: everyone but the sender gets every name here; the group's name stays with the sender (parents, DEC-49).
  // UX-R33: "Shared with <group>, N people" is the first line on my own post, with no heading above it.
  // UX-R34: the names are a sentence in the normal text color, ending with a period.
  const audience = post.audience
    ? `Shared with ${post.audience.map((a) => `${a.name}, ${people(a.member_count)}`).join('; ')}`
    : post.viewers?.length ? `${whoCanSee(post.viewers, session?.userId)}.` : 'Shared with you.';
  return (
    <BottomSheet testID={`more-${post.post_id}`} onClose={onClose}>
          {mine ? null : <Txt variant="title" role="header">Who can see this</Txt>}
          <Txt style={{ color: c.ink }}>{audience}</Txt>
          {mine ? (
            <View>
              {/* RD-50 (DEC-65): the standard words, "Edit description" and "Delete post" (which asks first). RD-57
                  (UX-R14): plain rows like the phone's own menus; Delete post is red words, never a red pill. */}
              <SheetRow label="Edit description" icon={{ sf: 'pencil', md: 'edit' }} color={c.ink} onPress={onChangeWords} />
              <View style={[styles.rowLine, { backgroundColor: c.line }]} />
              <SheetRow label="Delete post" icon={{ sf: 'trash', md: 'delete' }} color={c.dangerText} onPress={onDelete} />
            </View>
          ) : null}
          <Button label="Close this menu" text="Close" variant="secondary" onPress={onClose} />
    </BottomSheet>
  );
}

/** RD-57: one plain menu row: an outline icon, then the words at the left, 48 pt+ tall, on the sheet's own color. */
function SheetRow({ label, icon, color, onPress }: { label: string; icon: { sf: string; md: string }; color: string; onPress: () => void }) {
  const { t } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={({ pressed }) => [styles.sheetRow, { opacity: pressed ? 0.6 : 1 }]}>
      <SystemIcon icon={icon} color={color} />
      <Text style={{ flex: 1, color, fontSize: t.base, lineHeight: t.line }}>{label}</Text>
    </Pressable>
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
  // REPLY-11 (0011): the server names exactly who will read my reply; until it answers (or if the call fails)
  // the box falls back to the reply_scope words.
  const [names, setNames] = useState<string[] | null>(null);
  useEffect(() => {
    if (mine) return undefined;
    let alive = true;
    deps.api.replyReaders(post.post_id)
      .then((n) => { if (alive && n?.length) setNames(n); })
      .catch(() => {});
    return () => { alive = false; };
  }, [deps.api, post.post_id, mine]);
  const draft = useFeedSelect((s) => s.drafts[post.post_id]) ?? ''; // ENG-R3: this post's draft only
  const [sent, setSent] = useState(false);
  // UX-R5/R6 (DEC-63): the standard "Add a comment…" field; spoken with whose post it is.
  const spoken = mine ? 'Add a comment' : `Add a comment for ${post.author_name}`;
  const typing = useTypingField(); // UX-R1: the tab bar steps aside while typing
  const [focused, setFocused] = useState(false);
  // UX-R10 (RD-42): when exactly the people who can see the post will read my comment, say so in one line
  // (the names are already on the "can see this" line above).
  const others = (post.viewers ?? []).filter((v) => v.user_id !== session?.userId).map((v) => v.name).sort();
  const same = !mine && !!names && others.length > 0 && others.length === names.length && [...names].sort().every((n, i) => n === others[i]);
  // BETA-REPLY-6 + grandparent-ux: name who can read it; never a vague "everyone", never group names.
  // AUD-8/9/10: the server says who will read my reply on this post.
  const scope = post.reply_scope ?? 'everyone';
  // RD-58 (UX-R15): on my own post the names line already says who can see it, so no second line here.
  const readers = mine
    ? null
    // RD-69 (UX-R26): only while commenting; a narrower reader list (below) always shows.
    : same ? (focused || draft.trim() ? 'Your comment goes to the same people.' : null)
    : names ? `${readerNames(names)} will read this.`
    : scope === 'parents' ? "Only the kids' parents can read this."
    : scope === 'group' ? "The kids' parents and your part of the family can read this."
    : `${post.author_name} and the family ${post.author_name} shared this photo with can read this.`;
  const sentWords = mine
    ? 'Sent.'
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

  // RD-59 (UX-R16): one rounded field, like Instagram's and Messages': a quiet fill (an edge on Android), the words,
  // and Post inside it at the right end once there are words. The text input itself draws no second box.
  const box = os === 'android' ? { borderWidth: 1, borderColor: c.muted } : { backgroundColor: c.fill };
  // UX-R31: on the web the browser's square outline is off; focus draws a 2 pt ring on the field's own rounded edge.
  const ring = useWebFocusRing(focused);
  const words = sent ? sentWords : readers;
  return (
    <View style={{ gap: 6 }}>
      <View testID={`reply-${post.post_id}`} style={[styles.replyRow, box, ring]}>
        <TextInput
          accessibilityLabel={spoken}
          placeholder="Add a comment…"
          onFocus={() => { setFocused(true); typing.onFocus(); }}
          onBlur={() => { setFocused(false); typing.onBlur(); }}
          placeholderTextColor={c.muted}
          value={draft}
          onChangeText={(v) => { setSent(false); feed?.setDraft(post.post_id, v); }}
          multiline
          // The web's textarea starts two rows tall; one row, like the phone, until the words wrap.
          {...(Platform.OS === 'web' ? { rows: 1 } : {})}
          maxLength={500}
          // UX-R36/R40: a 1.3x line (22 at 17 pt, 28 at 21 pt) in (48 - line)/2 padding keeps the field 48 tall and
          // the words centered on Post at default and Bigger text.
          style={{ flex: 1, minHeight: MIN_TARGET, color: c.ink, paddingLeft: SPACE.lg, paddingRight: SPACE.sm, paddingVertical: (MIN_TARGET - commentLine(t.base)) / 2, fontSize: t.base, lineHeight: commentLine(t.base), borderWidth: 0, ...noWebOutline() }}
        />
        {/* UX-R6 / RD-59: Post is a text button inside the field, grey and off while empty, accent once there are words. */}
        <Button variant="quiet" label="Post" onPress={() => void send()} disabled={!draft.trim()} style={styles.post} />
      </View>
      {/* BETA-REPLY-6: say who can read it, matching the server (everyone the post was shared with). */}
      {words ? <Txt variant="muted">{words}</Txt> : null}
    </View>
  );
}

/** UX-R40: the comment line is at least 1.3x the text, rounded up to an even number so the padding is whole. */
const commentLine = (size: number) => 2 * Math.ceil(Math.round(1.3 * size) / 2);

/** CAP-4: past about 4 lines the caption folds, with a worded Read more / Show less (no tap on the text needed). */
const FOLD_LINES = 4;
const foldable = (t: string) => t.split('\n').length > FOLD_LINES || t.length > 220;

/** UX-R32: the description is just the words (the sender's name is on the row above). RD-71 (UX-R28): a post with
 *  a title opens with the title in Medium, then " – " (an en dash) and the words. */
function Caption({ title, text, testID, titleID }: { title: string | null; text: string; testID: string; titleID: string }) {
  const [open, setOpen] = useState(false);
  const fold = foldable(text);
  return (
    <View style={styles.caption}>
      <Txt testID={testID} numberOfLines={fold && !open ? FOLD_LINES : undefined}>
        {title ? <Txt testID={titleID} style={{ fontWeight: WEIGHT.medium }}>{title}</Txt> : null}{title && text ? ' – ' : null}{text ? <Txt>{text}</Txt> : null}
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

/** RD-89 (DEC-67, Chase Nov 18: "pop reactions"): turning a reaction on pops its emoji 1 → 1.25 → 1 in 220 ms, by
 *  transform only, so nothing around it moves; turning it off doesn't pop. The save never waits for the pop.
 *  RD-90: with Reduce Motion on, no pop; the picked outline just appears. Chase, Nov 18: the count's width is kept even
 *  at 0, so the first "1" doesn't widen the button. */
const POP = { up: 100, down: 120 } as const;
function ReactionButton({ emoji, n, on, first, onPress }: { emoji: Reaction; n: number; on: boolean; first: boolean; onPress: () => void }) {
  const { c, t, reduceMotion } = useTheme();
  const { fontScale } = useWindowDimensions();
  // One tabular digit is about 0.6 of the text size on every phone font; 0.7 leaves room.
  const slot = Math.ceil(t.base * 0.7 * Math.max(fontScale || 1, 1));
  const scale = useRef(new Animated.Value(1)).current;
  const press = () => {
    if (!on && !reduceMotion) {
      const native = Platform.OS !== 'web';
      scale.stopAnimation();
      scale.setValue(1);
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.25, duration: POP.up, useNativeDriver: native }),
        Animated.timing(scale, { toValue: 1, duration: POP.down, useNativeDriver: native }),
      ]).start();
    }
    onPress();
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={LABEL[emoji]}
      accessibilityState={{ selected: on }}
      accessibilityValue={n ? { text: String(n) } : undefined}
      onPress={press}
      // RD-114 (DEC-76, Chase Nov 20: no "lighter oval"): picked is a 2 pt accent outline with an accent count, no
      // fill; unpicked a 1 pt c.line outline. RD-116: padding gives back the extra 1 pt, so the box never changes size.
      style={({ pressed }) => [styles.react, first ? styles.firstReact : null, on ? styles.reactOn : styles.reactOff, { borderColor: on ? c.accent : c.line, opacity: pressed ? 0.7 : 1 }]}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Text style={styles.emoji}>{emoji}</Text>
      </Animated.View>
      {/* Chase, Nov 18: the count's slot keeps its width at 0 (an empty space as wide as one digit), so the first
          "1" doesn't widen the button or move its neighbours. */}
      {n ? (
        <Text style={[styles.count, { color: on ? c.accent : c.ink, fontSize: t.base, minWidth: slot }]}>{String(n)}</Text>
      ) : (
        <View testID="count-slot" style={{ width: slot }} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // The card is edge to edge; its parts keep one 16 pt edge (UX-R8), so Feed's list has no side padding.
  card: { padding: 0, gap: SPACE.sm, marginBottom: SPACE.lg },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md, paddingTop: SPACE.md, paddingBottom: SPACE.xs, paddingLeft: SPACE.lg, paddingRight: SPACE.xs },
  // RD-48: a round 36 pt face; GUX-R1: two letters stop growing past 1.3x so they never clip.
  avatar: { width: 36, height: 36, borderRadius: 18, marginTop: 6, alignItems: 'center', justifyContent: 'center' },
  nameBox: { flex: 1, minWidth: 0, minHeight: MIN_TARGET, justifyContent: 'center' },
  // RD-65 (R22): the name is body size, so it grows with Bigger text like the words around it.
  name: { fontWeight: WEIGHT.medium },
  more: { minHeight: MIN_TARGET, minWidth: MIN_TARGET, alignItems: 'center', justifyContent: 'center' },
  inset: { paddingHorizontal: SPACE.lg },
  caption: { gap: SPACE.xs },
  fold: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.xs, paddingHorizontal: SPACE.lg },
  // RD-64 (R21): the first emoji's glyph sits on the 16 pt edge; its tap area and highlight reach 8 pt past it.
  firstReact: { marginLeft: -SPACE.sm },
  react: { minHeight: MIN_TARGET, minWidth: MIN_TARGET, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: RADIUS.pill, backgroundColor: 'transparent' },
  // RD-116: border + padding is 8 pt a side either way (1 + 7 unpicked, 2 + 6 picked), so the box never changes
  // size and, with firstReact's -8, the first emoji still sits on the 16 pt edge (RD-64).
  reactOff: { borderWidth: 1, paddingHorizontal: SPACE.sm - 1, paddingVertical: 1 },
  reactOn: { borderWidth: 2, paddingHorizontal: SPACE.sm - 2, paddingVertical: 0 },
  count: { fontVariant: ['tabular-nums'] },
  words: { gap: SPACE.xs, paddingHorizontal: SPACE.lg },
  // UX-R35: 12 pt above the words in both views (the 4 pt gap plus 8 pt here); the 48 pt target grows below them.
  who: { minHeight: MIN_TARGET, justifyContent: 'flex-start', paddingTop: SPACE.sm, alignSelf: 'stretch' },
  face: { width: 36, height: 36, borderRadius: RADIUS.pill, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  // FIRSTMIN-1: two letters ("GJ") fit the 32 pt inside the ring at 17 pt with slightly tighter tracking.
  faceText: { fontWeight: WEIGHT.semibold, fontSize: 17, lineHeight: 20, letterSpacing: -0.5 },
  emoji: { fontSize: 22, lineHeight: 28, textAlign: 'center' },
  people: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  person: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, borderRadius: RADIUS.pill, paddingLeft: SPACE.xs, paddingRight: SPACE.md, minHeight: MIN_TARGET },
  newest: { paddingTop: SPACE.sm, paddingHorizontal: SPACE.lg, gap: SPACE.sm },
  seeAll: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  replyRow: { flexDirection: 'row', alignItems: 'flex-end', minHeight: MIN_TARGET, borderRadius: RADIUS.pill, paddingRight: SPACE.xs, overflow: 'hidden' },
  post: { paddingHorizontal: SPACE.md },
  sheetRow: { minHeight: MIN_TARGET, alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: SPACE.md, paddingVertical: SPACE.sm },
  rowLine: { height: StyleSheet.hairlineWidth, marginLeft: 34 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 12 },
});
