import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import {
  AppState,
  type AppStateStatus,
  Platform,
  View,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
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
} from '@/services/astrology/panchangService';
import { resolveLanguage } from '@/i18n';
import { ScreenMount } from '@/components/common/ScreenMount';
import { HomePanchangSkeleton, SkeletonCrossfade } from '@/components/common/SkeletonLoader';
import { AdBanner } from '@/components/common/AdBanner';
import { WalkthroughSpotlight, type SpotlightRect } from '@/components/common/WalkthroughOverlay';
import { buildDayVerdict } from '@/utils/dayVerdict';
import { getVaarDevataForDate, vaarDeityNames } from '@/config/vaarDevata';
import type { IPanchangDay, IPanchangElement } from '@/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DEVA_RE = /[ऀ-ॿ]/;

function getActiveElement(elements: IPanchangElement[]): IPanchangElement | undefined {
  if (!elements.length) return undefined;
  return elements[0];
}

/** Parse the service's "2:07 PM" strings into a Date on today's calendar day. */
function parseClockToday(clock: string | undefined): Date | null {
  if (!clock) return null;
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(clock.trim());
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const mer = m[3]?.toUpperCase();
  if (mer === 'PM' && h < 12) h += 12;
  if (mer === 'AM' && h === 12) h = 0;
  const d = new Date();
  d.setHours(h, min, 0, 0);
  return d;
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
  const userBirthDate = useStore(s => s.userBirthDate);
  const userBirthTime = useStore(s => s.userBirthTime);
  const userBirthPlace = useStore(s => s.userBirthPlace);
  const walkthroughStep = useStore(s => s.walkthroughStep);
  const setWalkthroughStep = useStore(s => s.setWalkthroughStep);
  const primaryIntent = useStore(s => s.primaryIntent);
  const colors = isDarkMode ? darkColors : lightColors;
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const lang: 'en' | 'hi' = i18n.language === 'hi' ? 'hi' : 'en';

  const [panchang, setPanchang] = useState<IPanchangDay | null>(null);
  const [panchangLoading, setPanchangLoading] = useState(true);
  // Minute tick drives the Rahu Kaal countdown. The value itself never
  // animates — it is replaced (MOTION.md: reported times appear, not move).
  const [nowMs, setNowMs] = useState(() => Date.now());

  // ── Panchang — fetch + mid-day refresh ────────────────────────────────────
  const lastFetchRef = useRef(0);
  const panchangLang = resolveLanguage(language);
  const refreshPanchang = useCallback((showSpinner = false) => {
    const now = Date.now();
    if (!showSpinner && now - lastFetchRef.current < 3_600_000) return;
    lastFetchRef.current = now;
    if (showSpinner) setPanchangLoading(true);
    const { janmaNakshatra, janmaRashi } = deriveJanmaIndicesFromStore({
      userBirthDate, userBirthTime, userBirthPlace,
    });
    fetchPanchangForToday(
      userLocation, panchangLang, region, ayanamsa, janmaNakshatra, janmaRashi,
    )
      .then(p => { if (p) setPanchang(p); })
      .finally(() => setPanchangLoading(false));
  }, [userLocation, panchangLang, region, ayanamsa, userBirthDate, userBirthTime, userBirthPlace]);

  useEffect(() => { refreshPanchang(true); }, [refreshPanchang]);
  useFocusEffect(useCallback(() => { refreshPanchang(); }, [refreshPanchang]));
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') { refreshPanchang(); setNowMs(Date.now()); }
    });
    return () => sub.remove();
  }, [refreshPanchang]);
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // ── Header date ───────────────────────────────────────────────────────────
  const dateParts = useMemo(() => {
    const locale = lang === 'hi' ? 'hi-IN' : 'en-IN';
    const now = new Date();
    return {
      weekday: now.toLocaleDateString(locale, { weekday: 'long' }),
      dayMonth: now.toLocaleDateString(locale, { day: 'numeric', month: 'long' }),
    };
  }, [lang]);

  // ── Rahu Kaal countdown ───────────────────────────────────────────────────
  const rahu = useMemo(() => {
    const start = parseClockToday(panchang?.rahuKalamStart);
    const end = parseClockToday(panchang?.rahuKalamEnd);
    if (!start || !end) return null;
    if (nowMs < start.getTime()) {
      return { text: t('home.rahuBeginsIn', { time: formatSpan(start.getTime() - nowMs) }) };
    }
    if (nowMs < end.getTime()) {
      return { text: t('home.rahuEndsIn', { time: formatSpan(end.getTime() - nowMs) }) };
    }
    return null; // over for today — the strip earns its place only while live
  }, [panchang?.rahuKalamStart, panchang?.rahuKalamEnd, nowMs, t]);

  // Plain verdict — shared with the Panchang tab (P16.3).
  const verdict = useMemo(
    () => buildDayVerdict(panchang, !!panchang?.eclipse, t),
    [panchang, t],
  );

  // ── Day's deity (vaar devata) ─────────────────────────────────────────────
  const vaar = getVaarDevataForDate(new Date());
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
  const masaLine = panchang?.masa ?? panchang?.hinduMonth;

  return (
    <ScreenMount>
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top']}>
      {/* One warm light in a dark room — a faint turmeric wash from the top. */}
      {isDarkMode && (
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <SvgRadialGradient id="heroGlow" cx="50%" cy="0%" rx="80%" ry="42%">
              <Stop offset="0" stopColor={palette.turmeric} stopOpacity={0.14} />
              <Stop offset="1" stopColor={palette.turmeric} stopOpacity={0} />
            </SvgRadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#heroGlow)" />
        </Svg>
      )}

      <ScrollView
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
            <View style={styles.locRow}>
              <Icon name="location" size={13} color={colors.textMuted} />
              <Text variant="body" style={[styles.locText, { color: colors.textTertiary }]} numberOfLines={1}>
                {locationLabel}
              </Text>
            </View>
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

                  <View style={[styles.heroDivider, { backgroundColor: colors.divider }]} />

                  <View style={styles.phRows}>
                    <PanchangRow label={t('home.nakshatra')} el={getActiveElement(panchang.nakshatras)} colors={colors} />
                    <PanchangRow label={t('home.yoga')}      el={getActiveElement(panchang.yogas)} colors={colors} />
                    <PanchangRow label={t('home.karana')}    el={getActiveElement(panchang.karanas)} colors={colors} />
                    <View style={styles.sunRow}>
                      <Text variant="kicker" style={[styles.phLbl, { color: colors.textMuted }]}>
                        {t('home.sunrise')}
                      </Text>
                      <Text variant="mono" style={[styles.sunVal, { color: colors.textSecondary }]}>
                        {panchang.sunrise}
                      </Text>
                      <Text variant="kicker" style={[styles.phLbl, styles.sunsetLbl, { color: colors.textMuted }]}>
                        {t('home.sunset')}
                      </Text>
                      <Text variant="mono" style={[styles.sunVal, { color: colors.textSecondary }]}>
                        {panchang.sunset}
                      </Text>
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
              <Text variant="mono" style={[styles.rahuTimes, { color: colors.textTertiary }]}>
                {panchang.rahuKalamStart} – {panchang.rahuKalamEnd}
              </Text>
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

      {/* ── Ad banner (pinned bottom — placement unchanged) ─────────────── */}
      <View style={Platform.OS === 'ios' ? { paddingBottom: Math.max(insets.bottom, 8) } : null}>
        <AdBanner colors={colors} placement="home" />
      </View>

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
  heroDivider: { height: StyleSheet.hairlineWidth, marginVertical: 14 },
  phRows: { gap: 9 },
  phRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  phLbl: { minWidth: 74, fontSize: 10 },
  phVal: { flex: 1, fontSize: 15 },
  phTime: { fontSize: 13 },
  sunRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 2 },
  sunVal: { fontSize: 13, marginRight: 10 },
  sunsetLbl: { minWidth: 0, marginLeft: 6 },
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
  rahuTimes: { fontSize: 12.5, marginTop: 2 },

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
