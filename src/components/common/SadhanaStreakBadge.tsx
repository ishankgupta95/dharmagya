import { memo } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText as Text } from './AppText';
import { Icon } from './Icon';
import { useStore } from '@/store/useStore';
import { displayStreak } from '@/services/sadhana';
import { MONO_FONT, type ColorPalette } from '@/config/theme';

/**
 * Small flame + count pill surfacing the user's sadhana streak (P14.4).
 * Always renders — at 0 it reads as "Begin your sadhana" (a soft invitation,
 * not "0 days"), at ≥1 it shows the running count. Welcoming-frame, never
 * loss-threat. Display value computes lazily so the data layer's
 * `currentStreak` stays immutable until the next qualifying event.
 *
 * Private, never compared — the badge identifies "your" practice, not a
 * ranking.
 */
interface SadhanaStreakBadgeProps {
  colors: ColorPalette;
  /** Optional layout style merged onto the outer pill. */
  style?: StyleProp<ViewStyle>;
  /** When true, render slightly larger for use as a stats-card row. */
  large?: boolean;
}

export const SadhanaStreakBadge = memo(function SadhanaStreakBadge({
  colors,
  style,
  large = false,
}: SadhanaStreakBadgeProps) {
  const { t } = useTranslation();
  const sadhana = useStore((s) => s.sadhana);
  const days = displayStreak(sadhana, Date.now());

  const sizing = large ? LARGE : COMPACT;

  return (
    <View
      style={[
        styles.pill,
        sizing.pill,
        { backgroundColor: colors.surfaceRecessed, borderColor: colors.borderAccent },
        style,
      ]}
      accessibilityRole="text"
      accessibilityLabel={t('sadhana.a11yStreakBadge', { count: days })}>
      <Icon name="flame" size={sizing.icon} color={colors.accent} />
      <Text style={[styles.value, sizing.value, { color: colors.accent }]}>
        {days}
      </Text>
      <Text variant="mono-caps" style={[styles.label, sizing.label, { color: colors.textSecondary }]}>
        {t('sadhana.dayStreakLabel', { count: days })}
      </Text>
    </View>
  );
});

const COMPACT = {
  pill: { paddingVertical: 5, paddingHorizontal: 10, gap: 6 },
  icon: 11,
  value: { fontSize: 13 },
  label: { fontSize: 8.5, letterSpacing: 2.4 },
} as const;

const LARGE = {
  pill: { paddingVertical: 8, paddingHorizontal: 12, gap: 8 },
  icon: 13,
  value: { fontSize: 15 },
  label: { fontSize: 9.5, letterSpacing: 2.6 },
} as const;

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
  },
  value: { fontFamily: MONO_FONT, fontWeight: '500' },
  label: {},
});
