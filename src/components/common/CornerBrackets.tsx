import { memo } from 'react';
import { View, StyleSheet } from 'react-native';

import { palette } from '@/config/theme';

/**
 * Four gold-leaf L-shaped brackets — absolutely positioned inside any
 * rectangular container (night plinth cards, hero wells). Non-interactive
 * decoration; set `pointerEvents="none"` on the parent if overlaying content.
 *
 * The brackets themselves are simple absolutely positioned corner elements —
 * one horizontal + one vertical edge per corner, drawn with a 1px gold stroke.
 */
interface CornerBracketsProps {
  color?: string;
  length?: number;
  thickness?: number;
  inset?: number;
}

export const CornerBrackets = memo(function CornerBrackets({
  color = palette.goldLeaf,
  length = 16,
  thickness = 1,
  inset = 8,
}: CornerBracketsProps) {
  const h = { width: length, height: thickness, backgroundColor: color };
  const v = { width: thickness, height: length, backgroundColor: color };

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* Top-left */}
      <View style={[styles.abs, { top: inset, left: inset }, h]} />
      <View style={[styles.abs, { top: inset, left: inset }, v]} />
      {/* Top-right */}
      <View style={[styles.abs, { top: inset, right: inset }, h]} />
      <View style={[styles.abs, { top: inset, right: inset }, v]} />
      {/* Bottom-left */}
      <View style={[styles.abs, { bottom: inset, left: inset }, h]} />
      <View style={[styles.abs, { bottom: inset, left: inset }, v]} />
      {/* Bottom-right */}
      <View style={[styles.abs, { bottom: inset, right: inset }, h]} />
      <View style={[styles.abs, { bottom: inset, right: inset }, v]} />
    </View>
  );
});

const styles = StyleSheet.create({
  abs: {
    position: 'absolute',
  },
});
