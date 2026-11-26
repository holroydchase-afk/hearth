// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// FLOW-15..17 (DEC-90, SPEC-SHARE-FLOW): the day sheet. A month grid in a bottom sheet replaces the typed day: weekday
// initials, the month and year, earlier and later month buttons, today ringed, quick chips (Today, Tomorrow, the
// coming Saturday) and Done. Every cell is 48 pt tall and at least 44 wide; day numbers are `body`. A tap on the
// page behind (the scrim) closes it too, and a day is always a real `YYYY-MM-DD`.
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WEEKDAY_INITIALS, dayLabel, isoDay, isoOf, monthGrid, monthTitle, parseIso, quickDays, shiftMonth, shortDayLabel } from '../share/dayPicker';
import { Button, SystemIcon, Txt } from '../ui/kit';
import { RADIUS, SPACE, useTheme } from '../ui/theme';

export function DaySheet({ value, onPick, onClose }: { value: string; onPick: (iso: string) => void; onClose: () => void }) {
  const { c, os, bigText } = useTheme();
  const now = new Date();
  const today = isoOf(now);
  const start = parseIso(value) ?? { year: now.getFullYear(), month0: now.getMonth() };
  const [view, setView] = useState({ year: start.year, month0: start.month0 });
  const min = bigText ? 60 : 48;
  const corner = os === 'android' ? 28 : 14;

  const pick = (iso: string) => {
    const p = parseIso(iso);
    if (p) setView({ year: p.year, month0: p.month0 }); // a quick chip moves the grid to its month
    onPick(iso);
  };
  const monthBtn = (label: string, by: 1 | -1) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => setView((v) => shiftMonth(v.year, v.month0, by))}
      android_ripple={{ color: c.line }} style={({ pressed }) => [styles.month, { minHeight: min, opacity: pressed && os !== 'android' ? 0.7 : 1 }]}>
      <SystemIcon icon={by < 0 ? { sf: 'chevron.backward', md: 'chevron_left' } : { sf: 'chevron.forward', md: 'chevron_right' }} color={c.ink} />
    </Pressable>
  );

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <View accessibilityViewIsModal style={[styles.wrap, { backgroundColor: c.scrim }]}>
        <Pressable testID="day-sheet-scrim" accessibilityRole="button" accessibilityLabel="Close the calendar" onPress={onClose} style={styles.scrim} />
        <SafeAreaView edges={['bottom']} testID="day-sheet"
          style={[styles.sheet, { backgroundColor: c.bg, borderTopLeftRadius: corner, borderTopRightRadius: corner }]}>
          <View style={styles.titleRow}>
            {monthBtn('Earlier month', -1)}
            <Txt variant="headline" role="header" style={styles.title}>{monthTitle(view.year, view.month0)}</Txt>
            {monthBtn('Later month', 1)}
          </View>

          <View style={styles.row}>
            {quickDays(now).map((q) => (
              <Pressable key={q.label} accessibilityRole="button" accessibilityLabel={q.label === 'Saturday' ? shortDayLabel(q.iso) : q.label} onPress={() => pick(q.iso)}
                android_ripple={{ color: c.line }}
                style={({ pressed }) => [styles.quick, { minHeight: min, backgroundColor: c.accentSoft, opacity: pressed && os !== 'android' ? 0.7 : 1 }]}>
                <Txt variant="body">{q.label === 'Saturday' ? shortDayLabel(q.iso) : q.label}</Txt>
              </Pressable>
            ))}
          </View>

          <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {WEEKDAY_INITIALS.map((w, i) => (
              <View key={`${w}${i}`} style={styles.cellBox}><Txt variant="body" tone="muted">{w}</Txt></View>
            ))}
          </View>
          {monthGrid(view.year, view.month0).map((week, wi) => (
            <View key={wi} style={styles.row}>
              {week.map((d, di) => {
                if (d === null) return <View key={di} style={[styles.cellBox, { minHeight: min }]} />;
                const iso = isoDay(view.year, view.month0, d);
                const on = iso === value;
                const isToday = iso === today;
                return (
                  <Pressable key={di} testID={`day-${iso}`} accessibilityRole="button" accessibilityLabel={dayLabel(iso)}
                    accessibilityState={{ selected: on }} onPress={() => pick(iso)} android_ripple={{ color: c.line }}
                    style={({ pressed }) => [styles.cell, {
                      minHeight: min, minWidth: 44, borderColor: isToday ? c.ink : 'transparent', backgroundColor: on ? c.ink : 'transparent',
                      opacity: pressed && os !== 'android' ? 0.7 : 1,
                    }]}>
                    <Txt variant="body" style={on ? { color: c.bg } : undefined}>{String(d)}</Txt>
                    {isToday ? <View testID="day-today" /> : null}
                  </Pressable>
                );
              })}
            </View>
          ))}

          <Button variant="tinted" label="Done" onPress={onClose} style={[styles.done, { minHeight: min }]} />
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  scrim: { flex: 1 }, // the page behind, above the sheet: a tap on it closes the sheet
  sheet: { paddingHorizontal: SPACE.lg, paddingTop: SPACE.lg, paddingBottom: SPACE.sm, gap: SPACE.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { flex: 1, textAlign: 'center' },
  month: { minWidth: 48, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: 0 },
  quick: { flex: 1, minWidth: 48, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center', marginHorizontal: SPACE.xs },
  cellBox: { flex: 1, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  cell: { flex: 1, borderRadius: RADIUS.pill, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  done: { alignSelf: 'stretch', marginTop: SPACE.sm },
});
