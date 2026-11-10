// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// VID-17: the inlined placeholder poster is exactly app/assets/video-poster.jpg (VID-15 checks that file is clean).
import { readFileSync } from 'fs';
import { join } from 'path';
import { placeholderPoster } from '../videoPosterPlaceholder';

it('VID-17 placeholderPoster() returns the bytes of app/assets/video-poster.jpg', async () => {
  const file = new Uint8Array(readFileSync(join(__dirname, '../../../assets/video-poster.jpg')));
  expect(await placeholderPoster()).toEqual(file);
});
