// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// RD-109: how much room a screen leaves at its bottom for a floating tab bar (the web lookalike of iOS 26's glass
// bar, RD-108). 0 when the bar is fixed and takes its own space.
import { createContext, useContext } from 'react';

/** The floating bar's height (64) plus its 16 pt gap above the bottom edge and 16 pt of breathing room. */
export const TAB_BAR_FLOAT_SPACE = 96;
export const TabBarSpaceContext = createContext(0);
export const useTabBarSpace = () => useContext(TabBarSpaceContext);
