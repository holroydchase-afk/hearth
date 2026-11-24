// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// GUX-R1, GUX-R3 (SPEC-LIFE-CALENDAR): Birthdays opened from Gallery ("See birthdays", or the card's "Add my birthday",
// ?add=mine) sits in Gallery's stack, so its back button reads "Gallery" and returns there, like Search.
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { BirthdaysScreen } from '../../../screens/Birthdays';
import { MoreRowGate } from '../../../screens/MoreScreen';
const close = () => router.dismissTo('/gallery');
export default function GalleryBirthdays() {
  const { add } = useLocalSearchParams<{ add?: string }>();
  return (
    <MoreRowGate row="birthdays">
      <BirthdaysScreen backTo="Gallery" onBack={close} startMine={add === 'mine'} />
    </MoreRowGate>
  );
}
