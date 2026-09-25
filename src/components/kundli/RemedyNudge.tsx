import { memo } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AppText as Text } from '@/components/common/AppText';
import { Icon, type IconName } from '@/components/common/Icon';
import { borderRadius, type ColorPalette } from '@/config/theme';
import type { DayKey } from '@/config/vaarDevata';
import { MotionPressable } from '@/components/common/MotionPressable';

interface RemedyNudgeProps {
  /** Banner copy — already localised by the caller. */
  text: string;
  /** Vaar Devata day this remedy points to (`/vaar/<dayKey>`). */
  dayKey: DayKey;
  icon?: IconName;
  /** Accent for the tint/border/foreground. Defaults to `colors.accent`. */
  accent?: string;
  colors: ColorPalette;
  style?: StyleProp<ViewStyle>;
}

/**
 * Small alpha-tinted banner that links a birth-chart finding (a weak graha, a
 * dosha, an active Sade Sati, the running daśā lord) to its traditional weekday
 * observance — i.e. the relevant Vaar Devata page (P14.1). Purely additive:
 * surfaced *below* an existing Kundli card, framed as "traditionally", never
 * as a fix. Visual family matches the §4 alpha-banner convention
 * (`accent + '1E'` bg / `+ '66'` border / `accentText` foreground).
 *
 * Accessibility: the banner's *text* is its label (it carries the actual
 * advice); the action is conveyed via `accessibilityHint`, not by overriding
 * the label.
 */
export const RemedyNudge = memo(function RemedyNudge({
  text, dayKey, icon = 'flower', accent, colors, style,
}: RemedyNudgeProps) {
  const { t } = useTranslation();
  // Two roles, two tokens: `tint` is the *fill* the banner's background and
  // border are derived from, `ink` is the glyph colour. Painting the glyphs
  // with the fill token put them at 2.13:1 on the light tint.
  const tint = accent ?? colors.accent;
  const ink = accent ?? colors.accentText;
  return (
    <MotionPressable
      pressedScale={0.97}
      onPress={() => router.push(`/vaar/${dayKey}`)}
      style={[styles.banner, { backgroundColor: tint + '1E', borderColor: tint + '66' }, style]}
      accessibilityRole="button"
      accessibilityHint={t('vaar.a11yRemedyNudgeHint')}>
      <Icon name={icon} size={15} color={ink} />
      <Text variant="body" style={[styles.text, { color: colors.textPrimary }]}>
        {text}
      </Text>
      <Icon name="chevron-right" size={14} color={ink} />
    </MotionPressable>
  );
});

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: borderRadius.cardInner,
    borderWidth: 1,
  },
  text: { flex: 1, fontSize: 13, lineHeight: 19 },
});
