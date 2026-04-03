import { useState } from 'react';
import { View, TouchableOpacity, TouchableWithoutFeedback, StyleSheet } from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { borderRadius, type ColorPalette } from '@/config/theme';

const PADDING = 6;
const TOOLTIP_GAP = 16;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SpotlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface WalkthroughSpotlightProps {
  spotlight: SpotlightRect;
  title: string;
  description: string;
  tooltipPosition: 'above' | 'below';
  stepIndex: number;
  totalSteps: number;
  /** If provided, shows a Next button instead of "tap highlighted area" hint */
  nextLabel?: string;
  onNext?: () => void;
  /** Called when user taps the highlighted element (spotlight cutout) */
  onSpotlightTap?: () => void;
  onSkip: () => void;
  colors: ColorPalette;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function WalkthroughSpotlight({
  spotlight,
  title,
  description,
  tooltipPosition,
  stepIndex,
  totalSteps,
  nextLabel,
  onNext,
  onSpotlightTap,
  onSkip,
  colors,
}: WalkthroughSpotlightProps) {
  const { t } = useTranslation();
  const [tooltipHeight, setTooltipHeight] = useState(0);

  // Spotlight rect with padding
  const s = {
    x: spotlight.x - PADDING,
    y: spotlight.y - PADDING,
    w: spotlight.width + PADDING * 2,
    h: spotlight.height + PADDING * 2,
  };

  // Arrow horizontal position: center on spotlight, relative to tooltip left edge (20px)
  const arrowLeft = Math.max(10, s.x + s.w / 2 - 20 - 10);

  // Tooltip top position
  const tooltipTop =
    tooltipPosition === 'below'
      ? s.y + s.h + TOOLTIP_GAP
      : s.y - TOOLTIP_GAP - tooltipHeight;

  // Hide tooltip until measured for 'above' positioning
  const tooltipReady = tooltipPosition === 'below' || tooltipHeight > 0;

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(200)}
      style={styles.root}
      pointerEvents="box-none"
    >
      {/* ── 4 dark strips forming the backdrop with a cutout ── */}
      <View style={[styles.strip, { top: 0, left: 0, right: 0, height: s.y }]} />
      <View style={[styles.strip, { top: s.y + s.h, left: 0, right: 0, bottom: 0 }]} />
      <View style={[styles.strip, { top: s.y, left: 0, width: s.x, height: s.h }]} />
      <View style={[styles.strip, { top: s.y, left: s.x + s.w, right: 0, height: s.h }]} />

      {/* ── Glowing border around spotlight ── */}
      <View
        style={[
          styles.spotlightBorder,
          {
            top: s.y,
            left: s.x,
            width: s.w,
            height: s.h,
            borderColor: colors.accent,
            shadowColor: colors.accent,
          },
        ]}
      />

      {/* ── Touchable area over the spotlight ── */}
      <TouchableWithoutFeedback onPress={onSpotlightTap ?? (() => {})}>
        <View
          style={{
            position: 'absolute',
            top: s.y,
            left: s.x,
            width: s.w,
            height: s.h,
          }}
        />
      </TouchableWithoutFeedback>

      {/* ── Tooltip card ── */}
      <View
        style={[
          styles.tooltip,
          {
            backgroundColor: colors.surface,
            borderColor: colors.borderAccent,
            top: tooltipTop,
            opacity: tooltipReady ? 1 : 0,
          },
        ]}
        onLayout={(e) => {
          if (tooltipPosition === 'above' && tooltipHeight === 0) {
            setTooltipHeight(e.nativeEvent.layout.height);
          }
        }}
        pointerEvents="box-none"
      >
        {/* Arrow pointing to spotlight */}
        {tooltipPosition === 'below' && (
          <View
            style={[
              styles.arrowUp,
              { borderBottomColor: colors.surface, left: arrowLeft },
            ]}
          />
        )}

        <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[styles.desc, { color: colors.textSecondary }]}>{description}</Text>

        {/* Step dots */}
        <View style={styles.dotsRow}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i === stepIndex ? colors.accent : colors.border },
                i === stepIndex && styles.dotActive,
              ]}
            />
          ))}
        </View>

        {/* Action row */}
        <View style={styles.actionRow}>
          <TouchableOpacity onPress={onSkip} hitSlop={10}>
            <Text style={[styles.skipText, { color: colors.textMuted }]}>{t('walkthrough.skip')}</Text>
          </TouchableOpacity>

          {onNext ? (
            <TouchableOpacity
              onPress={onNext}
              style={[styles.nextBtn, { backgroundColor: colors.accent }]}
              activeOpacity={0.8}
            >
              <Text style={[styles.nextText, { color: '#FFFFFF' }]}>
                {nextLabel ?? t('walkthrough.next')}
              </Text>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <View style={[styles.tapHint, { backgroundColor: colors.accent + '18' }]}>
              <Ionicons name="hand-left-outline" size={14} color={colors.accent} />
              <Text style={[styles.tapHintText, { color: colors.accent }]}>
                {t('walkthrough.tapHighlighted')}
              </Text>
            </View>
          )}
        </View>

        {tooltipPosition === 'above' && (
          <View
            style={[
              styles.arrowDown,
              { borderTopColor: colors.surface, left: arrowLeft },
            ]}
          />
        )}
      </View>
    </Animated.View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  strip: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  spotlightBorder: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: borderRadius.card,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },
  tooltip: {
    position: 'absolute',
    left: 20,
    right: 20,
    borderRadius: borderRadius.card,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  arrowUp: {
    position: 'absolute',
    top: -10,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  arrowDown: {
    position: 'absolute',
    bottom: -10,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  title: {
    fontSize: 18,
    fontFamily: 'Mukta_700Bold',
    marginBottom: 6,
  },
  desc: {
    fontSize: 14,
    fontFamily: 'Mukta_400Regular',
    lineHeight: 21,
    marginBottom: 16,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 16,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotActive: {
    width: 18,
    borderRadius: 9,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skipText: {
    fontSize: 14,
    fontFamily: 'Mukta_500Medium',
  },
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.chip,
  },
  tapHintText: {
    fontSize: 12,
    fontFamily: 'Mukta_500Medium',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: borderRadius.button,
  },
  nextText: {
    fontSize: 14,
    fontFamily: 'Mukta_700Bold',
  },
});
