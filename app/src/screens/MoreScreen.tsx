// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// RD-15, RD-16, RD-14 (SPEC-REDESIGN 1b, DEC-59), RD-60 (outline icons, inset lines): More fills the screen with big rows (icon, word, chevron,
// 48 pt+) in this order: Messages, Groups (owner and adult), Events, Easy view (RD-78, was Bigger text), Light or dark, Theme
// (owner, RD-97), Me, Help. Each opens today's screen with "Back to More". Viewers never get Groups or Theme
// (RD-98), so no screen reached from here shows them a group's name (DEC-49). Messages says "N new" (a count from
// this phone, never the words). Tapping the More tab again goes back to the menu, like the phone's own tabs.
// ENG-R6: each row is its own screen in More's stack (app/(tabs)/more/), so the phone's Back and iPhone's swipe
// return to the menu; these are the pieces the route files use.
import { Redirect, router } from 'expo-router';
import React, { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { useNewMessages } from '../messenger/newMessages';
import { useApp, useFeed } from '../state/AppContext';
import { BackButton, MenuLine, MenuRow, Screen, Txt, type Icon } from '../ui/kit';
import { AppGate } from './AppGate';
import { EventsScreen, type EventsView } from './EventsScreen';
import { EasyView, LightOrDark, ThemePicker } from './Preferences';

export type RowId = 'messages' | 'groups' | 'events' | 'easyView' | 'look' | 'theme' | 'me' | 'help';
interface Row { id: RowId; text: string; icon: Icon; path: string }

const ROWS: Row[] = [
  { id: 'messages', text: 'Messages', icon: { sf: 'bubble.left.and.bubble.right', md: 'chat' }, path: '/more/messages' },
  { id: 'groups', text: 'Groups', icon: { sf: 'person.3', md: 'groups' }, path: '/more/groups' },
  { id: 'events', text: 'Events', icon: { sf: 'calendar', md: 'event' }, path: '/more/events' },
  { id: 'easyView', text: 'Easy view', icon: { sf: 'textformat.size', md: 'format_size' }, path: '/more/easy-view' },
  { id: 'look', text: 'Light or dark', icon: { sf: 'sun.max', md: 'contrast' }, path: '/more/look' },
  { id: 'theme', text: 'Theme', icon: { sf: 'paintpalette', md: 'palette' }, path: '/more/theme' },
  { id: 'me', text: 'Me', icon: { sf: 'person.crop.circle', md: 'account_circle' }, path: '/more/me' },
  { id: 'help', text: 'Help', icon: { sf: 'questionmark.circle', md: 'help' }, path: '/more/help' },
];

/** RD-15 / RD-16: which rows a role gets. Groups for parents only; Theme for the owner only (RD-98). */
export function moreRowsFor(role: string): Row[] {
  const parent = role === 'owner' || role === 'adult';
  return ROWS.filter((r) => (r.id !== 'groups' || parent) && (r.id !== 'theme' || role === 'owner'));
}

/** B19: an old tab link (/groups, /me, /help, /more?open=…) asks for a row; only a row this role has opens. */
export function startRow(role: string | undefined, wanted: string | undefined): RowId | null {
  if (!role || !wanted) return null;
  return moreRowsFor(role).find((r) => r.id === wanted)?.id ?? null;
}

/** The address of a row's screen in More's stack. */
export function rowPath(id: RowId): string {
  return ROWS.find((r) => r.id === id)!.path;
}

/** "Back to More": back down More's stack to the menu (or to it, when a link opened the row with nothing under it). */
export function backToMore(): void {
  router.dismissTo('/more');
}

/** A row's screen, only for a role that has the row: anyone else gets the More menu (DEC-49, RD-98). */
export function MoreRowGate({ row, children }: { row: RowId; children: ReactNode }) {
  const app = useApp();
  if (app.status !== 'ready' || !app.space) return <AppGate />;
  if (!startRow(app.space.role, row)) return <Redirect href="/more" />;
  return <>{children}</>;
}

/** More → Events: the list, then one event; Back from the list returns to More. */
export function MoreEvents() {
  const app = useApp();
  const feedState = useFeed();
  const [events, setEvents] = useState<EventsView>({ eventId: null, fromList: true });
  return (
    <EventsScreen
      posts={feedState.posts}
      view={events}
      hasMore={feedState.hasMore}
      loadingMore={feedState.status === 'loadingMore'}
      onLoadMore={() => void app.feed?.loadMore()}
      onOpen={(eventId) => setEvents({ eventId, fromList: true })}
      onClose={backToMore}
      backTo="More"
    />
  );
}

/** More → Easy view, Light or dark, Theme: one setting on its own screen. */
export function MorePreference({ which }: { which: 'easyView' | 'look' | 'theme' }) {
  const title = which === 'easyView' ? 'Easy view' : which === 'look' ? 'Light or dark screen' : 'Theme';
  return (
    <Screen>
      <BackButton to="More" onPress={backToMore} />
      <Txt variant="display" role="header">{title}</Txt>
      {which === 'easyView' ? <EasyView /> : which === 'look' ? <LightOrDark heading={false} /> : <ThemePicker heading={false} />}
      {which === 'theme' ? <Txt variant="muted">It colors the page, the picked tab and links. For now it changes this phone only.</Txt> : null}
    </Screen>
  );
}

/** The More menu (the first screen of More's stack). */
export function MoreScreen() {
  const app = useApp();
  const news = useNewMessages();
  // Reading a chat marks it seen, which recounts the "N new" here (markChatSeen), so the menu needs no refresh on Back.
  if (app.status !== 'ready' || !app.space) return <AppGate />;

  return (
    <Screen>
      <Txt variant="display" role="header">More</Txt>
      <View>
        {moreRowsFor(app.space.role).map((r, i) => (
          <React.Fragment key={r.id}>
          {i ? <MenuLine /> : null}
          <MenuRow
            text={r.text}
            icon={r.icon}
            count={r.id === 'messages' && news.total > 0 ? `${news.total} new` : null}
            value={r.id === 'easyView' ? (app.prefs.easyView ? 'On' : 'Off') : null}
            onPress={() => router.push(r.path)}
          />
          </React.Fragment>
        ))}
      </View>
    </Screen>
  );
}
