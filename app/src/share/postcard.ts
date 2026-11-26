// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// DEC-73 (Chase, Nov 19): Share is a postcard (SPEC-REDESIGN 1j). The words that name who a post goes to: the To:
// line, the Send button and Feed's "Shared with ..." line (SHARE-PC-9), and each face tile's name (SHARE-PC-6).
import type { Circle } from '../api/types';

/** SHARE-PC-9: up to two names, then "and N more": "Gammy", "Gammy and Pawpaw", "Gammy, Pawpaw and 3 more". */
export function namesLine(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} more`;
}

/** The people a group reaches, not counting me (I'm the one sending). */
export function othersIn(g: Circle, me: string | null): string[] {
  const others = me ? g.member_names.filter((n) => n !== me) : g.member_names;
  return others.length ? others : g.member_names;
}

/** SHARE-PC-5 / SHARE-PC-6: a parent sees the group's own name; anyone else sees its people, never a group's name. */
export function tileName(g: Circle, me: string | null, parent: boolean): string {
  if (parent) return g.kind === 'everyone' ? 'Everyone' : g.name;
  return namesLine(othersIn(g, me));
}

/** SHARE-PC-9: who the picks reach, in words: "Everyone in the family", or the people of every picked group once
 *  each (not me), in the order the groups are listed. '' when nothing is picked. */
export function recipientsLine(circles: Circle[], chosen: string[], me: string | null): string {
  const picked = circles.filter((g) => chosen.includes(g.circle_id));
  if (picked.some((g) => g.kind === 'everyone')) return 'Everyone in the family';
  const names: string[] = [];
  for (const g of picked) for (const n of othersIn(g, me)) if (!names.includes(n)) names.push(n);
  return namesLine(names);
}

/** GUX-R1: a rough width of one word in the phone's semibold system font, in em, on the wide side so a word that
 *  might not fit counts as not fitting. React Native can't measure text before drawing it, so this stands in. */
export function wordEm(word: string): number {
  let em = 0;
  for (const ch of word) {
    if (/[ijlI.,'’!|:;]/.test(ch)) em += 0.3;
    else if (/[frt\-–()]/.test(ch)) em += 0.42;
    else if (/[mwMW]/.test(ch)) em += 0.9;
    else if (/[A-Z]/.test(ch)) em += 0.7;
    else em += 0.6;
  }
  return em;
}

/** GUX-R1: how many face tiles across. 3, or 2 when Easy view is on, the phone's text is 130% or more, or the
 *  longest word of any tile's name would be wider than a 3-across tile (names are never shortened or cut). */
export function tileColumns(o: { names: string[]; rowWidth: number; fontSize: number; fontScale: number; bigText: boolean }): 2 | 3 {
  if (o.bigText || o.fontScale >= 1.3) return 2;
  const room = o.rowWidth / 3 - TILE_INSET; // the tile's own side padding
  const widest = Math.max(0, ...o.names.flatMap((n) => n.split(/\s+/)).map(wordEm));
  return widest * o.fontSize * Math.max(1, o.fontScale) > room ? 2 : 3;
}
/** A face tile's padding on both sides together (kit's `face` style). */
export const TILE_INSET = 8;

/** DEC-91 (FLOW-9): step 2's tiles lay out 2 across; 1 across in Easy view, or when the longest word of any name would
 *  be wider than a 2-across tile (names are never shortened or cut). */
export function shareTileColumns(o: { names: string[]; rowWidth: number; fontSize: number; fontScale: number; bigText: boolean }): 1 | 2 {
  if (o.bigText) return 1;
  const room = o.rowWidth / 2 - TILE_INSET;
  const widest = Math.max(0, ...o.names.flatMap((n) => n.split(/\s+/)).map(wordEm));
  return widest * o.fontSize * Math.max(1, o.fontScale) > room ? 1 : 2;
}
