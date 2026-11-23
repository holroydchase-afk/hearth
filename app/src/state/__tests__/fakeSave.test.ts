// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// DEMO-SAFARI-1..4: the demo's family stays small in localStorage (Safari's 5 MB cap); photo bytes go to a store.
import { FakeBackend, type FakeState } from '../../api/fake/FakeBackend';
import { objectsComplete, splitSaver, type ObjectStore } from '../fakeSave';

function memStore(fail = false) {
  const data: Record<string, string> = {};
  const puts: string[][] = [];
  const store: ObjectStore = {
    getAll: async () => ({ ...data }),
    put: async (e) => { if (fail) throw new Error('quota'); puts.push(e.map(([k]) => k)); e.forEach(([k, v]) => { data[k] = v; }); },
    clear: async () => { for (const k of Object.keys(data)) delete data[k]; },
  };
  return { store, data, puts };
}
const memLS = () => { const m = new Map<string, string>(); return { m, setItem: (k: string, v: string) => { m.set(k, v); } }; };
const stateWith = (objects: Record<string, string>): FakeState => ({ ...FakeBackend.empty(), objects });

describe('DEMO-SAFARI split save', () => {
  it('DEMO-SAFARI-4 the family goes to localStorage without photo bytes; the bytes go to the store', async () => {
    const ls = memLS();
    const { store, data } = memStore();
    const s = splitSaver(ls, 'k', store);
    s.save(stateWith({ a: 'AAAA', b: 'BBBB' }));
    await s.flush();
    expect(JSON.parse(ls.m.get('k')!).objects).toEqual({});
    expect(data).toEqual({ a: 'AAAA', b: 'BBBB' });
  });

  it('DEMO-SAFARI-3 a just-shared photo is saved inline at once, so a reload before the store lands keeps it', async () => {
    const ls = memLS();
    const { store } = memStore();
    const s = splitSaver(ls, 'k', store, 10);
    s.save(stateWith({ a: 'AAAA' }));
    expect(JSON.parse(ls.m.get('k')!).objects).toEqual({ a: 'AAAA' });
    await s.flush();
    expect(JSON.parse(ls.m.get('k')!).objects).toEqual({});
  });

  it('DEMO-SAFARI-4 a big batch (the sample family) is not put in localStorage; the family is written once it is stored', async () => {
    const ls = memLS();
    const { store } = memStore();
    const s = splitSaver(ls, 'k', store, 10);
    s.save(stateWith({ a: 'AAAAAAAA', b: 'BBBBBBBB' }));
    expect(ls.m.has('k')).toBe(false);
    await s.flush();
    expect(JSON.parse(ls.m.get('k')!).objects).toEqual({});
  });

  it('DEMO-SAFARI-4 photo bytes are written once; later saves only add new keys', async () => {
    const { store, puts } = memStore();
    const s = splitSaver(memLS(), 'k', store);
    s.know(['a']);
    const st = stateWith({ a: 'AAAA', b: 'BBBB' });
    s.save(st);
    st.objects.c = 'CCCC';
    s.save(st);
    s.save(st);
    await s.flush();
    expect(puts).toEqual([['b'], ['c']]);
  });

  it('DEMO-SAFARI-3 the last save wins even when an earlier one waited on its photos', async () => {
    const ls = memLS();
    const { store } = memStore();
    const s = splitSaver(ls, 'k', store);
    const st = stateWith({ a: 'AAAA' });
    st.appSession = 'chase';
    s.save(st);
    st.appSession = 'jo';
    s.save(st);
    await s.flush();
    expect(JSON.parse(ls.m.get('k')!).appSession).toBe('jo');
  });

  it('DEMO-SAFARI without a store, or when it fails, the whole state is saved inline as before', async () => {
    const a = memLS();
    splitSaver(a, 'k', undefined).save(stateWith({ a: 'AAAA' }));
    expect(JSON.parse(a.m.get('k')!).objects).toEqual({ a: 'AAAA' });
    const b = memLS();
    const s = splitSaver(b, 'k', memStore(true).store);
    s.save(stateWith({ a: 'AAAA' }));
    s.save(stateWith({ a: 'AAAA' }));
    await s.flush();
    expect(JSON.parse(b.m.get('k')!).objects).toEqual({ a: 'AAAA' });
  });

  it('DEMO-SAFARI reset clears the store before a fresh family saves', async () => {
    const { store, data } = memStore();
    data.old = 'OLD';
    const s = splitSaver(memLS(), 'k', store);
    s.reset();
    s.save(stateWith({ a: 'AAAA' }));
    await s.flush();
    expect(data).toEqual({ a: 'AAAA' });
  });

  it('DEMO-SAFARI a ready photo with missing bytes counts as incomplete (the demo reseeds)', () => {
    const st = stateWith({ d: 'D' });
    st.media.m = { status: 'ready', display_key: 'd', thumb_key: 't' } as FakeState['media'][string];
    expect(objectsComplete(st)).toBe(false);
    st.objects.t = 'T';
    expect(objectsComplete(st)).toBe(true);
  });
});
