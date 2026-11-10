// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
import type { HearthApi } from '../HearthApi';

export type ContractUser = 'poster' | 'viewerIn' | 'viewerOut' | 'joiner' | 'ratelimit' | 'starter';

/**
 * Anything that can hand out HearthApi clients for the standard cast:
 *  - poster:    owner of `spaceId`, manages `circleIn` and `circleOut`
 *  - viewerIn:  viewer in `circleIn` only
 *  - viewerOut: viewer in `circleOut` only (same space, never in circleIn)
 *  - joiner:    signed-in user who is not yet a member (for invite redemption)
 *  - ratelimit: throwaway user for the S10 rate-limit test (gets locked out for 10 minutes)
 *  - starter:   signed-in user in no family, for Start a family (0024; ends up owning one)
 */
export interface ContractHarness {
  name: string;
  spaceId: string;
  circleIn: string;
  circleOut: string;
  joinerEmail?: string;
  /** Start a family (0024): the starter's email, so a parent can invite them (BETA-START-7). */
  starterEmail?: string;
  /** Start a family (0024): flip the server switch `start_family_open` (service role on a real stack). Absent = can't. */
  setStartFamilyOpen?(open: boolean): Promise<void>;
  has(user: ContractUser): boolean;
  as(user: ContractUser): HearthApi;
  anon(): HearthApi;
  /** sign-media + object storage are reachable (needs B2 for a real stack). */
  supportsMedia: boolean;
  /** Give a draft one ready media item (publish_post needs at least one), however this stack can. */
  attachReadyMedia(poster: HearthApi, postId: string): Promise<void>;
}

export type HarnessFactory = () => Promise<ContractHarness>;
