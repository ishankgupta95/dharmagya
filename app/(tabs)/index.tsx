import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
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
import { Icon, type IconName } from '@/components/common/Icon';
import { computeVimshottariDashaFromBirth, type DashaLord } from 'panchang-ts';

import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import {
  darkColors,
  lightColors,
  palette,
  spacing,
  borderRadius,
  type ColorPalette,
} from '@/config/theme';
import { fetchPanchangForToday } from '@/services/astrology/panchangService';
import { resolveLanguage } from '@/i18n';
import { DeityAvatar } from '@/components/common/DeityAvatar';
import { NightCard } from '@/components/common/NightCard';
import { Kicker } from '@/components/common/Kicker';
import { SectionLabel } from '@/components/common/SectionLabel';
import { Ornament } from '@/components/common/Ornament';
import { HomePanchangSkeleton } from '@/components/common/SkeletonLoader';
import { AdBanner } from '@/components/common/AdBanner';
import { WalkthroughSpotlight, type SpotlightRect } from '@/components/common/WalkthroughOverlay';
import { DEITY_BY_ID } from '@/config/deities';
import type { IPanchangDay, IPanchangElement } from '@/types';
import {
  getAllAppAartis,
  getAllAppChalisas,
  aartiVerses,
  type Recitation,
  type Chalisa,
} from '@/services/content';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getGreetingKey(): 'Morning' | 'Afternoon' | 'Evening' {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}

// Devanāgarī echo is a design element, not a translation — always renders in
// Devanāgarī regardless of UI language, so it's hardcoded rather than pulled
// from the locale files.
const GREETING_DEVA: Record<'Morning' | 'Afternoon' | 'Evening', string> = {
  Morning: 'शुभ प्रभात',
  Afternoon: 'शुभ दोपहर',
  Evening: 'शुभ संध्या',
};

interface DateParts {
  weekday: string;
  day: string;
  month: string;
  year: string;
}

function getDateParts(lang: string): DateParts {
  const locale = lang === 'hi' ? 'hi-IN' : 'en-IN';
  const now = new Date();
  return {
    weekday: now.toLocaleDateString(locale, { weekday: 'long' }).toUpperCase(),
    day: now.toLocaleDateString(locale, { day: 'numeric' }),
    month: now.toLocaleDateString(locale, { month: 'long' }),
    year: now.getFullYear().toString(),
  };
}

