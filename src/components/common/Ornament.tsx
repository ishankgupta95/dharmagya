import { memo } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

import { palette } from '@/config/theme';

/**
 * Chapter-break divider used between sections inside cards and on reader
 * screens. Three variants — `lotus` flanks an 8-petal lotus with hairlines,
 * `diamond` centers a gold-leaf rhombus, `double-rule` is a plain editorial
 * double line. Pick `tone="dark"` on night plinth surfaces.
 */
type OrnamentVariant = 'lotus' | 'diamond' | 'double-rule';

interface OrnamentProps {
  variant?: OrnamentVariant;
  color?: string;
  ruleColor?: string;
  tone?: 'light' | 'dark';
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export const Ornament = memo(function Ornament({
  variant = 'diamond',
  color,
  ruleColor,
  tone = 'light',
  size = 14,
  style,
}: OrnamentProps) {
  const resolvedColor =
    color ?? (tone === 'dark' ? palette.goldLeaf : palette.sindoor);
  const resolvedRule =
    ruleColor ?? (tone === 'dark' ? 'rgba(201,155,58,0.35)' : palette.ruleSoft);

  if (variant === 'double-rule') {
    return (
      <View style={[styles.doubleRuleWrap, style]}>
        <View style={[styles.rule, { backgroundColor: resolvedRule }]} />
        <View style={[styles.rule, { backgroundColor: resolvedRule, marginTop: 3 }]} />
      </View>
    );
  }

  return (
    <View style={[styles.row, style]}>
      <View style={[styles.flankRule, { backgroundColor: resolvedRule }]} />
      <View style={styles.glyphSlot}>
        {variant === 'lotus' ? (
          <LotusGlyph color={resolvedColor} size={size} />
        ) : (
          <DiamondGlyph color={resolvedColor} size={size} />
        )}
      </View>
      <View style={[styles.flankRule, { backgroundColor: resolvedRule }]} />
    </View>
  );
});

function DiamondGlyph({ color, size }: { color: string; size: number }) {
  const s = size;
  return (
    <Svg width={s} height={s} viewBox="0 0 10 10">
      <Path d="M5 0.6 L9.4 5 L5 9.4 L0.6 5 Z" fill={color} />
    </Svg>
  );
}

/** Eight-petal lotus suggestion, drawn from four overlapping rhombus petals
 *  rotated 0/45/90/135°, plus a centered dot. Purposefully geometric — meant
 *  to read as an ornament, not a botanical illustration. */
function LotusGlyph({ color, size }: { color: string; size: number }) {
  const s = size * 1.35;
  return (
    <Svg width={s} height={s} viewBox="-12 -12 24 24">
      {[0, 45, 90, 135].map((angle) => (
        <Path
          key={angle}
          d="M0 -9 L2.4 0 L0 9 L-2.4 0 Z"
          fill={color}
          fillOpacity={0.9}
          transform={`rotate(${angle})`}
        />
      ))}
      <Circle cx={0} cy={0} r={1.6} fill={color} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  flankRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  glyphSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  doubleRuleWrap: {
    alignSelf: 'stretch',
  },
  rule: {
    height: StyleSheet.hairlineWidth,
  },
});
