import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import {
  AppState,
  type AppStateStatus,
  View,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useIsFocused } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient as SvgRadialGradient, Rect, Stop } from 'react-native-svg';
import { Icon, type IconName } from '@/components/common/Icon';
import { MotionPressable } from '@/components/common/MotionPressable';

import { useTranslation } from 'react-i18next';

import { useStore, type IntentKey } from '@/store/useStore';
import {
  darkColors,
  lightColors,
  spacing,
  borderRadius,
  palette,
} from '@/config/theme';
import {
  deriveJanmaIndicesFromStore,
  fetchPanchangForToday,
  FALLBACK_COORDS,
  panchangTimezoneMinutes,
} from '@/services/astrology/panchangService';
import { timezoneLabel } from '@/utils/timezoneLabel';
import { resolveLanguage } from '@/i18n';
import { ScreenMount } from '@/components/common/ScreenMount';
import { HomePanchangSkeleton, SkeletonCrossfade } from '@/components/common/SkeletonLoader';
import { AdBanner } from '@/components/common/AdBanner';
import { WalkthroughSpotlight, type SpotlightRect } from '@/components/common/WalkthroughOverlay';
import { buildDayVerdict, VERDICT_REVIEW_PENDING } from '@/utils/dayVerdict';
import { getVaarDevataForDate, vaarDeityNames } from '@/config/vaarDevata';
import type { IPanchangDay, IPanchangElement } from '@/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DEVA_RE = /[ऀ-ॿ]/;

function getActiveElement(elements: IPanchangElement[]): IPanchangElement | undefined {
  if (!elements.length) return undefined;
  return elements[0];
}

/**
 * Parse one of the service's "2:07 PM" strings into the instant it names (epoch
 * ms). The string is a wall clock in the PLACE's zone — `offsetMinutes` east of
 * UTC, what the service rendered it in — on `day`'s civil date, the date the
 * panchang was fetched for. Reading it as a device-local clock (`setHours`) was
 * right only while phone and place shared an offset: a phone in New York on the
 * Ujjain default counted down to a Rahu Kaal 9½ hours off. For a GPS fix the
 * offset IS the device's, so that case reads exactly as it always did.
 */
function parseClockAtPlace(clock: string | undefined, day: Date, offsetMinutes: number): number | null {
  if (!clock) return null;
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(clock.trim());
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const mer = m[3]?.toUpperCase();
  if (mer === 'PM' && h < 12) h += 12;
  if (mer === 'AM' && h === 12) h = 0;
  return Date.UTC(day.getFullYear(), day.getMonth(), day.getDate(), h, min) - offsetMinutes * 60_000;
}

