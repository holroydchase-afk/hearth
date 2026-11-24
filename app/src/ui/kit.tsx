// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Grandparent-first building blocks in each phone's own style (DESIGN-SYSTEM.md): Apple's on iPhone and the
// web, Material 3 on Android. Every tappable thing is a Button or Choice: it always has an
// accessibilityLabel, a visible word (DS-3), and a 48 pt minimum target (DS-1).
import { SymbolView } from 'expo-symbols';
import React, { useRef, type ReactNode } from 'react';
import {
  ActivityIndicator, Animated, Modal, PanResponder, Platform, Pressable, type PanResponderCallbacks, ScrollView, StyleSheet, Switch, Text, TextInput, View,
  useWindowDimensions, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LABEL_SCALE_CAP, MIN_TARGET, RADIUS, FONT, STAMP_MARK, dialogRadius, iconSize, sheetShouldClose, useTheme, type TextStyleName } from './theme';
import { useTypingField } from './typing';
import { useTabBarSpace } from './tabBarSpace';

/** A system symbol: SF Symbol name on iPhone, Material Symbol name on Android and the web. */
export interface Icon { sf: string; md: string }

export function SystemIcon({ icon, color, size = 22 }: { icon: Icon; color: string; size?: number }) {
  // HIG-11: symbols grow with the phone's text size, like the words beside them (up to LABEL_SCALE_CAP).
  const { fontScale } = useWindowDimensions();
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <SymbolView name={{ ios: icon.sf as never, android: icon.md as never, web: icon.md as never }} size={iconSize(size, fontScale)} tintColor={color} />
    </View>
  );
}

/** Txt's color, separate from its style (SPEC-TYPE): the old muted variant is body + tone="muted". */
export type TxtTone = 'ink' | 'muted' | 'accent' | 'danger';

export function Txt({ variant = 'body', tone = 'ink', emphasized, level, style, children, role, testID, numberOfLines, selectable, label }: {
  selectable?: boolean;
  /** What a screen reader says, when it must be the words exactly (a heading built from parts). Defaults to the text. */
  label?: string;
  /** TYPE-6: one of Apple's named text styles (SPEC-TYPE). */
  variant?: TextStyleName; tone?: TxtTone; emphasized?: boolean;
  /** A header's level when it is not the style's own (Share's "New post" is title2 yet the page's one h1, R23). */
  level?: 1 | 2;
  style?: StyleProp<TextStyle>; children: ReactNode; role?: 'header' | 'alert' | 'text'; testID?: string; numberOfLines?: number;
}) {
  const { c, type } = useTheme();
  // FONT-2 (DEC-78) and TYPE-4: the weight is carried by the family; titles and headline SemiBold, the rest Regular
  // unless emphasized (RD-55: no Bold anywhere).
  const s = type[variant];
  const color = { ink: c.ink, muted: c.muted, accent: c.accent, danger: c.dangerText }[tone];
  const v: TextStyle = { fontFamily: emphasized ? FONT.semibold : s.fontFamily, fontSize: s.fontSize, lineHeight: s.lineHeight, color };
  return (
    <Text
      selectable={selectable}
      accessibilityRole={role === 'text' ? undefined : role}
      // A11Y-1: one level-1 heading per screen (the page title, largeTitle or title1); every other heading is level 2, so a screen
      // reader's heading list reads like an outline instead of fourteen equal titles.
      {...(role === 'header' ? { 'aria-level': level ?? (variant === 'largeTitle' || variant === 'title1' ? 1 : 2) } : {})}
      accessibilityLabel={label}
      testID={testID}
      numberOfLines={numberOfLines}
      style={[v, style]}
    >
      {children}
    </Text>
  );
}

/** RD-7: primary (filled accent) and danger (filled red) are only for the few deliberate big buttons (sign-in, Start a
 *  family, Post, Delete/Leave confirms). tinted is the small accent capsule for a screen's main tap word (RD-4);
 *  secondary the gray capsule; quiet a text button or link. Every one stays 48 pt tall to tap (DS-1). */
export type ButtonVariant = 'primary' | 'secondary' | 'tinted' | 'danger' | 'quiet';

