// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// SPEC-GROUPS v2, EVT-2..4: the event card and update line shown in Photos, and the Events section
// (opened in place from a "See events" button at the top of Photos, like the timeline; not a tab).
// EVT-6..9: inside an event, one timeline of everyone's photos by when they were taken (feed/eventTimeline.ts).
import React, { useState } from 'react';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { FeedPost } from '../api/HearthApi';
import { eventCountWords, eventList, eventPosts, updateWords } from '../feed/events';
import { eventContributors, eventTimeline, type EventPhoto, type EventTimelineRow } from '../feed/eventTimeline';
import { loadFailedWords } from '../errors/loadFailed';
import { BackButton, Button, Card, ErrorState, Txt } from '../ui/kit';
import { RADIUS, useTheme } from '../ui/theme';
import { PhotoSwipe } from './PhotoSwipe';
import { PostCard } from './PostCard';
import { useTabBarSpace } from '../ui/tabBarSpace';
import { useApp, useFeed } from '../state/AppContext';

/** EVT-2: the first post of an event, bigger, under the event's name. */
export function EventCard({ eventId, eventName, post, onOpen }: { eventId: string; eventName: string; post: FeedPost; onOpen: () => void }) {
  const { c } = useTheme();
  return (
    <View testID={`event-card-${eventId}`} style={{ gap: 12, padding: 12, borderRadius: RADIUS.medium, borderWidth: 1, borderColor: c.line, backgroundColor: c.bg }}>
      <Txt variant="title1" role="header">{eventName}</Txt>
      <PostCard post={post} />
      <Button variant="secondary" label={`Open ${eventName}`} onPress={onOpen} />
    </View>
  );
}

/** EVT-3: later posts to an event, as one line that opens it. */
export function EventUpdate({ eventId, eventName, photoCount, onOpen }: { eventId: string; eventName: string; photoCount: number; onOpen: () => void }) {
  return (
    <Card testID={`event-update-${eventId}`}>
      <Txt variant="headline">{updateWords(photoCount, eventName)}</Txt>
      <Button label={`Open ${eventName} to see the new photos`} text="See the new photos" variant="secondary" onPress={onOpen} />
    </Card>
  );
}

export interface EventsView {
  /** The open event, or null for the list. */
  eventId: string | null;
  /** Opened from the Events list (Back goes to the list) or straight from Photos (Back goes to Photos). */
  fromList: boolean;
}

/** EVT-4: the events list, or one event's posts. */
export function EventsScreen({ posts, view, hasMore, loadingMore, onLoadMore, onOpen, onClose, backTo = 'Gallery' }: {
  posts: FeedPost[];
  view: EventsView;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onOpen: (eventId: string | null) => void;
  onClose: () => void;
  /** Where the list's Back goes: "More" from the More menu (RD-15). */
  backTo?: string;
}) {
  const { c } = useTheme();
  const app = useApp();
  const isParent = app.space?.role === 'owner' || app.space?.role === 'adult';
  const under = useTabBarSpace(); // RD-109: room under the web's floating tab bar
  // STATES-13: the list is built from the Feed, so a Feed that failed to load is an error here, never "No events yet."
  const failed = useFeed().failed;
  const more = hasMore ? <Button label="Show older photos" variant="secondary" busy={loadingMore} onPress={onLoadMore} /> : null;

  if (view.eventId) {
    return <EventTimeline posts={eventPosts(posts, view.eventId)} fromList={view.fromList} more={more} onOpen={onOpen} onClose={onClose} />;
  }

  const list = eventList(posts);
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: c.bg }}>
      <FlatList
        data={list}
        keyExtractor={(e) => e.eventId}
        renderItem={({ item }) => (
          <Card testID={`event-${item.eventId}`}>
            <Txt variant="title2" role="header">{item.eventName}</Txt>
            <Txt tone="muted">{eventCountWords(item)}</Txt>
            <Button variant="secondary" label={`Open ${item.eventName}`} onPress={() => onOpen(item.eventId)} />
          </Card>
        )}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            <BackButton to={backTo} onPress={onClose} />
            <Txt variant="title1" role="header">Events</Txt>
          </View>
        }
        ListEmptyComponent={failed && posts.length === 0 ? (
          <ErrorState {...loadFailedWords(failed, { helper: app.helper, photos: true })} onRetry={() => void app.feed?.retry()} />
        ) : (
          // EF-HE-6: say what an event is; parents also read how to make one (the real labels).
          <View style={{ gap: 8 }}>
            <Txt variant="headline">No events yet.</Txt>
            <Txt tone="muted">An event is photos from one day, like a birthday or a trip. When someone adds you to one, it shows up here.</Txt>
            {isParent ? <Txt tone="muted">To make one, open Groups in More, tap New group, and tick "This group is for an event."</Txt> : null}
          </View>
        )}
        ListFooterComponent={more ?? undefined}
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 + under }}
        removeClippedSubviews={false}
      />
    </SafeAreaView>
  );
}

