import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  type AppStateStatus,
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, spacing, type ColorPalette } from '@/config/theme';
import { fetchPanchangForToday } from '@/services/astrology/panchangService';
import { resolveLanguage } from '@/i18n';
import { DeityAvatar } from '@/components/common/DeityAvatar';
import { HomePanchangSkeleton } from '@/components/common/SkeletonLoader';
import { AdBanner } from '@/components/common/AdBanner';
import { WalkthroughSpotlight, type SpotlightRect } from '@/components/common/WalkthroughOverlay';
import type { IPanchangDay, IPanchangElement, IAarti } from '@/types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AartiRow {
  id: string;
  titleEnglish: string;
  titleNative: string;
  content: string;
  deity: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getGreetingKey(): 'Morning' | 'Afternoon' | 'Evening' {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}

const DATE_LOCALE_MAP: Record<string, string> = { en: 'en-IN', hi: 'hi-IN', sa: 'hi-IN' };

function getTodayDateString(lang: string): string {
  const locale = DATE_LOCALE_MAP[lang] ?? 'en-IN';
  return new Date()
    .toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })
    .toUpperCase();
}

function rowToAarti(row: AartiRow): IAarti {
  return { ...row, content: JSON.parse(row.content) as string[] };
}

/**
 * From an element array (tithi/nakshatra/etc.), returns the one that is
 * currently active based on wall-clock time. Falls back to the last element
 * if all end-times have passed (shouldn't happen in practice).
 */
