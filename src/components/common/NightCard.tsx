import { memo, type ReactNode } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { CornerBrackets } from './CornerBrackets';
import { MandalaWatermark } from './MandalaWatermark';
import { borderRadius, palette, spacing } from '@/config/theme';

/**
 * Dark-plinth card: the inverse surface used for the Panchang hero, audio
 * player, and dasha callout. Deep brown-black background, bone-white text,
 * gold-leaf corner brackets, optional centered mandala watermark.
 *
 * Content is rendered inside a padded inner view so the brackets sit on the
 * card border, not inside the content flow. Override `padding` if the caller
 * needs a flush layout (e.g. the audio player occupies the entire card).
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
}: NightCardProps) {
  return (
    <View style={[styles.card, style]}>
      {showMandala && (
        <MandalaWatermark
          size={mandalaSize}
          color={palette.goldLeaf}
          opacity={mandalaOpacity}
          position="center"
        />
      )}
      {showBrackets && <CornerBrackets color={palette.goldLeaf} inset={bracketInset} />}
      <View style={[{ padding }, innerStyle]}>{children}</View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.card,
    overflow: 'hidden',
    backgroundColor: palette.nightPlinth,
    borderWidth: 1,
    borderColor: palette.nightPlinthDeep,
  },
});
