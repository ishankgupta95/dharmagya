import { memo } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path, G } from 'react-native-svg';

import { palette } from '@/config/theme';

/**
 * Geometric yantra — eight radiating petals enclosed in two concentric rings
 * with an inner Shatkoṇa (two overlapping triangles) and central bindu.
 * Purely decorative; intended as a low-opacity background motif behind
 * Panchang hero, audio player, and onboarding welcome copy.
 *
 * `position` — `center` by default. Use `top-right` / `bottom-left` etc. for
 * corner watermarks. `size` is the SVG square edge in dp.
 */
type Position = 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

interface MandalaWatermarkProps {
  size?: number;
  color?: string;
  opacity?: number;
  position?: Position;
  /** Pixel offset from the chosen position edge. */
  offset?: number;
  style?: StyleProp<ViewStyle>;
}

export const MandalaWatermark = memo(function MandalaWatermark({
  size = 180,
  color = palette.goldLeaf,
  opacity = 0.08,
  position = 'center',
  offset = 0,
  style,
}: MandalaWatermarkProps) {
  const inner = (
    <Svg width={size} height={size} viewBox="-50 -50 100 100">
      <Circle cx={0} cy={0} r={48} fill="none" stroke={color} strokeWidth={0.6} />
      <Circle cx={0} cy={0} r={42} fill="none" stroke={color} strokeWidth={0.4} />
      <G>
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
          <Path
            key={angle}
            d="M0 -38 C 9 -22, 9 -10, 0 0 C -9 -10, -9 -22, 0 -38 Z"
            fill="none"
            stroke={color}
            strokeWidth={0.5}
            transform={`rotate(${angle})`}
          />
        ))}
      </G>
      <Circle cx={0} cy={0} r={16} fill="none" stroke={color} strokeWidth={0.4} />
      <Path d="M0 -14 L12.12 7 L-12.12 7 Z" fill="none" stroke={color} strokeWidth={0.5} />
      <Path d="M0 14 L12.12 -7 L-12.12 -7 Z" fill="none" stroke={color} strokeWidth={0.5} />
      <Circle cx={0} cy={0} r={1.6} fill={color} />
    </Svg>
  );

  if (position === 'center') {
    return (
      <View
        pointerEvents="none"
        style={[styles.abs, styles.centerWrap, { opacity }, style]}>
        {inner}
      </View>
    );
  }

  const [v, h] = position.split('-') as ['top' | 'bottom', 'left' | 'right'];
  return (
    <View
      pointerEvents="none"
      style={[styles.abs, { [v]: offset, [h]: offset }, { opacity }, style]}>
      {inner}
    </View>
  );
});

const styles = StyleSheet.create({
  abs: {
    position: 'absolute',
  },
  centerWrap: {
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
