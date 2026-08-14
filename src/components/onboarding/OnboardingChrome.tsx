import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AppText as Text } from '@/components/common/AppText';
import { MotionPressable } from '@/components/common/MotionPressable';
import { palette, borderRadius, controlHeight } from '@/config/theme';

// Diya onboarding is the "one warm light in a dark room" moment — it always
// renders on the night ground regardless of the theme setting (frames 1–5).
export const onb = {
  base: palette.night,
  text: palette.bone,
  textSoft: 'rgba(237,232,240,0.50)',
  textFaint: 'rgba(237,232,240,0.42)',
  textGhost: 'rgba(237,232,240,0.32)',
  surface: 'rgba(255,255,255,0.05)',
  border: 'rgba(255,255,255,0.09)',
  divider: 'rgba(255,255,255,0.06)',
  accent: palette.turmeric,
  accentSoft: 'rgba(216,163,26,0.10)',
  accentBorder: 'rgba(216,163,26,0.45)',
  accentIconBg: 'rgba(216,163,26,0.16)',
  dashOff: 'rgba(237,232,240,0.16)',
} as const;

export const TOTAL_STEPS = 5;

interface ProgressHeaderProps {
  /** 1-based count of lit dashes. */
  step: number;
  /** Route to advance to when Skip is pressed; omit to hide Skip. */
  skipTo?: Href;
  style?: StyleProp<ViewStyle>;
}

/** The five-dash progress rail + optional Skip (frames 2–5). */
export function ProgressHeader({ step, skipTo, style }: ProgressHeaderProps) {
  const { t } = useTranslation();
  return (
    <View style={[styles.headerRow, style]}>
      <View style={styles.dashes}>
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <View
            key={i}
            style={[styles.dash, { backgroundColor: i < step ? onb.accent : onb.dashOff }]}
          />
        ))}
      </View>
      {skipTo ? (
        <MotionPressable
          onPress={() => router.push(skipTo)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('common.skip')}>
          <Text variant="body" style={styles.skip}>{t('common.skip')}</Text>
        </MotionPressable>
      ) : null}
    </View>
  );
}

interface PrimaryCtaProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** The 54px turmeric pill with its warm glow (all frames). */
export function PrimaryCta({ label, onPress, disabled, style }: PrimaryCtaProps) {
  return (
    <MotionPressable
      onPress={onPress}
      disabled={disabled}
      pressedScale={0.97}
      style={[styles.cta, disabled && styles.ctaDisabled, style]}
      accessibilityRole="button"
      accessibilityLabel={label}>
      <Text variant="button" style={styles.ctaText}>{label}</Text>
    </MotionPressable>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 38,
  },
  dashes: { flexDirection: 'row', gap: 6 },
  dash: { width: 26, height: 3, borderRadius: 2 },
  skip: { fontSize: 14, color: onb.textFaint },

  cta: {
    height: controlHeight.button,
    borderRadius: borderRadius.button,
    backgroundColor: palette.turmeric,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: palette.turmeric,
    shadowOpacity: 0.3,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  ctaDisabled: { opacity: 0.45 },
  ctaText: { fontSize: 16, color: palette.night },
});
