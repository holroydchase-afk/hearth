// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { last4 } from '../api/phone';
import { DEMO_MODE } from '../demo/flags';
import { useApp } from '../state/AppContext';
import { dateWords } from '../calendar/dates';
import { useFamilyDates } from '../calendar/useFamilyDates';
import { BackButton, Button, GroupedSection, Screen, Txt } from '../ui/kit';
import { AppGate } from './AppGate';
import { PRIVACY } from './Birthdays';
import { NoticeTiming } from './NoticeTiming';
import { ProblemDetailsCard } from './ProblemDetails';
import { DeleteAccount, HowToTell, PhotoHelpers, Privacy, ReplyAudience, SignOut } from './Preferences';

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

/** CAL-S2 (Chase, Nov 26): the birthday lives here, not on Gallery. Every member; hidden quietly on a server without 0029. */
function MyBirthday() {
  const app = useApp();
  const me = app.session?.userId ?? null;
  const cal = useFamilyDates(app.deps.api, app.space?.space_id ?? null);
  if (!me || cal.status !== 'ready') return null;
  const mine = cal.dates.find((d) => d.member_id === me);
  return (
    <GroupedSection testID="my-birthday">
      <Txt variant="title2" role="header">My birthday</Txt>
      <Txt>{mine ? dateWords(mine.month, mine.day) : "Your birthday isn't added yet."}</Txt>
      <Txt tone="muted">{PRIVACY}</Txt>
      <Button label={mine ? 'Change my birthday' : 'Add my birthday'} variant="secondary" onPress={() => router.push('/more/birthdays?add=mine')} />
    </GroupedSection>
  );
}

function MeReady({ onBack }: { onBack?: () => void }) {
  const app = useApp();
  return (
    <Screen>
      {onBack ? <BackButton to="More" onPress={onBack} /> : null}
      <Txt variant="title1" role="header">Me</Txt>
      <GroupedSection>
        <WhoYouAre />
        {/* RD-15: viewers reach Me from More too, so say what each can do. */}
        <Txt tone="muted">{app.space?.can_post ? 'You can share photos and choose who sees them.' : 'You can look at photos and write back.'}</Txt>
      </GroupedSection>
      <MyBirthday />
      {/* EF-HE-4 (Chase, Nov 24): Easy view and Light or dark live only in More, like Theme (RD-97). */}
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
