import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MotionPressable } from '@/components/common/MotionPressable';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Alert,
  BackHandler,
  Pressable,
  Modal,
  Platform,
  TextInput,
  Vibration,
} from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSQLiteContext } from 'expo-sqlite';
import * as Haptics from 'expo-haptics';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  withSequence,
  withSpring,
  Easing,
} from 'react-native-reanimated';

import { useStore } from '@/store/useStore';
import { useLocaleFormatters } from '@/utils/format';
import { darkColors, lightColors, MONO_FONT, palette, spacing, borderRadius } from '@/config/theme';
import { Icon } from '@/components/common/Icon';
import { Kicker } from '@/components/common/Kicker';
import { Ornament } from '@/components/common/Ornament';
import { ScreenMount } from '@/components/common/ScreenMount';
import { SegmentedChip } from '@/components/common/SegmentedChip';
import { resolveLanguage } from '@/i18n';
import { useMilestoneCelebration } from '@/store/useMilestoneCelebration';
import {
  CUSTOM_MANTRA_SLUG,
  getJaapStats,
  insertJaapSession,
} from '@/services/jaapSessions';
import { recordSessionForSadhana } from '@/services/sadhanaRecorder';
import { rescheduleSadhanaReminder } from '@/services/sadhanaReminders';
import {
  getMantraBySlug,
  type ContentLang,
  type Mantra,
} from '@/services/content';

// 7 is a common short-jaap count (e.g. quick saptaha). 1008 is the maximum
// any classical text recommends. The list stays sorted ascending so the chip
// row reads naturally.
const MALA_SIZES = [7, 27, 54, 108, 216, 1008] as const;
type MalaSize = number;
const DEFAULT_MALA_SIZE: MalaSize = 108;
const CUSTOM_MIN = 1;
const CUSTOM_MAX = 100000;

// Ring shrunk to 180dp to free up vertical space for a more readable mantra
// block — the user is reading + tapping simultaneously, so the Devanagari
// body is the focal element, not the ring. 180dp still comfortably holds the
// 56pt count number with the kicker + "x of y" stacked inside.
const RING_SIZE = 180;
const RING_STROKE = 5;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ─── Resolved mantra (preset OR custom) ─────────────────────────────────────

interface ResolvedMantra {
  slug: string;
  /** Devanagari title for display. */
  titleHi: string;
  /** Latin transliteration / English title. */
  titleEn: string;
  /** Devanagari mantra body — single string with `\n` separators. */
  bodyDevanagari: string;
  /** IAST transliteration of the mantra body. */
  bodyIast?: string;
  /** Meaning, in the requested language. */
  meaning?: string;
  /** Saved label for the history list (matches `mantra_label` column). */
  label: string;
  /** "for {{deity}}" chip text, or "universal" / "custom". */
  chipLabel: string;
  recommendedCount: number;
}

function buildResolved(
  mantra: Mantra,
  lang: ContentLang,
  t: (k: string, opts?: Record<string, unknown>) => string,
): ResolvedMantra {
  const recommendedCount = mantra.recommendedCount ?? 108;
  const chipLabel = mantra.deity
    ? t('jaap.deityChip', { name: t(`deities.${mantra.deity}.displayName`) })
    : t('jaap.universalMantra');
  const label = lang === 'hi' ? mantra.titleHindi : mantra.titleEnglish;
  return {
    slug: mantra.slug,
    titleHi: mantra.titleHindi,
    titleEn: mantra.titleEnglish,
    bodyDevanagari: mantra.text.devanagari,
    bodyIast: mantra.text.iast,
    meaning: lang === 'hi' ? mantra.meaning.hi : mantra.meaning.en,
    label,
    chipLabel,
    recommendedCount,
  };
}

