import { useState, useCallback, useRef, useMemo } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { MotionPressable } from '@/components/common/MotionPressable';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useIsFocused } from 'expo-router';
import { Icon, type IconName } from '@/components/common/Icon';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import {
  darkColors,
  lightColors,
  spacing,
  borderRadius,
  type ColorPalette,
} from '@/config/theme';
import { ScreenMount } from '@/components/common/ScreenMount';
import { AdBanner } from '@/components/common/AdBanner';
import { WalkthroughSpotlight, type SpotlightRect } from '@/components/common/WalkthroughOverlay';
import { getVaarDevataForDate } from '@/config/vaarDevata';
import { ALL_DEITIES } from '@/config/deities';
import { getDeityImageSmall } from '@/config/deityImages';
import {
  getAartiForDeity,
  getChalisaForDeity,
  getAllAppAartis,
  getAllAppChalisas,
  aartiVerses,
  chalisaSections,
  titleFor,
} from '@/services/content';
import { resolveLanguage } from '@/i18n';

/**
 * Library — Diya frame 06: resume first, deities second, collections as a
 * plain grouped list. Buckets are unchanged from P16.5 (Read / Rituals &
 * Festivals / Your Practice); the chrome is the Diya list card.
 */

const GRID_DEITIES = ALL_DEITIES.slice(0, 4);

