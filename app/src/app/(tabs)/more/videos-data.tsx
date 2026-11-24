// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// DEC-87 (SPEC-MEDIA 5.1): More → Videos and data, its own screen in More's stack.
import React from 'react';
import { MoreRowGate, MoreVideosData } from '../../../screens/MoreScreen';
export default function VideosDataRoute() {
  return <MoreRowGate row="videosData"><MoreVideosData /></MoreRowGate>;
}
