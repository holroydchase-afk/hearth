// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// UI-27: the avatar letter skips a leading "The", so "The Holroyds" shows "H", not "T".
import { initialOf } from '../format';

describe('UI-27 avatar initial', () => {
  it.each([
    ['The Holroyds', 'H'],
    ['the smiths', 'S'],
    ['Sam', 'S'],
    ['Theo', 'T'],
    ['  grandma Jo', 'GJ'],
    ['The', 'T'],
    ['', '?'],
  ])('UI-27 %p → %p', (name, want) => {
    expect(initialOf(name)).toBe(want);
  });
});

// FIRSTMIN-1 (Chase, Nov 6): two grandparents both showed "G", so the faces looked the same. Initials are now
// the first letters of the first two words, after skipping a leading "The"; one word stays one letter.
describe('FIRSTMIN-1 first and second initials', () => {
  it.each([
    ['Grandma Jo', 'GJ'],
    ['Grandpa Earl', 'GE'],
    ['Nana Ruth', 'NR'],
    ['Sam', 'S'],
    ['The Holroyds', 'H'],
    ['The Smith Family', 'SF'],
    ['  grandma   jo  ', 'GJ'],
    ['Mary Ann Lee', 'MA'],
    ['', '?'],
    ['   ', '?'],
  ])('FIRSTMIN-1 %p → %p', (name, want) => {
    expect(initialOf(name)).toBe(want);
  });

  it('FIRSTMIN-1 Grandma Jo and Grandpa Earl no longer share an initial', () => {
    expect(initialOf('Grandma Jo')).not.toBe(initialOf('Grandpa Earl'));
  });
});