/** EVT-7: one moment: "3:10 pm · 14 photos from Mom, Rachel and Sue", a swipe through its photos, and under
 *  each photo who it is from (and its post's caption). */
function Moment({ row, swipeId, posts }: { row: Extract<EventTimelineRow, { type: 'moment' }>; swipeId: string; posts: FeedPost[] }) {
  const byMedia = new Map<string, EventPhoto>(row.photos.map((p) => [p.media.media_id, p]));
  return (
    <Card testID={`moment-${swipeId}`} style={{ padding: 0, overflow: 'hidden' }}>
      <View style={{ padding: 14 }}>
        <Txt variant="headline">{row.line}</Txt>
      </View>
      <PhotoSwipe
        id={swipeId}
        items={row.photos}
        below={(it) => {
          const photo = byMedia.get(it.media.media_id);
          const caption = posts.find((p) => p.post_id === it.postId)?.caption;
          return (
            <View style={{ gap: 4, alignItems: 'center' }}>
              {photo ? <Txt tone="muted">{`From ${photo.from}`}</Txt> : null}
              {caption ? <Txt>{caption}</Txt> : null}
            </View>
          );
        }}
      />
      <View style={{ height: 14 }} />
    </Card>
  );
}

/** EVT-6..9: inside one event. Oldest first by when taken, a header per day, moments, name buttons, "Added later". */
function EventTimeline({ posts, fromList, more, onOpen, onClose }: {
  posts: FeedPost[];
  fromList: boolean;
  more: React.ReactNode;
  onOpen: (eventId: string | null) => void;
  onClose: () => void;
  /** Where the list's Back goes: "More" from the More menu (RD-15). */
  backTo?: string;
}) {
  const { c } = useTheme();
  const under = useTabBarSpace(); // RD-109: room under the web's floating tab bar
  const [person, setPerson] = useState<string | null>(null);
  const name = posts[0]?.event_name ?? '';
  const people = eventContributors(posts);
  const who = people.some((p) => p.authorId === person) ? person : null;
  const rows = eventTimeline(posts, { person: who });
  const swipeId = (key: string) => `${who ?? 'everyone'}-${key}`;
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: c.bg }}>
      <FlatList
        data={rows}
        keyExtractor={(r) => `${who ?? 'everyone'}-${r.key}`}
        renderItem={({ item }) =>
          item.type === 'moment'
            ? <Moment row={item} swipeId={swipeId(item.key)} posts={posts} />
            : <Txt variant="title2" role="header">{item.label}</Txt>}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            {fromList
              ? <BackButton to="Events" label="Back to events" onPress={() => onOpen(null)} />
              : <BackButton to="Gallery" onPress={onClose} />}
            <Txt variant="title1" role="header">{name}</Txt>
            {/* EVT-8: buttons, not gestures. */}
            {people.length > 1 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Button label="Show everyone's photos" text="Everyone" variant="secondary" selected={who === null} onPress={() => setPerson(null)} />
                {people.map((p) => (
                  <Button key={p.authorId} label={`Show photos from ${p.name}`} text={p.name} variant="secondary" selected={who === p.authorId} onPress={() => setPerson(p.authorId)} />
                ))}
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={<Txt tone="muted">No photos here yet.</Txt>}
        ListFooterComponent={(more as React.ReactElement | null) ?? undefined}
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 + under }}
        removeClippedSubviews={false}
      />
    </SafeAreaView>
  );
}
