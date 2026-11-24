// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Intake #162 (eval findings, Nov 24): failing tests written before any fix.
// EF-HE-9 / B18 (QA-R2 from OPEN-1/7/8): New for you must count every post since the last visit, not only the
// first page of 20 that Gallery has loaded.
// EF-HE-1, 2, 5, 6 (SPEC-EVAL-FIXES section 1): written red before the fix. The ff4543e EF-HE-1 guard ("Open the chat …"
// spoken, "Open" shown) is superseded by EF-HE-1-AC1/AC2: the button shows and speaks the same distinct words.
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { SymbolView } from 'expo-symbols';
import React from 'react';
import { Platform, StyleSheet, Text } from 'react-native';
import type { ChatSummary } from '../../api/types';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import { memoryKV } from '../../platform/kv';
import { seedPost } from '../../test/seed';
import { expectGrandparentSafe, renderApp } from '../../test/renderApp';
import { GalleryScreen, MoreScreen } from '../../test/redesignScreens';
import { Choice, GroupedSection } from '../../ui/kit';
import { LookContext, ThemeContext, contrast, paletteFor, type ThemeName } from '../../ui/theme';
import { GroupsScreen } from '../GroupsScreen';
import { MeScreen } from '../MeScreen';
import { chatOpenLabel } from '../MessagesScreen';
import { EasyView, LightOrDark } from '../Preferences';

const { dadSide } = FIXTURE.circles;
const { jo } = FIXTURE.users;
const KEY = (u: string) => `hearth.lastSeen.v1.${u}`;
const SEE_ALL = { name: /^See all(?! the photos)/ };

describe('EF-HE-9 B18 New for you past the first page', () => {
  it('EF-HE-9 B18 25 new posts since the last visit: the walk counts all 25 and starts at the oldest', async () => {
    const be = FakeBackend.withFixture();
    const lastSeen = Date.now() - 3600e3; // an hour ago
    const N = 25; // more than one page (20)
    for (let i = 0; i < N; i++) {
      const { id } = await seedPost(be, { caption: `New ${i}`, circles: [dadSide.id] });
      // oldest is "New 0", spread evenly between the last visit and now
      const at = new Date(lastSeen + ((i + 1) * 3600e3) / (N + 2)).toISOString();
      be.state.posts[id]!.published_at = at;
      be.state.posts[id]!.created_at = at;
    }
    const kv = memoryKV({ [KEY(jo.id)]: new Date(lastSeen).toISOString() });
    await renderApp(<GalleryScreen />, { be, kv, user: 'jo' });
    fireEvent.press(await screen.findByRole('button', SEE_ALL));
    await screen.findByTestId('new-one-at-a-time');
    const walk = screen.getByTestId('new-one-at-a-time');
    const heading = screen.getAllByRole('header').map((h) => String(h.props.accessibilityLabel ?? '')).find((n) => n.startsWith('New photos:'));
    expect(heading).toBe(`New photos: 1 of ${N}`);
    expect(within(walk).queryByText('New 0')).toBeTruthy(); // the oldest new post first
  });
});

// ---------- EF-HE-1: every Open button on Messages says which chat it opens ----------
type Node = ReturnType<typeof screen.UNSAFE_getAllByType>[number];
/** The words a button shows: every Text under it, joined. */
const shown = (b: Node) => b.findAll((n) => n.type === Text).map((t) => [t.props.children].flat().join('')).join(' ').trim();

async function openMessages(user: 'chase' | 'jo') {
  await renderApp(<MoreScreen />, { user, fixture: { joIsMember: true } });
  fireEvent.press(await screen.findByRole('button', { name: 'Messages' }));
  await screen.findByRole('header', { name: 'Messages' });
  await screen.findAllByRole('button', { name: /^Open / });
  return screen.getAllByRole('button', { name: /^Open / });
}

describe('EF-HE-1 Messages Open buttons', () => {
  it('EF-HE-1-AC1 chatOpenLabel: "Open <name>" for a named group or event, "Open chat with <people>" for people', () => {
    const chat = (title: string, named: boolean, kind: ChatSummary['kind'] = 'group'): ChatSummary => ({ circle_id: title, kind, title, named, member_count: 3 });
    expect(chatOpenLabel(chat('Everyone', true, 'everyone'))).toBe('Open Everyone');
    expect(chatOpenLabel(chat('Charleston trip', true, 'event'))).toBe('Open Charleston trip');
    expect(chatOpenLabel(chat('Alex and Grandpa Earl', false))).toBe('Open chat with Alex and Grandpa Earl');
  });

  it.each(['chase', 'jo'] as const)('EF-HE-1-AC1 %s: no two Open buttons show the same text, and each shows its chat', async (user) => {
    const btns = await openMessages(user);
    expect(btns.length).toBeGreaterThan(1);
    const texts = btns.map(shown);
    expect(new Set(texts).size).toBe(texts.length);
    for (const t of texts) expect(t).toMatch(/^Open (chat with )?\S/);
  });

  it.each(['chase', 'jo'] as const)('EF-HE-1-AC2 %s: each Open button speaks exactly the words it shows (WCAG 2.5.3)', async (user) => {
    const btns = await openMessages(user);
    for (const b of btns) expect({ spoken: String(b.props.accessibilityLabel) }).toEqual({ spoken: shown(b) });
    expect(screen.queryAllByRole('button', { name: /^Open the chat/ })).toEqual([]);
  });

  it('EF-HE-1-AC3 (auto part; the phone check is manual M-20) a long chat title is never cut off: no line limit, 17 pt+, 48 pt+', async () => {
    const btns = await openMessages('chase');
    for (const b of btns) {
      for (const t of b.findAll((n) => n.type === Text)) {
        expect(t.props.numberOfLines ?? 0).toBe(0);
        expect(Number(StyleSheet.flatten(t.props.style).fontSize)).toBeGreaterThanOrEqual(17);
      }
    }
    expectGrandparentSafe();
  });
});

