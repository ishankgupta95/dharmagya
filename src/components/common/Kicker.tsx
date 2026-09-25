import { memo, type ReactNode } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle, type TextStyle } from 'react-native';

import { AppText } from './AppText';
import { darkColors, lightColors, palette } from '@/config/theme';
import { useStore } from '@/store/useStore';

/**
 * Mono uppercase kicker — sits above hero blocks, deity titles, and cards.
 * Small, spaced, quietly colored. See design study `.kick` / `.tag` classes.
 * Default color is the theme's accent-as-words token — turmeric on night,
 * turmeric-ink on rice — because a fixed hex only ever reads on one ground
 * (the old `palette.sindoor` default fell to 2.85:1 on the dark base at these
 * 9–11px sizes). It is a guard for future call sites rather than a fix applied
 * to existing ones: all 71 sites today pass an explicit `color`, so the default
 * is currently unreachable. Pass `color` for a quieter kicker (text-muted) or to force
 * the dark treatment on a night plinth inside a light screen.
 *
 * Nearly every kicker titles the block printed under it — a card, an "About"
 * paragraph, a chapter, a verse — so the text is a screen-reader heading by
 * default and the whole app gains a Headings rotor at once. The handful of
 * kickers that only decorate a value already spoken next to them (a stat-pair
 * caption, a field label inside a verse) should pass `heading={false}` so they
 * stay plain text. The role rides the text, never the trailing-rule row, so no
 * decoration turns into a focus stop.
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
  /** Opt out of the screen-reader heading role for a purely decorative label. */
  heading?: boolean;
}

export const Kicker = memo(function Kicker({
  children,
  color,
  size = 10,
  style,
  wrapperStyle,
  withTrailingRule = false,
  ruleColor,
  heading = true,
}: KickerProps) {
  const isDarkMode = useStore(s => s.isDarkMode);
  const resolvedColor = color ?? (isDarkMode ? darkColors.accentText : lightColors.accentText);

  const text = (
    <AppText
      variant="mono-caps"
      accessibilityRole={heading ? 'header' : undefined}
      style={[{ fontSize: size, color: resolvedColor }, style]}>
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
