import { Text, StyleSheet, type TextProps } from 'react-native';

import { useStore } from '@/store/useStore';
import type { FontSize } from '@/store/useStore';

export const FONT_SCALE: Record<FontSize, number> = {
  small: 0.82,
  normal: 1.0,
  large: 1.5,
  xl: 1.9,
};

/**
 * Drop-in replacement for RN's Text.
 * Reads fontSize setting from the global store and scales every explicit
 * fontSize (and proportional lineHeight) in the style prop automatically.
 * Import as: import { AppText as Text } from '@/components/common/AppText';
 */
export function AppText({ style, ...props }: TextProps) {
  const { fontSize } = useStore();
  const scale = FONT_SCALE[fontSize];

  if (scale === 1) {
    return <Text style={style} {...props} />;
  }

  const flat = StyleSheet.flatten(style) ?? {};
  const scaledStyle = {
    ...flat,
    ...(flat.fontSize !== undefined ? { fontSize: Math.round(flat.fontSize * scale) } : {}),
    ...(flat.lineHeight !== undefined ? { lineHeight: Math.round(flat.lineHeight * scale) } : {}),
  };

  return <Text style={scaledStyle} {...props} />;
}
