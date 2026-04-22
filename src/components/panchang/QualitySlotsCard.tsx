import { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText as Text } from '@/components/common/AppText';
import { type ColorPalette } from '@/config/theme';
import type { IQualitySlot } from '@/types';

const MUTED_GREEN = '#3F7A3F';

function valueColor(quality: IQualitySlot['quality'], colors: ColorPalette): string {
  switch (quality) {
    case 'auspicious':
      return MUTED_GREEN;
    case 'inauspicious':
      return colors.accent;
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
        <Text variant="mono-caps" style={[styles.label, { color: colors.accent }]}>{label}</Text>
        <View style={styles.tabs}>
          {(['day', 'night'] as const).map((key, i) => (
            <TouchableOpacity
              key={key}
              onPress={() => setTab(key)}
              hitSlop={6}
              style={[styles.tab, i === 0 && { marginRight: 10 }]}
              accessibilityRole="tab"
              accessibilityLabel={key === 'day' ? t('panchang.dayTab') : t('panchang.nightTab')}
              accessibilityState={{ selected: tab === key }}>
              <Text
                variant="mono-caps"
                style={[
                  styles.tabText,
                  { color: tab === key ? colors.accent : colors.textTertiary },
                ]}>
                {key === 'day' ? t('panchang.dayTab') : t('panchang.nightTab')}
              </Text>
              {tab === key && <View style={[styles.tabUnderline, { backgroundColor: colors.accent }]} />}
            </TouchableOpacity>
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
  tabs: { flexDirection: 'row', alignItems: 'center' },
  tab: { paddingVertical: 2, alignItems: 'center' },
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
