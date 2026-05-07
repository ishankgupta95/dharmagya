import { memo, useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { AppText } from '@/components/common/AppText';
import { Icon } from '@/components/common/Icon';
import { durations, easings } from '@/config/motion';
import { type ColorPalette } from '@/config/theme';

interface AccordionSectionProps {
  /** Stable slug used as the persisted-state key on the store. */
  storageKey: string;
  /** Section title rendered in the header. */
  title: string;
  /** Open state from the store. */
  open: boolean;
  /** Toggle handler — usually `togglePanchangCategory(storageKey)`. */
  onToggle: () => void;
  /** Fires the *first* time the section opens this mount. Used to trigger
   *  lazy daily-panchang compute. Subsequent open/close cycles do not refire. */
  onFirstOpen?: () => void;
  /** Optional right-side hint text (e.g. count, "·", or a status pill). */
  rightHint?: string;
  /** Optional accent colour for the right-hint dot — when present the header
   *  prints a small coloured dot before the title (matches AlmanacGroup style). */
  accentColor?: string;
  colors: ColorPalette;
  children: ReactNode;
}

/**
 * Sacred-Editorial collapsible. Reuses the printed-almanac aesthetic:
 *
 *   ─ AUSPICIOUS TIMES ──────────────────────────  ⌄
 *
 * The header is a tap-target with small-caps title (or accent dot + small-caps
 * title) and a chevron that rotates 180° when open. Body renders below only
 * when open — no measure-and-animate-height tricks. The chevron is the only
 * animated piece; the rest is conditional render. Cheap and avoids layout
 * jitter on low-end devices.
 *
 * Lazy compute hook: `onFirstOpen` is invoked exactly once per mount the first
 * time `open` flips to true. Repeated re-opens (after closes) do not refire,
 * since the data fetch they trigger is cached at the service layer.
 */
export const AccordionSection = memo(function AccordionSection({
  title,
  open,
  onToggle,
  onFirstOpen,
  rightHint,
  accentColor,
  colors,
  children,
}: AccordionSectionProps) {
  const firedRef = useRef(false);
  const rotation = useSharedValue(open ? 1 : 0);

  useEffect(() => {
    rotation.value = withTiming(open ? 1 : 0, {
      duration: durations.fast,
      easing: easings.standard,
    });
    if (open && !firedRef.current) {
      firedRef.current = true;
      onFirstOpen?.();
    }
  }, [open, onFirstOpen, rotation]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value * 180}deg` }],
  }));

  return (
    <View style={styles.root}>
      <TouchableOpacity
        activeOpacity={0.65}
        onPress={onToggle}
        style={styles.header}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={title}>
        {accentColor && (
          <View style={[styles.dot, { backgroundColor: accentColor }]} />
        )}
        <AppText
          variant="mono-caps"
          style={[styles.title, { color: accentColor ?? colors.textTertiary }]}
          numberOfLines={1}>
          {title}
        </AppText>
        <View style={[styles.rule, { backgroundColor: (accentColor ?? colors.divider) + (accentColor ? '33' : '') }]} />
        {rightHint && (
          <AppText
            variant="mono"
            style={[styles.hint, { color: colors.textMuted }]}
            numberOfLines={1}>
            {rightHint}
          </AppText>
        )}
        <Animated.View style={chevronStyle}>
          <Icon name="chevron-down" size={16} color={accentColor ?? colors.textTertiary} />
        </Animated.View>
      </TouchableOpacity>

      {open && (
        <View style={styles.body}>
          {children}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  title: {
    fontSize: 12.5,
    letterSpacing: 1.5,
  },
  rule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  hint: {
    fontSize: 11,
    letterSpacing: 0.6,
  },
  body: {
    paddingTop: 4,
  },
});