function buildCustom(text: string, t: (k: string) => string): ResolvedMantra {
  const trimmed = text.trim();
  return {
    slug: CUSTOM_MANTRA_SLUG,
    titleHi: t('jaap.customMantraTitle'),
    titleEn: t('jaap.customMantraTitle'),
    bodyDevanagari: trimmed,
    bodyIast: undefined,
    meaning: undefined,
    label: trimmed.length <= 64 ? trimmed : `${trimmed.slice(0, 60)}…`,
    chipLabel: t('jaap.customMantra'),
    recommendedCount: 108,
  };
}

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function JaapCounterScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ slug?: string; text?: string }>();
  const slug = (Array.isArray(params.slug) ? params.slug[0] : params.slug) ?? '';
  const customText = Array.isArray(params.text) ? params.text[0] : params.text;
  const isDarkMode = useStore(s => s.isDarkMode);
  const appLanguage = useStore(s => s.language);
  const colors = isDarkMode ? darkColors : lightColors;
  const lang: ContentLang = resolveLanguage(appLanguage);
  const db = useSQLiteContext();
  const unlockMilestone = useMilestoneCelebration(s => s.unlock);
  const sadhana = useStore(s => s.sadhana);
  const setSadhanaState = useStore(s => s.setSadhanaState);
  const sadhanaReminderEnabled = useStore(s => s.sadhanaReminderEnabled);
  const sadhanaReminderTime = useStore(s => s.sadhanaReminderTime);
  const quietHoursEnabled = useStore(s => s.quietHoursEnabled);
  const quietHoursStart = useStore(s => s.quietHoursStart);
  const quietHoursEnd = useStore(s => s.quietHoursEnd);

  const resolved = useMemo<ResolvedMantra | null>(() => {
    if (slug === CUSTOM_MANTRA_SLUG) {
      if (!customText || customText.trim().length === 0) return null;
      return buildCustom(customText, t);
    }
    const m = getMantraBySlug(slug);
    return m ? buildResolved(m, lang, t) : null;
  }, [slug, customText, lang, t]);
  const mantraDeity = useMemo(
    () => (slug === CUSTOM_MANTRA_SLUG ? undefined : getMantraBySlug(slug)?.deity),
    [slug],
  );

  // Adaptive type scale — Gayatri is 4 lines, Mahamrityunjaya is 2, most are
  // 1. The mantra is the focal element so short mantras get a generous size;
  // longer mantras (≥3 lines) trim down so the body still fits above the ring
  // on a Pixel 3a (~590dp body height) without scrolling. Sizes derived by
  // budgeting against the worst case (4-line Gayatri + IAST + title + rule
  // + chips + ring + bottom bar).
  const mantraSizing = useMemo(() => {
    const lineCount = resolved?.bodyDevanagari.split('\n').length ?? 1;
    if (lineCount >= 4) {
      return { body: 17, bodyLh: 26, iast: 11, iastLh: 16 };
    }
    if (lineCount === 3) {
      return { body: 19, bodyLh: 29, iast: 12, iastLh: 18 };
    }
    return { body: 22, bodyLh: 33, iast: 13, iastLh: 19 };
  }, [resolved?.bodyDevanagari]);

  const { digits } = useLocaleFormatters();

  // ── Counter state ──────────────────────────────────────────────────────
  const [count, setCount] = useState(0); // current within-mala count [0..malaSize-1]
  const [malaCount, setMalaCount] = useState(0); // completed malas
  const [malaSize, setMalaSize] = useState<MalaSize>(
    () => resolved?.recommendedCount ?? DEFAULT_MALA_SIZE,
  );
  const [customSizeModalVisible, setCustomSizeModalVisible] = useState(false);
  const [customSizeDraft, setCustomSizeDraft] = useState('');
  const startedAtRef = useRef<number>(Date.now());

  // Reset starts-at when mantra resolved (covers re-mount)
  useEffect(() => {
    startedAtRef.current = Date.now();
  }, [resolved?.slug]);

  const totalCount = malaCount * malaSize + count;
  const hasCounted = totalCount > 0;
  const progressFraction = count / malaSize;

  // ── Animation (UI-thread) ──────────────────────────────────────────────
  const scaleSV = useSharedValue(1);
  const ringProgressSV = useSharedValue(0);
  const completionSV = useSharedValue(0);

  useEffect(() => {
    ringProgressSV.value = withTiming(progressFraction, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [progressFraction, ringProgressSV]);

  // ── Tap handlers ───────────────────────────────────────────────────────
  // Rendering reads `count` + `malaCount`; the closures here use those values
  // via the deps below. React batches both setState calls on a tap, so the
  // re-render sees both updates together (one commit, one ring-progress
  // animation kick-off). Keeping side effects (haptics + animation) outside
  // the setter avoids the React 18 strict-mode double-invoke footgun.
  //
  // Haptic intensity: `impactAsync(Heavy)` — earlier `selectionAsync()` was
  // unmistakably too weak (user feedback), and Medium is borderline on
  // Android handsets with damped vibration motors. Heavy gives a clear,
  // unambiguous "registered" cue on every tap, which is what jaap needs:
  // the user is often eyes-closed or chanting and needs confirmation without
  // looking. If 108-rep wrist fatigue becomes a real complaint we can dial
  // back to Medium.
  const handleTap = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});

    scaleSV.value = withSequence(
      withTiming(0.96, { duration: 80, easing: Easing.out(Easing.quad) }),
      withSpring(1, { damping: 12, stiffness: 220, mass: 0.6 }),
    );

    const next = count + 1;
    if (next >= malaSize) {
      // Mala complete — extended boundary haptic so the milestone is
      // unmistakable (often the phone is face-down and the user is eyes-
      // closed). Roughly double the length of the per-tap Heavy and the
      // previous Success notification, at full motor amplitude.
      //
      // Android: `Vibration.vibrate(ms)` runs the motor at max amplitude for
      // the requested duration. 500ms is ~3× Success and reads as a clear,
      // strong buzz without crossing into "alarm" territory. (We can't bump
      // amplitude beyond max without VibrationEffect, which Expo doesn't
      // expose.)
      //
      // iOS: the taptic engine has no "long pulse" mode, so we chain Success
      // (3-tap pattern) with a follow-up Heavy impact ~220ms later. The
      // result is a noticeably extended, denser cue compared to Success
      // alone.
      if (Platform.OS === 'android') {
        Vibration.vibrate(500);
      } else {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setTimeout(() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
        }, 220);
      }
      completionSV.value = withSequence(
        withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 480, easing: Easing.in(Easing.cubic) }),
      );
      setMalaCount((mc) => mc + 1);
      setCount(0);
    } else {
      setCount(next);
    }
  }, [count, malaSize, scaleSV, completionSV]);

  const handleDecrement = useCallback(() => {
    if (count === 0 && malaCount === 0) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (count > 0) {
      setCount((prev) => prev - 1);
    } else {
      // Underflow into previous mala
      setMalaCount((mc) => Math.max(0, mc - 1));
      setCount(malaSize - 1);
    }
  }, [count, malaCount, malaSize]);

  const handleReset = useCallback(() => {
    if (!hasCounted) return;
    Alert.alert(
      t('jaap.discardConfirm'),
      t('jaap.discardConfirmDesc', { count: totalCount }),
      [
        { text: t('jaap.discardNo'), style: 'cancel' },
        {
          text: t('jaap.discardYes'),
          style: 'destructive',
          onPress: () => {
            setCount(0);
            setMalaCount(0);
            startedAtRef.current = Date.now();
          },
        },
      ],
    );
  }, [hasCounted, totalCount, t]);

  // ── Save / exit flow ───────────────────────────────────────────────────
  // Persist the session AND advance the sadhana streak / scan milestones in
  // one call. We deliberately keep the SQLite write and the orchestrator
  // synchronous so that:
  //   - the celebration overlay opens before `router.back()` resolves,
  //     which puts it cleanly on top of the picker
  //   - the at-risk reminder cancellation runs from a known-true state
  //     (today is now a qualifying day) rather than racing on next focus.
  const persistSession = useCallback(() => {
    if (!resolved || !hasCounted) return;
    const nowMs = Date.now();
    insertJaapSession(db, {
      startedAt: startedAtRef.current,
      endedAt: nowMs,
      mantraSlug: resolved.slug,
      mantraLabel: resolved.label,
      malaSize,
      malaCount,
      totalCount,
    });

    // Re-read lifetime totals AFTER the insert — milestone scan needs the
    // post-write counts to detect crossings.
    const statsAfter = getJaapStats(db);
    const { nextState, celebration } = recordSessionForSadhana({
      db,
      prevState: sadhana,
      statsAfter,
      nowMs,
      deityId: mantraDeity,
    });
    if (nextState !== sadhana) setSadhanaState(nextState);
    if (celebration) unlockMilestone(celebration);

    // The user practised today — kill today's at-risk reminder and roll the
    // 14-day horizon forward so tomorrow's still fires (if enabled).
    if (sadhanaReminderEnabled) {
      void rescheduleSadhanaReminder({
        enabled: true,
        timeHHmm: sadhanaReminderTime,
        sadhana: nextState,
        quietHours: quietHoursEnabled
          ? { enabled: true, startHHmm: quietHoursStart, endHHmm: quietHoursEnd }
          : undefined,
      });
    }
  }, [
    db, resolved, hasCounted, malaSize, malaCount, totalCount,
    sadhana, setSadhanaState, unlockMilestone, mantraDeity,
    sadhanaReminderEnabled, sadhanaReminderTime,
    quietHoursEnabled, quietHoursStart, quietHoursEnd,
  ]);

  const handleSaveExit = useCallback(() => {
    persistSession();
    router.back();
  }, [persistSession]);

  const confirmAndExit = useCallback(() => {
    if (!hasCounted) {
      router.back();
      return;
    }
    Alert.alert(
      t('jaap.saveBeforeExit'),
      t('jaap.saveBeforeExitDesc', { count: totalCount }),
      [
        {
          text: t('jaap.saveNo'),
          style: 'destructive',
          onPress: () => router.back(),
        },
        {
          text: t('jaap.saveYes'),
          onPress: handleSaveExit,
        },
      ],
    );
  }, [hasCounted, totalCount, handleSaveExit, t]);

  // Hardware back on Android — same prompt as the nav-back button.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      confirmAndExit();
      return true;
    });
    return () => sub.remove();
  }, [confirmAndExit]);

  // ── Animated styles ────────────────────────────────────────────────────
  const tapScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleSV.value }],
  }));
  const completionFlashStyle = useAnimatedStyle(() => ({
    opacity: completionSV.value,
    transform: [{ scale: 1 + completionSV.value * 0.08 }],
  }));
  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_CIRCUMFERENCE * (1 - ringProgressSV.value),
  }));

  if (!resolved) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
        <View style={styles.notFoundWrap}>
          <Text variant="body-italic" style={[styles.notFoundText, { color: colors.textMuted }]}>
            {t('jaap.title')}
          </Text>
          <MotionPressable
            onPress={() => router.back()}
            style={[styles.notFoundBtn, { borderColor: colors.accent }]}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.back')}>
            <Text variant="mono-caps" style={[styles.notFoundBtnText, { color: colors.accent }]}>
              {t('common.back')}
            </Text>
          </MotionPressable>
        </View>
      </SafeAreaView>
    );
  }

  const ringTrackColor = isDarkMode ? 'rgba(243,229,200,0.10)' : 'rgba(27,20,10,0.12)';
  const ringFillColor = colors.accent;

  // Preserve the user's progress across size changes — the user has been
  // chanting; the *total* repetitions are what matters spiritually, the
  // mala/count split is just how we present it. Recompute the split from
  // totalCount so the running session continues uninterrupted.
  function handleMalaSizeChange(size: number) {
    if (size === malaSize) return;
    const total = totalCount;
    setMalaSize(size);
    setMalaCount(Math.floor(total / size));
    setCount(total % size);
  }

  function openCustomSizeModal() {
    setCustomSizeDraft(String(malaSize));
    setCustomSizeModalVisible(true);
  }

  function handleCustomSizeSubmit() {
    const parsed = parseInt(customSizeDraft, 10);
    if (!Number.isFinite(parsed) || parsed < CUSTOM_MIN || parsed > CUSTOM_MAX) {
      // Soft fail — keep the modal open so the user can correct.
      return;
    }
    handleMalaSizeChange(parsed);
    setCustomSizeModalVisible(false);
  }

  // Custom chip is "active" whenever the current size is not in the standard
  // preset list. In that case it shows the active value; otherwise it shows a
  // "+" affordance.
  const isCustomSize = !MALA_SIZES.includes(malaSize as typeof MALA_SIZES[number]);

  // The whole region below the header is the tap target. Children that need to
  // own their own taps (mala-size chips, decrement / reset buttons) are
  // touch-capturing components — React Native lets the innermost responder
  // win, so the parent Pressable's onPress only fires on "void" surfaces
  // (mantra text, ring, count, summary, parchment between elements). This is
  // the redesign's whole point: the user's eyes can stay on the mantra while
  // they tap anywhere that isn't a control.
  return (
    <ScreenMount>
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
        {/* ── Header (outside the tap zone) ───────────────────────────────── */}
        <View style={[styles.navRow, { borderBottomColor: colors.divider }]}>
          <MotionPressable
            onPress={confirmAndExit}
            style={[styles.navPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.back')}>
            <Icon name="chevron-left" size={18} color={colors.textSecondary} />
          </MotionPressable>
          <Text variant="body-italic" style={[styles.navTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {resolved.label}
          </Text>
          <MotionPressable
            onPress={handleSaveExit}
            disabled={!hasCounted}
            style={[
              styles.navPill,
              {
                backgroundColor: colors.surface,
                borderColor: hasCounted ? colors.accent : colors.border,
                opacity: hasCounted ? 1 : 0.5,
              },
            ]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('jaap.saveSession')}>
            <Icon name="check" size={16} color={hasCounted ? colors.accent : colors.textSecondary} />
          </MotionPressable>
        </View>

        {/* ── Whole-screen tap zone ───────────────────────────────────────── */}
        <Pressable
          style={styles.tapZone}
          onPress={handleTap}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.tapToCount')}>

          {/* ── Mantra reading area (always visible) ──────────────────────── */}
          <View style={[styles.mantraSection, { paddingHorizontal: spacing.screenH }]}>
            <Kicker color={colors.accent} size={10} style={styles.mantraEyebrow}>
              {resolved.chipLabel}
            </Kicker>
            <Text variant="deva-bold" style={[styles.mantraTitle, { color: colors.textPrimary }]} numberOfLines={1}>
              {resolved.titleHi}
            </Text>
            <Ornament variant="double-rule" style={styles.mantraRule} />
            <Text
              variant="deva"
              style={[
                styles.mantraBody,
                { color: colors.textPrimary, fontSize: mantraSizing.body, lineHeight: mantraSizing.bodyLh },
              ]}>
              {resolved.bodyDevanagari}
            </Text>
            {resolved.bodyIast && (
              <Text
                variant="body-italic"
                style={[
                  styles.mantraIast,
                  { color: colors.textTertiary, fontSize: mantraSizing.iast, lineHeight: mantraSizing.iastLh },
                ]}>
                {resolved.bodyIast}
              </Text>
            )}
            <Text variant="body-italic" style={[styles.mantraVerifyNote, { color: colors.textMuted }]}>
              {t('reader.verifyNote')}
            </Text>
          </View>

          {/* ── Mala size chips ───────────────────────────────────────────── */}
          <View style={styles.malaSizeRow}>
            {MALA_SIZES.map((size) => (
              <SegmentedChip
                key={size}
                active={size === malaSize}
                onPress={() => handleMalaSizeChange(size)}
                inactiveBg={colors.surface}
                activeBg={palette.ink}
                inactiveBorder={colors.border}
                activeBorder={palette.ink}
                style={styles.malaSizeChip}
                accessibilityLabel={t('jaap.malaSize', { count: size })}>
                <Text
                  variant="mono"
                  style={[
                    styles.malaSizeChipText,
                    { color: size === malaSize ? palette.parchmentBright : colors.textSecondary },
                  ]}>
                  {size}
                </Text>
              </SegmentedChip>
            ))}
            <SegmentedChip
              active={isCustomSize}
              onPress={openCustomSizeModal}
              inactiveBg={colors.surface}
              activeBg={palette.ink}
              inactiveBorder={colors.border}
              activeBorder={palette.ink}
              style={styles.malaSizeChip}
              accessibilityLabel={t('jaap.customMalaSize')}>
              <Text
                variant="mono"
                style={[
                  styles.malaSizeChipText,
                  { color: isCustomSize ? palette.parchmentBright : colors.textSecondary },
                ]}>
                {isCustomSize ? malaSize : '+'}
              </Text>
            </SegmentedChip>
          </View>

          {/* ── Counter centerpiece ───────────────────────────────────────── */}
          <View style={styles.counterCenterpiece}>
            <Animated.View style={[styles.ringWrap, tapScaleStyle]}>
              <Svg width={RING_SIZE} height={RING_SIZE}>
                <Circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_RADIUS}
                  stroke={ringTrackColor}
                  strokeWidth={RING_STROKE}
                  fill="none"
                />
                <AnimatedCircle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_RADIUS}
                  stroke={ringFillColor}
                  strokeWidth={RING_STROKE}
                  fill="none"
                  strokeDasharray={RING_CIRCUMFERENCE}
                  strokeLinecap="round"
                  rotation={-90}
                  origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
                  animatedProps={ringProps}
                />
              </Svg>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.completionFlash,
                  {
                    backgroundColor: colors.accent + '22',
                    borderColor: colors.accent,
                  },
                  completionFlashStyle,
                ]}
              />
              <View style={styles.counterCenter} pointerEvents="none">
                <Text variant="mono-caps" style={[styles.counterKicker, { color: colors.textTertiary }]}>
                  {t('jaap.countLabel')}
                </Text>
                <Text style={[styles.counterValue, { color: colors.textPrimary }]}>
                  {digits(String(count))}
                </Text>
                <Text variant="body-italic" style={[styles.counterTotal, { color: colors.textTertiary }]}>
                  {t('jaap.progressOf', { current: count, total: malaSize })}
                </Text>
              </View>
            </Animated.View>
          </View>

          {/* ── Bottom bar: summary + actions ─────────────────────────────── */}
          <View style={[styles.bottomBar, { paddingHorizontal: spacing.screenH }]}>
            <View style={styles.summaryInline}>
              <Text variant="mono-caps" style={[styles.summaryInlineKicker, { color: colors.accent }]}>
                {t('jaap.malaLabel', { count: malaCount })}
              </Text>
              <Text style={[styles.summaryInlineValue, { color: colors.textPrimary }]}>
                {digits(String(malaCount))}
              </Text>
              <View style={[styles.summaryInlineDivider, { backgroundColor: colors.divider }]} />
              <Text variant="mono-caps" style={[styles.summaryInlineKicker, { color: colors.accent }]}>
                {t('jaap.countLabel')}
              </Text>
              <Text style={[styles.summaryInlineValue, { color: colors.textPrimary }]}>
                {digits(String(totalCount))}
              </Text>
            </View>
            <View style={styles.actionRow}>
              <MotionPressable
                onPress={handleDecrement}
                disabled={!hasCounted}
                style={[
                  styles.actionBtn,
                  { borderColor: colors.border, opacity: hasCounted ? 1 : 0.4 },
                ]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={t('a11y.decrement')}>
                <Text variant="mono-caps" style={[styles.actionBtnText, { color: colors.textSecondary }]}>
                  {t('jaap.decrement')}
                </Text>
              </MotionPressable>
              <MotionPressable
                onPress={handleReset}
                disabled={!hasCounted}
                style={[
                  styles.actionBtn,
                  { borderColor: colors.border, opacity: hasCounted ? 1 : 0.4 },
                ]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={t('a11y.resetCount')}>
                <Text variant="mono-caps" style={[styles.actionBtnText, { color: colors.textSecondary }]}>
                  {t('jaap.reset')}
                </Text>
              </MotionPressable>
            </View>
          </View>
        </Pressable>

        {/* ── Custom mala size modal ─────────────────────────────────────── */}
        <Modal
          visible={customSizeModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setCustomSizeModalVisible(false)}>
          <TouchableOpacity
            style={styles.customSizeOverlay}
            activeOpacity={1}
            onPress={() => setCustomSizeModalVisible(false)}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.close')}>
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
              accessible={false}
              style={[
                styles.customSizeSheet,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}>
              <Text variant="display-italic" style={[styles.customSizeTitle, { color: colors.textPrimary }]}>
                {t('jaap.customMalaSizeTitle')}
              </Text>
              <Text variant="body-italic" style={[styles.customSizeDesc, { color: colors.textTertiary }]}>
                {t('jaap.customMalaSizeDesc')}
              </Text>
              <TextInput
                value={customSizeDraft}
                onChangeText={(v) => setCustomSizeDraft(v.replace(/[^0-9]/g, ''))}
                placeholder="108"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                returnKeyType="done"
                onSubmitEditing={handleCustomSizeSubmit}
                maxLength={6}
                autoFocus
                style={[
                  styles.customSizeInput,
                  { color: colors.textPrimary, borderColor: colors.border },
                ]}
              />
              <View style={styles.customSizeActions}>
                <MotionPressable
                  onPress={() => setCustomSizeModalVisible(false)}
                  style={[styles.customSizeBtn, { borderColor: colors.border }]}
                  accessibilityRole="button">
                  <Text variant="mono-caps" style={[styles.customSizeBtnText, { color: colors.textSecondary }]}>
                    {t('common.cancel')}
                  </Text>
                </MotionPressable>
                <MotionPressable
                  onPress={handleCustomSizeSubmit}
                  disabled={!isValidCustomDraft(customSizeDraft)}
                  style={[
                    styles.customSizeBtn,
                    {
                      borderColor: isValidCustomDraft(customSizeDraft) ? colors.accent : colors.border,
                      opacity: isValidCustomDraft(customSizeDraft) ? 1 : 0.5,
                    },
                  ]}
                  accessibilityRole="button">
                  <Text variant="mono-caps" style={[styles.customSizeBtnText, { color: colors.accent }]}>
                    {t('common.done')}
                  </Text>
                </MotionPressable>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </SafeAreaView>
    </ScreenMount>
  );
}

function isValidCustomDraft(draft: string): boolean {
  const n = parseInt(draft, 10);
  return Number.isFinite(n) && n >= CUSTOM_MIN && n <= CUSTOM_MAX;
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.screenH,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navTitle: { flex: 1, textAlign: 'center', marginHorizontal: 12, fontSize: 15 },

  // Whole-screen tap zone — flex column with mantra at top, counter centered
  // (flex:1 absorbs the slack), bottom bar at the bottom. No ScrollView so the
  // mantra never leaves the viewport during a session.
  tapZone: {
    flex: 1,
    paddingTop: 14,
    paddingBottom: 12,
  },

  // Mantra block — the focal area. Sizes tuned so a four-line mantra
  // (Gayatri) plus IAST still leaves room for a 180dp ring on a Pixel 3a
  // (~590dp body height). Most mantras are 1–2 lines and will get a much
  // taller ring zone.
  mantraSection: {
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 16,
  },
  mantraEyebrow: {
    letterSpacing: 3.6,
    textAlign: 'center',
    marginBottom: 8,
  },
  mantraTitle: {
    fontSize: 20,
    lineHeight: 28,
    textAlign: 'center',
  },
  mantraRule: {
    width: '38%',
    marginTop: 10,
    marginBottom: 14,
  },
  mantraBody: {
    // fontSize + lineHeight are overridden inline by the adaptive
    // `mantraSizing` calc — base values here are fallbacks if the inline
    // override is ever removed, picked to match the short-mantra branch.
    fontSize: 22,
    lineHeight: 33,
    textAlign: 'center',
  },
  mantraIast: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 10,
  },
  mantraVerifyNote: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 14,
  },

  // Mala chips — slim row directly under the mantra.
  malaSizeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: spacing.screenH,
    marginBottom: 10,
  },
  malaSizeChip: {
    minWidth: 48,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  malaSizeChipText: { fontSize: 11, letterSpacing: 0.5 },

  // Counter centerpiece — flex:1 fills remaining vertical space so it stays
  // centered between mantra and bottom bar regardless of phone height. On
  // small phones with a long mantra above, this region can compress; overflow
  // hidden clips the ring at the edges before it shoves the bottom bar off.
  counterCenterpiece: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completionFlash: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 2,
  },
  counterCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterKicker: { fontSize: 9.5, marginBottom: 4 },
  counterValue: {
    fontFamily: MONO_FONT,
    fontWeight: '500',
    fontSize: 56,
    lineHeight: 60,
    letterSpacing: -1,
  },
  counterTotal: { fontSize: 12, marginTop: 4 },

  // Bottom bar — summary + decrement/reset, fixed at the bottom of the tap
  // zone. Background-less so the parchment continues; just a subtle hairline
  // top to separate from the counter.
  bottomBar: {
    paddingTop: 12,
  },
  summaryInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  summaryInlineKicker: { fontSize: 9.5 },
  summaryInlineValue: {
    fontFamily: MONO_FONT,
    fontWeight: '500',
    fontSize: 18,
    letterSpacing: 0.3,
  },
  summaryInlineDivider: {
    width: StyleSheet.hairlineWidth,
    height: 18,
    marginHorizontal: 8,
  },

  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
    justifyContent: 'center',
  },
  actionBtn: {
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: borderRadius.button,
    borderWidth: 1,
  },
  actionBtnText: { fontSize: 10 },

  notFoundWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, paddingHorizontal: 40 },
  notFoundText: { fontSize: 15, textAlign: 'center' },
  notFoundBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5 },
  notFoundBtnText: { fontSize: 10 },

  customSizeOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(20,10,4,0.55)',
    paddingHorizontal: 28,
  },
  customSizeSheet: {
    width: '100%',
    maxWidth: 360,
    borderRadius: borderRadius.card,
    borderWidth: 1,
    paddingVertical: 22,
    paddingHorizontal: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 10,
  },
  customSizeTitle: { fontSize: 22, lineHeight: 28, textAlign: 'center', marginBottom: 4 },
  customSizeDesc: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: 14 },
  customSizeInput: {
    fontFamily: MONO_FONT,
    fontSize: 22,
    letterSpacing: 0.6,
    textAlign: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.cardInner,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  customSizeActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  customSizeBtn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: borderRadius.button,
    borderWidth: 1.5,
  },
  customSizeBtnText: { fontSize: 10 },
});