function getActiveElement(elements: IPanchangElement[]): IPanchangElement | undefined {
  if (!elements.length) return undefined;
  const nowMs = Date.now();
  for (const el of elements) {
    // endTimeMs is in the same reference frame as Date.now() (see panchangService)
    if (!el.endTimeMs || el.endTimeMs > nowMs) return el;
  }
  return elements[elements.length - 1];
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { isDarkMode, favoriteIds, userLocation, locationName, language, walkthroughStep, setWalkthroughStep } = useStore();
  const colors = isDarkMode ? darkColors : lightColors;
  const db = useSQLiteContext();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const [panchang, setPanchang] = useState<IPanchangDay | null>(null);
  const [panchangLoading, setPanchangLoading] = useState(true);
  const [featuredAarti, setFeaturedAarti] = useState<IAarti | null>(null);

  // ── Panchang — fetch + mid-day refresh ────────────────────────────────────
  const lastFetchRef = useRef(0);

  const panchangLang = resolveLanguage(language) as 'en' | 'hi' | 'sa';
  const refreshPanchang = useCallback((showSpinner = false) => {
    const now = Date.now();
    // Throttle: don't re-fetch more than once per hour (panchang only changes daily)
    if (!showSpinner && now - lastFetchRef.current < 3_600_000) return;
    lastFetchRef.current = now;
    if (showSpinner) setPanchangLoading(true);
    fetchPanchangForToday(userLocation, panchangLang)
      .then(p => { if (p) setPanchang(p); })
      .finally(() => setPanchangLoading(false));
  }, [userLocation, panchangLang]);

  // Initial load
  useEffect(() => { refreshPanchang(true); }, [refreshPanchang]);

  // Refresh when this tab gains focus (user switches back from another tab)
  useFocusEffect(useCallback(() => { refreshPanchang(); }, [refreshPanchang]));

  // Refresh when app comes back to foreground (mid-day element transitions)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') refreshPanchang();
    });
    return () => sub.remove();
  }, [refreshPanchang]);

  // ── Featured Aarti ────────────────────────────────────────────────────────
  useEffect(() => {
    const favAartiIds = favoriteIds.filter((id) => id.startsWith('aarti-'));
    let row: AartiRow | null = null;

    if (favAartiIds.length > 0) {
      const randomPrefixed = favAartiIds[Math.floor(Math.random() * favAartiIds.length)];
      const rawId = randomPrefixed.slice('aarti-'.length);
      row = db.getFirstSync<AartiRow>('SELECT * FROM aartis WHERE id = ?', [rawId]);
    }

    if (!row) {
      row = db.getFirstSync<AartiRow>('SELECT * FROM aartis ORDER BY RANDOM() LIMIT 1');
    }

    setFeaturedAarti(row ? rowToAarti(row) : null);
  }, [db, favoriteIds]);

  const greetingKey = getGreetingKey();
  const panchangGradient = useMemo<readonly [string, string]>(
    () => isDarkMode ? ['#2E2418', '#1E1E24'] : ['#FFF8F0', '#FFF0E4'],
    [isDarkMode]
  );

  // ── Walkthrough refs & measurement ────────────────────────────────────────
  const panchangCardRef = useRef<View>(null);
  const settingsBtnRef = useRef<View>(null);
  const [panchangRect, setPanchangRect] = useState<SpotlightRect | null>(null);
  const [settingsRect, setSettingsRect] = useState<SpotlightRect | null>(null);

  const measurePanchang = useCallback(() => {
    panchangCardRef.current?.measureInWindow((x, y, width, height) => {
      if (width > 0) setPanchangRect({ x, y, width, height });
    });
  }, []);

  const measureSettings = useCallback(() => {
    settingsBtnRef.current?.measureInWindow((x, y, width, height) => {
      if (width > 0) setSettingsRect({ x, y, width, height });
    });
  }, []);

  // Measure targets when this tab is focused and walkthrough is active
  useFocusEffect(
    useCallback(() => {
      if (walkthroughStep === 1 || walkthroughStep === 4) {
        const timer = setTimeout(() => {
          if (walkthroughStep === 1) measurePanchang();
          if (walkthroughStep === 4) measureSettings();
        }, 300);
        return () => clearTimeout(timer);
      }
    }, [walkthroughStep, measurePanchang, measureSettings])
  );

  const skipWalkthrough = useCallback(() => setWalkthroughStep(0), [setWalkthroughStep]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
        showsVerticalScrollIndicator={false}>

        {/* ── Header ───────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={[styles.dateLabel, { color: colors.textMuted }]}>
            {getTodayDateString(lang)}
          </Text>
          <TouchableOpacity
            ref={settingsBtnRef}
            onPress={() => router.push('/settings')}
            style={[styles.settingsBtn, { backgroundColor: colors.surfaceRecessed }]}>
            <Ionicons name="settings-outline" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* ── Greeting ─────────────────────────────────────────────────── */}
        <Text style={[styles.greeting, { color: colors.textPrimary }]}>
          {t(`home.greeting${greetingKey}Hi`)}
        </Text>
        {lang === 'en' && (
          <Text style={[styles.greetingEn, { color: colors.textMuted }]}>
            {t(`home.greeting${greetingKey}`)}
          </Text>
        )}

        {/* ── Panchang Card ─────────────────────────────────────────────── */}
        <TouchableOpacity
          ref={panchangCardRef}
          activeOpacity={0.85}
          onPress={() => router.push('/(tabs)/panchang')}>
          <LinearGradient
            colors={panchangGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.panchangCard, { borderColor: colors.borderAccent }]}>

            {/* Card header row */}
            <View style={styles.panchangCardHeader}>
              <Text style={[styles.sectionLabel, { color: colors.accent }]}>
                {t('home.todaysPanchang')}
              </Text>
              <View style={styles.panchangCardHeaderRight}>
                <View style={[styles.locationBadge, { backgroundColor: colors.surfaceRecessed }]}>
                  <Ionicons name="location-outline" size={10} color={colors.textMuted} />
                  <Text style={[styles.locationText, { color: colors.textMuted }]}>
                    {'  '}{locationName ?? (userLocation ? 'GPS' : 'Pune, MH')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={colors.textMuted} style={{ marginLeft: 6 }} />
              </View>
            </View>

            {panchangLoading ? (
              <HomePanchangSkeleton colors={colors} />
            ) : panchang ? (
              <>
                {/* Single-column element rows showing currently-active element */}
                <PanchangRow label={t('home.tithi')}     el={getActiveElement(panchang.tithis)}     colors={colors} />
                <PanchangRow label={t('home.nakshatra')} el={getActiveElement(panchang.nakshatras)} colors={colors} />
                <PanchangRow label={t('home.yoga')}      el={getActiveElement(panchang.yogas)}      colors={colors} />
                <PanchangRow label={t('home.karana')}    el={getActiveElement(panchang.karanas)}    colors={colors} />

                <View style={[styles.divider, { backgroundColor: colors.divider }]} />

                {/* Sunrise / Sunset */}
                <View style={styles.sunRow}>
                  <View style={styles.sunItem}>
                    <Ionicons name="sunny-outline" size={14} color={colors.accent} />
                    <Text style={[styles.sunLabel, { color: colors.textMuted }]}> {t('home.sunrise')}</Text>
                    <Text style={[styles.sunValue, { color: colors.textPrimary }]}>
                      {panchang.sunrise}
                    </Text>
                  </View>
                  <View style={[styles.sunSep, { backgroundColor: colors.divider }]} />
                  <View style={styles.sunItem}>
                    <Ionicons name="moon-outline" size={14} color={colors.textMuted} />
                    <Text style={[styles.sunLabel, { color: colors.textMuted }]}> {t('home.sunset')}</Text>
                    <Text style={[styles.sunValue, { color: colors.textPrimary }]}>
                      {panchang.sunset}
                    </Text>
                  </View>
                </View>
              </>
            ) : (
              <Text style={[styles.errorText, { color: colors.textMuted }]}>
                {t('home.couldNotLoadPanchang')}
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* ── Featured Aarti Card ───────────────────────────────────────── */}
        {featuredAarti && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push(`/aarti/${featuredAarti.id}`)}
            style={[
              styles.featuredCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}>
            <View style={styles.featuredInner}>
              <DeityAvatar deity={featuredAarti.deity} size={52} />

              <View style={styles.featuredText}>
                <Text style={[styles.featuredTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                  {lang === 'en' ? featuredAarti.titleNative : featuredAarti.titleNative}
                </Text>
                {lang === 'en' && (
                  <Text style={[styles.featuredTranslit, { color: colors.textTertiary }]} numberOfLines={1}>
                    {featuredAarti.titleEnglish}
                  </Text>
                )}
                <Text style={[styles.featuredDeity, { color: colors.accent }]}>
                  {featuredAarti.deity}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => router.push(`/aarti/${featuredAarti.id}`)}
                style={[styles.playBtn, { borderColor: colors.accent }]}>
                <Ionicons name="play" size={14} color={colors.accent} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.featuredCardLabel, { color: colors.textMuted }]}>
              {favoriteIds.some((id) => id.startsWith('aarti-'))
                ? t('home.fromYourFavourites')
                : t('home.featuredAarti')}
            </Text>
          </TouchableOpacity>
        )}

        {/* ── Quick Access Row ──────────────────────────────────────────── */}
        <View style={styles.quickRow}>
          <QuickCard
            emoji="❤️"
            label={t('home.favorites')}
            onPress={() => router.push('/favorites')}
            colors={colors}
          />
          <QuickCard
            emoji="🪔"
            label={t('home.festivals')}
            onPress={() => router.push('/festivals')}
            colors={colors}
          />
          <QuickCard
            emoji="🔍"
            label={t('common.search')}
            onPress={() => router.push('/search')}
            colors={colors}
          />
        </View>

      </ScrollView>

      <AdBanner colors={colors} />

      {/* ── Walkthrough Step 1: Spotlight panchang card ── */}
      {walkthroughStep === 1 && panchangRect && (
        <WalkthroughSpotlight
          spotlight={panchangRect}
          title={t('walkthrough.step1Title')}
          description={t('walkthrough.step1Desc')}
          tooltipPosition="below"
          stepIndex={0}
          totalSteps={4}
          onSpotlightTap={() => {
            setWalkthroughStep(2);
            router.push('/(tabs)/panchang');
          }}
          onSkip={skipWalkthrough}
          colors={colors}
        />
      )}

      {/* ── Walkthrough Step 4: Spotlight settings gear ── */}
      {walkthroughStep === 4 && settingsRect && (
        <WalkthroughSpotlight
          spotlight={settingsRect}
          title={t('walkthrough.step4Title')}
          description={t('walkthrough.step4Desc')}
          tooltipPosition="below"
          stepIndex={3}
          totalSteps={4}
          onSpotlightTap={() => {
            setWalkthroughStep(0);
            router.push('/settings');
          }}
          onSkip={skipWalkthrough}
          colors={colors}
        />
      )}

    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface PanchangRowProps {
  label: string;
  el: IPanchangElement | undefined;
  colors: ColorPalette;
}

