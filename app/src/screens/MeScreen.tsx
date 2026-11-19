// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
import React, { useEffect, useState } from 'react';
import { last4 } from '../api/phone';
import { DEMO_MODE } from '../demo/flags';
import { useApp } from '../state/AppContext';
import { BackButton, GroupedSection, Screen, Txt } from '../ui/kit';
import { AppGate } from './AppGate';
import { NoticeTiming } from './NoticeTiming';
import { ProblemDetailsCard } from './ProblemDetails';
import { DeleteAccount, EasyView, HowToTell, LightOrDark, PhotoHelpers, Privacy, ReplyAudience, SignOut } from './Preferences';

/** `onBack`: opened from More (RD-15), so a "‹ More" back button (spoken "Back to More") sits above the title (GUX-R1). */
export function MeScreen({ onBack }: { onBack?: () => void } = {}) {
  const app = useApp();
  if (app.status !== 'ready') return <AppGate />;
  return <MeReady onBack={onBack} />;
}

/** UI-4: the demo names its made-up person; the real app says which email you signed in with. */
function WhoYouAre() {
  const app = useApp();
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    if (!DEMO_MODE) return;
    let live = true;
    app.deps.api.myProfile().then((p) => { if (live) setName(p.display_name); }).catch(() => {});
    return () => { live = false; };
  }, [app.deps.api]);
  if (!DEMO_MODE) {
    const s = app.session;
    // TD-UX-R7b: a phone-only account is named by the last 4 digits only, never the whole number.
    if (s && !s.email && s.phone) return <Txt>{`Signed in with the mobile number ending ${last4(s.phone)}`}</Txt>;
    return <Txt>{`Signed in as ${s?.email ?? ''}`}</Txt>;
  }
  return <Txt>{name ? `You're ${name}, in the made-up sample family.` : "You're in the made-up sample family."}</Txt>;
}

function MeReady({ onBack }: { onBack?: () => void }) {
  const app = useApp();
  return (
    <Screen>
      {onBack ? <BackButton to="More" onPress={onBack} /> : null}
      <Txt variant="display" role="header">Me</Txt>
      <GroupedSection>
        <WhoYouAre />
        {/* RD-15: viewers reach Me from More too, so say what each can do. */}
        <Txt variant="muted">{app.space?.can_post ? 'You can share photos and choose who sees them.' : 'You can look at photos and write back.'}</Txt>
      </GroupedSection>
      <EasyView heading />
      <LightOrDark />
      {/* RD-15 / RD-97: Theme lives in More (owner only). */}
      <HowToTell />
      <ReplyAudience />
      <PhotoHelpers />
      <Privacy who={app.helper} />
      {/* DEMO-8: the public demo has no test tools and no way out of the sample family but Start over. */}
      {DEMO_MODE ? null : (
        <>
          <NoticeTiming />
          <ProblemDetailsCard />
          <SignOut />
          <DeleteAccount />
        </>
      )}
    </Screen>
  );
}
