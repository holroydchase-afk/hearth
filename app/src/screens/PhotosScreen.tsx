// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Two screens share this file's state (search, the timeline, the walk, the last visit). Feed (RD-17) is the post
// list, newest first, with everything the old Photos list had. Gallery (SPEC-REDESIGN 1b/1c, RD-44..47) is the
// greeting, the "Search photos" field (it pins under the bar on scroll), New for you's sideways row when others sent
// photos since the last visit (RD-19..21), then the months mosaic (RD-44). Messages and Events moved to More (RD-15);
// By date left Gallery (the months are the by-date view) and opens from Feed's Older photos card.
// Feed is the existing FlatList (Instagram-style posts, 32 pt apart, no lines: RD-48..54).
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, FlatList, RefreshControl, ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp, useFeed } from '../state/AppContext';
import { autoplayOn } from '../state/dataPrefs';
import { AutoplayContext, useAutoplay } from '../feed/autoplay';
import { loadLastSeen, saveLastSeen } from '../state/lastSeen';
import { photosRows, type PhotosRow } from '../feed/events';
import { newForYou } from '../feed/newForYou';
import { earlierGroups, isFromEarlier, monthSpan, startOfNextMonth, type EarlierGroup } from '../feed/timeline';
import { loadFailedWords } from '../errors/loadFailed';
import { Button, Card, EmptyState, ErrorState, Loading, Notice, Txt } from '../ui/kit';
import { andList } from '../ui/format';
import { useTheme } from '../ui/theme';
import { AppGate } from './AppGate';
import { TodayLine } from './Birthdays';
import { EventCard, EventsScreen, EventUpdate, type EventsView } from './EventsScreen';
import { FOLD_AT, GalleryTopBar, LargeGreeting, SearchField, greeting, useFamilyName } from './GalleryTop';
import { GalleryGrid, shadeLine } from './GalleryGrid';
import { NewForYouRow, OneAtATime } from './NewForYou';
import { PostCard } from './PostCard';
import { QueueStatus } from './QueueStatus';
import { YourName } from './YourName';
import { useTabBarSpace } from '../ui/tabBarSpace';

/** BETA-TIME-1: "Older photos. Chase added 48 older photos from July 2024. See them" (opens the timeline at that month). */
function EarlierCard({ g, onOpen }: { g: EarlierGroup; onOpen: () => void }) {
  return (
    <Card testID={`earlier-card-${g.authorId}`}>
      <Txt variant="title2" role="header">Older photos</Txt>
      <Txt>{`${g.authorName} added ${g.photoCount === 1 ? '1 older photo' : `${g.photoCount} older photos`} from ${monthSpan(g.fromAt, g.openAt)}.`}</Txt>
      <Button variant="secondary" label={`See ${g.authorName}'s older photos by date`} text="See them" onPress={onOpen} />
    </Card>
  );
}

/** STATES-7/24: the empty viewer page's "Check again": "Checking…" at once, and "Still nothing yet…" if it comes back empty. */
function CheckAgain({ helper, onCheck }: { helper: string | null; onCheck: () => Promise<void> }) {
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);
  const live = useRef(true);
  useEffect(() => () => { live.current = false; }, []);
  const check = () => {
    setChecking(true);
    void onCheck().finally(() => { if (live.current) { setChecking(false); setChecked(true); } });
  };
  return (
    <EmptyState
      title="No photos yet"
      line={checked ? "Still nothing yet. We'll show photos here as soon as they're shared." : `When ${helper ?? 'your family'} shares photos, they'll show up here.`}
      button={{ label: 'Check again', text: checking ? 'Checking…' : 'Check again', busy: checking, onPress: check }}
    />
  );
}

export type PhotosMode = 'feed' | 'gallery';

// ENG-R6: Search (SEARCH-UI-1) and the timeline (BETA-TIME-2) are screens of their own, pushed on Gallery's and
// Feed's stacks, so this list stays mounted under them (its scroll is kept) and Back returns to it.
const openSearch = () => router.push('/gallery/search');
const openTimeline = (startAt: string) => router.push({ pathname: '/feed/timeline', params: { startAt } });

