// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Life calendar v1 (SPEC-LIFE-CALENDAR, DEC-81): My birthday now lives in Me (CAL-S2, Chase Nov 26; the Gallery card is gone), the "Today is
// Grandma Jo's birthday" line (CAL-16) and More → Birthdays, "Birthdays and dates" (CAL-14/15). Month and day only:
// never a year or an age. No typing to give a birthday: 12 worded month buttons, then numbered day buttons, every
// target 48 pt (DS-1), every word 17 pt+ (DS-2). On a server without 0029 all of it hides quietly (CAL-17).
// CAL-18: labels are shown on screen only; nothing here logs them or puts them in a report.
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { isApiError, type FamilyDate, type FamilyDateKind } from '../api/HearthApi';
import { MONTHS, dateName, dateWords, daysIn, soonestFirst, todayLine, whenWords } from '../calendar/dates';
import { calendarMissing, markMissing, useFamilyDates } from '../calendar/useFamilyDates';
import { useApp } from '../state/AppContext';
import {
  AlertDialog,
  BackButton,
  Button,
  Card,
  Choice,
  Field,
  Loading,
  Notice,
  Screen,
  SystemIcon,
  Txt,
} from '../ui/kit';
import { MIN_TARGET, useTheme } from '../ui/theme';
import { backToMore } from './MoreScreen';

// CAL-S5 (QA-R1/B24): under PRIV-R2 not everyone sees it, so say who plainly.
export const PRIVACY = 'The people who can see you in Hearth will see the month and day. Never the year.';
const CHECK = { sf: 'checkmark', md: 'check' }; // GUX-R5: the picked month and day carry a checkmark
const CHEVRON = { sf: 'chevron.forward', md: 'chevron_right' }; // GUX-R8: a row you can tap says so
// GUX-R3: from Gallery, Birthdays opens in Gallery's own stack, so its back button reads "Gallery" and returns there.
const openBirthdays = () => router.push('/gallery/birthdays');

/** Plain words for a failed save; never the label, never server text. */
function didntSave(e: unknown): string {
  if (isApiError(e) && e.code === 'NETWORK') return 'No internet right now. Check your Wi-Fi, then try again.';
  if (isApiError(e) && e.code === '22023') return 'Pick a month and a day that are on the calendar.';
  return "That didn't save. Please try again.";
}

