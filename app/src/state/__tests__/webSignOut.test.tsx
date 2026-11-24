// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// PRIV-WEB-R5 (privacy-security review of HRT-WEB.1, WEB-APP-6): sign-out on web must leave no sealed chat.*
// data and no IndexedDB key behind, even when the messenger's write lands while the store is being cleared or
// just after. Today the open chat keeps polling until the signed-out state unmounts it, and a write already in
// flight goes through the store after clear(), which seals it again under a brand-new key.
// The real Messages screen and ChatClient run over the real web store (sealed localStorage, key store in memory
// for IndexedDB); the fake relay's fetch is held open so the messenger's save is in flight during sign-out.
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { FakeBackend } from '../../api/fake/FakeBackend';
import type { HearthApi } from '../../api/HearthApi';
import { createSecureSessionStorage, type SecureSessionStorage } from '../../platform/secureSession.web';
import { MessagesScreen } from '../../screens/MessagesScreen';
import { renderApp } from '../../test/renderApp';
import { useApp } from '../AppContext';

// The messenger's store on web is secureSessionStorage (secureSession.web.ts). Jest resolves the native module,
// so point it at this test's web store.
const mockWeb: { store?: SecureSessionStorage } = {};
jest.mock('../../platform/secureSession', () => ({
  get secureSessionStorage() {
    try { return mockWeb.store; } catch { return undefined; }
  },
}));

function fakeLocalStorage() {
  const m = new Map<string, string>();
  const ls = {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  };
  return { m, ls };
}

function memoryKeys() {
  let key: CryptoKey | null = null;
  const handed: CryptoKey[] = [];
  return {
    handed,
    get held() { return key; },
    get: async () => key,
    put: async (k: CryptoKey) => { key = k; handed.push(k); },
    delete: async () => { key = null; },
  };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => { resolve = r; });
  return { promise, resolve };
}
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const realLS = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
afterEach(() => {
  if (realLS) Object.defineProperty(globalThis, 'localStorage', realLS); else delete (globalThis as { localStorage?: unknown }).localStorage;
  mockWeb.store = undefined;
});

let app: ReturnType<typeof useApp> | null = null;
function Probe() {
  app = useApp();
  return <MessagesScreen onClose={() => {}} />;
}

type Moment = 'when clear starts' | 'after clear finishes';

async function signOutWithMessengerWriteLanding(moment: Moment) {
  const local = fakeLocalStorage();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: local.ls });
  const keys = memoryKeys();
  const web = createSecureSessionStorage({ keys });

  // Every chat.group write that reaches the store resolves `landed` (the store itself is untouched).
  let landed = deferred();
  mockWeb.store = new Proxy(web, {
    get(t, p, r) {
      if (p === 'setItem') {
        return async (k: string, v: string) => {
          await t.setItem(k, v);
          if (k.startsWith('chat.group.')) landed.resolve();
        };
      }
      return Reflect.get(t, p, r);
    },
  });

  // The relay's last answer of a visit, held on demand. A visit reads the chat (fetch), then checks this
  // device's key packages (the last relay call), works the MLS state and saves it. The answer came back while
  // signed in; the save is still to come when sign-out runs. Later relay calls fail once signed out, as on
  // the real backend.
  const be = FakeBackend.withFixture({ joIsMember: true });
  const real = be.clientFor(null, { trackAppSession: true });
  let gate: ReturnType<typeof deferred> | null = null;
  let fetched = false;
  let fetching = deferred();
  const api = new Proxy(real, {
    get(t, p) {
      const v = Reflect.get(t, p, t) as unknown;
      if (p === 'chatFetch') {
        return async (...a: Parameters<HearthApi['chatFetch']>) => {
          const rows = await t.chatFetch(...a);
          if (gate) fetched = true;
          return rows;
        };
      }
      if (p === 'chatKeyPackageCount') {
        return async () => {
          const g = gate && fetched ? gate : null;
          const n = await t.chatKeyPackageCount();
          if (g) { fetching.resolve(); await g.promise; }
          return n;
        };
      }
      return typeof v === 'function' ? (v as (...x: unknown[]) => unknown).bind(t) : v;
    },
  }) as HearthApi;

  const clearSessionStore = async () => {
    if (moment === 'when clear starts') gate?.resolve();
    await web.clear();
    if (moment === 'after clear finishes') gate?.resolve();
  };

  await renderApp(<Probe />, { be, user: 'chase', deps: { api, clearSessionStore } });
  fireEvent.press(await screen.findByRole('button', { name: "Open Grandparents – Dad's side" }, { timeout: 5000 }));
  expect(await screen.findByText('No messages yet. Say hello!', {}, { timeout: 15000 })).toBeTruthy();
  // Signed in with a chat open: sealed chat.* values and one key exist.
  expect([...local.m.keys()].some((k) => k.includes('chat.'))).toBe(true);
  expect(keys.held).not.toBeNull();

  // The poll (or a tap on "Check for new messages") is mid-fetch when the person signs out.
  landed = deferred();
  fetching = deferred();
  gate = deferred();
  fireEvent.press(screen.getByRole('button', { name: 'Check for new messages' }));
  await act(async () => { await fetching.promise; });

  await act(async () => { await app!.signOut(); });
  // Let the messenger's in-flight visit finish (or be stopped): its save lands within this window if it lands.
  await act(async () => {
    let t: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([landed.promise.then(() => sleep(50)), new Promise<void>((r) => { t = setTimeout(r, 3000); })]);
    clearTimeout(t);
  });

  await waitFor(() => expect(screen.queryByText('No messages yet. Say hello!')).toBeNull());
  return { local, keys };
}

describe('PRIV-WEB-R5 web sign-out with the messenger still writing', () => {
  for (const moment of ['when clear starts', 'after clear finishes'] as Moment[]) {
    it(`PRIV-WEB-R5 a messenger write landing ${moment} leaves no sealed chat.* data and no IndexedDB key behind`, async () => {
      const { local, keys } = await signOutWithMessengerWriteLanding(moment);
      // Report names only, never values.
      expect([...local.m.keys()].filter((k) => k.startsWith('hs.') || /(^|\.)chat\.|auth-token/.test(k))).toEqual([]);
      expect(keys.held).toBeNull();
    }, 30000);
  }
});
