import { useEffect, useMemo } from 'react';
import { Modal, View, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { AppText as Text } from './AppText';
import { Icon } from './Icon';
import { Kicker } from './Kicker';
import { Ornament } from './Ornament';
import { CornerBrackets } from './CornerBrackets';
import { MandalaWatermark } from './MandalaWatermark';
import { useStore } from '@/store/useStore';
import { darkColors, lightColors, palette, spacing, borderRadius } from '@/config/theme';
import { useMilestoneCelebration } from '@/store/useMilestoneCelebration';
import { useShareSheet } from '@/store/useShareSheet';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { durations, easings, loop } from '@/config/motion';

const MANDALA_SIZE = 280;
const MANDALA_OPACITY = 0.12;

/**
 * Sadhana milestone celebration overlay (P14.4). Mounted once in
 * `app/_layout.tsx`. Reads from {@link useMilestoneCelebration}: when a jaap
 * session crosses a sacred-number threshold and the streak recorder calls
 * `unlock(event)`, this Modal pops over whatever screen the user is on.
 *
 * Style — transform + opacity only, per the Phase 7 rules. A faint mandala
 * watermark and corner brackets keep the screen feeling "Sacred Editorial,"
 * not "gamified loot box." Two pills: Share (hands the milestone to
 * `<ShareCardHost />` as a 5th ShareCardSpec kind) and Continue. Tap outside
 * or hardware-back dismisses. Honors reduced motion.
 *
 * Cultural framing (hard rule from PLAN.md §8 P14.4): no scoreboards, no
 * "achievement unlocked" loot-box copy — the headline reads as recognition of
 * sustained practice ("108 repetitions of sacred chanting"), not a game prize.
 */
export function MilestoneCelebrationHost() {
  const { t } = useTranslation();
  const event = useMilestoneCelebration((s) => s.event);
  const dismiss = useMilestoneCelebration((s) => s.dismiss);
  const isDarkMode = useStore((s) => s.isDarkMode);
  const colors = isDarkMode ? darkColors : lightColors;
  const openShare = useShareSheet((s) => s.open);
  const { reduced } = useReducedMotion();

  const breathSV = useSharedValue(0);

  useEffect(() => {
    if (!event) {
      breathSV.value = 0;
      return;
    }
    // Soft breath on the headline + ornament — UI-thread worklet, paired
    // with a confirmation haptic. The loop pauses naturally because the
    // Modal unmounts when `event` clears.
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (reduced) {
      breathSV.value = 0;
      return;
    }
    breathSV.value = withRepeat(
      withSequence(
        withTiming(1, { duration: loop.breath / 2, easing: easings.sine }),
        withTiming(0, { duration: loop.breath / 2, easing: easings.sine }),
      ),
      -1,
      false,
    );
  }, [event, reduced, breathSV]);

  const breathStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breathSV.value * 0.025 }],
    opacity: 0.88 + breathSV.value * 0.12,
  }));

  const headline = useMemo(() => {
    if (!event) return { kicker: '', big: '', subEn: '' };
    const big = formatThreshold(event.threshold);
    const subKey = `sadhana.milestoneSub.${event.kind}`;
    return {
      kicker: t(`sadhana.milestoneKicker.${event.kind}`),
      big,
      subEn: t(subKey, { count: event.threshold }),
    };
  }, [event, t]);

  function handleShare() {
    if (!event) return;
    openShare({
      kind: 'milestone',
      milestoneKind: event.kind,
      threshold: event.threshold,
      deityId: event.deityId,
    });
    // Don't dismiss the celebration — the share sheet sits over it, and the
    // user might want to see the unlock again after closing the share sheet.
  }

  if (!event) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss}>
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={dismiss}
        accessibilityRole="button"
        accessibilityLabel={t('a11y.close')}>
        <Animated.View
          entering={FadeIn.duration(durations.slow)}
          exiting={FadeOut.duration(durations.fast)}
          style={[styles.sheet, { backgroundColor: colors.base, borderColor: colors.borderAccent }]}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            accessible={false}
            style={styles.sheetInner}>

          <MandalaWatermark
            size={MANDALA_SIZE}
            color={palette.goldLeaf}
            opacity={MANDALA_OPACITY}
            position="center"
            style={styles.mandala}
          />

          <CornerBrackets color={palette.goldLeaf} length={28} thickness={1.2} inset={18} />

          <View style={styles.content}>
            <Kicker color={palette.goldLeaf} size={10} style={styles.kicker}>
              {t('sadhana.milestoneEyebrow')}
            </Kicker>

            <Animated.View style={[styles.headlineWrap, breathStyle]}>
              <Text variant="display-italic" style={[styles.kindLine, { color: colors.textSecondary }]}>
                {headline.kicker}
              </Text>
              <Text style={[styles.bigNumber, { color: colors.emphasis }]}>
                {headline.big}
              </Text>
              <Text variant="display-italic" style={[styles.subLine, { color: colors.textPrimary }]}>
                {headline.subEn}
              </Text>
            </Animated.View>

            <Ornament variant="lotus" tone={isDarkMode ? 'dark' : 'light'} style={styles.rule} />

            <Text variant="body-italic" style={[styles.blessing, { color: colors.textTertiary }]}>
              {t('sadhana.milestoneBlessing')}
            </Text>

            <View style={styles.actions}>
              <TouchableOpacity
                onPress={dismiss}
                activeOpacity={0.85}
                style={[styles.btn, styles.btnSecondary, { borderColor: colors.border }]}
                accessibilityRole="button"
                accessibilityLabel={t('sadhana.continueBtn')}>
                <Text variant="mono-caps" style={[styles.btnText, { color: colors.textSecondary }]}>
                  {t('sadhana.continueBtn')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleShare}
                activeOpacity={0.85}
                style={[styles.btn, styles.btnPrimary, { backgroundColor: colors.accent }]}
                accessibilityRole="button"
                accessibilityLabel={t('sadhana.shareBtn')}>
                <Icon name="share" size={14} color={palette.parchmentBright} />
                <Text variant="mono-caps" style={[styles.btnText, { color: palette.parchmentBright }]}>
                  {t('sadhana.shareBtn')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

/** Locale-aware "108", "1,008" etc. Stays plain digits — the celebration is
 *  bilingual but a numeral in Devanagari script (१०८) reads awkwardly at this
 *  size; the milestone *concept* is Sanskrit, the rendering is universal. */
function formatThreshold(n: number): string {
  return n.toLocaleString('en-IN');
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.screenH,
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    borderRadius: borderRadius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sheetInner: {
    paddingHorizontal: spacing.screenH,
    paddingVertical: 32,
  },
  mandala: { position: 'absolute', alignSelf: 'center', top: -40 },
  content: { alignItems: 'center', gap: 0 },
  kicker: { letterSpacing: 3.8, marginBottom: 18, textAlign: 'center' },
  headlineWrap: { alignItems: 'center' },
  kindLine: { fontSize: 14, lineHeight: 18, textAlign: 'center' },
  bigNumber: {
    fontFamily: 'Fraunces_400Regular_Italic',
    fontStyle: 'italic',
    fontSize: 72,
    lineHeight: 82,
    letterSpacing: -2,
    marginTop: 6,
  },
  subLine: { fontSize: 18, lineHeight: 24, textAlign: 'center', marginTop: 4 },
  rule: { marginTop: 18, marginBottom: 14, width: '40%' },
  blessing: { fontSize: 13.5, lineHeight: 21, textAlign: 'center', paddingHorizontal: 8 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 26, alignSelf: 'stretch' },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: borderRadius.button,
  },
  btnSecondary: { borderWidth: 1 },
  btnPrimary: {},
  btnText: { fontSize: 10 },
});
