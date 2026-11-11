// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PhotosDemoTip } from '../demo/DemoTip';
import { useApp, useFeed } from '../state/AppContext';
import { loadLastSeen, saveLastSeen } from '../state/lastSeen';
import { eventList, photosRows, type PhotosRow } from '../feed/events';
import { newForYou } from '../feed/newForYou';
import { earlierGroups, isFromEarlier, monthSpan, startOfNextMonth, type EarlierGroup } from '../feed/timeline';
import { Button, Card, IconButton, Loading, Notice, Txt } from '../ui/kit';
import { andList } from '../ui/format';
import { useTheme } from '../ui/theme';
import { AppGate } from './AppGate';
import { EventCard, EventsScreen, EventUpdate, type EventsView } from './EventsScreen';
import { MessagesScreen } from './MessagesScreen';
import { NewForYouCard, OneAtATime } from './NewForYou';
import { PhotoWall } from './PhotoWall';
import { PostCard } from './PostCard';
import { QueueStatus } from './QueueStatus';
import { SearchScreen } from './SearchScreen';
import { TimelineScreen } from './TimelineScreen';
import { YourName } from './YourName';

/** BETA-TIME-1: "Older photos. Chase added 48 older photos from July 2024. See them" (opens the timeline at that month). */
function EarlierCard({ g, onOpen }: { g: EarlierGroup; onOpen: () => void }) {
  return (
    <Card testID={`earlier-card-${g.authorId}`}>
      <Txt variant="title" role="header">Older photos</Txt>
      <Txt>{`${g.authorName} added ${g.photoCount === 1 ? '1 older photo' : `${g.photoCount} older photos`} from ${monthSpan(g.fromAt, g.openAt)}.`}</Txt>
      <Button label={`See ${g.authorName}'s older photos by date`} text="See them" onPress={onOpen} />
    </Card>
  );
}

// LIVE-2: the toolbar sits at the top right; with Bigger text it wraps instead of squeezing.
const TOOLBAR = { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 4 } as const;

