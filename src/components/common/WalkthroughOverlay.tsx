import { useState, useEffect, useRef, useCallback } from 'react';
import {
  AccessibilityInfo,
  View,
  TouchableWithoutFeedback,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { Icon } from '@/components/common/Icon';
import { useTranslation } from 'react-i18next';
import { MotionPressable } from '@/components/common/MotionPressable';
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { borderRadius, palette } from '@/config/theme';
import { CornerBrackets } from './CornerBrackets';

const PADDING = 6;
const TOOLTIP_GAP = 16;
// Android refuses accessibility focus on a fully transparent view, and the card
// arrives behind a 300ms FadeIn. Ask for focus just after it has settled.
const A11Y_FOCUS_DELAY_MS = 350;

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
}: WalkthroughSpotlightProps) {
  const { t } = useTranslation();
  const dims = useWindowDimensions();
  const [tooltipHeight, setTooltipHeight] = useState(0);

  // Measure the overlay's own screen position so we can offset spotlight
  // coordinates (which come from measureInWindow = screen-absolute) to be
  // relative to this container.
  const rootRef = useRef<View>(null);
  const [containerOffset, setContainerOffset] = useState<{ x: number; y: number } | null>(null);

  const measureSelf = useCallback(() => {
    rootRef.current?.measureInWindow((cx, cy) => {
      setContainerOffset({ x: cx, y: cy });
    });
  }, []);

  // Pulsing animation for the spotlight border
  const pulseOpacity = useSharedValue(1);
  useEffect(() => {
    pulseOpacity.value = withRepeat(
      withTiming(0.4, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [pulseOpacity]);
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  const ox = containerOffset?.x ?? 0;
  const oy = containerOffset?.y ?? 0;

  const s = {
    x: spotlight.x - PADDING - ox,
    y: spotlight.y - PADDING - oy,
    w: spotlight.width + PADDING * 2,
    h: spotlight.height + PADDING * 2,
  };

  const arrowLeft = Math.max(10, s.x + s.w / 2 - 20 - 10);

  // ── Tooltip placement with screen clamping + auto-flip ───────────────────
  // On short / low-PPI phones the requested side ('above' or 'below') may not
  // have room for the tooltip, leaving Next / Skip off-screen and stranding
  // the user. Auto-flip when the requested side doesn't fit, then clamp into
  // the visible area as a final safety net.
  const SAFE_MARGIN = 16;
  const rootHeight = dims.height; // root is absolutely positioned full-screen — close enough
  const spaceAbove = s.y;
  const spaceBelow = rootHeight - oy - (s.y + s.h);
  const requiredSpace = (tooltipHeight || 220) + TOOLTIP_GAP + SAFE_MARGIN;

  const fitsRequested =
    tooltipPosition === 'above' ? spaceAbove >= requiredSpace : spaceBelow >= requiredSpace;
  const fitsOther =
    tooltipPosition === 'above' ? spaceBelow >= requiredSpace : spaceAbove >= requiredSpace;
  const effectivePosition: 'above' | 'below' = fitsRequested
    ? tooltipPosition
    : fitsOther
      ? tooltipPosition === 'above'
        ? 'below'
        : 'above'
      : tooltipPosition;

  const tooltipTopRaw =
    effectivePosition === 'below'
      ? s.y + s.h + TOOLTIP_GAP
      : s.y - TOOLTIP_GAP - tooltipHeight;

  // Clamp into root coords so the tooltip card always stays on-screen even
  // when neither side fits. The arrow may then visually disconnect from the
  // spotlight, but a usable tooltip beats a stranded user.
  const tooltipMaxTop = rootHeight - oy - tooltipHeight - SAFE_MARGIN;
  const tooltipMinTop = SAFE_MARGIN - oy;
  const tooltipTop = Math.max(tooltipMinTop, Math.min(tooltipTopRaw, tooltipMaxTop));

  const tooltipReady = effectivePosition === 'below' || tooltipHeight > 0;
  const overlayReady = containerOffset !== null;

  // ── Screen-reader entry ──────────────────────────────────────────────────
  // The overlay is the last sibling of its host screen, so left alone TalkBack
  // would walk the whole dimmed screen before ever reaching this tooltip, with
  // nothing to say that the walkthrough had opened. Pull accessibility focus
  // onto the instruction as soon as the card is up; landing on it is itself the
  // announcement, so there is no separate `announceForAccessibility` to avoid
  // speaking the copy twice. The announce call is only the fallback for the
  // case where the node never mounted.
  const a11yTooltipLabel = `${title}. ${description}`;
  const tooltipVisible = overlayReady && tooltipReady;
  const tooltipCopyRef = useRef<View>(null);

  useEffect(() => {
    if (!tooltipVisible) return;
    const timer = setTimeout(() => {
      const node = tooltipCopyRef.current;
      if (node) {
        // Fabric-safe focus move. `setAccessibilityFocus(reactTag)` is the
        // pre-Fabric path and does not resolve a New-Architecture node.
        AccessibilityInfo.sendAccessibilityEvent(node, 'focus');
      } else {
        AccessibilityInfo.announceForAccessibility(a11yTooltipLabel);
      }
    }, A11Y_FOCUS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [tooltipVisible, a11yTooltipLabel]);

  // Tooltip card: always on parchment-bright with paperEdge border +
  // turmericInk corner brackets. Editorial motif reads the same on either app
  // theme — the walkthrough is a temporary overlay, so its surface doesn't need
  // to match the underlying screen's palette.
  //
  // Because the plinth is a hardcoded white, every mark on it is measured
  // against white and never against the app theme: the accent has to be the
  // turmericInk step (6.45:1), not turmeric (2.29:1).
  const cardBg = palette.parchmentBright;
  const cardBorder = palette.paperEdge;
  const cardTitleColor = palette.ink;
  const cardBodyColor = palette.inkQuiet;
  const arrowColor = cardBg;

  return (
    <View
      ref={rootRef}
      style={styles.root}
      pointerEvents="box-none"
      onLayout={measureSelf}
      // Declares the overlay modal to the screen reader. RN 0.85 wires this on
      // iOS only — there is no view-level Android equivalent — so on Android
      // the screen behind stays reachable by swiping backwards out of the
      // tooltip. Sealing it there needs `importantForAccessibility=
      // "no-hide-descendants"` on the host screen's other children while the
      // walkthrough is up; the focus move below is what fixes the entry point.
      accessibilityViewIsModal
    >
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(200)}
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
    >
      {overlayReady && (
        <>
      {/* ── 4 dark strips forming the backdrop with a cutout ── */}
      <View style={[styles.strip, { top: 0, left: 0, right: 0, height: s.y }]} />
      <View style={[styles.strip, { top: s.y + s.h, left: 0, right: 0, bottom: 0 }]} />
      <View style={[styles.strip, { top: s.y, left: 0, width: s.x, height: s.h }]} />
      <View style={[styles.strip, { top: s.y, left: s.x + s.w, right: 0, height: s.h }]} />

      {/* ── Glowing sindoor border around spotlight ── */}
      <Animated.View
        style={[
          styles.spotlightBorder,
          {
            top: s.y,
            left: s.x,
            width: s.w,
            height: s.h,
            borderColor: palette.sindoor,
            backgroundColor: palette.sindoor + '20',
            shadowColor: palette.sindoor,
          },
          pulseStyle,
        ]}
      />

      {/* ── Touchable area over the spotlight ──
          On the step that advances by tapping the highlight, this is the only
          way forward, so it has to stay reachable — labelled with the same
          "Tap to continue" wording the card prints. The Next-driven steps pass
          no handler and this layer exists only to swallow taps on the element
          underneath; there it is an unlabelled dead end, so hide it instead. */}
      <TouchableWithoutFeedback
        onPress={onSpotlightTap ?? (() => {})}
        accessible={onSpotlightTap != null}
        accessibilityRole={onSpotlightTap ? 'button' : undefined}
        accessibilityLabel={onSpotlightTap ? t('walkthrough.tapHighlighted') : undefined}
        accessibilityElementsHidden={onSpotlightTap == null}
        importantForAccessibility={onSpotlightTap ? 'yes' : 'no-hide-descendants'}>
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

      {/* ── Tooltip card — parchment-bright plinth with accent brackets ── */}
      <View
        style={[
          styles.tooltip,
          {
            backgroundColor: cardBg,
            borderColor: cardBorder,
            top: tooltipTop,
            opacity: tooltipReady ? 1 : 0,
          },
        ]}
        onLayout={(e) => {
          // Capture height once we have it so we can pre-flip / clamp on the
          // next render — measure for either requested direction.
          if (tooltipHeight === 0) {
            setTooltipHeight(e.nativeEvent.layout.height);
          }
        }}
        pointerEvents="box-none"
      >
        {/* Override the component default (turmeric): that value is tuned for
            the dark NightCards this motif normally sits on, and only reaches
            2.29:1 on this white plinth — an ornament too faint to see. */}
        <CornerBrackets color={palette.turmericInk} inset={8} length={14} />

        {/* Arrow pointing to spotlight */}
        {effectivePosition === 'below' && (
          <View
            style={[styles.arrowUp, { borderBottomColor: arrowColor, left: arrowLeft }]}
          />
        )}

        {/* Step counter — "Step 1 · of 4" */}
        <Text variant="mono-caps" style={[styles.kicker, { color: palette.turmericInk }]}>
          {t('walkthrough.stepCounter', { current: stepIndex + 1, total: totalSteps })}
        </Text>

        {/* Title + description are grouped into one accessibility node so the
            focus move above lands on the whole instruction in a single stop.
            Layout is untouched — a bare column View around two block children.
            Skip / Next stay separate, individually focusable controls. */}
        <View ref={tooltipCopyRef} accessible accessibilityLabel={a11yTooltipLabel}>
          <Text variant="display-italic" style={[styles.title, { color: cardTitleColor }]}>
            {title}
          </Text>
          <Text variant="body-italic" style={[styles.desc, { color: cardBodyColor }]}>
            {description}
          </Text>
        </View>

        {/* Step dots */}
        <View style={styles.dotsRow}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i === stepIndex ? palette.sindoor : palette.paperEdge },
                i === stepIndex && styles.dotActive,
              ]}
            />
          ))}
        </View>

        {/* Action row */}
        <View style={styles.actionRow}>
          <MotionPressable
            onPress={onSkip}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('walkthrough.skip')}>
            <Text variant="mono-caps" style={[styles.skipText, { color: palette.inkQuiet }]}>
              {t('walkthrough.skip')}
            </Text>
          </MotionPressable>

          {onNext ? (
            <MotionPressable
              onPress={onNext}
              style={[styles.nextBtn, { backgroundColor: palette.sindoor }]}
              pressedScale={0.97}
              accessibilityRole="button"
              accessibilityLabel={nextLabel ?? t('walkthrough.next')}
            >
              <Text variant="mono-caps" style={styles.nextText}>
                {nextLabel ?? t('walkthrough.next')}
              </Text>
              <Icon name="arrow-right" size={14} color={palette.parchmentBright} />
            </MotionPressable>
          ) : (
            <View style={[styles.tapHint, { borderColor: palette.sindoor }]}>
              <Icon name="hand" size={12} color={palette.sindoor} />
              <Text
                variant="mono-caps"
                numberOfLines={1}
                style={[styles.tapHintText, { color: palette.sindoor }]}>
                {t('walkthrough.tapHighlighted')}
              </Text>
            </View>
          )}
        </View>

        {effectivePosition === 'above' && (
          <View
            style={[styles.arrowDown, { borderTopColor: arrowColor, left: arrowLeft }]}
          />
        )}
      </View>
        </>
      )}
    </Animated.View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 10,
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
  kicker: {
    fontSize: 9,
    marginBottom: 6,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    marginBottom: 6,
  },
  desc: {
    fontSize: 14,
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
    fontSize: 10,
  },
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.chip,
    borderWidth: 1,
    flexShrink: 1,
  },
  tapHintText: {
    fontSize: 9,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: borderRadius.button,
  },
  nextText: {
    fontSize: 11,
    color: palette.parchmentBright,
  },
});
