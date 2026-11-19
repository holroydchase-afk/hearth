// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// The phone's own tab bar on Android and on iPhone with Easy view Off (RD-106: glass on iOS 26, classic before);
// Hearth's fixed bar with words on iPhone with Easy view On (LIVE-1) and on the web.
import { Redirect, Tabs } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import React from 'react';
import { Platform } from 'react-native';
import { AppGate } from '../../screens/AppGate';
import { useNewMessages } from '../../messenger/newMessages';
import { resetMore } from '../../screens/MoreScreen';
import { HearthTabBar, NATIVE_TAB_OPTIONS, TAB_ICONS, floatingTabBar, nativeLabelMode, nativeTabLook, tabsFor, usesNativeTabs, type TabName } from '../../screens/TabBar';
import { useApp } from '../../state/AppContext';
import { TabBarSpaceContext, TAB_BAR_FLOAT_SPACE } from '../../ui/tabBarSpace';
import { useTheme } from '../../ui/theme';

// RD-9: Gallery first (RD-10), Share in the middle for parents, then Feed and More.
const ALL: TabName[] = ['gallery', 'share', 'feed', 'more'];

export default function TabsLayout() {
  const app = useApp();
  const { c, bigText: easyView } = useTheme();
  const { total: newMessages } = useNewMessages(); // RD-14: the dot on More
  if (app.status === 'signedOut') return <Redirect href="/sign-in" />;
  if (app.status !== 'ready' || !app.space) return <AppGate />;
  const role = app.space.role;
  const tabs = tabsFor(role);
  const allowed = new Set(tabs.map((t) => t.name));

  if (usesNativeTabs(Platform.OS, easyView)) {
    const look = nativeTabLook(Platform.OS, easyView);
    return (
      <NativeTabs
        minimizeBehavior={NATIVE_TAB_OPTIONS.minimizeBehavior}
        labelVisibilityMode={nativeLabelMode(easyView)}
        labelStyle={{ default: { ...NATIVE_TAB_OPTIONS.labelStyle, color: c.muted }, selected: { ...NATIVE_TAB_OPTIONS.labelStyle, color: c.accent } }}
        tintColor={c.accent}
        backgroundColor={look.themedBackground ? c.bg : undefined}
      >
        {ALL.map((name) => {
          const tab = tabs.find((t) => t.name === name);
          return (
            <NativeTabs.Trigger key={name} name={name} hidden={!allowed.has(name)}
              listeners={name === 'more' ? { tabPress: resetMore } : undefined}
              accessibilityLabel={name === 'more' && newMessages > 0 ? 'More, new message' : look.labelHidden ? (tab?.label ?? name) : undefined}>
              <NativeTabs.Trigger.Icon sf={TAB_ICONS[name].sf as never} md={TAB_ICONS[name].md as never} />
              <NativeTabs.Trigger.Label hidden={look.labelHidden}>{tab?.label ?? name}</NativeTabs.Trigger.Label>
              {/* RD-14: an empty badge is the phone's own dot. */}
              {name === 'more' ? <NativeTabs.Trigger.Badge hidden={newMessages === 0} selectedBackgroundColor={c.accent}>{' '}</NativeTabs.Trigger.Badge> : null}
            </NativeTabs.Trigger>
          );
        })}
      </NativeTabs>
    );
  }

  // RD-108 / RD-109: the web's lookalike of iOS 26's floating glass bar (Easy view Off); screens leave room under it.
  const floating = floatingTabBar(Platform.OS, easyView);
  return (
    <TabBarSpaceContext.Provider value={floating ? TAB_BAR_FLOAT_SPACE : 0}>
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => (
        <HearthTabBar
          role={role}
          current={props.state.routes[props.state.index]!.name as TabName}
          newMessages={newMessages}
          floating={floating}
          onNavigate={(t) => {
            if (t === 'more') resetMore(); // tapping More again shows the menu, like the phone's own tabs
            // SDK 58: the tab bar gets navigateToTab(routeKey) instead of navigation.
            const key = props.state.routes.find((r) => r.name === t)?.key;
            if (key) props.navigateToTab(key);
          }}
        />
      )}
    >
      {ALL.map((name) => (
        <Tabs.Screen key={name} name={name} options={{ href: allowed.has(name) ? undefined : null }} />
      ))}
    </Tabs>
    </TabBarSpaceContext.Provider>
  );
}