// ---------- EF-HE-2: a radio row shows an empty ring when it isn't picked ----------
type Sym = { name: { ios: string; android: string; web?: string }; tintColor: string };
const symOf = (row: Node): Sym | undefined => row.findAll((n) => n.type === SymbolView)[0]?.props as Sym | undefined;
const os = Platform.OS as 'ios';

describe('EF-HE-2 radio rings', () => {
  it('EF-HE-2-AC1 Easy view and Light or dark: unpicked rows show an empty ring, the picked row a filled ring in accent', async () => {
    await renderApp(<><EasyView heading /><LightOrDark /></>, { user: 'jo' });
    const radios = await screen.findAllByRole('radio');
    expect(radios.length).toBe(5); // On, Off; Same as my phone, Light screen, Dark screen
    const c = paletteFor(os, false);
    const seen = radios.map((r) => {
      const sym = symOf(r);
      return { label: r.props.accessibilityLabel, checked: !!r.props.accessibilityState?.checked, ios: sym?.name.ios, android: sym?.name.android, tint: sym?.tintColor };
    });
    expect(seen.filter((r) => r.checked).length).toBe(2);
    for (const r of seen) {
      expect(r).toEqual(r.checked
        ? { ...r, ios: 'checkmark.circle.fill', android: 'radio_button_checked', tint: c.accent }
        : { ...r, ios: 'circle', android: 'radio_button_unchecked', tint: expect.any(String) });
    }
  });

  it('EF-HE-2-AC1 the shared Choice radio: picking another row moves the filled ring, the old row goes back to an empty ring', () => {
    const Two = () => {
      const [v, setV] = React.useState<'a' | 'b'>('a');
      return <>{(['a', 'b'] as const).map((k) => <Choice key={k} kind="radio" label={k} title={k} checked={v === k} onPress={() => setV(k)} />)}</>;
    };
    render(<Two />);
    fireEvent.press(screen.getByRole('radio', { name: 'b' }));
    expect(symOf(screen.getByRole('radio', { name: 'a' }))?.name.ios).toBe('circle');
    expect(symOf(screen.getByRole('radio', { name: 'b' }))?.name.ios).toBe('checkmark.circle.fill');
  });

  const CASES: [ThemeName, boolean][] = [['paper', false], ['paper', true], ['avocado', false], ['avocado', true]];
  it.each(CASES)('EF-HE-2-AC2 (%s, dark %s) the unpicked ring has 3:1 or better against its row (WCAG 1.4.11)', (theme, dark) => {
    render(
      <LookContext.Provider value={dark ? 'dark' : 'light'}>
        <ThemeContext.Provider value={theme}>
          <GroupedSection><Choice kind="radio" label="Off" title="Off" checked={false} onPress={() => {}} /></GroupedSection>
        </ThemeContext.Provider>
      </LookContext.Provider>,
    );
    const c = paletteFor(os, dark, theme);
    const ring = symOf(screen.getByRole('radio', { name: 'Off' }));
    expect(ring?.name.ios).toBe('circle');
    expect(contrast(ring!.tintColor, c.surface)).toBeGreaterThanOrEqual(3);
  });

  it('EF-HE-2-AC3 (guard) checked state is still spoken the same way and the whole row is still the 48 pt target', () => {
    render(<><Choice kind="radio" label="On" title="On" checked onPress={() => {}} /><Choice kind="radio" label="Off" title="Off" checked={false} onPress={() => {}} /></>);
    const on = screen.getByRole('radio', { name: 'On' });
    const off = screen.getByRole('radio', { name: 'Off' });
    expect(on.props.accessibilityState).toMatchObject({ checked: true }); // aria-checked on the web: demo e2e GUX-R11
    expect(off.props.accessibilityState).toMatchObject({ checked: false });
    expectGrandparentSafe();
  });
});

// ---------- EF-HE-5: an honest line about group names; New group stands out ----------
const GROUPS_LINE = "Each photo goes only to the groups you pick. Only parents see these names; everyone else sees people's names.";

