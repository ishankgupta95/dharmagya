import { View, StyleSheet } from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { borderRadius, type ColorPalette } from '@/config/theme';
import type { IGrahaPosition } from '@/types';

const PLANET_COLOR: Record<string, string> = {
  Sun: '#E8893C',
  Moon: '#9E9E9E',
  Mars: '#F44336',
  Mercury: '#4CAF50',
  Jupiter: '#FFC107',
  Venus: '#E91E63',
  Saturn: '#607D8B',
  Rahu: '#78909C',
  Ketu: '#A1887F',
};

interface Props {
  positions: IGrahaPosition[];
  colors: ColorPalette;
}

export function PlanetaryPositionsCard({ positions, colors }: Props) {
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.label, { color: colors.accent }]}>GRAHA STHITI</Text>
      {positions.map((p, i) => (
        <View
          key={p.planet}
          style={[
            styles.row,
            i < positions.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: colors.divider },
          ]}>
          <View style={styles.planetCol}>
            <View style={[styles.dot, { backgroundColor: PLANET_COLOR[p.planet] ?? colors.textMuted }]} />
            <Text style={[styles.planetName, { color: colors.textPrimary }]}>
              {p.planet}
              {p.isRetrograde && <Text style={styles.retroBadge}> ℞</Text>}
            </Text>
          </View>
          <View style={styles.detailCol}>
            <Text style={[styles.rashi, { color: colors.textPrimary }]}>
              {p.rashi} {p.degreeInRashi}°
            </Text>
            <Text style={[styles.nakshatra, { color: colors.textMuted }]}>
              {p.nakshatra} (Pada {p.nakshatraPada})
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: borderRadius.card, borderWidth: 1, padding: 16, marginBottom: 16 },
  label: { fontSize: 11, fontFamily: 'Mukta_400Regular', letterSpacing: 1, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  planetCol: { flexDirection: 'row', alignItems: 'center', width: 100, gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  planetName: { fontSize: 14, fontFamily: 'Mukta_500Medium' },
  retroBadge: { fontSize: 13, color: '#F44336', fontFamily: 'Mukta_700Bold' },
  detailCol: { flex: 1 },
  rashi: { fontSize: 14, fontFamily: 'Mukta_500Medium' },
  nakshatra: { fontSize: 11, fontFamily: 'Mukta_400Regular' },
});
