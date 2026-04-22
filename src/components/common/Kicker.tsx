import { memo, type ReactNode } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle, type TextStyle } from 'react-native';

import { AppText } from './AppText';
import { palette } from '@/config/theme';

/**
 * Mono uppercase kicker — sits above hero blocks, deity titles, and cards.
 * Small, spaced, quietly colored. See design study `.kick` / `.tag` classes.
 * Default color is `palette.sindoor`; pass `color` to opt into gold-leaf
 * (night plinth) or ink-quiet (parchment secondary kickers).
 */
interface KickerProps {
  children: ReactNode;
  color?: string;
  size?: number;
  style?: StyleProp<TextStyle>;
  wrapperStyle?: StyleProp<ViewStyle>;
  /** Optional trailing hairline — design study `.ph-head .rk` + verse kickers. */
  withTrailingRule?: boolean;
  ruleColor?: string;
}

export const Kicker = memo(function Kicker({
  children,
  color = palette.sindoor,
  size = 10,
  style,
  wrapperStyle,
  withTrailingRule = false,
  ruleColor,
}: KickerProps) {
  const text = (
    <AppText variant="mono-caps" style={[{ fontSize: size, color }, style]}>
      {children}
    </AppText>
  );

  if (!withTrailingRule) return text;

  return (
    <View style={[styles.withRuleRow, wrapperStyle]}>
      {text}
      <View style={[styles.rule, { backgroundColor: ruleColor ?? palette.ruleSoft }]} />
    </View>
  );
});

const styles = StyleSheet.create({
  withRuleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
});
