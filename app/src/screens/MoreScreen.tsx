// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// RD-15, RD-16, RD-14 (SPEC-REDESIGN 1b, DEC-59), RD-60 (outline icons, inset lines): More fills the screen with big rows (icon, word, chevron,
// 48 pt+) in this order: Messages, Groups (owner and adult), Events, Easy view (RD-78, was Bigger text), Light or dark, Family color
// (owner), Me, Help. Each opens today's screen in place with "Back to More". Viewers never get Groups or Family
// color, so no screen reached from here shows them a group's name (DEC-49). Messages says "N new" (a count from
// this phone, never the words). Tapping the More tab again goes back to the menu, like the phone's own tabs.
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useNewMessages } from '../messenger/newMessages';
import { useApp, useFeed } from '../state/AppContext';
import { BackButton, MenuLine, MenuRow, Screen, Txt, type Icon } from '../ui/kit';
import { AppGate } from './AppGate';
import { EventsScreen, type EventsView } from './EventsScreen';
import { GroupsScreen } from './GroupsScreen';
import { HelpScreen } from './HelpScreen';
import { MeScreen } from './MeScreen';
import { MessagesScreen } from './MessagesScreen';
import { EasyView, FamilyColor, LightOrDark } from './Preferences';

type RowId = 'messages' | 'groups' | 'events' | 'easyView' | 'look' | 'color' | 'me' | 'help';
interface Row { id: RowId; text: string; icon: Icon }

const ROWS: Row[] = [
  { id: 'messages', text: 'Messages', icon: { sf: 'bubble.left.and.bubble.right', md: 'chat' } },
  { id: 'groups', text: 'Groups', icon: { sf: 'person.3', md: 'groups' } },
  { id: 'events', text: 'Events', icon: { sf: 'calendar', md: 'event' } },
  { id: 'easyView', text: 'Easy view', icon: { sf: 'textformat.size', md: 'format_size' } },
  { id: 'look', text: 'Light or dark', icon: { sf: 'sun.max', md: 'contrast' } },
  { id: 'color', text: 'Family color', icon: { sf: 'paintpalette', md: 'palette' } },
  { id: 'me', text: 'Me', icon: { sf: 'person.crop.circle', md: 'account_circle' } },
  { id: 'help', text: 'Help', icon: { sf: 'questionmark.circle', md: 'help' } },
];

/** RD-15 / RD-16: which rows a role gets. Groups for parents only; Family color for the owner only (RD-26). */
export function moreRowsFor(role: string): Row[] {
  const parent = role === 'owner' || role === 'adult';
  return ROWS.filter((r) => (r.id !== 'groups' || parent) && (r.id !== 'color' || role === 'owner'));
}

const resets = new Set<() => void>();
/** The More tab was tapped: show the menu again (the tab layouts call this). */
export function resetMore(): void {
  resets.forEach((f) => f());
}

/** B19: an old tab link (/groups, /me, /help) asks for a row; only a row this role has opens. */
export function startRow(role: string | undefined, wanted: string | undefined): RowId | null {
  if (!role || !wanted) return null;
  return moreRowsFor(role).find((r) => r.id === wanted)?.id ?? null;
}

export function MoreScreen({ initialOpen }: { initialOpen?: string } = {}) {
  const app = useApp();
  const feedState = useFeed();
  const [open, setOpen] = useState<RowId | null>(() => startRow(app.space?.role, initialOpen));
  // The space may load after the first paint (cold load): open the asked-for row once it does.
  const role = app.space?.role;
  useEffect(() => {
    const row = startRow(role, initialOpen);
    if (row) setOpen(row);
  }, [role, initialOpen]);
  const [events, setEvents] = useState<EventsView>({ eventId: null, fromList: true });
  const news = useNewMessages();
  useEffect(() => {
    const f = () => setOpen(null);
    resets.add(f);
    return () => { resets.delete(f); };
  }, []);
  if (app.status !== 'ready' || !app.space) return <AppGate />;
  const back = () => { setOpen(null); news.refresh(); };

  if (open === 'messages') return <MessagesScreen backTo="More" onClose={back} />;
  if (open === 'groups') return <GroupsScreen onBack={back} />;
  if (open === 'me') return <MeScreen onBack={back} />;
  if (open === 'help') return <HelpScreen onBack={back} />;
  if (open === 'events') {
    return (
      <EventsScreen
        posts={feedState.posts}
        view={events}
        hasMore={feedState.hasMore}
        loadingMore={feedState.status === 'loadingMore'}
        onLoadMore={() => void app.feed?.loadMore()}
        onOpen={(eventId) => setEvents({ eventId, fromList: true })}
        onClose={() => { setEvents({ eventId: null, fromList: true }); back(); }}
        backTo="More"
      />
    );
  }
  if (open === 'easyView' || open === 'look' || open === 'color') {
    const title = open === 'easyView' ? 'Easy view' : open === 'look' ? 'Light or dark screen' : 'Family color';
    return (
      <Screen>
        <BackButton to="More" onPress={back} />
        <Txt variant="display" role="header">{title}</Txt>
        {open === 'easyView' ? <EasyView /> : open === 'look' ? <LightOrDark heading={false} /> : <FamilyColor heading={false} />}
        {open === 'color' ? <Txt variant="muted">It colors the picked tab and links. For now it changes this phone only.</Txt> : null}
      </Screen>
    );
  }

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
            onPress={() => {
              if (r.id === 'events') setEvents({ eventId: null, fromList: true });
              setOpen(r.id);
            }}
          />
          </React.Fragment>
        ))}
      </View>
    </Screen>
  );
}