export function Button({ label, text, onPress, variant = 'primary', disabled, softDisabled, style, selected, testID, busy, role = 'button', icon, ink }: {
  /** UX-R9 (RD-4): a quiet button in the words' own color, for secondary tools like Options (the accent is saved
   *  for the one main tap word). */
  ink?: boolean;
  /** What a screen reader says. Required: no unlabeled targets. */
  label: string;
  /** Visible words; defaults to the label. */
  text?: ReactNode;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  /** Looks and reads as off, but a tap still reaches onPress so the screen can say why ("Pick one above first."). */
  softDisabled?: boolean;
  selected?: boolean;
  busy?: boolean;
  /** A system symbol shown before the words, never instead of them (DS-3). */
  icon?: Icon;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  role?: 'button' | 'link';
}) {
  const { c, type, os } = useTheme();
  const material = os === 'android';
  // iPhone: filled, gray (tinted fill) and plain buttons. Android: filled, outlined and text buttons.
  // DS-11: a waiting button is solid gray with readable words, never a see-through blue.
  const waiting = !!disabled || !!softDisabled;
  const bg = waiting && variant !== 'quiet' ? c.fill : { primary: c.accent, secondary: material ? 'transparent' : c.fill, tinted: c.accentSoft, danger: c.danger, quiet: 'transparent' }[variant];
  const fg = waiting ? c.muted : { primary: c.accentInk, secondary: c.ink, tinted: c.accent, danger: c.onDanger, quiet: ink ? c.ink : c.accent }[variant];
  const border = variant === 'secondary' && material ? c.muted : bg;
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled || !!softDisabled, selected: !!selected, busy: !!busy }}
      // undefined, not false: Pressable copies a boolean `disabled` over accessibilityState and would undo softDisabled
      disabled={disabled || busy || undefined}
      onPress={onPress}
      testID={testID}
      android_ripple={{ color: c.line }}
      style={({ pressed }) => [
        styles.btn,
        variant === 'tinted' ? styles.capsule : null,
        { backgroundColor: bg, borderColor: border, opacity: !waiting && pressed && !material ? 0.7 : 1 },
        selected ? { borderColor: c.accent, borderWidth: 2, backgroundColor: c.accentSoft } : null,
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : null}
      {icon && !busy ? <SystemIcon icon={icon} color={selected ? c.accent : fg} /> : null}
      {typeof (text ?? label) === 'string' ? (
        <Text style={{ color: selected ? c.ink : fg, ...type.headline, textAlign: 'center' }}>{text ?? label}</Text>
      ) : (
        text
      )}
    </Pressable>
  );
}

/** LIVE-2 (Chase, Nov 5): a compact toolbar button for common actions, the icon over a short word, like a
 *  tab. Never icon-only (DS-3); the word stays 17 pt (DS-2) and the target 48 pt (DS-1). */
export function IconButton({ label, text, icon, onPress, testID }: { label: string; text: string; icon: Icon; onPress: () => void; testID?: string }) {
  const { c, type } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityShowsLargeContentViewer
      accessibilityLargeContentTitle={text}
      onPress={onPress}
      testID={testID}
      android_ripple={{ color: c.line, borderless: true }}
      style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.7 : 1 }]}
    >
      <SystemIcon icon={icon} color={c.ink} size={28} />
      {/* HIG-3: a toolbar word stops growing at 1.5x so the row still fits at the largest text size. */}
      <Text maxFontSizeMultiplier={LABEL_SCALE_CAP} style={{ color: c.ink, ...type.body }}>{text}</Text>
    </Pressable>
  );
}

/** GUX-R1: Apple's back button, top left above the title: a chevron and the place's word ("‹ More") as a plain text
 *  button, 48 pt tall. The screen reader still hears "Back to More" (DS-4: a labeled way back, no swipe needed). */
