// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// SEARCH-UI-1 / ENG-R6: Search, opened from Gallery's "Search photos" field; "Back to Gallery" returns there.
import { router } from 'expo-router';
import React from 'react';
import { AppGate } from '../../../screens/AppGate';
import { SearchScreen } from '../../../screens/SearchScreen';
import { useApp } from '../../../state/AppContext';
const close = () => router.dismissTo('/gallery');
export default function Search() {
  const app = useApp();
  return app.status === 'ready' && app.space ? <SearchScreen onClose={close} /> : <AppGate />;
}
