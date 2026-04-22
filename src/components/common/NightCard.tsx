import { memo, type ReactNode } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { CornerBrackets } from './CornerBrackets';
import { MandalaWatermark } from './MandalaWatermark';
import { MotionPressable } from './MotionPressable';
import { borderRadius, palette, spacing } from '@/config/theme';
import { useStore } from '@/store/useStore';

/**
 * Editorial plinth card. Originally a dark-only surface (panchang hero, dasha
 * callout, muhurat result, audio dock) but theme-aware in P6.10+ so the same
 * plinth treatment renders as a recessed parchment surface in light mode and
 * the night-plinth in dark mode. Gold corner brackets + mandala stay in both
 * modes — those are the editorial signature, not the darkness.
 *
 * Content is rendered inside a padded inner view so the brackets sit on the
 * card border, not inside the content flow. Callers that need to colour text
 * or rules inside the card should call [usePlinthColors](./NightCard.tsx)
 * so the inner colours flip with the theme.
 */
interface NightCardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  innerStyle?: StyleProp<ViewStyle>;
  padding?: number;
  showBrackets?: boolean;
  showMandala?: boolean;
  mandalaSize?: number;
  mandalaOpacity?: number;
  bracketInset?: number;
  /**
   * When provided, renders the card as a MotionPressable so press-in scale
   * animation runs on the UI thread. Leave undefined for display-only cards.
   */
  onPress?: () => void;
  accessibilityLabel?: string;
}

export interface PlinthColors {
  bg: string;
  border: string;
  text: string;
  textMuted: string;
  textSubdued: string;
  divider: string;
  accent: string;
  bracket: string;
  mandala: string;
  iconBg: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
}

const PLINTH_DARK: PlinthColors = {
  bg: palette.nightPlinth,
  border: palette.nightPlinthDeep,
  text: palette.boneWhite,
  textMuted: 'rgba(243,229,200,0.72)',
  textSubdued: 'rgba(243,229,200,0.62)',
  divider: 'rgba(201,155,58,0.16)',
  accent: palette.goldLeaf,
  bracket: palette.goldLeaf,
  mandala: palette.goldLeaf,
  iconBg: 'rgba(217,106,40,0.16)',
  badgeBg: 'transparent',
  badgeBorder: 'rgba(201,155,58,0.5)',
  badgeText: 'rgba(243,229,200,0.88)',
};

const PLINTH_LIGHT: PlinthColors = {
  bg: palette.parchmentDeep,
  border: palette.paperEdge,
  text: palette.ink,
  textMuted: palette.inkSoft,
  textSubdued: palette.inkQuiet,
  divider: 'rgba(184,166,112,0.55)',
  accent: palette.gold,
  bracket: palette.gold,
  mandala: palette.gold,
  iconBg: 'rgba(165,48,28,0.10)',
  badgeBg: 'rgba(251,243,222,0.6)',
  badgeBorder: 'rgba(156,118,35,0.45)',
  badgeText: palette.inkSoft,
};

export function usePlinthColors(): PlinthColors {
  const isDark = useStore((s) => s.isDarkMode);
  return isDark ? PLINTH_DARK : PLINTH_LIGHT;
}

export const NightCard = memo(function NightCard({
  children,
  style,
  innerStyle,
  padding = spacing.cardPadLg,
  showBrackets = true,
  showMandala = true,
  mandalaSize,
  mandalaOpacity = 0.07,
  bracketInset = 10,
  onPress,
  accessibilityLabel,
}: NightCardProps) {
  const plinth = usePlinthColors();
  // P7.3 draw-in is handled inside CornerBrackets — it snapshots its
  // `animateEntrance` prop on first render, so NightCard re-renders (theme,
  // state churn) never retrigger the animation without any ref plumbing here.
  const body = (
    <>
      {showMandala && (
        <MandalaWatermark
          size={mandalaSize}
          color={plinth.mandala}
          opacity={mandalaOpacity}
          position="center"
        />
      )}
      {showBrackets && (
        <CornerBrackets
          color={plinth.bracket}
          inset={bracketInset}
          animateEntrance
        />
      )}
      <View style={[{ padding }, innerStyle]}>{children}</View>
    </>
  );
  const surfaceStyle = [styles.card, { backgroundColor: plinth.bg, borderColor: plinth.border }, style];
  if (onPress) {
    return (
      <MotionPressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={surfaceStyle}>
        {body}
      </MotionPressable>
    );
  }
  return <View style={surfaceStyle}>{body}</View>;
});

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.card,
    overflow: 'hidden',
    borderWidth: 1,
  },
});
