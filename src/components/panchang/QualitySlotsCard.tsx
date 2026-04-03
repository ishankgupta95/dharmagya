import { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText as Text } from '@/components/common/AppText';
import { borderRadius, type ColorPalette } from '@/config/theme';
import type { IQualitySlot } from '@/types';

const QUALITY_COLOR: Record<IQualitySlot['quality'], string> = {
  auspicious: '#4CAF50',
  inauspicious: '#F44336',
  neutral: '#9E9E9E',
};

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
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Text style={[styles.label, { color: colors.accent }]}>{label}</Text>
        <View style={[styles.tabs, { backgroundColor: colors.surfaceRecessed }]}>
          {(['day', 'night'] as const).map(key => (
            <TouchableOpacity
              key={key}
              onPress={() => setTab(key)}
              style={[styles.tab, tab === key && { backgroundColor: colors.accent }]}>
              <Text style={[styles.tabText, { color: tab === key ? colors.base : colors.textMuted }]}>
                {key === 'day' ? t('panchang.dayTab') : t('panchang.nightTab')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      {active.map((slot, i) => (
        <View
          key={i}
          style={[
            styles.row,
            i < active.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: colors.divider },
          ]}>
          <View style={[styles.dot, { backgroundColor: QUALITY_COLOR[slot.quality] }]} />
          <Text style={[styles.name, { color: colors.textPrimary }]}>{slot.name}</Text>
          <Text style={[styles.qualityLabel, { color: QUALITY_COLOR[slot.quality] }]}>{slot.qualityName}</Text>
          <Text style={[styles.time, { color: colors.textMuted }]}>{slot.start} – {slot.end}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: borderRadius.card, borderWidth: 1, padding: 16, marginBottom: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  label: { fontSize: 11, fontFamily: 'Mukta_400Regular', letterSpacing: 1 },
  tabs: { flexDirection: 'row', borderRadius: borderRadius.chip, padding: 2, gap: 2 },
  tab: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: borderRadius.chip },
  tabText: { fontSize: 12, fontFamily: 'Mukta_500Medium' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  name: { fontSize: 15, fontFamily: 'Mukta_500Medium', flex: 1 },
  qualityLabel: { fontSize: 11, fontFamily: 'Mukta_400Regular', minWidth: 48 },
  time: { fontSize: 12, fontFamily: 'Mukta_400Regular' },
});