export function PhotosScreen() {
  const app = useApp();
  const state = useFeed();
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  // BETA-TIME-2: the timeline opens in place; "Back to Photos" returns here.
  const [timeline, setTimeline] = useState<{ startAt: string | null } | null>(null);
  // EVT-3/4: the Events list or one event, opened in place; Back returns here.
  const [events, setEvents] = useState<EventsView | null>(null);
  // SPEC-MESSENGER: Messages opens in place too; Back returns here.
  const [messages, setMessages] = useState(false);
  // SEARCH-UI-1: Search opens in place too; Back returns here.
  const [search, setSearch] = useState(false);
  // OPEN-5: the last visit, read once when Photos loads and then set to now, so the card stays for this visit.
  const me = app.session?.userId ?? null;
  const kv = app.deps.kv;
  const [lastSeen, setLastSeen] = useState<{ user: string; at: string | null } | null>(null);
  useEffect(() => {
    if (!me) return;
    let live = true;
    void loadLastSeen(kv, me).then((at) => {
      if (!live) return;
      setLastSeen({ user: me, at });
      void saveLastSeen(kv, me, new Date().toISOString());
    });
    return () => { live = false; };
  }, [kv, me]);
  // OPEN-7: the new posts one at a time; OPEN-9: the photo wall. Both open in place; Back returns here.
  const [walk, setWalk] = useState<string[] | null>(null);
  const [wall, setWall] = useState(false);
  const closeWalk = useCallback(() => setWalk(null), []);
  const closeWall = useCallback(() => setWall(false), []);
  if (app.status !== 'ready' || !app.space || !app.feed) return <AppGate />;
  const feed = app.feed;
  if (messages) return <MessagesScreen onClose={() => setMessages(false)} />;
  if (search) return <SearchScreen onClose={() => setSearch(false)} />;
  if (walk) return <OneAtATime postIds={walk} onClose={closeWalk} />;
  if (wall) return <PhotoWall onClose={closeWall} />;
  if (timeline) return <TimelineScreen startAt={timeline.startAt} onClose={() => setTimeline(null)} />;
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
  const fresh = me && lastSeen?.user === me ? newForYou(state.posts, lastSeen.at, me) : [];
  const senders = andList(state.posts.map((p) => p.author_name));
  // BETA-TIME-1: old photos added today don't take over the top; they go in a card.
  const earlier = earlierGroups(state.posts);
  const recent = state.posts.filter((p) => !isFromEarlier(p));
  // EVT-2/3: an event's first post is a bigger card; its later posts are ordinary cards (EVENT_LATER_POSTS_IN_PHOTOS).
  // MOMENT-7: each upload is its own moment (one card), even several within an hour.
  const rows = photosRows(recent);
  const hasEvents = eventList(state.posts).length > 0;
  const openEvent = (eventId: string) => setEvents({ eventId, fromList: false });
  const renderRow = ({ item }: { item: PhotosRow }) =>
    item.type === 'post' ? <PostCard post={item.post} />
      : item.type === 'event' ? <EventCard eventId={item.eventId} eventName={item.eventName} post={item.post} onOpen={() => openEvent(item.eventId)} />
        : item.type === 'update' ? <EventUpdate eventId={item.eventId} eventName={item.eventName} photoCount={item.photoCount} onOpen={() => openEvent(item.eventId)} />
          : null;

  const header = (
    <View style={{ gap: 12 }}>
      {/* LIVE-2 (Chase, Nov 5): Messages, By date, Search and Events are everyday actions, so they sit as compact icon
          buttons (a word under each) in a toolbar above the big title, like the phone's own large-title screens.
          UI-26 still holds: no "Check for new photos" button; photos refresh on their own and on pull-down. */}
      <View testID="photos-toolbar" style={TOOLBAR}>
        <IconButton label="Messages" text="Messages" icon={{ sf: 'bubble.left.and.bubble.right', md: 'chat' }} onPress={() => setMessages(true)} />
        {state.loaded && state.posts.length ? (
          <IconButton label="Show photos by the date they were taken" text="By date" icon={{ sf: 'arrow.up.arrow.down', md: 'sort' }} onPress={() => setTimeline({ startAt: null })} />
        ) : null}
        {state.loaded && state.posts.length ? (
          <IconButton label="Search the photos" text="Search" icon={{ sf: 'magnifyingglass', md: 'search' }} onPress={() => setSearch(true)} />
        ) : null}
        {state.loaded && state.posts.length ? (
          <IconButton label="See all photos as a wall" text="Wall" icon={{ sf: 'square.grid.3x3', md: 'grid_view' }} onPress={() => setWall(true)} />
        ) : null}
        {hasEvents ? (
          <IconButton label="See events" text="Events" icon={{ sf: 'calendar', md: 'event' }} onPress={() => setEvents({ eventId: null, fromList: true })} />
        ) : null}
      </View>
      <Txt variant="display" role="header">{`Photos of ${app.space.name}`}</Txt>
      {senders ? <Txt variant="muted">{`Sent by ${senders}`}</Txt> : null}
      {fresh.length && lastSeen?.at ? (
        <NewForYouCard posts={fresh} since={lastSeen.at} onSee={() => setWalk(fresh.map((p) => p.post_id))} />
      ) : null}
      <PhotosDemoTip width={width} />
      {app.space.can_post ? <YourName /> : null}
      <QueueStatus />
      {app.pushAsk && state.posts.length ? <PushAsk /> : null}
      {state.notice ? <Notice text={state.notice} onClose={() => feed.clearNotice()} /> : null}
      {earlier.map((g) => (
        <EarlierCard key={g.authorId} g={g} onOpen={() => setTimeline({ startAt: startOfNextMonth(g.openAt) })} />
      ))}
    </View>
  );

  const empty = state.loaded && earlier.length ? null : !state.loaded ? (
    <Loading words="Loading the photos…" />
  ) : (
    <Txt variant="muted">
      {app.space.can_post
        ? 'Nothing shared yet. Tap Share to send your first photos.'
        : `No photos yet. When ${app.helper ?? 'your family'} shares photos, they'll show up here.`}
    </Txt>
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: c.bg }}>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.key}
        renderItem={renderRow}
        ListHeaderComponent={header ?? undefined}
        ListEmptyComponent={empty ?? undefined}
        ListFooterComponent={
          state.hasMore ? (
            <Button label="Show older photos" variant="secondary" busy={state.status === 'loadingMore'} onPress={() => void feed.loadMore()} />
          ) : undefined
        }
        onEndReached={() => void feed.loadMore()}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={state.status === 'refreshing'} onRefresh={() => void feed.refresh()} />}
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={false}
      />
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
      <Txt variant="title" role="header">Get a notice when the family shares photos?</Txt>
      <Txt>Your phone will ask next. Tap Allow to get a notice for new photos.</Txt>
      <Button label="Turn on notices" icon={{ sf: 'bell', md: 'notifications' }} onPress={() => void app.askPush()} />
      <Button label="Not now, maybe later" text="Not now" variant="quiet" onPress={app.skipPushAsk} />
    </Card>
  );
}
