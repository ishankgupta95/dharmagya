import { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { GRAHA_ABBR, type Dignity, type GrahaName } from 'panchang-ts';

import { AppText } from '@/components/common/AppText';
import { palette, borderRadius } from '@/config/theme';
import { useStore } from '@/store/useStore';

/**
 * Strip showing each graha's dignity in the natal chart — exalted /
 * moolatrikona / own / friend / neutral / enemy / debilitated. Drives at-a-glance
 * "where is each planet doing well?" reads on the Kundli surface.
 *
 * Dignity order from strongest → weakest follows the library's classical
 * resolution order (see src/jyotish/dignity.ts in panchang-ts).
 */
interface PlanetaryDignityChartProps {
  items: { graha: GrahaName; dignity: Dignity }[];
  /** Optional dignity-key → translated label resolver. */
  labelFor?: (dignity: Dignity) => string;
}

interface DignityTone {
  bg: string;
  fg: string;
}

/**
 * Dignity tone has to be per-theme. The strip sits directly on the screen
 * ground — AccordionSection paints no surface of its own — and the label
 * renders at 9px, so each face is measured against its OWN composited cell
 * tint rather than the flat ground, and has to clear 4.5:1 there.
 *
 * The seven hue families (green / gold / blue / amber / grey / red / deep-red)
 * are the semantic scale and are preserved across the pair; only lightness
 * flips per theme. Ratios below are against the composited cell.
 *
 * Two deliberate departures from the pre-Diya table: `exalted` moves off the
 * retired teal onto the app's single affirmative green, and `debilitated`
 * moves out of the brown family into deep red. The brown was an artifact of
 * the `sindoorDeep` accent alias and made the WORST dignity render nearly the
 * same colour as moolatrikona, the second-best — an active mis-signal.
 */
const DIGNITY_TONE_DARK: Record<Dignity, DignityTone> = {
  exalted:      { bg: 'rgba(93,168,93,0.18)',   fg: palette.leaf },     // 4.86:1
  moolatrikona: { bg: 'rgba(201,155,58,0.20)',  fg: palette.turmeric }, // 5.78:1
  own:          { bg: 'rgba(74,158,245,0.18)',  fg: '#6FA8E8' },        // 5.65:1
  friend:       { bg: 'rgba(232,168,72,0.18)',  fg: '#E8C489' },        // 7.92:1
  neutral:      { bg: 'rgba(120,120,120,0.18)', fg: '#A9A2B0' },        // 6.12:1
  enemy:        { bg: 'rgba(226,75,74,0.18)',   fg: palette.roseText }, // 5.03:1
  debilitated:  { bg: 'rgba(165,48,28,0.20)',   fg: '#FFA894' },        // 8.74:1
};

const DIGNITY_TONE_LIGHT: Record<Dignity, DignityTone> = {
  // The one opaque container in the table: leafDeep over a translucent green
  // wash on rice tops out at 4.07:1, and `leafSoft` is the token the theme
  // ships for exactly this pairing.
  exalted:      { bg: palette.leafSoft,         fg: palette.leafDeep },    // 4.60:1
  moolatrikona: { bg: 'rgba(201,155,58,0.20)',  fg: palette.turmericInk }, // 5.05:1
  own:          { bg: 'rgba(74,158,245,0.18)',  fg: '#1F5FA8' },           // 5.05:1
  friend:       { bg: 'rgba(232,168,72,0.18)',  fg: '#8F4F10' },           // 5.20:1
  neutral:      { bg: 'rgba(120,120,120,0.18)', fg: '#55505C' },           // 5.83:1
  enemy:        { bg: 'rgba(226,75,74,0.18)',   fg: palette.crimson },     // 4.80:1
  debilitated:  { bg: 'rgba(165,48,28,0.20)',   fg: palette.crimsonText }, // 6.06:1
};

export const PlanetaryDignityChart = memo(function PlanetaryDignityChart({
  items,
  labelFor,
}: PlanetaryDignityChartProps) {
  const isDark = useStore((s) => s.isDarkMode);
  const tones = isDark ? DIGNITY_TONE_DARK : DIGNITY_TONE_LIGHT;
  const surfaceText = isDark ? palette.bone : palette.ink;

  return (
    <View style={styles.row}>
      {items.map(({ graha, dignity }) => {
        const tone = tones[dignity];
        return (
          <View
            key={graha}
            style={[styles.cell, { backgroundColor: tone.bg }]}>
            <AppText variant="mono-caps" style={[styles.abbr, { color: surfaceText }]}>
              {GRAHA_ABBR[graha]}
            </AppText>
            <AppText
              variant="mono"
              style={[styles.dignity, { color: tone.fg }]}
              numberOfLines={1}>
              {labelFor ? labelFor(dignity) : dignity}
            </AppText>
          </View>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  cell: {
    minWidth: 64,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: borderRadius.iconContainer,
    alignItems: 'center',
    gap: 2,
  },
  abbr: {
    fontSize: 11,
    letterSpacing: 1.6,
  },
  dignity: {
    fontSize: 9,
    letterSpacing: 0.4,
    textTransform: 'capitalize',
  },
});