function PanchangRow({ label, el, colors }: PanchangRowProps) {
  const { t } = useTranslation();
  if (!el) return null;
  return (
    <View style={styles.panchangRow}>
      <Text style={[styles.panchangLabel, { color: colors.textMuted }]}>{label}</Text>
      <View style={styles.panchangRowRight}>
        <Text style={[styles.panchangValue, { color: colors.textPrimary }]}>{el.name}</Text>
        {el.endTime && (
          <Text style={[styles.panchangEndTime, { color: colors.textMuted }]}>{t('home.untilTime', { time: el.endTime })}</Text>
        )}
      </View>
    </View>
  );
}

interface QuickCardProps {
  emoji: string;
  label: string;
  onPress: () => void;
  colors: ColorPalette;
}

function QuickCard({ emoji, label, onPress, colors }: QuickCardProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.quickCard,
        { backgroundColor: colors.surfaceRecessed, borderColor: colors.border },
      ]}>
      <Text style={styles.quickEmoji}>{emoji}</Text>
      <Text style={[styles.quickLabel, { color: colors.textSecondary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingBottom: 32, paddingTop: 12 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  dateLabel: { fontSize: 13, fontFamily: 'Mukta_400Regular', letterSpacing: 0.5 },
  settingsBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },

  // Greeting
  greeting: { fontSize: 26, fontFamily: 'Mukta_500Medium', marginBottom: 2 },
  greetingEn: { fontSize: 13, fontFamily: 'Mukta_400Regular', marginBottom: 20 },

  // Panchang card
  panchangCard: {
    borderRadius: borderRadius.card,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  panchangCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  panchangCardHeaderRight: { flexDirection: 'row', alignItems: 'center' },
  sectionLabel: { fontSize: 11, fontFamily: 'Mukta_400Regular', letterSpacing: 1 },
  locationBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: borderRadius.chip },
  locationText: { fontSize: 11, fontFamily: 'Mukta_400Regular' },

  panchangRow: { flexDirection: 'row', alignItems: 'baseline', paddingVertical: 5 },
  panchangLabel: { fontSize: 11, fontFamily: 'Mukta_400Regular', letterSpacing: 0.5, width: 86 },
  panchangRowRight: { flex: 1, flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 6 },
  panchangValue: { fontSize: 15, fontFamily: 'Mukta_500Medium' },
  panchangEndTime: { fontSize: 11, fontFamily: 'Mukta_400Regular' },

  divider: { height: 0.5, marginVertical: 12 },

  sunRow: { flexDirection: 'row', alignItems: 'center' },
  sunItem: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  sunLabel: { fontSize: 11, fontFamily: 'Mukta_400Regular', letterSpacing: 0.5 },
  sunValue: { fontSize: 13, fontFamily: 'Mukta_500Medium', marginLeft: 4 },
  sunSep: { width: 0.5, height: 20, marginHorizontal: 12 },

  errorText: { fontSize: 13, fontFamily: 'Mukta_400Regular', textAlign: 'center', paddingVertical: 16 },

  // Featured aarti
  featuredCard: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  featuredInner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featuredText: { flex: 1 },
  featuredTitle: { fontSize: 16, fontFamily: 'Mukta_700Bold', marginBottom: 2 },
  featuredTranslit: { fontSize: 13, fontFamily: 'Mukta_400Regular', marginBottom: 2 },
  featuredDeity: { fontSize: 11, fontFamily: 'Mukta_400Regular', letterSpacing: 0.5 },
  featuredCardLabel: { fontSize: 11, fontFamily: 'Mukta_400Regular', letterSpacing: 1, marginTop: 12 },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Quick access
  quickRow: { flexDirection: 'row', gap: spacing.gridGap },
  quickCard: {
    flex: 1,
    borderRadius: borderRadius.iconContainer,
    borderWidth: 1,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 6,
  },
  quickEmoji: { fontSize: 22 },
  quickLabel: { fontSize: 12, fontFamily: 'Mukta_400Regular' },
});
