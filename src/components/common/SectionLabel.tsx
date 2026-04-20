import { memo, type ReactNode } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from './AppText';
import { palette } from '@/config/theme';
import { useStore } from '@/store/useStore';

/**
 * Small-caps mono section label with a leading 20px accent rule.
 * Matches `.section-lbl` in the design study — used above every card group
 * on parchment screens (Library filter rows, Home "Your Deities", etc.).
 *
 * The rule + text auto-adapt to the app theme: sindoor / inkQuiet on
 * parchment, goldLeaf / bone-white alpha on night plinth. `tone="dark"`
 * forces the dark treatment for labels that sit on a night-plinth surface
 * inside an otherwise light-theme screen (e.g. a NightCard on parchment).
 */
interface SectionLabelProps {
  children: ReactNode;
  tone?: 'light' | 'dark';
  color?: string;
  ruleColor?: string;
  ruleLength?: number;
  style?: StyleProp<ViewStyle>;
}

export const SectionLabel = memo(function SectionLabel({
  children,
  tone,
  color,
  ruleColor,
  ruleLength = 20,
  style,
}: SectionLabelProps) {
  const isDarkMode = useStore(s => s.isDarkMode);
  const isDark = tone === 'dark' || (tone !== 'light' && isDarkMode);
  const resolvedText = color ?? (isDark ? 'rgba(243,229,200,0.75)' : palette.inkQuiet);
  const resolvedRule = ruleColor ?? (isDark ? palette.goldLeaf : palette.sindoor);

  return (
    <View style={[styles.row, style]}>
      <View style={[styles.rule, { width: ruleLength, backgroundColor: resolvedRule }]} />
      <AppText variant="mono-caps" style={[styles.label, { color: resolvedText }]}>
        {children}
      </AppText>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rule: {
    height: 1,
  },
  label: {
    fontSize: 10,
  },
});