export function PhotosScreen({ mode = 'feed' }: { mode?: PhotosMode } = {}) {
  const gallery = mode === 'gallery';
  const app = useApp();
  const state = useFeed();
  const { c, dark, reduceMotion } = useTheme();
  // DEC-87 (SPEC-MEDIA 5): Feed only; the Gallery grid never autoplays.
  const autoplay = useAutoplay(!gallery && autoplayOn(app.dataPrefs, reduceMotion));
  const tabRoom = useTabBarSpace(); // RD-109: room under the web's floating tab bar
  // EVT-3/4: the Events list or one event, opened in place; Back returns here.
  const [events, setEvents] = useState<EventsView | null>(null);
  // OPEN-5 (GUX-R4, QA-R1): the last visit, read once when Photos loads. It is saved only once the first network load
  // succeeds, as the time that load started, so a failed or offline open never hides photos she hasn't seen.
  const me = app.session?.userId ?? null;
  const kv = app.deps.kv;
  const [lastSeen, setLastSeen] = useState<{ user: string; at: string | null } | null>(null);
  useEffect(() => {
    if (!me || !gallery) return; // New for you lives on Gallery (the start screen); Feed never moves the last visit
    let live = true;
    void loadLastSeen(kv, me).then((at) => { if (live) setLastSeen({ user: me, at }); });
    return () => { live = false; };
  }, [kv, me, gallery]);
  const saved = useRef<string | null>(null);
  const fetchedAt = state.fetchedAt;
  useEffect(() => {
    if (!me || lastSeen?.user !== me || !fetchedAt || saved.current === me) return;
    saved.current = me;
    void saveLastSeen(kv, me, fetchedAt);
  }, [kv, me, lastSeen, fetchedAt]);
  // EF-HE-9 (B18): once the first network page is in, load older pages back to the last visit, so New for you
  // counts every new post. Until then New for you waits, so its count never jumps.
  const feedStore = app.feed;
  const [backTo, setBackTo] = useState<string | null>(null);
  const backKey = gallery && me && lastSeen?.user === me && lastSeen.at && fetchedAt ? `${me}|${lastSeen.at}|${fetchedAt}` : null;
  useEffect(() => {
    if (!backKey || !feedStore || !lastSeen?.at) return;
    let live = true;
    void feedStore.loadBackTo(lastSeen.at).finally(() => { if (live) setBackTo(backKey); });
    return () => { live = false; };
  }, [backKey, feedStore, lastSeen?.at]);
  // OPEN-7 / RD-21: the new posts one at a time, in place; Back and Done return here.
  const [walk, setWalk] = useState<string[] | null>(null);
  const closeWalk = useCallback(() => setWalk(null), []);
  // RD-11/RD-12: Gallery's greeting, folded into the top bar once the list scrolls past it.
  const familyName = useFamilyName(gallery);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [folded, setFolded] = useState(false);
  // RD-47: the "Search photos" field is the scroll's sticky header, so it pins under the bar; RD-61 (R18): each
  // month's title then sticks right under it (pinAt: the field's height with its 8 pt below).
  const [pinAt, setPinAt] = useState(0);
  const [relayout, setRelayout] = useState(0);
  // RD-82: where the field sits in the scroll; once the list scrolls past it, content is under the pinned bar.
  const fieldAt = useRef(0);
  const [under, setUnder] = useState(false);
  // RD-83: while a month title is pinned under the bar, the shade sits under the title instead (one pinned block).
  const [monthPinned, setMonthPinned] = useState(false);
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    scrollY.setValue(y);
    setFolded(y > FOLD_AT);
    setUnder(y > Math.max(fieldAt.current, 0));
  }, [scrollY]);
  if (app.status !== 'ready' || !app.space || !app.feed) return <AppGate />;
  const feed = app.feed;
  if (walk) {
    // GUX-R7: finishing the walk (Done) marks those posts seen here, so New for you and its "N new" chip go away.
    const finish = () => {
      const newest = Math.max(...state.posts.filter((p) => walk.includes(p.post_id)).map((p) => Date.parse(p.published_at)));
      if (me && Number.isFinite(newest)) setLastSeen((s) => (s && s.user === me && s.at && Date.parse(s.at) >= newest ? s : { user: me, at: new Date(newest).toISOString() }));
      setWalk(null);
    };
    return <OneAtATime postIds={walk} onClose={closeWalk} onDone={finish} />;
  }
  if (events) {
    return (
      <EventsScreen
        posts={state.posts}
        view={events}
        hasMore={state.hasMore}
        loadingMore={state.status === 'loadingMore'}
        onLoadMore={() => void feed.loadMore()}
        onOpen={(eventId) => setEvents({ eventId, fromList: true })}
        onClose={() => setEvents(null)}
      />
    );
  }
  // OPEN-1: others' posts since the last visit on this phone; none on a first open (OPEN-5) or for my own posts.
  const oldest = state.posts[state.posts.length - 1];
  const caughtUp = backTo === backKey || !state.hasMore || !oldest || !lastSeen?.at || Date.parse(oldest.published_at) <= Date.parse(lastSeen.at);
  const fresh = gallery && me && lastSeen?.user === me && caughtUp ? newForYou(state.posts, lastSeen.at, me) : [];
  const senders = andList(state.posts.map((p) => p.author_name));
  // BETA-TIME-1: old photos added today don't take over the top; they go in a card.
  const earlier = earlierGroups(state.posts);
  const recent = state.posts.filter((p) => !isFromEarlier(p));
  // EVT-2/3: an event's first post is a bigger card; its later posts are ordinary cards (EVENT_LATER_POSTS_IN_PHOTOS).
  // MOMENT-7: each upload is its own moment (one card), even several within an hour.
  const rows = photosRows(recent);
  const openEvent = (eventId: string) => setEvents({ eventId, fromList: false });
  // A post card is edge to edge with its own 16 pt edge (UX-R8); everything else in Feed's list gets the 16 pt here.
  const side = gallery ? undefined : { paddingHorizontal: 16 };
  const renderRow = ({ item }: { item: PhotosRow }) =>
    item.type === 'post' ? <PostCard post={item.post} />
      : item.type === 'event' ? <View style={side}><EventCard eventId={item.eventId} eventName={item.eventName} post={item.post} onOpen={() => openEvent(item.eventId)} /></View>
        : item.type === 'update' ? <View style={side}><EventUpdate eventId={item.eventId} eventName={item.eventName} photoCount={item.photoCount} onOpen={() => openEvent(item.eventId)} /></View>
          : null;

  const words = familyName === undefined ? null : greeting(new Date(), familyName);
  const header = (
    <View style={[{ gap: 12 }, side]}>
      {/* RD-11: Gallery's large title is the greeting (shown once the name is known, so it never flips mid-read);
          Feed's title is "Feed" (GUX-R5), the tab's own word. UI-26 still holds: no "Check for new photos" button; pull down to refresh. */}
      {gallery ? null : <Txt variant="largeTitle" role="header">Feed</Txt>}
      {/* CAL-16: on a day with a family date, one line at the top of Gallery ("Today is Grandma Jo's birthday"). */}
      {gallery ? <TodayLine /> : null}
      {/* RD-18: Gallery has no "Sent by" line; the grid tiles and New for you name the senders. */}
      {senders && !gallery ? <Txt tone="muted">{`Sent by ${senders}`}</Txt> : null}
      {fresh.length && lastSeen?.at ? (
        <NewForYouRow posts={fresh} since={lastSeen.at} onSee={() => setWalk(fresh.map((p) => p.post_id))} />
      ) : null}
      {/* SHARE-PC-11 (DEC-73): after a Send, Feed says who it went to, by name, until closed. */}
      {app.shared && !gallery ? <Notice tone="good" text={app.shared} onClose={() => app.setShared(null)} /> : null}
      {app.space.can_post ? <YourName /> : null}
      <QueueStatus />
      {app.pushAsk && state.posts.length ? <PushAsk /> : null}
      {state.notice ? <Notice text={state.notice} onClose={() => feed.clearNotice()} /> : null}
      {/* STATES-3: a failed refresh with photos on the phone keeps them, and this line stays until a refresh works. */}
      {state.failed && state.posts.length ? (
        <ErrorState line={state.failed === 'network' ? 'No signal right now. Showing the photos saved on this phone.' : 'Something went wrong. Showing the photos saved on this phone.'} onRetry={() => void feed.retry()} />
      ) : null}
      {/* BETA-TIME-1 on Feed; on Gallery old photos sit in their own months in the grid (RD-18, QA-R2). */}
      {gallery ? null : earlier.map((g) => (
        <EarlierCard key={g.authorId} g={g} onOpen={() => openTimeline(startOfNextMonth(g.openAt))} />
      ))}
    </View>
  );

  // STATES-1..8: failed, loading, or empty, in that order of care. "Failed" is never read as "empty".
  const failedWords = state.failed ? loadFailedWords(state.failed, { helper: app.helper, photos: true }) : null;
  const empty = state.failed && !state.posts.length ? (
    <View style={side}>
      {state.status === 'idle' && failedWords
        ? <ErrorState title={failedWords.title} line={failedWords.line} onRetry={() => void feed.retry()} />
        : <Loading words="Loading the photos…" />}
    </View>
  ) : state.loaded && (gallery ? state.posts.length : earlier.length) ? null : !state.loaded ? (
    <View style={side}><Loading words="Loading the photos…" /></View>
  ) : (
    <View style={side}>
      {app.space.can_post ? (
        <EmptyState
          title="No photos yet"
          line="Share your first photos and your family will see them here."
          button={{ label: 'Share photos', onPress: () => router.navigate('/share') }}
        />
      ) : (
        <CheckAgain helper={app.helper} onCheck={() => feed.refresh()} />
      )}
    </View>
  );

  const older = state.hasMore ? (
    <View style={side}>
      <Button label="Show older photos" variant="secondary" busy={state.status === 'loadingMore'} onPress={() => void feed.loadMore()} />
    </View>
  ) : undefined;
  const refresh = <RefreshControl refreshing={state.status === 'refreshing'} onRefresh={() => void feed.refresh()} />;

  if (gallery) {
    // RD-18: a ScrollView, not a FlatList: a page is 20 posts of thumbnails, and every month block shows at once.
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: c.bg }}>
        <GalleryTopBar words={words} folded={folded} />
        <ScrollView
          testID="gallery-scroll"
          onScroll={onScroll}
          scrollEventThrottle={16}
          refreshControl={refresh}
          // RD-47: child 1 (the field) is sticky. Children 0 and 1 are never null, so the index holds.
          stickyHeaderIndices={[1]}
          onContentSizeChange={() => setRelayout((n) => n + 1)}
          contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 + tabRoom }}
          // GUX-T6: on the web, focus and scroll-into-view stop above the floating tab bar (WCAG 2.4.11), not under it.
          style={tabRoom ? ({ scrollPaddingBottom: tabRoom } as object) : undefined}
          keyboardShouldPersistTaps="handled"
        >
          {/* RD-11 / RD-55: the greeting is the large title; RD-47: the "Search photos" field right under it. */}
          <View style={words ? null : { marginBottom: -16 }}>{words ? <LargeGreeting words={words} scrollY={scrollY} /> : null}</View>
          {/* RD-82 (Chase, Nov 17): the pinned bar's backing spans the full screen width (it steps out of the scroll's
              16 pt padding and puts it back inside), so nothing shows past its edges; a soft shade below it once
              content is under it, none at the top. */}
          <View
            style={{ backgroundColor: c.bg, paddingBottom: 8, marginBottom: -8, marginHorizontal: -16, paddingHorizontal: 16 }}
            onLayout={(e) => { setPinAt(e.nativeEvent.layout.height); fieldAt.current = e.nativeEvent.layout.y; }}
          >
            <SearchField testID="search-field" onPress={openSearch} />
            {under && !monthPinned ? <View testID="search-bar-shade" pointerEvents="none" accessible={false} style={[shadeLine(dark), { backgroundColor: c.line }]} /> : null}
          </View>
          {header}
          {empty}
          {state.posts.length ? <GalleryGrid posts={state.posts} scrollY={scrollY} pinAt={pinAt} relayout={relayout} onPinned={setMonthPinned} /> : null}
          {older}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: c.bg }}>
      <AutoplayContext.Provider value={autoplay.now}>
      <FlatList
        {...autoplay.listProps}
        scrollEventThrottle={16}
        data={rows}
        keyExtractor={(r) => r.key}
        renderItem={renderRow}
        ListHeaderComponent={header ?? undefined}
        ListEmptyComponent={empty ?? undefined}
        ListFooterComponent={older}
        onEndReached={() => void feed.loadMore()}
        onEndReachedThreshold={0.5}
        refreshControl={refresh}
        // RD-52: 32 pt between posts, no lines: this 16 pt gap plus each post's own 16 pt below it. No side padding:
        // a post keeps its own 16 pt edge (UX-R8), and the rest get theirs above.
        contentContainerStyle={{ paddingTop: 16, gap: 16, paddingBottom: 32 + tabRoom }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets // UX-R1: on iPhone the comment field scrolls up above the keyboard
        removeClippedSubviews={false}
      />
      </AutoplayContext.Provider>
    </SafeAreaView>
  );
}

/** HIG-1 (Apple: ask when it's needed and say why first): after the first photo shows, one card explains notices
 *  before the phone's own "Allow notifications?" A no on the phone can only be undone in its Settings, so it is
 *  never asked cold at launch. Not now hides the card for good; How should we tell you (Help or Me) stays. */
function PushAsk() {
  const app = useApp();
  return (
    <Card testID="push-ask">
      <Txt variant="title2" role="header">Get a notice when the family shares photos?</Txt>
      <Txt>Your phone will ask next. Tap Allow to get a notice for new photos.</Txt>
      <Button variant="secondary" label="Turn on notices" icon={{ sf: 'bell', md: 'notifications' }} onPress={() => void app.askPush()} />
      <Button label="Not now, maybe later" text="Not now" variant="quiet" onPress={app.skipPushAsk} />
    </Card>
  );
}
