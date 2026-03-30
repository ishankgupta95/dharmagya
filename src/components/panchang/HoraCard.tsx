import { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { borderRadius, type ColorPalette } from '@/config/theme';
import type { IHoraSlot } from '@/types';

const PLANET_COLOR: Record<string, string> = {
  Sun: '#E8893C',
  Moon: '#9E9E9E',
  Mars: '#F44336',
  Mercury: '#4CAF50',
  Jupiter: '#FFC107',
  Venus: '#E91E63',
  Saturn: '#607D8B',
};

interface Props {
  slots: { day: IHoraSlot[]; night: IHoraSlot[] };
  colors: ColorPalette;
}

export function HoraCard({ slots, colors }: Props) {
  const [tab, setTab] = useState<'day' | 'night'>('day');
  const active = tab === 'day' ? slots.day : slots.night;
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Text style={[styles.label, { color: colors.accent }]}>HORA</Text>
        <View style={[styles.tabs, { backgroundColor: colors.surfaceRecessed }]}>
          {(['day', 'night'] as const).map(t => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={[styles.tab, tab === t && { backgroundColor: colors.accent }]}>
              <Text style={[styles.tabText, { color: tab === t ? colors.base : colors.textMuted }]}>
                {t === 'day' ? 'Day' : 'Night'}
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
          <View style={[styles.dot, { backgroundColor: PLANET_COLOR[slot.planet] ?? colors.textMuted }]} />
          <Text style={[styles.name, { color: colors.textPrimary }]}>{slot.planet}</Text>
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
  time: { fontSize: 12, fontFamily: 'Mukta_400Regular' },
});
