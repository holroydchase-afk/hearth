// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// DEC-72 (Chase, Nov 19): Share is a postcard (SPEC-REDESIGN 1j). The words that name who a post goes to: the To:
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
