// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// WEB-APP-10 (HRT-WEB.1): the web work leaves the iPhone/Android session store alone. The 32-byte key lives in
// the Keychain/Keystore (expo-secure-store, mocked in jest.setup.js) and the AES-GCM blob in AsyncStorage.
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { secureSessionStorage } from '../secureSession';

const SESSION = JSON.stringify({ access_token: 'native-access-AAA', refresh_token: 'native-refresh-BBB', user: { id: 'u-native' } });

describe('WEB-APP-10 native secureSession.ts is unchanged', () => {
  it('WEB-APP-10 the file matches the reviewed native version byte for byte (no native change in HRT-WEB.1)', () => {
    // If a later, reviewed PR changes the native store on purpose, update this hash in that PR.
    const src = readFileSync(join(__dirname, '..', 'secureSession.ts'));
    expect(createHash('sha256').update(src).digest('hex')).toBe('ed2f1e24f65fc70039615bd7083cb40bc86feefabf2e318946dd13eea7f5ff1b');
  });

  it('WEB-APP-10 round trip: the key goes to SecureStore (hk_), the sealed blob to AsyncStorage (hs_), no plain text', async () => {
    await secureSessionStorage.setItem('sb-x-auth-token', SESSION);
    const key = await SecureStore.getItemAsync('hk_sb-x-auth-token');
    expect(key && Buffer.from(key, 'base64').length).toBe(32);
    const blob = await AsyncStorage.getItem('hs_sb-x-auth-token');
    expect(blob).toBeTruthy();
    expect(blob).not.toContain('native-access-AAA');
    expect(Buffer.from(blob!, 'base64').toString('latin1')).not.toContain('native-refresh-BBB');
    expect(await secureSessionStorage.getItem('sb-x-auth-token')).toBe(SESSION);
  });

  it('WEB-APP-10 removeItem deletes both the blob and the Keychain key', async () => {
    await secureSessionStorage.setItem('chat.identity.u1', '{"id":1}');
    await secureSessionStorage.removeItem('chat.identity.u1');
    expect(await AsyncStorage.getItem('hs_chat.identity.u1')).toBeNull();
    expect(await SecureStore.getItemAsync('hk_chat.identity.u1')).toBeNull();
    expect(await secureSessionStorage.getItem('chat.identity.u1')).toBeNull();
  });

  it('WEB-APP-10 a tampered blob reads as signed out (null), not an error', async () => {
    await secureSessionStorage.setItem('sb-y-auth-token', SESSION);
    const raw = Buffer.from((await AsyncStorage.getItem('hs_sb-y-auth-token'))!, 'base64');
    raw[raw.length - 1]! ^= 1;
    await AsyncStorage.setItem('hs_sb-y-auth-token', raw.toString('base64'));
    await expect(secureSessionStorage.getItem('sb-y-auth-token')).resolves.toBeNull();
  });
});