/** "2h 14m" / "43m" — the countdown grain used by the Rahu Kaal strip. */
function formatSpan(ms: number): string {
  const totalMin = Math.max(1, Math.round(ms / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const isDarkMode = useStore(s => s.isDarkMode);
  const userLocation = useStore(s => s.userLocation);
  const locationName = useStore(s => s.locationName);
  const language = useStore(s => s.language);
  const region = useStore(s => s.region);
  const ayanamsa = useStore(s => s.ayanamsa);
  const masaSystem = useStore(s => s.masaSystem);
  const userBirthDate = useStore(s => s.userBirthDate);
  const userBirthTime = useStore(s => s.userBirthTime);
  const userBirthPlace = useStore(s => s.userBirthPlace);
  const walkthroughStep = useStore(s => s.walkthroughStep);
  const setWalkthroughStep = useStore(s => s.setWalkthroughStep);
  const primaryIntent = useStore(s => s.primaryIntent);
  const colors = isDarkMode ? darkColors : lightColors;
  const { t, i18n } = useTranslation();
  const lang: 'en' | 'hi' = i18n.language === 'hi' ? 'hi' : 'en';

  // NativeTabs has no lazy/freeze gate (see `app/(tabs)/_layout.tsx`), so all
  // four tab screens mount on cold start. Home is the initial route and so is
  // normally focused on its very first render — `useIsFocused` reads the live
  // state synchronously, so the latch is already true and the fetch below
  // starts in the same effect pass it always did. It only bites when Home is
  // NOT the entry (a notification deep-link lands on another route), where the
  // panchang fetch would otherwise run behind whatever the user actually
  // opened. One-way: once focused it stays armed for the session.
  const isFocused = useIsFocused();
  const [hasBeenFocused, setHasBeenFocused] = useState(isFocused);
  if (isFocused && !hasBeenFocused) setHasBeenFocused(true);

  const [panchang, setPanchang] = useState<IPanchangDay | null>(null);
  const [panchangLoading, setPanchangLoading] = useState(true);
  // Minute tick drives the Rahu Kaal countdown. The value itself never
  // animates — it is replaced (MOTION.md: reported times appear, not move).
  const [nowMs, setNowMs] = useState(() => Date.now());

  // ── Panchang — fetch + mid-day refresh ────────────────────────────────────
  const lastFetchRef = useRef(0);
  const panchangLang = resolveLanguage(language);
  // Everything the fetch reads, as one identity. `runFetch` closes over it and
  // the skeleton adjustment below keys on the same object, so "the inputs
  // changed" means exactly the same thing in both places.
  const fetchInputs = useMemo(
    () => ({ userLocation, panchangLang, region, ayanamsa, userBirthDate, userBirthTime, userBirthPlace }),
    [userLocation, panchangLang, region, ayanamsa, userBirthDate, userBirthTime, userBirthPlace],
  );
  // The fetch itself. Its only state writes are in the promise callbacks, so
  // an effect body can call it without a synchronous setState.
  const runFetch = useCallback(() => {
    lastFetchRef.current = Date.now();
    const { janmaNakshatra, janmaRashi } = deriveJanmaIndicesFromStore({
      userBirthDate: fetchInputs.userBirthDate,
      userBirthTime: fetchInputs.userBirthTime,
      userBirthPlace: fetchInputs.userBirthPlace,
    });
    // No stored place means FALLBACK_COORDS, said explicitly. Handing the
    // service `null` sent it to `getCoords()`, which takes a live GPS fix
    // whenever permission happens to be granted — so Home could print a sunrise
    // for wherever the phone was, on the phone's clock, under a header that
    // says "Ujjain", while the Panchang tab, the widget and the sunrise alert
    // all computed Ujjain on IST. It also left the zone of these times
    // unknowable here, and the zone tag beside sunrise below has to name it.
    fetchPanchangForToday(
      fetchInputs.userLocation ?? FALLBACK_COORDS, fetchInputs.panchangLang, fetchInputs.region, fetchInputs.ayanamsa,
      janmaNakshatra, janmaRashi,
    )
      .then(p => { if (p) setPanchang(p); })
      .finally(() => setPanchangLoading(false));
  }, [fetchInputs]);
  const refreshPanchang = useCallback((showSpinner = false) => {
    if (!showSpinner && Date.now() - lastFetchRef.current < 3_600_000) return;
    if (showSpinner) setPanchangLoading(true);
    runFetch();
  }, [runFetch]);

  // First fetch, and a refetch whenever an input changes. The skeleton for
  // that refetch is raised during render (React's "adjusting state when a
  // prop changes"), keyed on `fetchInputs` and guarded by its previous value,
  // so it lands in the commit that carries the new inputs instead of a second
  // commit cascaded out of the effect. The key is `null` until the tab has
  // been focused: input changes before then neither fetch (the effect's early
  // return) nor spin. On mount key and previous key are equal, so cold start
  // pays nothing here — the initial `panchangLoading` is already true.
  const fetchKey = hasBeenFocused ? fetchInputs : null;
  const [prevFetchKey, setPrevFetchKey] = useState(fetchKey);
  if (fetchKey !== prevFetchKey) {
    setPrevFetchKey(fetchKey);
    if (fetchKey) setPanchangLoading(true);
  }
  useEffect(() => {
    if (!hasBeenFocused) return;
    runFetch();
  }, [runFetch, hasBeenFocused]);
  useFocusEffect(useCallback(() => { refreshPanchang(); }, [refreshPanchang]));
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') { refreshPanchang(); setNowMs(Date.now()); }
    });
    return () => sub.remove();
  }, [refreshPanchang]);
  // Keyed on focus, not mounted forever: tabs never unmount here, so an unkeyed
  // interval kept re-rendering Home from behind whatever tab the user was
  // actually on — for the rest of the session, long after the Rahu Kaal strip
  // had gone null for the day. The tick only feeds visible chrome (that
  // countdown and the midnight header rollover), so it has no reason to run
  // while the screen is not on screen.
  //
  // The leading edge on re-arm is load-bearing, not tidiness: without it a
  // return to Home after midnight paints yesterday's date until the first tick
  // lands, up to 30s later. It rides a zero-delay timer rather than running in
  // the effect body so it stays out of the synchronous render cascade, and it
  // is guarded on staleness so that arming at mount — where `nowMs` is
  // milliseconds old — bails out instead of costing cold start a second render
  // of the whole screen.
  useEffect(() => {
    if (!isFocused) return;
    const lead = setTimeout(
      () => setNowMs(prev => (Date.now() - prev >= 30_000 ? Date.now() : prev)),
      0,
    );
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => { clearTimeout(lead); clearInterval(id); };
  }, [isFocused]);

  // ── Header date ───────────────────────────────────────────────────────────
  // `nowMs` collapsed to the local midnight that opens its civil day. Everything
  // below keys off *that*, so the day-granular work doesn't re-run on every 30s
  // countdown tick while the header still rolls over at midnight. (Memoising on
  // `[lang]` alone froze it at mount: after an overnight resume the largest text
  // on the launch screen named yesterday while the panchang hero and the day's
  // deity card below it had already advanced.)
  const dayStartMs = new Date(nowMs).setHours(0, 0, 0, 0);
  const dateParts = useMemo(() => {
    const locale = lang === 'hi' ? 'hi-IN' : 'en-IN';
    // Midnight formats to the same weekday/day/month as any other moment in
    // its day, so this reads `dayStartMs` alone — no stale-closure suppression.
    const day = new Date(dayStartMs);
    return {
      weekday: day.toLocaleDateString(locale, { weekday: 'long' }),
      dayMonth: day.toLocaleDateString(locale, { day: 'numeric', month: 'long' }),
    };
  }, [lang, dayStartMs]);

  // The rest of the card follows the wall clock, so the day it describes has to
  // follow it too: `refreshPanchang` is throttled to an hour, which would
  // otherwise leave yesterday's tithi and Rahu Kaal under today's heading.
  const lastDayStartRef = useRef(dayStartMs);
  useEffect(() => {
    if (lastDayStartRef.current === dayStartMs) return;
    lastDayStartRef.current = dayStartMs;
    // Bust the one-hour throttle — a day change is exactly the case it must
    // not suppress.
    lastFetchRef.current = 0;
    refreshPanchang(false);
  }, [dayStartMs, refreshPanchang]);

  // ── Zone tag beside sunrise (A14) ─────────────────────────────────────────
  // The zone the fetch above renders in: a stored place's own (none for a GPS
  // fix, which is the phone's clock), else FALLBACK_COORDS' IST. Printed for
  // the fallback always, and for a chosen place whose offset is not the
  // phone's; null otherwise (see `timezoneLabel`).
  const zoneLabel = useMemo(
    () => timezoneLabel(userLocation, FALLBACK_COORDS, new Date(dayStartMs)),
    [userLocation, dayStartMs],
  );

  // ── Rahu Kaal countdown ───────────────────────────────────────────────────
  // The window's strings are wall clocks in the zone the panchang was rendered
  // in, on the day it was fetched for, so they are turned into instants with
  // that zone's offset — the service's own resolution for the same coords and
  // day — before being compared with the phone's clock. Memoised apart from
  // the countdown so the offset (an Intl round-trip for a non-IST place) is
  // resolved once per fetch, not on every 30s tick.
  const rahuWindow = useMemo(() => {
    if (!panchang) return null;
    const offset = panchangTimezoneMinutes(userLocation ?? FALLBACK_COORDS, panchang.date);
    const start = parseClockAtPlace(panchang.rahuKalamStart, panchang.date, offset);
    const end = parseClockAtPlace(panchang.rahuKalamEnd, panchang.date, offset);
    if (start === null || end === null) return null;
    return { start, end };
  }, [panchang, userLocation]);
  const rahu = useMemo(() => {
    if (!rahuWindow) return null;
    if (nowMs < rahuWindow.start) {
      return { text: t('home.rahuBeginsIn', { time: formatSpan(rahuWindow.start - nowMs) }) };
    }
    if (nowMs < rahuWindow.end) {
      return { text: t('home.rahuEndsIn', { time: formatSpan(rahuWindow.end - nowMs) }) };
    }
    return null; // over for today — the strip earns its place only while live
  }, [rahuWindow, nowMs, t]);

  // Plain verdict — shared with the Panchang tab (P16.3).
  const verdict = useMemo(
    () => buildDayVerdict(panchang, !!panchang?.eclipse, t),
    [panchang, t],
  );

  // ── Day's deity (vaar devata) ─────────────────────────────────────────────
  // Keyed on `dayStartMs`, not a bare `new Date()`: only the weekday is read,
  // so midnight gives the same deity as any other moment of its day — and it
  // gives the compiler a reactive input, where a clock read in render is
  // cached at mount and the card would stop rolling over at midnight.
  const vaar = getVaarDevataForDate(new Date(dayStartMs));
  const deityNames = vaarDeityNames(vaar, lang);

  // ── Quick actions — intent decides which tile leads (P16.6 + Diya 01).
  // Built inline each render: four tiny objects, cheaper than memo bookkeeping.
  const abhijit = panchang?.abhijitMuhurtaStart;
  const jaapTile = {
    key: 'jaap', icon: 'flower' as IconName,
    title: t('home.quickJaap'), caption: t('home.quickJaapCaption'),
    go: () => router.push('/jaap'),
  };
  const muhuratTile = {
    key: 'muhurat', icon: 'clock' as IconName,
    title: t('home.quickMuhurat'),
    caption: abhijit ? t('home.abhijitAt', { time: abhijit }) : t('home.quickMuhuratCaption'),
    go: () => router.push('/muhurat'),
  };
  const aartiTile = {
    key: 'aarti', icon: 'flame' as IconName,
    title: t('home.quickAarti'), caption: deityNames.split(/[,·]/)[0].trim(),
    go: () => router.push('/aarti'),
  };
  const kundliTile = {
    key: 'kundli', icon: 'compass' as IconName,
    title: t('home.quickKundli'), caption: t('home.quickKundliCaption'),
    go: () => router.push('/(tabs)/astrology'),
  };
  const primaryKey: IntentKey = primaryIntent[0] ?? 'worship';
  const quickActions =
    primaryKey === 'kundli' ? [kundliTile, jaapTile, muhuratTile]
    : primaryKey === 'panchang' ? [muhuratTile, jaapTile, aartiTile]
    : [jaapTile, muhuratTile, aartiTile];

  const locationLabel = locationName ?? (userLocation ? t('common.gpsLabel') : t('common.locationDefault'));

  // ── Walkthrough — Step 1 spotlights the Panchang hero ─────────────────────
  const panchangCardRef = useRef<View>(null);
  const [panchangRect, setPanchangRect] = useState<SpotlightRect | null>(null);
  const measurePanchang = useCallback(() => {
    panchangCardRef.current?.measureInWindow((x, y, width, height) => {
      if (width > 0) setPanchangRect({ x, y, width, height });
    });
  }, []);
  useFocusEffect(
    useCallback(() => {
      if (walkthroughStep === 1) {
        const timer = setTimeout(measurePanchang, 300);
        return () => clearTimeout(timer);
      }
    }, [walkthroughStep, measurePanchang]),
  );
  const skipWalkthrough = useCallback(() => setWalkthroughStep(0), [setWalkthroughStep]);

  const tithi = panchang ? getActiveElement(panchang.tithis) : undefined;
  // The lunar month in the user's own reckoning — the same string the Panchang
  // tab's Chandra Masa row prints, read the same way, so the two screens cannot
  // disagree. Neither of the other two fields can stand in here: `masa` is the
  // SOLAR month (the rashi the Sun occupies), and `hinduMonth` is always the
  // purnimanta name regardless of the setting — on 2026-09-03 that is
  // Bhadrapada where an Amanta user is owed Shravana. The line is unlabelled
  // and sits directly under a paksha-prefixed tithi, so it reads as *the*
  // Hindu month.
  const masaLine = masaSystem === 'purnimanta'
    ? panchang?.hinduMonthPurnimanta
    : panchang?.hinduMonthAmanta;

  return (
    <ScreenMount>
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top']}>
      {/* One warm light in a dark room — a faint turmeric wash from the top.
          Bounded to the top 42% rather than absoluteFill: on Android every
          <Svg> root is drawn into a retained ARGB_8888 bitmap the size of the
          view (9.2 MiB full-screen on a 1080×2220 panel, never recycled because
          the tab never unmounts) and software-filled pixel by pixel. The glow
          only ever reached y = 42% — the ellipse's own vertical radius — so the
          rest of that bitmap was fully transparent. Shrinking the box and
          taking `ry` to 100% of it leaves the identical ellipse: `ry` is in
          objectBoundingBox units, so 100% × 42%H is the same 42%H it was. */}
      {isDarkMode && (
        <Svg style={styles.wash} pointerEvents="none">
          <Defs>
            <SvgRadialGradient id="heroGlow" cx="50%" cy="0%" rx="80%" ry="100%">
              <Stop offset="0" stopColor={palette.turmeric} stopOpacity={0.14} />
              <Stop offset="1" stopColor={palette.turmeric} stopOpacity={0} />
            </SvgRadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#heroGlow)" />
        </Svg>
      )}

      <ScrollView
        // iOS: react-native-screens only applies the tab-bar content inset to the
        // first ScrollView in the tab screen's first-descendant chain, and here the
        // dark-mode wash comes first, so React Native's iOS default (Never) stuck.
        // Without this the end of the scroll content sits permanently under
        // the floating tab bar and cannot be tapped (Android ignores the prop).
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
        showsVerticalScrollIndicator={false}>

        {/* ── Header: weekday kicker, date, location + gear ─────────────── */}
        <View style={styles.header}>
          <View style={styles.dateStack}>
            <Text variant="kicker" style={[styles.weekday, { color: colors.accentText }]}>
              {dateParts.weekday}
            </Text>
            <Text variant="display" style={[styles.dateBig, { color: colors.textPrimary }]}>
              {dateParts.dayMonth}
            </Text>
            {/* Tappable: on the fallback this is a guess, and the user is
                looking at the sunrise it produced. One tap to the city picker
                is worth more than any choice of default city. */}
            <MotionPressable
              onPress={() => router.push('/location-permission')}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              style={styles.locRow}
              accessibilityRole="button"
              accessibilityLabel={t('a11y.changeLocation', { location: locationLabel })}>
              <Icon name="location" size={13} color={colors.textMuted} />
              <Text variant="body" style={[styles.locText, { color: colors.textTertiary }]} numberOfLines={1}>
                {locationLabel}
              </Text>
              <Icon name="chevron-right" size={11} color={colors.textMuted} />
            </MotionPressable>
          </View>
          <MotionPressable
            onPress={() => router.push('/settings')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[styles.gear, { backgroundColor: colors.surface, borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.openSettings')}>
            <Icon name="gear" size={19} color={colors.textSecondary} />
          </MotionPressable>
        </View>

        {/* ── Hero: the panchang glance ─────────────────────────────────── */}
        <MotionPressable
          ref={panchangCardRef}
          pressedScale={0.98}
          onPress={() => router.push('/(tabs)/panchang')}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.openPanchang')}>
          <LinearGradient
            colors={
              isDarkMode
                ? ['rgba(216,163,26,0.14)', 'rgba(255,255,255,0.035)']
                : [colors.accentSurface, colors.surface]
            }
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.7, y: 1 }}
            style={[styles.hero, { borderColor: colors.borderAccent }]}>
            <View style={styles.heroHead}>
              <Text variant="kicker" style={[styles.heroKicker, { color: colors.textTertiary }]}>
                {t('home.panchangHeroKicker')}
              </Text>
              <Text variant="body" style={[styles.heroFull, { color: colors.accentText }]}>
                {t('home.fullLink')} →
              </Text>
            </View>

            <SkeletonCrossfade
              ready={!panchangLoading}
              skeleton={
                <HomePanchangSkeleton
                  colors={colors}
                  baseColor={isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
                  shimmerColor={isDarkMode ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.45)'}
                  dividerColor={colors.divider}
                />
              }>
              {panchang ? (
                <>
                  <View style={styles.tithiRow}>
                    <View style={[styles.tithiDot, { backgroundColor: colors.accent, shadowColor: colors.accent }]} />
                    <Text
                      variant={tithi && DEVA_RE.test(tithi.name) ? 'deva-bold' : 'title'}
                      style={[styles.tithiName, { color: colors.textPrimary }]}
                      numberOfLines={1}>
                      {tithi?.name ?? '—'}
                    </Text>
                    {!!tithi?.endTime && (
                      <Text variant="mono" style={[styles.tithiEnd, { color: colors.textTertiary }]}>
                        {t('home.untilTime', { time: tithi.endTime })}
                      </Text>
                    )}
                  </View>
                  {!!masaLine && (
                    <Text variant="body" style={[styles.masaLine, { color: colors.textTertiary }]} numberOfLines={1}>
                      {masaLine}
                    </Text>
                  )}
                  {verdict && (
                    <Text variant="body" style={[styles.heroVerdict, { color: colors.accentText }]}>
                      {verdict.text}
                    </Text>
                  )}
                  {/* Home is the launch screen, so this is the first verdict a
                      user ever sees — it carries the same provisional caption
                      as the Panchang tab. Tertiary rather than muted: the hero
                      sits on a turmeric-tinted gradient, where textMuted washes
                      out. */}
                  {verdict && VERDICT_REVIEW_PENDING && (
                    <Text
                      variant="body-italic"
                      style={[styles.heroVerdictProvisional, { color: colors.textSecondary }]}>
                      {t('panchang.verdictProvisional')}
                    </Text>
                  )}

                  <View style={[styles.heroDivider, { backgroundColor: colors.divider }]} />

                  <View style={styles.phRows}>
                    <PanchangRow label={t('home.nakshatra')} el={getActiveElement(panchang.nakshatras)} colors={colors} />
                    <PanchangRow label={t('home.yoga')}      el={getActiveElement(panchang.yogas)} colors={colors} />
                    <PanchangRow label={t('home.karana')}    el={getActiveElement(panchang.karanas)} colors={colors} />
                    {/* Two label/value pairs that wrap as whole pairs: on a
                        narrow phone, at a large text size or with the zone tag
                        present, sunset drops to its own line instead of the
                        row running past the card edge. */}
                    <View style={styles.sunRow}>
                      <View style={styles.sunPair}>
                        <Text variant="kicker" style={[styles.phLbl, { color: colors.textMuted }]}>
                          {t('home.sunrise')}
                        </Text>
                        <Text variant="mono" style={[styles.sunVal, { color: colors.textSecondary }]}>
                          {panchang.sunrise}
                        </Text>
                        {!!zoneLabel && (
                          <Text
                            variant="kicker"
                            style={[styles.zoneTag, styles.zoneTagTight, { color: colors.textSecondary }]}
                            numberOfLines={1}
                            accessibilityLabel={t('a11y.timesInZone', { zone: zoneLabel })}>
                            {zoneLabel}
                          </Text>
                        )}
                      </View>
                      <View style={styles.sunPair}>
                        <Text variant="kicker" style={[styles.phLbl, styles.sunsetLbl, { color: colors.textMuted }]}>
                          {t('home.sunset')}
                        </Text>
                        <Text variant="mono" style={[styles.sunVal, { color: colors.textSecondary }]}>
                          {panchang.sunset}
                        </Text>
                      </View>
                    </View>
                  </View>
                </>
              ) : (
                <Text variant="body" style={[styles.errorText, { color: colors.textMuted }]}>
                  {t('home.couldNotLoadPanchang')}
                </Text>
              )}
            </SkeletonCrossfade>
          </LinearGradient>
        </MotionPressable>

        {/* ── Rahu Kaal — only while it still matters today ─────────────── */}
        {rahu && panchang && (
          <View style={[styles.rahuCard, { backgroundColor: colors.dangerSurface, borderColor: isDarkMode ? 'rgba(210,64,92,0.30)' : 'rgba(179,38,30,0.25)' }]}>
            <View style={[styles.rahuIcon, { backgroundColor: isDarkMode ? 'rgba(210,64,92,0.18)' : 'rgba(179,38,30,0.10)' }]}>
              <Icon name="warning" size={18} color={colors.dangerText} />
            </View>
            <View style={styles.rahuBody}>
              <Text variant="title" style={[styles.rahuTitle, { color: colors.textPrimary }]}>
                {rahu.text}
              </Text>
              {/* The countdown above runs on the phone's clock; the window's
                  times are the place's, so when the sunrise tag names a zone
                  it is named here too. A sibling, not a nested span: a nested
                  Text's own scaled lineHeight can squeeze the line on Android. */}
              <View style={styles.rahuTimesRow}>
                <Text variant="mono" style={[styles.rahuTimes, { color: colors.textTertiary }]}>
                  {panchang.rahuKalamStart} – {panchang.rahuKalamEnd}
                </Text>
                {!!zoneLabel && (
                  <Text
                    variant="kicker"
                    style={[styles.zoneTag, { color: colors.textSecondary }]}
                    numberOfLines={1}
                    accessibilityLabel={t('a11y.timesInZone', { zone: zoneLabel })}>
                    {zoneLabel}
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* ── Quick actions ─────────────────────────────────────────────── */}
        <View style={styles.quickRow}>
          {quickActions.map(a => (
            <MotionPressable
              key={a.key}
              pressedScale={0.97}
              onPress={a.go}
              style={[styles.quickTile, { backgroundColor: colors.surface, borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel={a.title}>
              <Icon name={a.icon} size={21} color={colors.accent} />
              <View>
                <Text variant="title" style={[styles.quickTitle, { color: colors.textPrimary }]}>{a.title}</Text>
                <Text variant="body-small" style={[styles.quickCaption, { color: colors.textMuted }]} numberOfLines={1}>
                  {a.caption}
                </Text>
              </View>
            </MotionPressable>
          ))}
        </View>

        {/* ── Day's deity ───────────────────────────────────────────────── */}
        <MotionPressable
          pressedScale={0.98}
          onPress={() => router.push(`/vaar/${vaar.dayKey}`)}
          style={[styles.deityCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          accessibilityRole="button"
          accessibilityLabel={t('vaar.a11yTodaysDeities', { names: deityNames, graha: vaar.grahaName[lang] })}>
          <LinearGradient
            colors={['rgba(216,163,26,0.30)', 'rgba(216,163,26,0.05)']}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={[styles.omBadge, { borderColor: colors.borderAccent }]}>
            <Text variant="deva" style={[styles.omGlyph, { color: colors.accent }]}>ॐ</Text>
          </LinearGradient>
          <View style={styles.deityBody}>
            <Text variant="kicker" style={[styles.deityKicker, { color: colors.textMuted }]}>
              {t('vaar.todaysDeityKicker')}
            </Text>
            <Text variant="deva-bold" style={[styles.deityName, { color: colors.textPrimary }]} numberOfLines={1}>
              {deityNames}
            </Text>
          </View>
          <Icon name="chevron-right" size={17} color={colors.textMuted} />
        </MotionPressable>

      </ScrollView>

      {/* ── Ad banner (pinned bottom — placement unchanged). aboveTabBar lifts
          it clear of the iOS tab bar (the per-tab bottom inset) only while a
          banner renders, so an empty slot leaves the scroll content free to
          run under the glass bar with its automatic content inset. */}
      <AdBanner colors={colors} placement="home" aboveTabBar />

      {walkthroughStep === 1 && panchangRect && (
        <WalkthroughSpotlight
          spotlight={panchangRect}
          title={t('walkthrough.step1Title')}
          description={t('walkthrough.step1Desc')}
          tooltipPosition="below"
          stepIndex={0}
          totalSteps={3}
          onSpotlightTap={() => {
            setWalkthroughStep(2);
            router.push('/(tabs)/panchang');
          }}
          onSkip={skipWalkthrough}
        />
      )}

    </SafeAreaView>
    </ScreenMount>
  );
}

// ─── Panchang hero sub-components ──────────────────────────────────────────────

interface PanchangRowProps {
  label: string;
  el: IPanchangElement | undefined;
  colors: typeof darkColors | typeof lightColors;
}

const PanchangRow = memo(function PanchangRow({ label, el, colors }: PanchangRowProps) {
  if (!el) return null;
  const isDeva = DEVA_RE.test(el.name);
  return (
    <View style={styles.phRow}>
      <Text variant="kicker" style={[styles.phLbl, { color: colors.textMuted }]}>{label}</Text>
      <Text
        variant={isDeva ? 'deva' : 'body'}
        style={[styles.phVal, { color: colors.textSecondary }]}
        numberOfLines={1}>
        {el.name}
      </Text>
      {!!el.endTime && (
        <Text variant="mono" style={[styles.phTime, { color: colors.textTertiary }]}>
          {el.endTime}
        </Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingTop: 10, paddingBottom: 24 },

  // Height is the glow's own reach — see the note at the call site.
  wash: { position: 'absolute', top: 0, left: 0, right: 0, height: '42%' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  dateStack: { flex: 1 },
  weekday: { fontSize: 10.5 },
  dateBig: { fontSize: 36, lineHeight: 40, marginTop: 6 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 7 },
  locText: { fontSize: 13, flexShrink: 1 },
  gear: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },

  // Hero
  hero: {
    borderRadius: borderRadius.hero,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
  },
  heroHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  heroKicker: { fontSize: 10.5 },
  heroFull: { fontSize: 12 },
  tithiRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  tithiDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  tithiName: { flex: 1, fontSize: 22, lineHeight: 30 },
  tithiEnd: { fontSize: 13.5, marginLeft: 8 },
  masaLine: { fontSize: 13, marginTop: 2, marginLeft: 16 },
  heroVerdict: { fontSize: 13, lineHeight: 19, marginTop: 8 },
  heroVerdictProvisional: { fontSize: 11, lineHeight: 15, marginTop: 3 },
  heroDivider: { height: StyleSheet.hairlineWidth, marginVertical: 14 },
  phRows: { gap: 9 },
  phRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  phLbl: { minWidth: 74, fontSize: 10 },
  phVal: { flex: 1, fontSize: 15 },
  phTime: { fontSize: 13 },
  // 26 between the pairs is the old sunrise-value → SUNSET spacing (10 value
  // margin + 10 gap + 6 label margin), so the unwrapped row is unchanged; the
  // 9 row gap matches `phRows` when sunset wraps.
  sunRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: 26,
    rowGap: 9,
    marginTop: 2,
  },
  sunPair: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  sunVal: { fontSize: 13 },
  sunsetLbl: { minWidth: 0 },
  // Zone tag ("IST") — small, secondary ink, never accent. Beside sunrise the
  // negative margin pulls it to 5 from the time it qualifies, inside the
  // pair's 10 gap; beside the Rahu window the row's own gap is 5.
  zoneTag: { fontSize: 9.5, letterSpacing: 0.8 },
  zoneTagTight: { marginLeft: -5 },
  errorText: { fontSize: 13, textAlign: 'center', paddingVertical: 8 },

  // Rahu Kaal
  rahuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderRadius: borderRadius.list,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginTop: 12,
  },
  rahuIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rahuBody: { flex: 1 },
  rahuTitle: { fontSize: 14.5 },
  rahuTimesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: 5,
    marginTop: 2,
  },
  rahuTimes: { fontSize: 12.5 },

  // Quick actions
  quickRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  quickTile: {
    flex: 1,
    borderRadius: borderRadius.tile,
    borderWidth: 1,
    paddingVertical: 15,
    paddingHorizontal: 14,
    gap: 9,
  },
  quickTitle: { fontSize: 14 },
  quickCaption: { fontSize: 11.5, marginTop: 1 },

  // Day's deity
  deityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    borderRadius: borderRadius.card,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginTop: 12,
  },
  omBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  omGlyph: { fontSize: 21, lineHeight: 30 },
  deityBody: { flex: 1 },
  deityKicker: { fontSize: 10.5 },
  deityName: { fontSize: 19, lineHeight: 26, marginTop: 2 },
});
