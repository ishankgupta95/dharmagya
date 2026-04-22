import { type ReactNode } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { useAnimatedMount } from '@/hooks/useAnimatedMount';

interface ScreenMountProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Thin `Animated.View` wrapper that applies the shared screen entrance
 * (opacity 0→1 + translateY 8→0, durations.base, easings.standard). Drop
 * this as the outermost element of any tab or detail screen so every screen
 * inherits the same cadence without re-importing the hook at each call site.
 */
export function ScreenMount({ children, style }: ScreenMountProps) {
  const mountStyle = useAnimatedMount();
  return (
    <Animated.View style={[{ flex: 1 }, style, mountStyle]}>
      {children}
    </Animated.View>
  );
}
