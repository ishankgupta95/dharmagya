import { memo, useEffect, type ReactNode } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from './AppText';
import { palette } from '@/config/theme';
import { easings } from '@/config/motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
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
 *
 * `settle` (P7.3) opts the label into a one-shot entrance: opacity 0 → 1
 * and scaleX 0.96 → 1 over 500ms on first mount. Reserved for major section
 * titles on hero screens (home "Your Deities" / featured kickers). Chip- or
 * row-style usages keep the default (no animation) to avoid layout drama.
 *
 * Every call site titles the card group that follows it, so the text carries
 * `accessibilityRole="header"` unconditionally — that is what puts the Kundli
 * and Settings screens on TalkBack's Headings rotor. The role sits on the text
 * and not on the row, so the leading rule stays a decoration and nothing that
 * was silent before becomes a focus stop.
 */
interface SectionLabelProps {
  children: ReactNode;
  tone?: 'light' | 'dark';
  color?: string;
  ruleColor?: string;
  ruleLength?: number;
  style?: StyleProp<ViewStyle>;
  settle?: boolean;
}

const SETTLE_DURATION_MS = 500;
const SETTLE_SCALE_FROM = 0.96;

export const SectionLabel = memo(function SectionLabel({
  children,
  tone,
  color,
  ruleColor,
  ruleLength = 20,
  style,
  settle = false,
}: SectionLabelProps) {
  const isDarkMode = useStore(s => s.isDarkMode);
  const isDark = tone === 'dark' || (tone !== 'light' && isDarkMode);
  const resolvedText = color ?? (isDark ? 'rgba(243,229,200,0.75)' : palette.inkQuiet);
  const resolvedRule = ruleColor ?? (isDark ? palette.goldLeaf : palette.sindoor);

  const rowContent = (
    <>
      <View style={[styles.rule, { width: ruleLength, backgroundColor: resolvedRule }]} />
      <AppText
        variant="mono-caps"
        accessibilityRole="header"
        style={[styles.label, { color: resolvedText }]}>
        {children}
      </AppText>
    </>
  );

  if (settle) {
    return <SettlingRow style={style}>{rowContent}</SettlingRow>;
  }
  return <View style={[styles.row, style]}>{rowContent}</View>;
});

interface SettlingRowProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

// Isolated so the non-settling path doesn't pay for a shared value, effect,
// or worklet style on every SectionLabel mount.
function SettlingRow({ children, style }: SettlingRowProps) {
  const { dur, reduced } = useReducedMotion();
  const progress = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(1, {
      duration: dur(SETTLE_DURATION_MS),
      easing: easings.standard,
    });
    return () => {
      cancelAnimation(progress);
    };
  }, [progress, dur]);

  // scaleX-only, never letterSpacing — animating letter-spacing forces a
  // relayout per frame on Android and tanks Pixel 3a frame time.
  const animStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scaleX: SETTLE_SCALE_FROM + progress.value * (1 - SETTLE_SCALE_FROM) }],
  }));

  return <Animated.View style={[styles.row, style, animStyle]}>{children}</Animated.View>;
}

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
