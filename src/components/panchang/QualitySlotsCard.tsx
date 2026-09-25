import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText as Text } from '@/components/common/AppText';
import { type ColorPalette } from '@/config/theme';
import type { IQualitySlot } from '@/types';
import { MotionPressable } from '@/components/common/MotionPressable';

function valueColor(quality: IQualitySlot['quality'], colors: ColorPalette): string {
  switch (quality) {
    // Both branches take the per-theme *ink* token. The card paints no ground
    // of its own, so it sits on `colors.base`: a fixed #3F7A3F green was
    // 3.56:1 on the dark ground and the `colors.accent` fill was 2.09:1 on the
    // light one — whichever theme was in use, one of the two categories in
    // "Good & avoid times" was below AA.
    case 'auspicious':
      return colors.success;
    case 'inauspicious':
      return colors.accentText;
    default:
      return colors.textSecondary;
  }
}

interface Props {
  label: string;
  slots: { day: IQualitySlot[]; night: IQualitySlot[] };
  colors: ColorPalette;
}

export function QualitySlotsCard({ label, slots, colors }: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'day' | 'night'>('day');
  const active = tab === 'day' ? slots.day : slots.night;
  return (
    <View style={styles.card}>
      <View style={[styles.header, { borderBottomColor: colors.divider }]}>
        <Text variant="mono-caps" style={[styles.label, { color: colors.accentText }]}>{label}</Text>
        <View style={styles.tabs}>
          {(['day', 'night'] as const).map((key, i) => (
            <MotionPressable
              key={key}
              onPress={() => setTab(key)}
              // 2 + 29.7 + 14 = 45.7dp of reachable target. Most of that is the
              // tab box itself (`paddingVertical: 7` around an 11.7dp Geist line
              // box — 9px at 1.3em — plus the 4dp underline), because slop below
              // the tabs is mostly unreachable: the slot rows are *later*
              // siblings inside `styles.card`, and RN hit-tests children in
              // reverse order (TouchTargetHelper: `for (i in childrenCount - 1
              // downTo 0)`), so the first row claims any point inside its own box
              // before the header is ever visited. Only the header's
              // paddingBottom (10) + hairline border + marginBottom (4) ≈ 14.3dp
              // is genuinely free, hence `bottom: 14` — anything past that is
              // inert. Top is capped at 2dp for the opposite reason: this card is
              // the first child of an AccordionSection body, whose `paddingTop: 4`
              // is all that separates these tabs from the accordion's own toggle.
              // That toggle is an *earlier* sibling, so upward slop crossing the
              // 4dp gap would win over it — and the chevron shares this
              // right-hand x-range, so its lower half would flip Day/Night
              // instead of collapsing the section. Horizontal slop is half the
              // 10dp `marginRight` between the two tabs, so they stay adjacent
              // and never overlap.
              hitSlop={{ top: 2, bottom: 14, left: 5, right: 5 }}
              style={[styles.tab, i === 0 && { marginRight: 10 }]}
              accessibilityRole="tab"
              accessibilityLabel={key === 'day' ? t('panchang.dayTab') : t('panchang.nightTab')}
              accessibilityState={{ selected: tab === key }}>
              <Text
                variant="mono-caps"
                style={[
                  styles.tabText,
                  { color: tab === key ? colors.accentText : colors.textTertiary },
                ]}>
                {key === 'day' ? t('panchang.dayTab') : t('panchang.nightTab')}
              </Text>
              {tab === key && <View style={[styles.tabUnderline, { backgroundColor: colors.accent }]} />}
            </MotionPressable>
          ))}
        </View>
      </View>
      {active.map((slot, i) => (
        <View key={i} style={styles.row}>
          <Text variant="mono-caps" style={[styles.keyLabel, { color: colors.textTertiary }]} numberOfLines={1}>
            {slot.name}
          </Text>
          <Text variant="mono" style={[styles.timeValue, { color: valueColor(slot.quality, colors) }]}>
            {`${slot.start} \u2014 ${slot.end}`}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 18,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    marginBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: { fontSize: 9.5 },
  // Deliberately no `alignItems: 'center'`: the tabs stretch to the row height
  // so the inactive tab — which renders no underline and would otherwise be
  // 4dp shorter and 2dp lower — gets the same touch box and the same label
  // baseline as the active one.
  tabs: { flexDirection: 'row' },
  // paddingVertical carries the touch target, not hitSlop; see the note above.
  tab: { paddingVertical: 7, alignItems: 'center' },
  tabText: { fontSize: 9 },
  tabUnderline: {
    marginTop: 3,
    height: 1,
    width: 18,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
  },
  keyLabel: {
    fontSize: 9.5,
    flexShrink: 1,
  },
  timeValue: {
    fontSize: 12,
    letterSpacing: 0.3,
  },
});
