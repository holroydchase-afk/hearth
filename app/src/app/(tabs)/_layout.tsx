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
import { HearthTabBar, TAB_ICONS, floatingTabBar, nativeLabelMode, nativeTabLabelStyle, nativeTabLook, tabsFor, usesNativeTabs, type TabName } from '../../screens/TabBar';
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
    const label = { fontSize: nativeTabLabelStyle(easyView).fontSize }; // TYPE-6: caption1
    return (
      <NativeTabs
        minimizeBehavior={look.minimize}
        labelVisibilityMode={nativeLabelMode(easyView)}
        labelStyle={{ default: { ...label, color: c.muted }, selected: { ...label, color: c.accent } }}
        tintColor={c.accent}
        backgroundColor={look.themedBackground ? c.bg : undefined}
      >
        {ALL.map((name) => {
          const tab = tabs.find((t) => t.name === name);
          return (
            <NativeTabs.Trigger key={name} name={name} hidden={!allowed.has(name)}
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
      tabBar={(props) => {
        const current = props.state.routes[props.state.index]!.name as TabName;
        return (
        <HearthTabBar
          role={role}
          current={current}
          newMessages={newMessages}
          floating={floating}
          onNavigate={(t) => {
            // SDK 58: the tab bar gets navigateToTab(routeKey) instead of navigation. ENG-R6: like the phone's own
            // tab bars, a tap is a tabPress first, so tapping the tab you're on takes its stack back to its first
            // screen (the stack listens for it); the phone's own bar does this itself.
            const key = props.state.routes.find((r) => r.name === t)?.key;
            if (!key) return;
            const press = props.emitter.emit({ type: 'tabPress', target: key, canPreventDefault: true });
            if (t !== current && !press.defaultPrevented) props.navigateToTab(key);
          }}
        />
        );
      }}
    >
      {ALL.map((name) => (
        // ENG-R6: leaving More takes it back to its menu, as tapping More always did here.
        <Tabs.Screen key={name} name={name} options={{ href: allowed.has(name) ? undefined : null, popToTopOnBlur: name === 'more' }} />
      ))}
    </Tabs>
    </TabBarSpaceContext.Provider>
  );
}