function pickRandom<T>(arr: T[]): T | null {
  if (!arr.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function getActiveElement(elements: IPanchangElement[]): IPanchangElement | undefined {
  if (!elements.length) return undefined;
  const nowMs = Date.now();
  for (const el of elements) {
    if (!el.endTimeMs || el.endTimeMs > nowMs) return el;
  }
  return elements[elements.length - 1];
}

const DEVA_RE = /[\u0900-\u097F]/;

const DASHA_LORD_KEY: Record<DashaLord, string> = {
  Sun: 'sun', Moon: 'moon', Mars: 'mars', Mercury: 'mercury', Jupiter: 'jupiter',
  Venus: 'venus', Saturn: 'saturn', Rahu: 'rahu', Ketu: 'ketu',
};

function padTwo(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const isDarkMode = useStore(s => s.isDarkMode);
  const favoriteIds = useStore(s => s.favoriteIds);
  const userLocation = useStore(s => s.userLocation);
  const locationName = useStore(s => s.locationName);
  const language = useStore(s => s.language);
  const region = useStore(s => s.region);
  const userBirthDate = useStore(s => s.userBirthDate);
  const walkthroughStep = useStore(s => s.walkthroughStep);
  const setWalkthroughStep = useStore(s => s.setWalkthroughStep);
  const selectedDeities = useStore(s => s.selectedDeities);
  const colors = isDarkMode ? darkColors : lightColors;
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const [panchang, setPanchang] = useState<IPanchangDay | null>(null);
  const [panchangLoading, setPanchangLoading] = useState(true);
  const [featuredAarti, setFeaturedAarti] = useState<Recitation | null>(null);
  const [featuredAartiIndex, setFeaturedAartiIndex] = useState<number>(0);
  const [featuredAartiFromSelected, setFeaturedAartiFromSelected] = useState(false);
  const [featuredChalisa, setFeaturedChalisa] = useState<Chalisa | null>(null);
  const [featuredChalisaIndex, setFeaturedChalisaIndex] = useState<number>(0);
  const [featuredChalisaFromSelected, setFeaturedChalisaFromSelected] = useState(false);

  // ── Panchang — fetch + mid-day refresh ────────────────────────────────────
  const lastFetchRef = useRef(0);

  const panchangLang = resolveLanguage(language);
  const refreshPanchang = useCallback((showSpinner = false) => {
    const now = Date.now();
    if (!showSpinner && now - lastFetchRef.current < 3_600_000) return;
    lastFetchRef.current = now;
    if (showSpinner) setPanchangLoading(true);
    fetchPanchangForToday(userLocation, panchangLang, region)
      .then(p => { if (p) setPanchang(p); })
      .finally(() => setPanchangLoading(false));
  }, [userLocation, panchangLang, region]);

  useEffect(() => { refreshPanchang(true); }, [refreshPanchang]);
  useFocusEffect(useCallback(() => { refreshPanchang(); }, [refreshPanchang]));

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') refreshPanchang();
    });
    return () => sub.remove();
  }, [refreshPanchang]);

  // ── Featured Aarti / Chalisa ─────────────────────────────────────────────
  useEffect(() => {
    const allAartis = getAllAppAartis();
    const selected = new Set(selectedDeities);
    let pick: Recitation | null = null;
    let fromSelected = false;

    const favAartiSlugs = favoriteIds
      .filter(id => id.startsWith('aarti-'))
      .map(id => id.slice('aarti-'.length));
    if (favAartiSlugs.length > 0) {
      const favPool = allAartis.filter(a => favAartiSlugs.includes(a.deity));
      pick = pickRandom(favPool);
    }

    if (!pick && selected.size > 0) {
      const selectedPool = allAartis.filter(a => selected.has(a.deity));
      pick = pickRandom(selectedPool);
      if (pick) fromSelected = true;
    }

    if (!pick) pick = pickRandom(allAartis);

    setFeaturedAarti(pick);
    setFeaturedAartiIndex(pick ? allAartis.findIndex(a => a.deity === pick!.deity) + 1 : 0);
    setFeaturedAartiFromSelected(fromSelected);
  }, [favoriteIds, selectedDeities]);

  useEffect(() => {
    const allChalisas = getAllAppChalisas();
    const selected = new Set(selectedDeities);
    let pick: Chalisa | null = null;
    let fromSelected = false;

    if (selected.size > 0) {
      const selectedPool = allChalisas.filter(c => selected.has(c.deity));
      pick = pickRandom(selectedPool);
      if (pick) fromSelected = true;
    }

    if (!pick) pick = pickRandom(allChalisas);

    setFeaturedChalisa(pick);
    setFeaturedChalisaIndex(pick ? allChalisas.findIndex(c => c.deity === pick!.deity) + 1 : 0);
    setFeaturedChalisaFromSelected(fromSelected);
  }, [selectedDeities]);

  const greetingKey = useMemo(() => getGreetingKey(), []);
  const dateParts = useMemo(() => getDateParts(lang), [lang]);

  const selectedDeityMetas = useMemo(
    () => selectedDeities.map((id) => DEITY_BY_ID[id]).filter(Boolean),
    [selectedDeities]
  );

  // First verse of the featured aarti, for the card's verse-peek.
  const aartiVersePeek = useMemo(() => {
    if (!featuredAarti) return null;
    const lines = aartiVerses(featuredAarti, 'hi');
    return lines[0] ?? null;
  }, [featuredAarti]);

  // ── Dasha (Vimshottari) — current mahādaśā lord, if birth date set ────────
  const dashaLord = useMemo<DashaLord | null>(() => {
    if (!userBirthDate) return null;
    try {
      const birth = new Date(userBirthDate + 'T12:00:00');
      return computeVimshottariDashaFromBirth(birth, 'lahiri').currentMahaDashaLord;
    } catch {
      return null;
    }
  }, [userBirthDate]);

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
          <View style={styles.dateStack}>
            <Text variant="mono-caps" style={[styles.weekday, { color: colors.textMuted }]}>
              {dateParts.weekday}
            </Text>
            <View style={styles.dateMainRow}>
              <Text style={[styles.dateNum, { color: colors.emphasis }]}>
                {dateParts.day}
              </Text>
              <Text variant="display-italic" style={[styles.dateMonth, { color: colors.textPrimary }]}>
                {' '}{dateParts.month}{' '}
              </Text>
              <Text style={[styles.dateNum, { color: colors.emphasis }]}>
                {dateParts.year}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            ref={settingsBtnRef}
            onPress={() => router.push('/settings')}
            style={[styles.gear, { backgroundColor: colors.surface, borderColor: colors.border }]}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.openSettings')}>
            <Icon name="gear" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* ── Greeting ─────────────────────────────────────────────────── */}
        <View style={styles.greetingBlock}>
          <Text variant="display-italic" style={[styles.greeting, { color: colors.textPrimary }]}>
            {t(`home.greeting${greetingKey}`)}
          </Text>
          <Text variant="deva" style={[styles.greetingSub, { color: colors.textTertiary }]}>
            {GREETING_DEVA[greetingKey]}
          </Text>
        </View>

        {/* ── Panchang Hero ────────────────────────────────────────────── */}
        <TouchableOpacity
          ref={panchangCardRef}
          activeOpacity={0.88}
          onPress={() => router.push('/(tabs)/panchang')}
          style={styles.panchangWrap}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.openPanchang')}>
          <NightCard padding={20} mandalaSize={220} mandalaOpacity={0.09}>
            <View style={styles.phHead}>
              <View>
                <Kicker color={palette.goldLeaf} size={9.5}>
                  {t('home.panchangKicker')}
                </Kicker>
                <Text variant="deva-bold" style={styles.phTitle}>
                  {t('home.panchangTitleDeva')}
                </Text>
              </View>
              <View style={styles.locBadge}>
                <Icon name="location" size={10} color="rgba(243,229,200,0.7)" />
                <Text variant="mono-caps" style={styles.locText} numberOfLines={1}>
                  {locationName ?? (userLocation ? 'GPS' : 'Varanasi')}
                </Text>
              </View>
            </View>

            {panchangLoading ? (
              <HomePanchangSkeleton colors={colors} />
            ) : panchang ? (
              <>
                <View style={styles.phRows}>
                  <PanchangRow label={t('home.tithi')}     el={getActiveElement(panchang.tithis)} />
                  <PanchangRow label={t('home.nakshatra')} el={getActiveElement(panchang.nakshatras)} />
                  <PanchangRow label={t('home.yoga')}      el={getActiveElement(panchang.yogas)} />
                  <PanchangRow label={t('home.karana')}    el={getActiveElement(panchang.karanas)} last />
                </View>

                <Ornament variant="diamond" tone="dark" style={styles.phDivider} />

                <View style={styles.phSun}>
                  <SunItem
                    icon="sun"
                    label={t('home.sunrise')}
                    value={panchang.sunrise}
                  />
                  <View style={styles.phSunSep} />
                  <SunItem
                    icon="moon"
                    label={t('home.sunset')}
                    value={panchang.sunset}
                  />
                </View>
              </>
            ) : (
              <Text variant="body-italic" style={styles.errorText}>
                {t('home.couldNotLoadPanchang')}
              </Text>
            )}
          </NightCard>
        </TouchableOpacity>

        {/* ── Your Deities strip ────────────────────────────────────────── */}
        {selectedDeityMetas.length > 0 && (
          <View style={styles.block}>
            <View style={styles.sectionHeader}>
              <SectionLabel>{t('home.yourDeities')}</SectionLabel>
              <TouchableOpacity
                onPress={() => router.push('/settings/deities')}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                accessibilityRole="button"
                accessibilityLabel={t('home.yourDeitiesManage')}>
                <Text variant="body-italic" style={[styles.sectionAction, { color: colors.emphasis }]}>
                  {t('home.yourDeitiesManage')}  →
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.deitiesScroll}>
              {selectedDeityMetas.map((deity) => (
                <TouchableOpacity
                  key={deity.id}
                  activeOpacity={0.85}
                  onPress={() => router.push(`/god/${deity.id}`)}
                  style={styles.deityChip}
                  accessibilityRole="button"
                  accessibilityLabel={t('a11y.openDeity', { name: t(`deities.${deity.id}.displayName`) })}>
                  <DeityAvatar deity={deity.id} size={54} />
                  <Text
                    variant="body-italic"
                    style={[styles.deityName, { color: colors.textSecondary }]}
                    numberOfLines={1}>
                    {t(`deities.${deity.id}.displayName`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Featured Aarti ────────────────────────────────────────────── */}
        {featuredAarti && (
          <View style={styles.block}>
            <View style={styles.sectionHeader}>
              <SectionLabel>
                {favoriteIds.some((id) => id.startsWith('aarti-'))
                  ? t('home.fromYourFavourites')
                  : featuredAartiFromSelected
                    ? t('home.forYourDeities')
                    : t('home.featuredKicker')}
              </SectionLabel>
            </View>

            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => router.push(`/aarti/${featuredAarti.deity}`)}
              style={[styles.featCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel={`${featuredAarti.titleEnglish} — ${t('a11y.openAarti')}`}>
              <View style={styles.cornerMark}>
                <Kicker color={palette.gold} size={8.5}>
                  Aarti № {padTwo(featuredAartiIndex)}
                </Kicker>
              </View>
              <View style={styles.featRow}>
                <DeityAvatar deity={featuredAarti.deity} size={58} />
                <View style={styles.featBody}>
                  <Text variant="deva-bold" style={[styles.featHiTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                    {featuredAarti.titleHindi}
                  </Text>
                  <Text variant="body-italic" style={[styles.featEnTitle, { color: colors.textTertiary }]} numberOfLines={1}>
                    {featuredAarti.titleEnglish}
                  </Text>
                  <Text variant="mono-caps" style={[styles.featMeta, { color: colors.accent }]} numberOfLines={1}>
                    {t(`deities.${featuredAarti.deity}.displayName`)}
                  </Text>
                </View>
                <Icon name="chevron-right" size={18} color={colors.textMuted} />
              </View>
              {aartiVersePeek && (
                <>
                  <Ornament variant="double-rule" style={styles.versePeekRule} />
                  <Text variant="deva" style={[styles.versePeek, { color: colors.textSecondary }]} numberOfLines={2}>
                    {aartiVersePeek}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* ── Featured Chalisa ─────────────────────────────────────────── */}
        {featuredChalisa && (
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => router.push(`/chalisa/${featuredChalisa.deity}`)}
            style={[styles.featCard, styles.featCardSecondary, { backgroundColor: colors.surface, borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel={`${featuredChalisa.titleEnglish} — ${t('a11y.openChalisa')}`}>
            <View style={styles.cornerMark}>
              <Kicker color={palette.gold} size={8.5}>
                Chalisa № {padTwo(featuredChalisaIndex)}
              </Kicker>
            </View>
            <View style={styles.featRow}>
              <DeityAvatar deity={featuredChalisa.deity} size={58} />
              <View style={styles.featBody}>
                <Text variant="deva-bold" style={[styles.featHiTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                  {featuredChalisa.titleHindi}
                </Text>
                <Text variant="body-italic" style={[styles.featEnTitle, { color: colors.textTertiary }]} numberOfLines={1}>
                  {featuredChalisa.titleEnglish}
                </Text>
                <Text variant="mono-caps" style={[styles.featMeta, { color: colors.accent }]}>
                  {featuredChalisaFromSelected ? t('home.forYourDeities') : t('home.featuredChalisa')}
                </Text>
              </View>
              <Icon name="chevron-right" size={18} color={colors.textMuted} />
            </View>
          </TouchableOpacity>
        )}

        {/* ── Dasha Callout ─────────────────────────────────────────────── */}
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => router.push('/dasha')}
          style={styles.calloutWrap}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.openDasha')}>
          <LinearGradient
            colors={['rgba(165,48,28,0.10)', 'rgba(156,118,35,0.10)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.callout}>
            <View style={[styles.calloutIcon, { backgroundColor: colors.surface, borderColor: colors.borderAccent }]}>
              <Icon name="clock" size={18} color={colors.accent} />
            </View>
            <View style={styles.calloutStack}>
              <Text variant="mono-caps" style={[styles.calloutKicker, { color: colors.accent }]}>
                {t('dasha.title')}
              </Text>
              {dashaLord ? (
                <Text variant="body-italic" style={[styles.calloutBody, { color: colors.textPrimary }]}>
                  {t('home.dashaCurrentBody', { planet: t(`dasha.planet.${DASHA_LORD_KEY[dashaLord]}`) })}
                </Text>
              ) : (
                <Text variant="body-italic" style={[styles.calloutBody, { color: colors.textSecondary }]} numberOfLines={2}>
                  {t('home.setDashaPrompt')}
                </Text>
              )}
            </View>
            <Icon name="chevron-right" size={18} color={colors.textTertiary} />
          </LinearGradient>
        </TouchableOpacity>

        {/* ── Quick Row ─────────────────────────────────────────────────── */}
        <View style={styles.quickRow}>
          <QuickCard icon="heart-outline" label={t('home.favorites')}  onPress={() => router.push('/favorites')} colors={colors} />
          <QuickCard icon="flame" label={t('home.festivals')} onPress={() => router.push('/festivals')} colors={colors} />
          <QuickCard icon="search" label={t('common.search')} onPress={() => router.push('/search')} colors={colors} />
        </View>

        {/* ── Find Auspicious Date ──────────────────────────────────────── */}
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => router.push('/muhurat')}
          style={[styles.muhuratCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.openMuhuratFinder')}>
          <View style={[styles.muhuratIc, { backgroundColor: colors.surfaceRecessed, borderColor: colors.borderAccent }]}>
            <Icon name="calendar" size={18} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="mono-caps" style={[styles.muhuratKicker, { color: colors.accent }]}>
              {t('home.findMuhuratTitle')}
            </Text>
            <Text variant="body-italic" style={[styles.muhuratDesc, { color: colors.textTertiary }]} numberOfLines={2}>
              {t('home.findMuhuratDesc')}
            </Text>
          </View>
          <Icon name="chevron-right" size={16} color={colors.textMuted} />
        </TouchableOpacity>

      </ScrollView>

      <AdBanner colors={colors} placement="home" />

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
        />
      )}

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
        />
      )}

    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface PanchangRowProps {
  label: string;
  el: IPanchangElement | undefined;
  last?: boolean;
}

const PanchangRow = memo(function PanchangRow({ label, el, last }: PanchangRowProps) {
  const { t } = useTranslation();
  if (!el) return null;
  const isDeva = DEVA_RE.test(el.name);
  return (
    <View style={[styles.phRow, last && styles.phRowLast]}>
      <Text variant="mono-caps" style={styles.phLbl}>{label}</Text>
      <Text
        variant={isDeva ? 'deva' : 'body-italic'}
        style={styles.phVal}
        numberOfLines={1}>
        {el.name}
      </Text>
      {el.endTime ? (
        <Text variant="mono" style={styles.phTime}>
          {t('home.untilTime', { time: el.endTime })}
        </Text>
      ) : (
        <View />
      )}
    </View>
  );
});

interface SunItemProps {
  icon: IconName;
  label: string;
  value: string;
}

const SunItem = memo(function SunItem({ icon, label, value }: SunItemProps) {
  return (
    <View style={styles.phSunItem}>
      <View style={styles.phSunIc}>
        <Icon name={icon} size={13} color={palette.goldLeaf} />
      </View>
      <View>
        <Text variant="mono-caps" style={styles.phSunK}>{label}</Text>
        <Text variant="mono" style={styles.phSunV}>{value}</Text>
      </View>
    </View>
  );
});

interface QuickCardProps {
  icon: IconName;
  label: string;
  onPress: () => void;
  colors: ColorPalette;
}

const QuickCard = memo(function QuickCard({ icon, label, onPress, colors }: QuickCardProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.quickCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityRole="button"
      accessibilityLabel={label}>
      <Icon name={icon} size={20} color={colors.accent} />
      <Text variant="body-italic" style={[styles.quickLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const DARK_BONE_TEXT = 'rgba(243,229,200,0.72)';

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingBottom: 32, paddingTop: 10 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  dateStack: { flex: 1 },
  weekday: { fontSize: 10 },
  dateMainRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
  },
  dateNum: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 22,
    letterSpacing: 0.2,
  },
  dateMonth: {
    fontSize: 22,
  },
  gear: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Greeting
  greetingBlock: { marginTop: 8, marginBottom: 20 },
  greeting: { fontSize: 34, lineHeight: 38 },
  greetingSub: { fontSize: 15, marginTop: 6 },

  // Panchang hero
  panchangWrap: { marginBottom: 18 },
  phHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  phTitle: {
    fontSize: 18,
    color: palette.boneWhite,
    marginTop: 4,
  },
  locBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: 'rgba(201,155,58,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    maxWidth: 140,
  },
  locText: {
    fontSize: 10,
    color: 'rgba(243,229,200,0.88)',
  },
  phRows: { marginTop: 2 },
  phRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(201,155,58,0.16)',
  },
  phRowLast: { borderBottomWidth: 0 },
  phLbl: {
    width: 78,
    fontSize: 9.5,
    color: DARK_BONE_TEXT,
  },
  phVal: {
    flex: 1,
    fontSize: 15,
    color: palette.boneWhite,
  },
  phTime: {
    fontSize: 11,
    color: palette.goldLeaf,
    marginLeft: 8,
  },
  phDivider: { marginVertical: 10 },
  phSun: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 4,
  },
  phSunItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  phSunIc: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(217,106,40,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phSunK: { fontSize: 9, color: DARK_BONE_TEXT },
  phSunV: { fontSize: 13, color: palette.boneWhite, marginTop: 2 },
  phSunSep: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: 'rgba(201,155,58,0.28)',
    marginHorizontal: 12,
  },
  errorText: {
    fontSize: 13,
    color: DARK_BONE_TEXT,
    textAlign: 'center',
    paddingVertical: 16,
  },

  // Generic block + section header
  block: { marginBottom: 18 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionAction: { fontSize: 12 },

  // Deities strip
  deitiesScroll: { gap: 14, paddingRight: 4, paddingBottom: 4 },
  deityChip: { alignItems: 'center', width: 64, gap: 7 },
  deityName: { fontSize: 11, textAlign: 'center' },

  // Featured card
  featCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  featCardSecondary: {
    marginBottom: 18,
  },
  cornerMark: {
    position: 'absolute',
    top: 10,
    right: 14,
    zIndex: 2,
  },
  featRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  featBody: { flex: 1, minWidth: 0 },
  featHiTitle: { fontSize: 18 },
  featEnTitle: { fontSize: 12.5, marginTop: 2 },
  featMeta: { fontSize: 9, marginTop: 6 },
  versePeekRule: { marginTop: 14, marginBottom: 10 },
  versePeek: {
    fontSize: 13.5,
    lineHeight: 20,
    fontStyle: 'italic',
  },

  // Callout
  calloutWrap: { marginBottom: 16 },
  callout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(165,48,28,0.22)',
  },
  calloutIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  calloutStack: { flex: 1 },
  calloutKicker: { fontSize: 9.5, marginBottom: 3 },
  calloutBody: { fontSize: 14 },

  // Quick row
  quickRow: { flexDirection: 'row', gap: spacing.gridGap, marginBottom: 16 },
  quickCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 6,
  },
  quickLabel: { fontSize: 12 },

  // Muhurat card
  muhuratCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: borderRadius.card,
    borderWidth: 1,
    padding: 14,
  },
  muhuratIc: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muhuratKicker: { fontSize: 9.5, marginBottom: 3 },
  muhuratDesc: { fontSize: 12.5, lineHeight: 17 },
});
