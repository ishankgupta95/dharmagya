import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText as Text } from '@/components/common/AppText';
import { borderRadius, MONO_FONT, palette, type ColorPalette } from '@/config/theme';
import type { IHoraSlot } from '@/types';
import { MotionPressable } from '@/components/common/MotionPressable';

// Indexed by `IHoraSlot.planetIndex`, in the library's Chaldean order:
// Sun, Venus, Mercury, Moon, Saturn, Jupiter, Mars. NOT the order the old
// name-keyed object listed them in — get this wrong and every dot is silently
// mis-coloured in both languages. Keying on the name was the original bug:
// `HoraSlot.planet` is localized, so all 24 dots fell back to the muted
// colour under the Hindi locale and the card's only scannable signal vanished.
const PLANET_COLOR: readonly string[] = [
  '#E8893C', // Sun
  '#E91E63', // Venus
  '#4CAF50', // Mercury
  '#9E9E9E', // Moon
  '#607D8B', // Saturn
  '#FFC107', // Jupiter
  '#F44336', // Mars
];

interface Props {
  slots: { day: IHoraSlot[]; night: IHoraSlot[] };
  colors: ColorPalette;
}

export function HoraCard({ slots, colors }: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'day' | 'night'>('day');
  const active = tab === 'day' ? slots.day : slots.night;
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Text style={[styles.label, { color: colors.accentText }]}>{t('panchang.hora')}</Text>
        <View style={[styles.tabs, { backgroundColor: colors.surfaceRecessed }]}>
          {(['day', 'night'] as const).map(key => (
            <MotionPressable
              key={key}
              onPress={() => setTab(key)}
              // The tab box is only ~27dp tall (12px Devanagari line box, which
              // is 1.555em, plus 4dp padding) and shrinks to exactly 24dp at
              // the "small" font setting — sitting right on the WCAG 2.2 AA
              // floor with nothing to spare. 10dp of vertical slop lifts it to
              // 44dp in both cases. Horizontal slop is capped at 1dp — half the
              // 2dp `tabs` gap — so Day and Night stay adjacent and never
              // overlap into each other's targets. hitSlop is hit-testing only,
              // so the header keeps its current height.
              hitSlop={{ top: 10, bottom: 10, left: 1, right: 1 }}
              style={[styles.tab, tab === key && { backgroundColor: colors.accent }]}
              accessibilityRole="tab"
              accessibilityLabel={key === 'day' ? t('panchang.dayTab') : t('panchang.nightTab')}
              accessibilityState={{ selected: tab === key }}>
              <Text style={[styles.tabText, { color: tab === key ? palette.night : colors.textMuted }]}>
                {key === 'day' ? t('panchang.dayTab') : t('panchang.nightTab')}
              </Text>
            </MotionPressable>
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
          <View style={[styles.dot, { backgroundColor: PLANET_COLOR[slot.planetIndex] ?? colors.textMuted }]} />
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
  label: { fontSize: 11, fontFamily: 'NotoSerifDevanagari_500Medium', letterSpacing: 1 },
  tabs: { flexDirection: 'row', borderRadius: borderRadius.chip, padding: 2, gap: 2 },
  tab: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: borderRadius.chip },
  tabText: { fontSize: 12, fontFamily: 'NotoSerifDevanagari_500Medium' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  name: { fontSize: 15, fontFamily: 'Geist_400Regular', flex: 1 },
  time: { fontSize: 12, fontFamily: MONO_FONT },
});