describe('EF-HE-5 Your groups', () => {
  it('EF-HE-5-AC1 a parent reads the honest line, and never "People never see group names"', async () => {
    await renderApp(<GroupsScreen />, { user: 'chase' });
    await screen.findByRole('header', { name: 'Your groups' });
    expect(screen.queryByText(GROUPS_LINE)).toBeTruthy();
    expect(screen.queryByText(/People never see group names/)).toBeNull();
  });

  it('EF-HE-5-AC2 New group is the one filled main button; Rename stays secondary', async () => {
    await renderApp(<GroupsScreen />, { user: 'chase' });
    await screen.findByRole('button', { name: 'New group' });
    const c = paletteFor(os, false);
    const bg = (b: Node) => StyleSheet.flatten(typeof b.props.style === 'function' ? b.props.style({ pressed: false }) : b.props.style)?.backgroundColor;
    const filled = screen.getAllByRole('button').filter((b) => bg(b) === c.accent).map((b) => b.props.accessibilityLabel);
    expect(filled).toEqual(['New group']);
    const renames = screen.getAllByRole('button', { name: /^Rename / });
    expect(renames.length).toBeGreaterThan(0);
    for (const r of renames) expect(bg(r)).not.toBe(c.accent);
  });

  it('EF-HE-5-AC3 (guard, GRP-15) a relative never reaches Your groups or its line', async () => {
    await renderApp(<GroupsScreen />, { user: 'ruth' });
    expect(await screen.findByText("You can't do that here.")).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'New group' })).toBeNull();
    expect(screen.queryByText(/group names|these names/)).toBeNull();
  });
});

// ---------- EF-HE-6: an empty Events list says what an event is ----------
const NO_EVENTS = 'No events yet.';
const WHAT = 'An event is photos from one day, like a birthday or a trip. When someone adds you to one, it shows up here.';
const HOW = 'To make one, open Groups in More, tap New group, and tick "This group is for an event."';

async function emptyEvents(user: 'chase' | 'jo' | 'ruth') {
  await renderApp(<MoreScreen />, { user });
  fireEvent.press(await screen.findByRole('button', { name: 'Events' }));
  await screen.findByRole('header', { name: 'Events' });
}

describe('EF-HE-6 empty Events', () => {
  it.each(['jo', 'ruth'] as const)('EF-HE-6-AC1 relative %s with no events reads what an event is, and no how-to-make line', async (user) => {
    await emptyEvents(user);
    expect(screen.queryByRole('button', { name: /^Open / })).toBeNull(); // really empty
    expect(screen.queryByText(NO_EVENTS)).toBeTruthy();
    expect(screen.queryByText(WHAT)).toBeTruthy();
    expect(screen.queryByText(HOW)).toBeNull();
  });

  it('EF-HE-6-AC2 a parent with no events reads the same two lines plus how to make one', async () => {
    await emptyEvents('chase');
    expect(screen.queryByText(NO_EVENTS)).toBeTruthy();
    expect(screen.queryByText(WHAT)).toBeTruthy();
    expect(screen.queryByText(HOW)).toBeTruthy();
  });

  it('EF-HE-6-AC2 the how-to words match the real labels: More has Groups, Groups has New group, New group has "This group is for an event"', async () => {
    await renderApp(<MoreScreen />, { user: 'chase' });
    fireEvent.press(await screen.findByRole('button', { name: 'Groups' }));
    fireEvent.press(await screen.findByRole('button', { name: 'New group' }));
    expect(await screen.findByRole('checkbox', { name: 'This group is for an event' })).toBeTruthy();
  });
});

// ---------- EF-HE-4 (Chase, Nov 24: "Yes, only in More"): Easy view and Light or dark live only in More ----------
describe('EF-HE-4 Easy view and Light or dark only in More', () => {
  it.each(['chase', 'jo'] as const)('EF-HE-4-AC1 %s: Me shows neither the Easy view nor the Light or dark section', async (user) => {
    await renderApp(<MeScreen />, { user });
    await screen.findByRole('header', { name: 'Me' });
    await screen.findByText('How should we tell you about new photos?'); // Me has finished loading
    const headers = screen.getAllByRole('header').map((h) => String(h.props.accessibilityLabel ?? [h.props.children].flat().join('')));
    expect(headers.filter((h) => h === 'Easy view' || h === 'Light or dark screen')).toEqual([]);
    const radios = screen.queryAllByRole('radio').map((r) => r.props.accessibilityLabel);
    for (const name of ['On', 'Off', 'Same as my phone (Recommended)', 'Light screen', 'Dark screen']) expect(radios).not.toContain(name);
  });

  it.each(['chase', 'jo'] as const)('EF-HE-4-AC2 %s: More still has an Easy view row and a Light or dark row, each opening its page', async (user) => {
    await renderApp(<MoreScreen />, { user });
    for (const [row, header, radio] of [['Easy view', 'Easy view', 'On'], ['Light or dark', 'Light or dark screen', 'Dark screen']] as const) {
      fireEvent.press(await screen.findByRole('button', { name: new RegExp(`^${row}(,|$)`) }));
      expect(await screen.findByRole('header', { name: header })).toBeTruthy();
      expect(screen.getByRole('radio', { name: radio })).toBeTruthy();
      fireEvent.press(screen.getByRole('button', { name: 'Back to More' }));
      await screen.findByRole('header', { name: 'More' });
    }
  });
});
