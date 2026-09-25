import { memo, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GRAHA_ABBR, type AshtakavargaResult, type GrahaName } from 'panchang-ts';

import { AppText as Text } from '@/components/common/AppText';
import { grahaLabel } from '@/utils/grahaLabel';
import { SegmentedChip } from '@/components/common/SegmentedChip';
import { borderRadius, type ColorPalette } from '@/config/theme';
import { localizeRashi } from '@/i18n/panchangNames';
import { resolveLanguage } from '@/i18n';
import { useStore } from '@/store/useStore';

interface AshtakavargaCardProps {
  result: AshtakavargaResult;
  colors: ColorPalette;
}

// Receivers (no Rahu/Ketu — they aren't Ashtakavarga receivers in the
// classical Parashara scheme).
type Receiver = Exclude<GrahaName, 'Rahu' | 'Ketu'>;
const RECEIVERS: Receiver[] = [
  'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn',
];

// Sarvashtaka selector key — distinguished from a receiver graha so the
// segmented chip strip stays a single union.
type Mode = 'sarvashtaka' | Receiver;

const RASHI_NAMES_EN = [
  'Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya',
  'Tula', 'Vrischika', 'Dhanu', 'Makara', 'Kumbha', 'Meena',
];

export const AshtakavargaCard = memo(function AshtakavargaCard({
  result,
  colors,
}: AshtakavargaCardProps) {
  const { t } = useTranslation();
  const language = useStore((s) => s.language);
  const isDark = useStore((s) => s.isDarkMode);
  const lang = resolveLanguage(language);
  const [mode, setMode] = useState<Mode>('sarvashtaka');

  // 12-cell grid for whichever mode the user is on. Sarvashtaka 0..56;
  // Bhinnashtaka 0..8 per receiver.
  const cells: number[] =
    mode === 'sarvashtaka' ? result.sarvashtaka : result.bhinnashtaka[mode];
  // Each receiver donates at most 8 dots per cell; Sarvashtaka caps at 56
  // (the per-cell sum across all 7 receivers).
  const max = mode === 'sarvashtaka' ? 56 : 8;

  // Bhinnashtaka cell sums (sanity for the user — invariant per BPHS Ch. 66:
  // Sun=47, Moon=49, Mars=39, Mercury=54, Jupiter=56, Venus=52, Saturn=39).
  const cellSum = useMemo(() => cells.reduce((a, b) => a + b, 0), [cells]);

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.chipScroll}>
        <SegmentedChip
          active={mode === 'sarvashtaka'}
          onPress={() => setMode('sarvashtaka')}
          inactiveBg="transparent"
          activeBg={colors.surfaceRecessed}
          inactiveBorder={colors.border}
          activeBorder={colors.borderAccent}
          style={styles.chip}>
          <Text
            variant="mono-caps"
            style={[
              styles.chipText,
              { color: mode === 'sarvashtaka' ? colors.textPrimary : colors.textTertiary },
            ]}>
            {t('kundli.ashtakavarga.sarvaShort')}
          </Text>
        </SegmentedChip>
        {RECEIVERS.map((graha) => {
          const active = mode === graha;
          return (
            <SegmentedChip
              key={graha}
              active={active}
              onPress={() => setMode(graha)}
              inactiveBg="transparent"
              activeBg={colors.surfaceRecessed}
              inactiveBorder={colors.border}
              activeBorder={colors.borderAccent}
              style={styles.chip}>
              <Text
                variant="mono-caps"
                style={[
                  styles.chipText,
                  { color: active ? colors.textPrimary : colors.textTertiary },
                ]}>
                {GRAHA_ABBR[graha]}
              </Text>
            </SegmentedChip>
          );
        })}
      </View>

      <View style={styles.grid}>
        {cells.map((value, idx) => {
          const intensity = max > 0 ? value / max : 0;
          const rashiName = lang === 'hi' ? localizeRashi(RASHI_NAMES_EN[idx], 'hi') : RASHI_NAMES_EN[idx];
          return (
            <View
              key={idx}
              style={[
                styles.cell,
                {
                  backgroundColor: heatBg(intensity, isDark),
                  borderColor: colors.border,
                },
              ]}>
              <Text
                variant="mono-caps"
                style={[styles.cellRashi, { color: colors.textTertiary }]}
                numberOfLines={1}>
                {rashiName}
              </Text>
              <Text
                variant="display"
                style={[styles.cellValue, { color: heatFg(intensity, colors) }]}>
                {value}
              </Text>
            </View>
          );
        })}
      </View>

      <Text variant="body-italic" style={[styles.footnote, { color: colors.textMuted }]}>
        {mode === 'sarvashtaka'
          ? t('kundli.ashtakavarga.sarvaFootnote', { sum: cellSum })
          : t('kundli.ashtakavarga.bhinnaFootnote', { graha: grahaLabel(mode, t), sum: cellSum })}
      </Text>
    </View>
  );
});

// Background tint scales with the bindu count — emptier rashis read fainter,
// stronger rashis read warmer. The wash is the turmeric accent at low alpha.
function heatBg(intensity: number, isDark: boolean): string {
  const a = Math.max(0, Math.min(1, intensity));
  // Dark tops out lower than light. Every step of turmeric wash lifts the
  // ground toward the accent itself, eating the headroom the value needs: on
  // the old 0.32 ceiling the emphasised value fell to 3.83:1 over this card's
  // surface. 0.22 holds it at 4.76:1 and still reads as a ramp.
  const alpha = isDark ? 0.05 + a * 0.17 : 0.04 + a * 0.28;
  return `rgba(216, 163, 26, ${alpha})`;
}

function heatFg(intensity: number, colors: ColorPalette): string {
  // Lift the value into the accent at high intensity so the strongest rashis
  // read as emphasised; below that it stays the base text colour. `accentText`
  // rather than `accent` because this is 18px of a 300-weight face: the token
  // resolves to turmeric on dark and turmericInk on light, where raw turmeric
  // would be 2.09:1.
  return intensity > 0.65 ? colors.accentText : colors.textPrimary;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    padding: 14,
  },
  chipScroll: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: borderRadius.chip,
    borderWidth: 1,
  },
  chipText: { fontSize: 9, letterSpacing: 1.2 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  // 4-col grid → 12 cells in 3 rows; works at most phone widths inside the
  // existing screen padding.
  cell: {
    width: '23.5%',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: borderRadius.iconContainer,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    gap: 2,
  },
  cellRashi: { fontSize: 8, letterSpacing: 0.8 },
  cellValue: { fontSize: 18, lineHeight: 22 },
  footnote: { fontSize: 12, lineHeight: 17, marginTop: 12 },
});
