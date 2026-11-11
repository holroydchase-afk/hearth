// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// SEARCH-UI-1..8 (go-live item 9, docs/product/SPEC-SEARCH.md): find photos by the words people wrote, who sent
// them and the year they were taken. Plain words only (search_posts, migration 0025): it never looks inside a
// photo and nothing typed is kept. Only posts you can see are found, and group names never show. Every choice
// is a labeled button; opened from Photos ("Search"), "Back to Photos" and the phone's Back return there.
import React, { useEffect, useMemo, useState } from 'react';
import { BackHandler, FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { TimelinePost, TimelineYear } from '../api/HearthApi';
import { messageFor } from '../errors/messages';
import { useApp, useFeed } from '../state/AppContext';
import { Button, Field, Loading, Notice, Txt } from '../ui/kit';
import { useTheme } from '../ui/theme';
import { PostCard } from './PostCard';
import { TimelineCard } from './TimelineScreen';

const PAGE = 20;
const ROW = { flexDirection: 'row', flexWrap: 'wrap', gap: 8 } as const;

interface Query { words: string; author: string | null; year: number | null }
interface Results { query: Query; posts: TimelinePost[]; hasMore: boolean }

const zone = () => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
};

export function SearchScreen({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const feedState = useFeed();
  const { c } = useTheme();
  const api = app.deps.api;
  const space = app.space!.space_id;
  const [words, setWords] = useState('');
  const [author, setAuthor] = useState<string | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [years, setYears] = useState<TimelineYear[]>([]);
  const [results, setResults] = useState<Results | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  // People who sent photos you can already see; never anyone from a post you can't.
  const senders = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of feedState.posts) if (!seen.has(p.author_id)) seen.set(p.author_id, p.author_name);
    return [...seen].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [feedState.posts]);

  useEffect(() => {
    let live = true;
    api.getTimelineYears(space, zone()).then((y) => { if (live) setYears(y); }).catch(() => {});
    return () => { live = false; };
  }, [api, space]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (openId) setOpenId(null);
      else onClose();
      return true;
    });
    return () => sub.remove();
  }, [openId, onClose]);

  const run = async (q: Query, more = false) => {
    if (!q.words.trim() && !q.author && q.year === null) {
      setResults(null);
      setNotice('Type a word, or pick a person or a year.');
      return;
    }
    const last = more ? results?.posts[results.posts.length - 1] : undefined;
    setBusy(true);
    setNotice(null);
    try {
      const page = await api.searchPosts({
        space, words: q.words.trim() || null, author: q.author, limit: PAGE,
        from: q.year === null ? null : new Date(q.year, 0, 1).toISOString(),
        until: q.year === null ? null : new Date(q.year + 1, 0, 1).toISOString(),
        beforeAt: last?.sort_at ?? null, beforeId: last?.post_id ?? null,
      });
      setResults({ query: q, posts: more && results ? [...results.posts, ...page] : page, hasMore: page.length === PAGE });
    } catch (e) {
      setNotice(messageFor(e, { inviter: app.helper ?? null, action: 'search' }));
    } finally {
      setBusy(false);
    }
  };

  const pickAuthor = (id: string | null) => { setAuthor(id); void run({ words, author: id, year }); };
  const pickYear = (y: number | null) => { setYear(y); void run({ words, author, year: y }); };

  if (openId) {
    const post = feedState.opened[openId] ?? feedState.posts.find((p) => p.post_id === openId)
      ?? results?.posts.find((p) => p.post_id === openId);
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: c.bg }}>
        <FlatList
          data={post ? [post] : []}
          keyExtractor={(p) => p.post_id}
          ListHeaderComponent={<Button label="Back to the search" text="Back to search" variant="secondary" onPress={() => setOpenId(null)} />}
          renderItem={({ item }) => <PostCard post={item} />}
          contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews={false}
        />
      </SafeAreaView>
    );
  }

  const n = results?.posts.length ?? 0;
  const found = results && n
    ? `Found ${n} photo${n === 1 ? '' : 's'}${results.hasMore ? ' so far' : ''}`
    : null;
  const nothing = results && !n
    ? (results.query.words.trim()
      ? `Nothing found for "${results.query.words.trim()}". Try one word, or pick a person or a year.`
      : 'Nothing found. Tap Anyone or Any year to see more.')
    : null;

  const header = (
    <View style={{ gap: 12 }}>
      <Txt variant="display" role="header">Search photos</Txt>
      <Button label="Back to Photos" variant="secondary" onPress={onClose} />
      <Txt variant="muted">Search looks at the words people wrote and who sent them. It never looks inside your photos.</Txt>
      <Field
        label="Words to look for"
        value={words}
        onChangeText={setWords}
        placeholder="For example: birthday"
        returnKeyType="search"
        autoCorrect={false}
        maxLength={100}
        onSubmitEditing={() => void run({ words, author, year })}
      />
      <Button label="Search for these words" text="Search" busy={busy} onPress={() => void run({ words, author, year })} />
      {senders.length > 1 ? (
        <View style={{ gap: 8 }}>
          <Txt variant="title" role="header">From</Txt>
          <View style={ROW}>
            <Button label="Photos from anyone" text="Anyone" variant="secondary" selected={author === null} onPress={() => pickAuthor(null)} />
            {senders.map((s) => (
              <Button key={s.id} label={`Only photos from ${s.name}`} text={s.name} variant="secondary" selected={author === s.id} onPress={() => pickAuthor(s.id)} />
            ))}
          </View>
        </View>
      ) : null}
      {years.length > 1 ? (
        <View style={{ gap: 8 }}>
          <Txt variant="title" role="header">Taken in</Txt>
          <View style={ROW}>
            <Button label="Photos from any year" text="Any year" variant="secondary" selected={year === null} onPress={() => pickYear(null)} />
            {years.map((y) => (
              <Button key={y.year} label={`Only photos taken in ${y.year}`} text={String(y.year)} variant="secondary" selected={year === y.year} onPress={() => pickYear(y.year)} />
            ))}
          </View>
        </View>
      ) : null}
      {notice ? <Notice text={notice} onClose={() => setNotice(null)} /> : null}
      {found ? <Txt variant="strong" role="header">{found}</Txt> : null}
    </View>
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: c.bg }}>
      <FlatList
        data={results?.posts ?? []}
        keyExtractor={(p) => p.post_id}
        renderItem={({ item }) => (
          <TimelineCard post={item} onOpen={() => { app.feed?.adopt(item); setOpenId(item.post_id); }} />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={busy && !n ? <Loading words="Searching…" /> : nothing ? <Txt>{nothing}</Txt> : undefined}
        ListFooterComponent={
          results?.hasMore ? (
            <Button label="Show more of what was found" text="Show more" variant="secondary" busy={busy} onPress={() => void run(results.query, true)} />
          ) : undefined
        }
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={false}
      />
    </SafeAreaView>
  );
}