export function BackButton({ to, onPress, label, ink }: {
  to: string; onPress: () => void; /** Spoken name, when not "Back to <to>". */ label?: string;
  /** UX-R9: in the words' own color, where the screen's one accent belongs to another button (the walk's Next). */
  ink?: boolean;
}) {
  const { c, type, os } = useTheme();
  const color = ink ? c.ink : c.accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? `Back to ${to}`}
      onPress={onPress}
      android_ripple={{ color: c.line }}
      style={({ pressed }) => [styles.back, { opacity: pressed && os !== 'android' ? 0.7 : 1 }]}
    >
      <SystemIcon icon={{ sf: 'chevron.backward', md: 'arrow_back' }} color={color} />
      <Text style={{ color, ...type.body }}>{to}</Text>
    </Pressable>
  );
}

/** RD-15: one of More's big rows: icon, word, an optional accent count ("2 new", RD-14) and a chevron, the whole
 *  row one 48 pt+ target. The screen reader hears the word, then the count ("Messages, 2 new"). */
/** `value` (RD-78): a setting's state in words at the row's end, in the muted color ("Easy view, On"). */
export function MenuRow({ text, icon, count, value, onPress, testID }: { text: string; icon: Icon; count?: string | null; value?: string | null; onPress: () => void; testID?: string }) {
  const { c, type, os } = useTheme();
  const extra = count || value;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={extra ? `${text}, ${extra}` : text}
      onPress={onPress}
      testID={testID}
      android_ripple={{ color: c.line }}
      style={({ pressed }) => [styles.menuRow, { opacity: pressed && os !== 'android' ? 0.7 : 1 }]}
    >
      <SystemIcon icon={icon} color={c.ink} size={26} />
      <Text style={{ flex: 1, color: c.ink, ...type.body }}>{text}</Text>
      {count ? <Text style={{ color: c.accent, ...type.headline }}>{count}</Text> : null}
      {value ? <Text style={{ color: c.muted, ...type.body }}>{value}</Text> : null}
      <SystemIcon icon={CHEVRON} color={c.muted} size={18} />
    </Pressable>
  );
}
const CHEVRON: Icon = { sf: 'chevron.forward', md: 'chevron_right' };

/** RD-60 (R17): the line between two MenuRows, inset to start where the words start (after the 26 pt icon and its
 *  14 pt gap), like the phone's own Settings lists. Never full width. */
export function MenuLine() {
  const { c } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, marginLeft: 40, backgroundColor: c.line }} />;
}

/** A whole-row checkbox / radio / switch: the full row is the 48 pt+ target. GUX-R2 / GUX-R9 (Nov 16): a plain grouped
 *  row (no box of its own, no tinted fill), like the phone's own settings. A picked radio shows an accent check
 *  mark at the end; a checkbox shows an empty circle that fills with an accent check (iPhone) or the phone's own
 *  check box (Android). Switches are the phone's own switch with the word On or Off beside it (DS-3). */
export function Choice({ label, title, detail, checked, onPress, kind, disabled }: {
  label: string; title: string; detail?: string; checked: boolean; onPress: () => void; kind: 'checkbox' | 'radio' | 'switch';
  /** Can't be tapped, but stays fully readable (never faded: DEC-87 5.1); the detail line says why. */
  disabled?: boolean;
}) {
  const { c, os } = useTheme();
  const box: Icon = checked ? { sf: 'checkmark.circle', md: 'check_box' } : { sf: 'circle', md: 'check_box_outline_blank' };
  return (
    <Pressable
      accessibilityRole={kind}
      accessibilityLabel={label}
      accessibilityState={disabled ? { checked, disabled: true } : { checked }}
      accessibilityHint={kind === 'switch' ? detail : undefined}
      aria-checked={checked} // GUX-R11: the web build reads aria-checked, not accessibilityState
      disabled={disabled || undefined}
      onPress={onPress}
      android_ripple={{ color: c.line }}
      style={({ pressed }) => [styles.choice, { opacity: pressed && os !== 'android' ? 0.7 : 1 }]}
    >
      {kind === 'checkbox' ? <SystemIcon icon={box} color={checked ? c.accent : c.muted} size={26} /> : null}
      <View style={{ flex: 1 }}>
        <Txt variant="headline">{title}</Txt>
        {detail ? <Txt tone="muted">{detail}</Txt> : null}
      </View>
      {/* EF-HE-2: an empty ring when not picked (muted, 3:1+), a filled accent ring when picked. */}
      {kind === 'radio' ? (
        <SystemIcon icon={checked ? { sf: 'checkmark.circle.fill', md: 'radio_button_checked' } : { sf: 'circle', md: 'radio_button_unchecked' }} color={checked ? c.accent : c.muted} size={26} />
      ) : null}
      {kind === 'switch' ? (
        <View style={styles.switchBox} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <SwitchWord on={checked} />
          {/* A11Y-2: the web's default On thumb is teal; keep it in Hearth's colors (phones ignore activeThumbColor).
              A11Y-3: the Off track is muted, not line, so the switch shows at 3:1 (WCAG 1.4.11). */}
          <Switch value={checked} disabled={disabled} trackColor={{ true: c.accent, false: c.muted }} {...({ activeThumbColor: c.surface } as object)} />
        </View>
      ) : null}
    </Pressable>
  );
}

