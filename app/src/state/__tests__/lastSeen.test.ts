// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// OPEN-5 (docs/product/SPEC-OPENING.md): "last visit" lives on this phone only, one KV key per person
// (`hearth.lastSeen.v1.<user>`, an ISO time), next to prefs. No server call.
import { memoryKV } from '../../platform/kv';
import { loadLastSeen, saveLastSeen } from '../lastSeen';

describe('OPEN-5 last visit kept on this phone', () => {
  it('OPEN-5 first ever open: no last visit', async () => {
    expect(await loadLastSeen(memoryKV(), 'u-jo')).toBeNull();
  });

  it('OPEN-5 saved per person under hearth.lastSeen.v1.<user>, and read back', async () => {
    const kv = memoryKV({ 'hearth.prefs.v1.u-jo': '{"bigText":true}' });
    await saveLastSeen(kv, 'u-jo', '2026-11-11T14:00:00.000Z');
    expect(kv.dump()).toEqual({ 'hearth.prefs.v1.u-jo': '{"bigText":true}', 'hearth.lastSeen.v1.u-jo': '2026-11-11T14:00:00.000Z' });
    expect(await loadLastSeen(kv, 'u-jo')).toBe('2026-11-11T14:00:00.000Z');
    expect(await loadLastSeen(kv, 'u-ruth')).toBeNull(); // another person on the same phone starts fresh
  });

  it('OPEN-5 a damaged value reads as no last visit (no card, no crash)', async () => {
    expect(await loadLastSeen(memoryKV({ 'hearth.lastSeen.v1.u-jo': 'not a time' }), 'u-jo')).toBeNull();
    const broken = { getItem: async () => { throw new Error('disk'); }, setItem: async () => {}, removeItem: async () => {} };
    expect(await loadLastSeen(broken, 'u-jo')).toBeNull();
  });
});
