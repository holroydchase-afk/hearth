// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Push wiring. Without an EAS projectId (no credentials here) every call is a no-op.
// Payloads never carry captions, names of children or image URLs (BETA-NOTIFY-2):
// the only field we read is data.post_id.
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';

function projectId(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? null;
}

export type PushStatus = 'granted' | 'undetermined' | 'denied' | 'off';

/** HIG-1: what the phone says about notices, without asking. 'off': push isn't set up here (web, no project). */
export async function pushStatus(): Promise<PushStatus> {
  if (!projectId() || Platform.OS === 'web') return 'off';
  try {
    const p = await Notifications.getPermissionsAsync();
    if (p.granted) return 'granted';
    return p.canAskAgain === false || p.status === 'denied' ? 'denied' : 'undetermined';
  } catch {
    return 'off';
  }
}

/** Returns an Expo push token, or null when push is not configured or not allowed.
 *  HIG-1: the phone's "Allow notifications?" shows only with ask: true (the Photos card's button), never at launch. */
export async function registerForPush({ ask = false }: { ask?: boolean } = {}): Promise<string | null> {
  const id = projectId();
  if (!id || Platform.OS === 'web') return null;
  try {
    const current = await Notifications.getPermissionsAsync();
    let granted = current.granted;
    if (!granted && ask) granted = (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) return null;
    const token = await Notifications.getExpoPushTokenAsync({ projectId: id });
    return token.data;
  } catch {
    return null;
  }
}

/** AE-10: call back with (post id, time the phone got the notice) for each notice seen. */
export function listenForArrivals(onArrival: (postId: string, at: number) => void): () => void {
  if (Platform.OS === 'web' || !projectId()) return () => {};
  const take = (n: Notifications.Notification | undefined) => {
    const postId = n?.request.content.data?.post_id;
    if (typeof postId === 'string' && typeof n?.date === 'number') onArrival(postId, n.date);
  };
  const a = Notifications.addNotificationReceivedListener(take);
  const b = Notifications.addNotificationResponseReceivedListener((r) => take(r.notification));
  // notices that arrived while the app was closed and are still in the tray
  Notifications.getPresentedNotificationsAsync().then((ns) => ns.forEach(take)).catch(() => {});
  return () => { a.remove(); b.remove(); };
}

/** Tapping a notice opens that post (BETA-NOTIFY-3). */
export function useNotificationTaps(open: (postId: string) => void): void {
  useEffect(() => {
    if (Platform.OS === 'web' || !projectId()) return;
    const handle = (r: Notifications.NotificationResponse | null) => {
      const postId = r?.notification.request.content.data?.post_id;
      if (typeof postId === 'string') open(postId);
    };
    Notifications.getLastNotificationResponseAsync().then(handle).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
  }, [open]);
}
