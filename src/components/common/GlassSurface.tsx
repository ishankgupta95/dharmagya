import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors } from '@/config/theme';

const LIQUID_GLASS = Platform.OS === 'ios' && isLiquidGlassAvailable();

interface GlassSurfaceProps {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/**
 * Diya floating-glass material. Real Liquid Glass on iOS 26+
 * (`expo-glass-effect`); everywhere else a tonal surface — an opaque tinted
 * plate with a hairline edge — per the handoff's fallback rule (no fake blur).
 */
export function GlassSurface({ style, children }: GlassSurfaceProps) {
  const isDark = useStore((s) => s.isDarkMode);
  const colors = isDark ? darkColors : lightColors;

  if (LIQUID_GLASS) {
    return (
      <GlassView
        glassEffectStyle="regular"
        colorScheme={isDark ? 'dark' : 'light'}
        style={style}>
        {children}
      </GlassView>
    );
  }
  return (
    <View
      style={[
        styles.tonal,
        {
          backgroundColor: isDark ? '#2D233C' : '#FCFAF9',
          borderColor: isDark ? 'rgba(255,255,255,0.14)' : colors.border,
        },
        style,
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  tonal: {
    borderWidth: 1,
  },
});
