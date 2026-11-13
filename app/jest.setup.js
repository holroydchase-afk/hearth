/* global jest */
// Deterministic, Node-backed stand-ins for native modules used by pure code.
const nodeCrypto = require('crypto');

jest.mock('expo-crypto', () => ({
  getRandomBytes: (n) => new Uint8Array(require('crypto').randomBytes(n)),
  getRandomValues: (a) => { require('crypto').randomFillSync(a); return a; },
  randomUUID: () => require('crypto').randomUUID(),
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-secure-store', () => {
  const m = new Map();
  return {
    getItemAsync: async (k) => (m.has(k) ? m.get(k) : null),
    setItemAsync: async (k, v) => { m.set(k, v); },
    deleteItemAsync: async (k) => { m.delete(k); },
  };
});

jest.mock('./src/notify/push', () => ({
  registerForPush: jest.fn(async () => null),
  pushStatus: jest.fn(async () => 'off'),
  listenForArrivals: jest.fn(() => () => {}),
  useNotificationTaps: () => {},
}));

if (!globalThis.crypto || !globalThis.crypto.getRandomValues) {
  globalThis.crypto = nodeCrypto.webcrypto;
}

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

// VID-14..21 (SPEC-MEDIA 4.1): expo-video is native; tests get a small stand-in. Every player is kept in
// __players so a test can read what it was given (source, muted, play calls) and emit events
// (`player.__emit('statusChange', { status: 'error', error: { message: 'x' } })`).
jest.mock('expo-video', () => {
  const React = require('react');
  const { View } = require('react-native');
  const players = [];
  function makePlayer(source) {
    const listeners = new Map();
    const player = {
      source,
      playing: false,
      muted: false,
      volume: 1,
      loop: false,
      status: 'readyToPlay',
      currentTime: 0,
      duration: 0,
      play: jest.fn(() => { player.playing = true; }),
      pause: jest.fn(() => { player.playing = false; }),
      replace: jest.fn((s) => { player.source = s; }),
      replaceAsync: jest.fn(async (s) => { player.source = s; }),
      release: jest.fn(),
      addListener: jest.fn((event, cb) => {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event).add(cb);
        return { remove: () => listeners.get(event).delete(cb) };
      }),
      removeAllListeners: jest.fn(() => listeners.clear()),
      generateThumbnailsAsync: jest.fn(async (times) => [].concat(times).map((t) => ({ width: 480, height: 270, requestedTime: t, actualTime: t }))),
      __emit(event, payload) {
        if (event === 'statusChange' && payload && payload.status) player.status = payload.status;
        for (const cb of [...(listeners.get(event) || [])]) cb(payload);
      },
    };
    players.push(player);
    return player;
  }
  function useVideoPlayer(source, setup) {
    const ref = React.useRef(null);
    if (!ref.current) {
      ref.current = makePlayer(source);
      if (setup) setup(ref.current);
    } else if (ref.current.source !== source) {
      ref.current.replace(source);
    }
    return ref.current;
  }
  function VideoView(props) {
    return React.createElement(View, { testID: 'expo-video-view', style: props.style });
  }
  return {
    __players: players,
    createVideoPlayer: makePlayer,
    useVideoPlayer,
    VideoView,
    isPictureInPictureSupported: () => false,
    clearVideoCacheAsync: async () => {},
  };
});