/** SHARE-PC-5 / SHARE-PC-8 (DEC-73): one "To:" face tile on Share's postcard: a pill of up to 3 faces (initials on a
 *  neutral circle), the name under it and "N people", the whole tile one 48 pt+ target. Picked shows an accent edge
 *  a soft accent tint and a filled accent check (never color alone, GUX-R4) and reads "picked". `across` (3, or 2: see tileColumns, GUX-R1) sets its width. */
export function FaceTile({ name, count, faces, picked, onPress, across }: {
  name: string; count: number; faces: string[]; picked: boolean; onPress: () => void; across: number;
}) {
  const { c, type, os } = useTheme();
  const edge = picked ? 3 : 2;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${count} ${count === 1 ? 'person' : 'people'}, ${picked ? 'picked' : 'not picked'}`}
      accessibilityState={{ selected: picked }}
      aria-pressed={picked}
      onPress={onPress}
      android_ripple={{ color: c.line }}
      style={({ pressed }) => [styles.face, { width: `${(100 / across).toFixed(3)}%` as `${number}%`, opacity: pressed && os !== 'android' ? 0.7 : 1 }]}
    >
      <View style={[styles.faceRing, { borderWidth: edge, borderColor: picked ? c.accent : c.line, backgroundColor: picked ? c.accentSoft : c.bg, paddingVertical: 12 - edge }]}>
        <View style={styles.faceStack}>
          {faces.slice(0, 3).map((f, i) => (
            <View key={`${f}-${i}`} style={[styles.faceDot, { backgroundColor: c.line, borderColor: c.bg, marginLeft: i ? -10 : 0 }]}>
              <Text maxFontSizeMultiplier={LABEL_SCALE_CAP} style={{ color: c.ink, ...type.headline }}>{initial(f)}</Text>
            </View>
          ))}
        </View>
        {picked ? (
          // GUX-R4: a filled accent disc with the check in accentInk, ringed in the page color so it lifts off the edge.
          <View style={[styles.faceTick, { backgroundColor: c.accent, borderColor: c.bg }]}>
            <SystemIcon icon={{ sf: 'checkmark', md: 'check' }} color={c.accentInk} size={16} />
          </View>
        ) : null}
      </View>
      {/* GUX-R1: the whole name, never cut; a word too long for even a 2-across tile breaks rather than spill out. */}
      <Text style={[{ alignSelf: 'stretch', color: c.ink, ...type.headline, textAlign: 'center' }, breakLongWords]}>{name}</Text>
      <Text testID="face-count" style={{ color: c.muted, ...type.subheadline, textAlign: 'center' }}>{`${count} ${count === 1 ? 'person' : 'people'}`}</Text>
    </Pressable>
  );
}
/** SHARE-PC-2 / GUX-R2: Share's "Add" photos tile beside the small photos: an outline, not a grey box (a dashed
 *  c.line edge, no fill), with "Add" and its plus in the accent. */
export function AddTile({ label, onPress }: { label: string; onPress: () => void }) {
  const { c, type } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={({ pressed }) => [styles.addTile, { borderColor: c.line, opacity: pressed ? 0.7 : 1 }]}>
      <SystemIcon icon={{ sf: 'plus', md: 'add' }} color={c.accent} />
      <Text maxFontSizeMultiplier={LABEL_SCALE_CAP} style={{ color: c.accent, ...type.headline }}>Add</Text>
    </Pressable>
  );
}
/** SHARE-ST-20..24 / SHARE-ST-17 (DEC-79 round 3, A "Quiet postcard"): the empty postcard is one button, the only way
 *  to start a post. The whole card (`cardStyle`, `testID`) sits inside it, so a tap anywhere on it (spot, ruled lines,
 *  padding) opens the picker. Set 12 pt in, a 4:3 accent-tint photo spot with no border holds a 76 pt surface circle
 *  with the add-photo symbol and the title in the accent; `inSpot` (the stamp) rides in the spot's corner and
 *  `children` (the decorative ruled lines) go below it. A press shrinks the card to 0.98 for 120 ms, unless the
 *  phone's Reduce Motion is on. No fixed height, so the words never get cut at bigger text sizes. */
// SHARE-ST-29 (round 4, DEC-84): the circle is 52 pt with a 26 pt symbol (Easy view 60 / 30); "Add photos" is headline.
const SPOT = { corner: 14, standard: { circle: 52, icon: 26 }, easy: { circle: 60, icon: 30 } } as const;
export function AddPhotoCard({ label, title, onPress, testID, spotTestID, cardStyle, inSpot, children }: {
  label: string; title: string; onPress: () => void; testID?: string; spotTestID?: string;
  cardStyle?: StyleProp<ViewStyle>; inSpot?: React.ReactNode; children?: React.ReactNode;
}) {
  const { c, type, bigText, reduceMotion } = useTheme();
  const spot = bigText ? SPOT.easy : SPOT.standard;
  const scale = useRef(new Animated.Value(1)).current;
  const to = (toValue: number) => {
    if (reduceMotion) return;
    Animated.timing(scale, { toValue, duration: 120, useNativeDriver: Platform.OS !== 'web' }).start();
  };
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} onPressIn={() => to(0.98)} onPressOut={() => to(1)}
        style={styles.addCard}>
        <View testID={testID} style={[styles.addCardBody, cardStyle]}>
          <View testID={spotTestID} style={[styles.spot, { backgroundColor: c.accentSoft }]}>
            <View style={[styles.spotCircle, { width: spot.circle, height: spot.circle, borderRadius: spot.circle / 2, backgroundColor: c.surface }]}>
              {/* A fixed symbol in a fixed circle: it does not grow with the text (the words do). */}
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <SymbolView name={{ ios: 'photo.badge.plus', android: 'add_photo_alternate', web: 'add_photo_alternate' } as never} size={spot.icon} tintColor={c.accent} />
              </View>
            </View>
            <Text style={{ color: c.accent, ...type.headline, textAlign: 'center' }}>{title}</Text>
            {inSpot}
          </View>
          {children}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const STAMP_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** SHARE-ST-22: the empty postcard's small decorative stamp, for the photo spot's top-right corner, postmarked with
 *  today's month, then day (GUX-R4). Not a control: hidden from VoiceOver and TalkBack, and taps pass through it. */
export function PostcardStamp({ date = new Date(), testID }: { date?: Date; testID?: string }) {
  const { c } = useTheme();
  return (
    <View testID={testID} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden
      style={[styles.stamp, { borderColor: c.accent, backgroundColor: c.surface }]}>
      <Text accessible={false} allowFontScaling={false} style={[STAMP_MARK, styles.stampMark, { color: c.accent, fontFamily: FONT.semibold }]}>{STAMP_MONTHS[date.getMonth()]}</Text>
      <Text accessible={false} allowFontScaling={false} style={[STAMP_MARK, styles.stampMark, { color: c.accent, fontFamily: FONT.semibold }]}>{String(date.getDate())}</Text>
    </View>
  );
}

/** GUX-R1: on the web a word wider than its box would spill out; phones already break it. */
const breakLongWords = (Platform.OS === 'web' ? { overflowWrap: 'anywhere' } : {}) as TextStyle;
/** The first letter of the last word: "Grandma Jo" is J, "Chase" is C. */
export const initial = (name: string) => (name.trim().split(/\s+/).pop() ?? '?').charAt(0).toUpperCase() || '?';

function SwitchWord({ on }: { on: boolean }) {
  const { c, type } = useTheme();
  return <Text style={{ color: c.ink, ...type.headline }}>{on ? 'On' : 'Off'}</Text>;
}

/** UX-R31: on the web a rounded field draws its own focus ring: a 2 pt accent edge that follows its corners (the
 *  browser's square outline is turned off on the input; see `noWebOutline`). At rest the edge is clear, so focusing
 *  never shifts the words. Phones keep their own focus look, so this is empty there. */
export function useWebFocusRing(focused: boolean): ViewStyle | null {
  const { c, os } = useTheme();
  return os === 'web' ? { borderWidth: 2, borderColor: focused ? c.accent : 'transparent' } : null;
}

/** UX-R31: the browser's own outline off, for a text input inside a field that draws `useWebFocusRing`. */
export function noWebOutline(): TextStyle {
  return (Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) as TextStyle;
}

export function Field(props: TextInputProps & { label: string; underline?: boolean }) {
  const { c, type, os } = useTheme();
  const { label, style, onFocus, onBlur, underline, ...rest } = props;
  const typing = useTypingField(); // UX-R1: the tab bar steps aside while this field is focused
  // iPhone and the web: a filled rounded box with no edge, like the Search field (GUX-R16; was a c.surface box with a
  // c.line edge, which read as a form on paper). Android: Material's outlined text field.
  // GUX-R3: `underline` writes on the card itself (Share's note): no fill, a hairline c.line rule under the words.
  const box: TextStyle = underline
    ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line, paddingHorizontal: 0, paddingTop: 4, paddingBottom: 8 }
    : os === 'android'
    ? { borderWidth: 1, borderColor: c.muted, backgroundColor: 'transparent', borderRadius: RADIUS.small }
    : { borderWidth: 0, backgroundColor: c.fill, borderRadius: RADIUS.medium };
  return (
    <View style={{ gap: 6 }}>
      <Txt variant="headline">{label}</Txt>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.muted}
        {...rest}
        onFocus={(e) => { typing.onFocus(); onFocus?.(e); }}
        onBlur={(e) => { typing.onBlur(); onBlur?.(e); }}
        style={[
          { minHeight: 56, color: c.ink, paddingHorizontal: 14, paddingVertical: 12, fontFamily: FONT.regular, fontSize: type.body.fontSize, ...box },
          style,
        ]}
      />
    </View>
  );
}

/** RD-34 (Chase, Nov 16: "why is everything grey?"; Apple HIG Color): content sits on the plain background, so a
 *  Card is only a padded group with no fill or outline. Settings-style lists use GroupedSection instead. */
export function Card({ children, style, testID }: { children: ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  return <View testID={testID} style={[styles.card, style]}>{children}</View>;
}

/** RD-34: the Settings-style grouped section (iPhone inset grouped list; Android outlined card), only for the
 *  settings lists under More (Easy view, Light or dark, Theme, Help, Me). */
export function GroupedSection({ children, style, testID }: { children: ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  const { c, os } = useTheme();
  const look = os === 'android' ? { borderWidth: 1, borderColor: c.line, borderRadius: RADIUS.medium } : { borderWidth: 0, borderRadius: RADIUS.medium };
  return <View testID={testID} style={[styles.card, { backgroundColor: c.surface }, look, style]}>{children}</View>;
}

/** `footer` (GUX-R1): a screen's one main action, fixed under the scrolling words and above the tab bar, so it is on
 *  screen without scrolling (a form's Save). */
export function Screen({ children, scroll = true, testID, footer }: { children: ReactNode; scroll?: boolean; testID?: string; footer?: ReactNode }) {
  const { c } = useTheme();
  const under = useTabBarSpace(); // RD-109: room under a floating tab bar
  const room = under && !footer ? { paddingBottom: 32 + under } : null;
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: c.bg }} testID={testID}>
      {scroll ? (
        <ScrollView contentContainerStyle={[styles.screen, room]} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>{children}</ScrollView>
      ) : (
        <View style={[styles.screen, { flex: 1 }, room]}>{children}</View>
      )}
      {footer ? (
        <View style={[styles.footer, { backgroundColor: c.bg, borderTopColor: c.line, paddingBottom: 12 + under }]}>{footer}</View>
      ) : null}
    </SafeAreaView>
  );
}

/** Spinner WITH words: June needs to know something is happening (UX-REVIEW #10). */
export function Loading({ words }: { words: string }) {
  const { c } = useTheme();
  return (
    <View style={styles.loading} accessibilityLiveRegion="polite">
      <ActivityIndicator size="large" color={c.muted} />
      <Txt tone="muted">{words}</Txt>
    </View>
  );
}

export function Notice({ text, onClose, tone = 'info' }: { text: string; onClose?: () => void; tone?: 'info' | 'good' }) {
  const { c } = useTheme();
  return (
    // SHARE-U-22: the words sit in one accessible alert element, so a screen reader (and a test) finds them as one
    // thing while the OK button stays its own; the box is a polite live region for Android.
    <View accessibilityLiveRegion="polite" style={[styles.notice, { backgroundColor: tone === 'good' ? c.safeSoft : c.accentSoft, borderColor: c.line }]}>
      <View accessible accessibilityRole="alert" style={{ flex: 1 }}>
        <Txt style={{ color: tone === 'good' ? c.safe : c.ink }}>{text}</Txt>
      </View>
      {onClose ? <Button label="OK, hide this message" text="OK" variant="secondary" onPress={onClose} /> : null}
    </View>
  );
}

/** RD-67 (UX-R24): an iOS-style alert over the screen: a short title, then two plain text buttons side by side with no
 *  fill. The safe choice (`keep`) is Semibold, the default; the destructive one is red Regular words (RD-72). */
export function AlertDialog({ title, body, keep, destroy, onKeep, onDestroy }: {
  title: string; body?: string; keep: string; destroy: string; onKeep: () => void; onDestroy: () => void;
}) {
  const { c, type, os } = useTheme();
  const words = (label: string, color: string, family: string, onPress: () => void, first: boolean) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={({ pressed }) => [styles.alertBtn, first ? { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: c.line } : null,
        { backgroundColor: pressed ? c.fill : 'transparent' }]}>
      <Text style={{ color, fontFamily: family, fontSize: type.body.fontSize, lineHeight: type.body.lineHeight, textAlign: 'center' }}>{label}</Text>
    </Pressable>
  );
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onKeep}>
      <View style={[styles.scrim, { backgroundColor: c.scrim }]}>
        <View accessibilityViewIsModal style={[styles.alert, { backgroundColor: c.surface, borderRadius: dialogRadius(os) }]}>
          <View style={styles.alertWords}>
            <Text accessibilityRole="header" style={{ color: c.ink, ...type.headline, textAlign: 'center' }}>{title}</Text>
            {body ? <Text style={{ color: c.ink, ...type.body, textAlign: 'center' }}>{body}</Text> : null}
          </View>
          <View style={[styles.alertRow, { borderTopColor: c.line }]}>
            {words(keep, c.ink, FONT.semibold, onKeep, true)}
            {words(destroy, c.dangerText, FONT.regular, onDestroy, false)}
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** HIG-10 / QA-R2: what a bottom sheet does with a drag: a clear downward drag, released far or fast enough, closes. */
export function sheetPan(close: () => void): PanResponderCallbacks {
  return {
    onMoveShouldSetPanResponder: (_e, g) => g.dy > 12 && Math.abs(g.dy) > Math.abs(g.dx) * 2,
    onPanResponderRelease: (_e, g) => { if (sheetShouldClose(g.dy, g.vy)) close(); },
  };
}

/** HIG-10: a sheet from the bottom of the screen (More, Who can see this). Apple's sheets show a grabber and close
 *  with a swipe down; the Close button inside stays (DS-4: never gesture-only). HIG-8: it fades in with Reduce
 *  Motion on, instead of sliding. */
export function BottomSheet({ testID, onClose, children }: { testID: string; onClose: () => void; children: ReactNode }) {
  const { c, os, reduceMotion } = useTheme();
  const close = React.useRef(onClose);
  close.current = onClose;
  const drag = React.useRef(PanResponder.create(sheetPan(() => close.current()))).current;
  const corner = os === 'android' ? 28 : 14;
  return (
    <Modal transparent visible animationType={reduceMotion ? 'fade' : 'slide'} onRequestClose={onClose}>
      <View style={[styles.sheetScrim, { backgroundColor: c.scrim }]}>
        <SafeAreaView edges={['bottom']} testID={testID} accessibilityViewIsModal {...drag.panHandlers}
          style={[styles.menu, { backgroundColor: c.surface, borderTopLeftRadius: corner, borderTopRightRadius: corner }]}>
          <View testID="sheet-grabber" style={[styles.grabber, { backgroundColor: c.muted }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
          {children}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  alert: { alignSelf: 'center', width: '100%', maxWidth: 320, overflow: 'hidden' },
  alertWords: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 16, gap: 4 },
  alertRow: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
  alertBtn: { flex: 1, minHeight: MIN_TARGET, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 10 },
  sheetScrim: { flex: 1, justifyContent: 'flex-end' },
  menu: { padding: 20, paddingTop: 8, gap: 14 },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: RADIUS.pill, opacity: 0.5 },
  menuRow: { minHeight: MIN_TARGET + 12, minWidth: MIN_TARGET, alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  iconBtn: { flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: MIN_TARGET + 12, minWidth: MIN_TARGET + 12, paddingHorizontal: 6, gap: 2 },
  capsule: { alignSelf: 'flex-start' },
  back: { alignSelf: 'flex-start', minHeight: MIN_TARGET, minWidth: MIN_TARGET, flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: -6, marginBottom: -8 },
  btn: { minHeight: MIN_TARGET, minWidth: MIN_TARGET, borderRadius: RADIUS.pill, borderWidth: 1, paddingHorizontal: 18, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  choice: { minHeight: MIN_TARGET + 8, minWidth: MIN_TARGET, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchBox: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  face: { minHeight: MIN_TARGET, minWidth: MIN_TARGET, alignItems: 'center', gap: 4, paddingHorizontal: 4, paddingVertical: 6 },
  faceRing: { alignSelf: 'stretch', minHeight: 64, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  faceStack: { flexDirection: 'row', justifyContent: 'center' },
  faceDot: { width: 36, height: 36, borderRadius: RADIUS.pill, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  // SHARE-ST-11 / SHARE-ST-12 (Chase's B+ reference, DEC-79): the photo spot's 14 pt corners and 72 pt circle are set by
  // the spec, not the RADIUS tokens (engineer, flagged for qa-tdd and the design system: DSG-2 style hand-typed corner).
  addCard: { alignSelf: 'stretch', minHeight: MIN_TARGET },
  addCardBody: { padding: 12 },
  spot: { alignSelf: 'stretch', aspectRatio: 4 / 3, borderRadius: SPOT.corner, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 12 },
  stamp: { position: 'absolute', top: 10, right: 10, width: 44, height: 52, transform: [{ rotate: '4deg' }], borderWidth: 2, borderStyle: 'dotted', borderRadius: RADIUS.small, alignItems: 'center', justifyContent: 'center' },
  stampMark: { textAlign: 'center' },
  spotCircle: { alignItems: 'center', justifyContent: 'center' },
  addTile: { minWidth: 64, minHeight: 64, borderRadius: RADIUS.medium, borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  faceTick: { position: 'absolute', top: -6, right: -4, borderRadius: RADIUS.pill, borderWidth: 2, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  card: { padding: 14, gap: 12 },
  screen: { padding: 16, gap: 16, paddingBottom: 32 },
  footer: { paddingHorizontal: 16, paddingTop: 12, gap: 8, borderTopWidth: StyleSheet.hairlineWidth },
  loading: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: RADIUS.medium, borderWidth: 1, padding: 12 },
  scrim: { flex: 1, justifyContent: 'center', padding: 16 },
  sheet: { padding: 20, gap: 14 },
});