/** Month, then day: 12 worded month buttons, then a button for each day of that month. */
export function MonthDayPicker({
  month,
  day,
  onMonth,
  onDay,
}: {
  month: number | null;
  day: number | null;
  onMonth: (m: number) => void;
  onDay: (d: number) => void;
}) {
  return (
    <View style={{ gap: 12 }}>
      <Txt variant="headline">Month</Txt>
      <View style={styles.wrap}>
        {MONTHS.map((m, i) => (
          <Button
            key={m}
            label={m}
            variant="secondary"
            selected={month === i + 1}
            icon={month === i + 1 ? CHECK : undefined}
            onPress={() => onMonth(i + 1)}
          />
        ))}
      </View>
      {month ? (
        <>
          <Txt variant="headline">Day</Txt>
          <View style={styles.wrap}>
            {Array.from({ length: daysIn(month) }, (_, i) => i + 1).map((d) => (
              <Button
                key={d}
                label={dateWords(month, d)}
                text={String(d)}
                variant="secondary"
                selected={day === d}
                icon={day === d ? CHECK : undefined}
                onPress={() => onDay(d)}
              />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

/** CAL-16: one line at the top of Gallery on a day with a date, with "See birthdays". */
export function TodayLine() {
  const app = useApp();
  const cal = useFamilyDates(app.deps.api, app.space?.space_id ?? null);
  const line = cal.status === 'ready' ? todayLine(cal.dates, new Date(), app.session?.userId ?? null) : null;
  if (!line) return null;
  return (
    // TIDY-1 (Chase, Nov 28): one quiet line (Body 17, no card) under New for you, with a small See birthdays button.
    <View testID="today-line" style={{ alignItems: 'flex-start' }}>
      <Txt>{line}</Txt>
      <Button
        label="See birthdays"
        text="See birthdays"
        variant="quiet"
        onPress={openBirthdays}
        style={{ minHeight: MIN_TARGET, paddingHorizontal: 16, marginLeft: -16 }}
      />
    </View>
  );
}

type Form = { mode: 'mine' } | { mode: 'add' } | { mode: 'change'; date: FamilyDate };

const KINDS: { kind: FamilyDateKind; title: string; field: string; hint: string }[] = [
  { kind: 'birthday', title: 'Birthday', field: 'Whose birthday?', hint: 'Their name, like Mia' },
  { kind: 'anniversary', title: 'Anniversary', field: 'Whose anniversary?', hint: 'Their names, like Chase and Alex' },
  { kind: 'other', title: 'Something else', field: 'Name of the day', hint: 'Like Family reunion' },
];

/** Add my birthday, Change my birthday, Add a date (parents), Change (parents). */
function DateForm({
  form,
  mine,
  onDone,
  onCancel,
}: {
  form: Form;
  mine: FamilyDate | undefined;
  onDone: (saved: string) => void;
  onCancel: () => void;
}) {
  const app = useApp();
  const api = app.deps.api;
  const space = app.space!.space_id;
  const start = form.mode === 'change' ? form.date : form.mode === 'mine' ? mine : undefined;
  const [kind, setKind] = useState<FamilyDateKind>(start?.kind ?? 'birthday');
  const [label, setLabel] = useState(start?.label ?? '');
  const [month, setMonth] = useState<number | null>(start?.month ?? null);
  const [day, setDay] = useState<number | null>(start?.day ?? null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const linked = form.mode === 'mine' || (form.mode === 'change' && !!form.date.member_id);
  const title =
    form.mode === 'mine'
      ? mine
        ? 'Change my birthday'
        : 'Add my birthday'
      : form.mode === 'add'
        ? 'Add a date'
        : `Change ${dateName(form.date)}`;
  const k = KINDS.find((x) => x.kind === kind)!;

  const save = async () => {
    if (!linked && !label.trim()) {
      setProblem('Type a name first.');
      return;
    }
    if (!month || !day) {
      setProblem('Pick a month and a day first.');
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      if (form.mode === 'mine') await api.setMyBirthday(space, month, day);
      else {
        const memberId = form.mode === 'change' ? form.date.member_id : null;
        await api.saveFamilyDate({
          space,
          id: form.mode === 'change' ? form.date.id : null,
          kind: memberId ? 'birthday' : kind,
          label: memberId ? null : label.trim(),
          month,
          day,
          memberId,
        });
      }
      onDone(form.mode === 'mine' ? `Saved. ${dateWords(month, day)} is your birthday.` : 'Saved.');
    } catch (e) {
      if (calendarMissing(e)) {
        markMissing(api, space);
        onCancel();
      } else setProblem(didntSave(e));
    } finally {
      setBusy(false);
    }
  };
  // GUX-R7: the form is its own page: back reads "Birthdays", one heading. GUX-R1: Save stays fixed at the bottom.
  const footer = (
    <>
      {problem ? <Txt role="alert">{problem}</Txt> : null}
      {form.mode === 'mine' && month && day ? (
        <Txt variant="headline">{`Your birthday: ${dateWords(month, day)}`}</Txt>
      ) : null}
      <Button label="Save" variant="tinted" softDisabled={!month || !day} busy={busy} onPress={() => void save()} />
    </>
  );
  return (
    <Screen key="form" footer={footer}>
      <BackButton to="Birthdays" onPress={onCancel} />
      <Txt variant="title1" role="header">
        {title}
      </Txt>
      {form.mode === 'mine' ? <Txt>{PRIVACY}</Txt> : null}
      {linked ? null : (
        <>
          <View>
            {KINDS.map((x) => (
              <Choice
                key={x.kind}
                kind="radio"
                label={x.title}
                title={x.title}
                checked={kind === x.kind}
                onPress={() => setKind(x.kind)}
              />
            ))}
          </View>
          <Field label={k.field} placeholder={k.hint} value={label} maxLength={60} onChangeText={setLabel} />
        </>
      )}
      <MonthDayPicker
        month={month}
        day={day}
        onMonth={(m) => {
          setMonth(m);
          if (day && day > daysIn(m)) setDay(null);
        }}
        onDay={setDay}
      />
      <Button label="Cancel" variant="quiet" onPress={onCancel} />
    </Screen>
  );
}

/** One date in the list: what it is, the date in words and how soon. Parents tap it for Change and Delete. */
function DateRow({
  d,
  open,
  onPress,
}: {
  d: FamilyDate & { days: number };
  open: boolean;
  onPress: (() => void) | null;
}) {
  const { c } = useTheme();
  const when = whenWords(d.days);
  const words = (
    <View style={{ flex: 1, gap: 2 }}>
      <Txt variant="headline">{dateName(d)}</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12 }}>
        <Txt tone="muted">{dateWords(d.month, d.day)}</Txt>
        {when ? <Txt variant={d.days === 0 ? 'headline' : 'body'}>{when}</Txt> : null}
      </View>
    </View>
  );
  if (!onPress) return <View style={styles.row}>{words}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[dateName(d), dateWords(d.month, d.day), when].filter(Boolean).join(', ')}
      accessibilityState={{ expanded: open }}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
    >
      {words}
      <SystemIcon icon={CHEVRON} color={c.muted} size={18} />
    </Pressable>
  );
}

/** CAL-14/15: More → Birthdays, "Birthdays and dates". From Gallery (GUX-R3) it sits in Gallery's stack and its
 *  back button reads "Gallery"; `startMine` (GUX-R1, Me's "Add my birthday") opens on the Add my birthday form. */
export function BirthdaysScreen({
  backTo = 'More',
  onBack = backToMore,
  startMine = false,
}: {
  backTo?: string;
  onBack?: () => void;
  startMine?: boolean;
} = {}) {
  const app = useApp();
  const { c } = useTheme();
  const api = app.deps.api;
  const space = app.space?.space_id ?? null;
  const me = app.session?.userId ?? null;
  const parent = app.space?.role === 'owner' || app.space?.role === 'adult';
  const cal = useFamilyDates(api, space);
  const [form, setForm] = useState<Form | null>(startMine ? { mode: 'mine' } : null);
  const [open, setOpen] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<FamilyDate | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  if (!space) return null;
  const mine = cal.dates.find((d) => d.member_id === me);

  const done = (saved: string) => {
    setForm(null);
    setOpen(null);
    setNotice(saved);
    void cal.reload();
  };
  const remove = async (d: FamilyDate) => {
    setConfirm(null);
    try {
      await api.deleteFamilyDate(d.id);
      setOpen(null);
      setNotice('Deleted.');
    } catch (e) {
      if (calendarMissing(e)) markMissing(api, space);
      else setNotice("That date wasn't deleted. Please try again.");
    }
    void cal.reload();
  };

  if (form) return <DateForm form={form} mine={mine} onDone={done} onCancel={() => setForm(null)} />;
  return (
    <Screen key="list">
      <BackButton to={backTo} onPress={onBack} />
      <Txt variant="title1" role="header">
        Birthdays and dates
      </Txt>
      {/* GUX-R2: "Saved. December 8 is your birthday." at the top, in view (the list opens scrolled to the top) */}
      {notice ? <Notice tone="good" text={notice} onClose={() => setNotice(null)} /> : null}
      <Txt tone="muted">Only your family can see these.</Txt>
      {cal.status === 'missing' ? <Txt>Birthdays aren't ready on Hearth yet. They're coming soon.</Txt> : null}
      {cal.status === 'loading' ? <Loading words="Loading the dates…" /> : null}
      {cal.status === 'error' ? (
        <>
          <Txt>The dates can't load right now. Try again in a minute, or ask Chase.</Txt>
          <Button label="Try again" variant="secondary" onPress={() => void cal.reload()} />
        </>
      ) : null}
      {cal.status === 'ready' ? (
        <>
          {parent ? (
            <Button
              label="Add a date"
              variant="tinted"
              icon={{ sf: 'plus', md: 'add' }}
              onPress={() => setForm({ mode: 'add' })}
            />
          ) : null}
          {!parent || !mine ? (
            <Button
              label={mine ? 'Change my birthday' : 'Add my birthday'}
              variant={parent ? 'secondary' : 'tinted'}
              onPress={() => setForm({ mode: 'mine' })}
            />
          ) : null}
          {cal.dates.length ? null : <Txt tone="muted">No dates yet.</Txt>}
          <View>
            {soonestFirst(cal.dates).map((d, i) => (
              <View key={d.id} style={i ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line } : null}>
                <DateRow
                  d={d}
                  open={open === d.id}
                  onPress={parent ? () => setOpen(open === d.id ? null : d.id) : null}
                />
                {parent && open === d.id ? (
                  <View style={[styles.wrap, { paddingBottom: 12 }]}>
                    <Button label="Change" variant="secondary" onPress={() => setForm({ mode: 'change', date: d })} />
                    <Button label="Delete" variant="secondary" onPress={() => setConfirm(d)} />
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        </>
      ) : null}
      {confirm ? (
        <AlertDialog
          title="Delete this date?"
          body={`${dateName(confirm)}, ${dateWords(confirm.month, confirm.day)}. It's removed for everyone in the family.`}
          keep="Keep it"
          destroy="Delete"
          onKeep={() => setConfirm(null)}
          onDestroy={() => void remove(confirm)}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { minHeight: MIN_TARGET + 12, flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
});
