import { memo, useMemo } from 'react';
import { Text, StyleSheet, type TextProps, type TextStyle } from 'react-native';

import { useStore } from '@/store/useStore';
import type { FontSize } from '@/store/useStore';
import { typeScale } from '@/config/theme';

export const FONT_SCALE: Record<FontSize, number> = {
  small: 0.85,
  normal: 1.0,
  medium: 1.15,
  large: 1.3,
};

const fontSizeSelector = (s: { fontSize: FontSize }) => s.fontSize;

/**
 * Diya text variants. Opt-in — passing `variant="display"` applies the
 * matching `typeScale` token as a base style, which the caller's `style` prop
 * can still override. Omitting `variant` preserves legacy behavior for screens
 * that haven't been ported yet.
 *
 * The italic variants are kept as names only — the Diya design language has no
 * italics, so they resolve to the upright faces.
 */
export type AppTextVariant =
  | 'display'
  | 'display-italic'
  | 'title'
  | 'body'
  | 'body-italic'
  | 'body-small'
  | 'button'
  | 'kicker'
  | 'kicker-small'
  | 'deva'
  | 'deva-bold'
  | 'deva-verse'
  | 'mono'
  | 'mono-caps';

const VARIANT_TO_TOKEN: Record<AppTextVariant, TextStyle> = {
  display: typeScale.display,
  'display-italic': typeScale.display,
  title: typeScale.title,
  body: typeScale.body,
  'body-italic': typeScale.body,
  'body-small': typeScale.bodySmall,
  button: typeScale.button,
  kicker: typeScale.kicker,
  'kicker-small': typeScale.kickerSmall,
  deva: typeScale.deva,
  'deva-bold': typeScale.devaBold,
  'deva-verse': typeScale.devaVerse,
  mono: typeScale.mono,
  'mono-caps': typeScale.kicker,
};

interface AppTextProps extends TextProps {
  variant?: AppTextVariant;
}

/**
 * Drop-in replacement for RN's Text.
 * Reads fontSize setting from the global store and scales every explicit
 * fontSize (and proportional lineHeight) in the style prop automatically.
 * Import as: import { AppText as Text } from '@/components/common/AppText';
 */
export const AppText = memo(function AppText({ style, variant, ...props }: AppTextProps) {
  const fontSize = useStore(fontSizeSelector);
  const scale = FONT_SCALE[fontSize];

  const mergedStyle = useMemo(() => {
    if (!variant) return style;
    return [VARIANT_TO_TOKEN[variant], style];
  }, [variant, style]);

  if (scale === 1) {
    return <Text style={mergedStyle} {...props} />;
  }

  const flat = StyleSheet.flatten(mergedStyle) ?? {};
  const scaledFontSize = flat.fontSize !== undefined ? Math.round(flat.fontSize * scale) : undefined;
  const scaledLineHeight = flat.lineHeight !== undefined
    ? Math.round(flat.lineHeight * scale)
    : scaledFontSize !== undefined
      ? Math.round(scaledFontSize * 1.6)
      : undefined;
  const scaledStyle = {
    ...flat,
    ...(scaledFontSize !== undefined ? { fontSize: scaledFontSize } : {}),
    ...(scaledLineHeight !== undefined ? { lineHeight: scaledLineHeight } : {}),
  };

  return <Text style={scaledStyle} {...props} />;
});
