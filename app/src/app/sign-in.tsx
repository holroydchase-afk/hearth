// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { SignInScreen } from '../screens/SignInScreen';

/** /sign-in?with=email opens on the email field (BETA-SMS-12). */
export default function SignInRoute() {
  const { with: via } = useLocalSearchParams<{ with?: string }>();
  return <SignInScreen start={via === 'email' ? 'email' : undefined} />;
}