export default function LibraryScreen() {
  const isDarkMode = useStore(s => s.isDarkMode);
  const walkthroughStep = useStore(s => s.walkthroughStep);
  const setWalkthroughStep = useStore(s => s.setWalkthroughStep);
  const colors = isDarkMode ? darkColors : lightColors;
  const { t } = useTranslation();

  // NativeTabs has no lazy/freeze gate (see `app/(tabs)/_layout.tsx`), so this
  // tab mounts on cold start alongside Home — and its body is the widest tree
  // in the app: three grouped list cards (16 rows, two icons each), four
  // deity tiles and the resume lookup, all built inside the commit that paints
  // Home. Holding the body back until the tab is first focused moves that off
  // the launch frame. Only the body is gated: the screen chrome and its title
  // stay outside, so the tab is never blank if it is tapped on the first
  // frame. One-way latch, so switching away and back tears nothing down.
  const isFocused = useIsFocused();
  const [hasBeenFocused, setHasBeenFocused] = useState(isFocused);
  if (isFocused && !hasBeenFocused) setHasBeenFocused(true);

  // Walkthrough step 3 spotlights the Deities section. The ref is handed down
  // to the body; the measure fires 300ms after focus, by which point the latch
  // above has already mounted the grid it measures.
  const deityGridRef = useRef<View>(null);
  const [deityGridRect, setDeityGridRect] = useState<SpotlightRect | null>(null);

  const measureDeityGrid = useCallback(() => {
    deityGridRef.current?.measureInWindow((x, y, width, height) => {
      if (width > 0) {
        setDeityGridRect({ x, y, width, height: Math.min(height, 260) });
      }
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (walkthroughStep === 3) {
        const timer = setTimeout(measureDeityGrid, 300);
        return () => clearTimeout(timer);
      }
    }, [walkthroughStep, measureDeityGrid])
  );

  return (
    <ScreenMount>
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top']}>
      <ScrollView
        // iOS: explicit rather than relying on react-native-screens finding this
        // as the first ScrollView in the tab screen's first-descendant chain
        // (it does today) — keeps the content clear of the floating tab bar
        // even if something is ever rendered before it. Android ignores it.
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
        showsVerticalScrollIndicator={false}>

        {/* ── Title ─────────────────────────────────────────────────────── */}
        <Text variant="display" style={[styles.heroTitle, { color: colors.textPrimary }]}>
          {t('library.title')}
        </Text>

        {hasBeenFocused && (
          <LibraryBody colors={colors} isDarkMode={isDarkMode} deityGridRef={deityGridRef} />
        )}

      </ScrollView>

      <AdBanner colors={colors} placement="libraryGodsInline" aboveTabBar />

      {walkthroughStep === 3 && deityGridRect && (
        <WalkthroughSpotlight
          spotlight={deityGridRect}
          title={t('walkthrough.step3Title')}
          description={t('walkthrough.step3Desc')}
          tooltipPosition="below"
          stepIndex={2}
          totalSteps={3}
          onNext={() => {
            setWalkthroughStep(0);
            router.push('/(tabs)');
          }}
          onSkip={() => setWalkthroughStep(0)}
        />
      )}
    </SafeAreaView>
    </ScreenMount>
  );
}

// ─── Body — everything below the title, mounted on first focus ───────────────

interface LibraryBodyProps {
  colors: ColorPalette;
  isDarkMode: boolean;
  deityGridRef: React.RefObject<View | null>;
}

function LibraryBody({ colors, isDarkMode, deityGridRef }: LibraryBodyProps) {
  const selectedDeities = useStore(s => s.selectedDeities);
  const lastReadKey = useStore(s => s.lastReadKey);
  const readingPositions = useStore(s => s.readingPositions);
  const appLanguage = useStore(s => s.language);
  const { t } = useTranslation();
  const contentLang = resolveLanguage(appLanguage);

  const vaar = useMemo(() => getVaarDevataForDate(new Date()), []);

  // ── Continue card — resolves the most recent reader position ─────────────
  const resume = useMemo(() => {
    if (!lastReadKey) return null;
    const [kind, ...rest] = lastReadKey.split('-');
    const slug = rest.join('-');
    const index = readingPositions[lastReadKey] ?? 0;
    if (kind === 'aarti') {
      const a = getAartiForDeity(slug);
      if (!a) return null;
      return {
        title: titleFor(a, contentLang),
        num: index + 1,
        total: aartiVerses(a, contentLang).length,
        go: () => router.push({ pathname: '/aarti/[id]', params: { id: slug } }),
      };
    }
    if (kind === 'chalisa') {
      const c = getChalisaForDeity(slug);
      if (!c) return null;
      const total = chalisaSections(c, contentLang).reduce((n, s) => n + s.verses.length, 0);
      return {
        title: titleFor(c, contentLang),
        num: index + 1,
        total,
        go: () => router.push({ pathname: '/chalisa/[id]', params: { id: slug } }),
      };
    }
    return null;
  }, [lastReadKey, readingPositions, contentLang]);

  const aartiCount = useMemo(() => getAllAppAartis().length, []);
  const chalisaCount = useMemo(() => getAllAppChalisas().length, []);

  const manageDeitiesSub =
    selectedDeities.length > 0
      ? t('settings.manageDeitiesCount', { count: selectedDeities.length })
      : t('settings.manageDeitiesNone');

  return (
    <>
    {/* ── Search field → /search ────────────────────────────────────── */}
    <MotionPressable
      onPress={() => router.push('/search')}
      pressedScale={0.98}
      style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityRole="button"
      accessibilityLabel={t('search.placeholder')}>
      <Icon name="search" size={17} color={colors.textMuted} />
      <Text
        variant="body"
        style={[styles.searchPlaceholder, { color: colors.textMuted }]}
        numberOfLines={1}>
        {t('search.placeholder')}
      </Text>
    </MotionPressable>

    {/* ── Continue reading ──────────────────────────────────────────── */}
    {resume && (
      <MotionPressable
        onPress={resume.go}
        pressedScale={0.98}
        accessibilityRole="button"
        accessibilityLabel={`${t('library.continueKicker')} · ${resume.title}`}>
        <LinearGradient
          colors={
            isDarkMode
              ? ['rgba(216,163,26,0.13)', 'rgba(255,255,255,0.03)']
              : [colors.accentSurface, colors.surface]
          }
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={[styles.resumeCard, { borderColor: colors.borderAccent }]}>
          <View style={[styles.resumeIcon, { backgroundColor: colors.accentSurface, borderColor: colors.borderAccent }]}>
            <Icon name="text" size={20} color={colors.accent} />
          </View>
          <View style={styles.resumeBody}>
            <Text variant="kicker" style={[styles.resumeKicker, { color: colors.textMuted }]}>
              {t('library.continueKicker')}
            </Text>
            <Text variant="deva-bold" style={[styles.resumeTitle, { color: colors.textPrimary }]} numberOfLines={1}>
              {resume.title}
            </Text>
            <Text variant="body-small" style={[styles.resumeMeta, { color: colors.textMuted }]}>
              {t('library.continueVerse', { num: resume.num, total: resume.total })}
            </Text>
          </View>
          <Icon name="chevron-right" size={16} color={colors.textMuted} />
        </LinearGradient>
      </MotionPressable>
    )}

    {/* ── Deities — portrait tiles + "All N" ────────────────────────── */}
    <View ref={deityGridRef} collapsable={false}>
      <View style={styles.sectionHead}>
        <Text variant="kicker" style={[styles.sectionKicker, { color: colors.textMuted }]}>
          {t('library.bucketDeities')}
        </Text>
        <MotionPressable
          onPress={() => router.push('/gods')}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('library.allGodsTitle')}>
          <Text variant="body" style={[styles.sectionLink, { color: colors.accentText }]}>
            {t('library.allCount', { count: ALL_DEITIES.length })}
          </Text>
        </MotionPressable>
      </View>
      <View style={styles.deityGrid}>
        {GRID_DEITIES.map((d) => {
          const src = getDeityImageSmall(d.id);
          return (
            <MotionPressable
              key={d.id}
              onPress={() => router.push({ pathname: '/god/[id]', params: { id: d.id } })}
              pressedScale={0.96}
              style={styles.deityCell}
              accessibilityRole="button"
              accessibilityLabel={t(`deities.${d.id}.displayName`)}>
              <View style={[styles.deityTile, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
                {src && (
                  <Image
                    source={src}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={150}
                    cachePolicy="memory-disk"
                  />
                )}
                <LinearGradient
                  colors={['rgba(11,8,16,0)', 'rgba(11,8,16,0.55)']}
                  start={{ x: 0.5, y: 0.45 }}
                  end={{ x: 0.5, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              </View>
              <Text variant="body-small" style={[styles.deityName, { color: colors.textSecondary }]} numberOfLines={1}>
                {t(`deities.${d.id}.displayName`)}
              </Text>
            </MotionPressable>
          );
        })}
      </View>
    </View>

    {/* ── Read ──────────────────────────────────────────────────────── */}
    <Text variant="kicker" style={[styles.sectionKicker, styles.bucketLabel, { color: colors.textMuted }]}>
      {t('library.bucketRead')}
    </Text>
    <ListCard colors={colors} rows={[
      { icon: 'flame',  title: t('library.allAartis.title'),   count: aartiCount,   go: () => router.push('/aarti') },
      { icon: 'text',   title: t('library.allChalisas.title'), count: chalisaCount, go: () => router.push('/chalisa') },
      { icon: 'school', title: t('texts.scriptures.title'),    go: () => router.push('/scripture') },
      { icon: 'star',   title: t('texts.stotras.title'),       go: () => router.push('/stotra') },
      { icon: 'lotus',  title: t('texts.sahasranama.title'),   go: () => router.push('/sahasranama') },
      { icon: 'flower', title: t('texts.suktas.title'),        go: () => router.push('/sukta') },
      { icon: 'text',   title: t('texts.kathas.title'),        go: () => router.push('/katha') },
      { icon: 'hand',   title: t('practice.prayers.title'),    go: () => router.push('/prayers') },
    ]} />

    {/* ── Rituals & Festivals ───────────────────────────────────────── */}
    <Text variant="kicker" style={[styles.sectionKicker, styles.bucketLabel, { color: colors.textMuted }]}>
      {t('library.bucketRituals')}
    </Text>
    <ListCard colors={colors} rows={[
      { icon: 'gift',     title: t('practice.pujaVidhi.title'), go: () => router.push('/pooja') },
      { icon: 'calendar', title: t('practice.festivals.title'), go: () => router.push('/festivals') },
      { icon: 'flame',    title: t('practice.navratri.title'),  go: () => router.push('/navratri') },
      { icon: 'sun',      title: t('practice.vaar.title'),      go: () => router.push({ pathname: '/vaar/[day]', params: { day: vaar.dayKey } }) },
      { icon: 'map',      title: t('practice.tirtha.title'),    go: () => router.push('/tirtha') },
    ]} />

    {/* ── Your Practice ─────────────────────────────────────────────── */}
    <Text variant="kicker" style={[styles.sectionKicker, styles.bucketLabel, { color: colors.textMuted }]}>
      {t('library.bucketPractice')}
    </Text>
    <ListCard colors={colors} rows={[
      { icon: 'circle-outline', title: t('jaap.title'),             go: () => router.push('/jaap') },
      { icon: 'flower',         title: t('settings.manageDeities'), caption: manageDeitiesSub, go: () => router.push('/settings/deities') },
      { icon: 'heart',          title: t('favorites.title'),        go: () => router.push('/favorites') },
    ]} />
    </>
  );
}

// ─── Grouped list card ───────────────────────────────────────────────────────

interface ListRow {
  icon: IconName;
  title: string;
  caption?: string;
  count?: number;
  go: () => void;
}

function ListCard({ rows, colors }: { rows: ListRow[]; colors: ColorPalette }) {
  return (
    <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {rows.map((row, i) => (
        <View key={row.title}>
          {i > 0 && <View style={[styles.rowDivider, { backgroundColor: colors.divider }]} />}
          <MotionPressable
            onPress={row.go}
            pressedScale={0.98}
            style={styles.row}
            accessibilityRole="button"
            accessibilityLabel={row.title}>
            <Icon name={row.icon} size={19} color={colors.accent} />
            <View style={styles.rowText}>
              <Text variant="body" style={[styles.rowTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                {row.title}
              </Text>
              {!!row.caption && (
                <Text variant="body-small" style={[styles.rowCaption, { color: colors.textMuted }]} numberOfLines={1}>
                  {row.caption}
                </Text>
              )}
            </View>
            {row.count !== undefined && (
              <Text variant="mono" style={[styles.rowCount, { color: colors.textMuted }]}>{row.count}</Text>
            )}
            <Icon name="chevron-right" size={15} color={colors.textDisabled} />
          </MotionPressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  scroll: { paddingTop: 10, paddingBottom: 32 },

  heroTitle: { fontSize: 30, lineHeight: 36, marginBottom: 14 },

  // Search field
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 13,
    borderWidth: 1,
    marginBottom: 16,
  },
  searchPlaceholder: { flex: 1, fontSize: 15 },

  // Continue card
  resumeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: borderRadius.card,
    borderWidth: 1,
    paddingVertical: 15,
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  resumeIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumeBody: { flex: 1 },
  resumeKicker: { fontSize: 10 },
  resumeTitle: { fontSize: 17, lineHeight: 24, marginTop: 2 },
  resumeMeta: { fontSize: 12, marginTop: 2 },

  // Sections
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionKicker: { fontSize: 9.5 },
  sectionLink: { fontSize: 12.5 },
  bucketLabel: { marginTop: 22, marginBottom: 12 },

  // Deity tiles
  deityGrid: { flexDirection: 'row', gap: 10 },
  deityCell: { flex: 1, alignItems: 'center', gap: 7 },
  deityTile: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: borderRadius.tile,
    borderWidth: 1,
    overflow: 'hidden',
  },
  deityName: { fontSize: 11.5 },

  // Grouped list card
  listCard: {
    borderRadius: borderRadius.list,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 15,
    paddingHorizontal: 18,
  },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 15, lineHeight: 21 },
  rowCaption: { fontSize: 12, marginTop: 1 },
  rowCount: { fontSize: 13 },
  rowDivider: { height: StyleSheet.hairlineWidth, marginLeft: 50 },
});
