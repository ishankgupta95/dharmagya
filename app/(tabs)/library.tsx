import { useState, useCallback, useRef, useMemo, memo } from 'react';
import {
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  type ListRenderItemInfo,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Icon } from '@/components/common/Icon';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import {
  darkColors,
  lightColors,
  palette,
  spacing,
  typeScale,
  type ColorPalette,
} from '@/config/theme';
import { Ornament } from '@/components/common/Ornament';
import { ScreenMount } from '@/components/common/ScreenMount';
import { AdBanner } from '@/components/common/AdBanner';
import { WalkthroughSpotlight, type SpotlightRect } from '@/components/common/WalkthroughOverlay';
import { ALL_DEITIES, type DeityMeta } from '@/config/deities';
import { getDeityImage } from '@/config/deityImages';
import { getAllAppAartis, getAllAppChalisas } from '@/services/content';

// ─── Content counts (computed once at module load) ──────────────────────────
// Cards show "X aartis · Y chālīsā" — costs nothing to precompute since both
// listings are already filtered to the in-app roster.

const COUNTS: Record<string, { aartis: number; chalisas: number }> = (() => {
  const acc: Record<string, { aartis: number; chalisas: number }> = {};
  for (const a of getAllAppAartis()) {
    const c = (acc[a.deity] ??= { aartis: 0, chalisas: 0 });
    c.aartis += 1;
  }
  for (const c of getAllAppChalisas()) {
    const e = (acc[c.deity] ??= { aartis: 0, chalisas: 0 });
    e.chalisas += 1;
  }
  return acc;
})();

const COLUMN_GAP = 10;

export default function LibraryScreen() {
  const isDarkMode = useStore(s => s.isDarkMode);
  const walkthroughStep = useStore(s => s.walkthroughStep);
  const setWalkthroughStep = useStore(s => s.setWalkthroughStep);
  const colors = isDarkMode ? darkColors : lightColors;
  const { t } = useTranslation();

  const [query, setQuery] = useState('');

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

  const filteredDeities = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ALL_DEITIES;
    return ALL_DEITIES.filter(d => {
      const tagline = (t(`deities.${d.id}.description`) as string).toLowerCase();
      const display = (t(`deities.${d.id}.displayName`) as string).toLowerCase();
      return (
        d.name.toLowerCase().includes(q) ||
        d.nameHindi.includes(q) ||
        display.includes(q) ||
        tagline.includes(q)
      );
    });
  }, [query, t]);

  const renderDeity = useCallback(
    ({ item }: ListRenderItemInfo<DeityMeta>) => (
      <View style={styles.cardCell}>
        <DeityCard deity={item} colors={colors} />
      </View>
    ),
    [colors]
  );

  return (
    <ScreenMount>
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top']}>

      <FlatList
        data={filteredDeities}
        keyExtractor={(item) => item.id}
        renderItem={renderDeity}
        numColumns={2}
        contentContainerStyle={[styles.listContent, { paddingHorizontal: spacing.screenH }]}
        columnWrapperStyle={styles.columnWrapper}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View ref={deityGridRef} collapsable={false}>
            {/* Hero */}
            <View style={styles.hero}>
              <Text
                variant="display-italic"
                style={[styles.heroTitle, { color: colors.textPrimary }]}>
                {t('library.godsTitle')}
              </Text>
            </View>

            {/* Search */}
            <View
              style={[
                styles.searchBar,
                { backgroundColor: colors.surface, borderColor: colors.borderAccent },
              ]}>
              <Icon name="search" size={16} color={colors.textTertiary} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t('library.searchPlaceholder') as string}
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.searchInput,
                  { color: colors.textPrimary, ...typeScale.bodyItalic },
                ]}
                returnKeyType="search"
                autoCorrect={false}
              />
              {query.length > 0 && (
                <TouchableOpacity
                  onPress={() => setQuery('')}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={t('a11y.clearSearch')}>
                  <Icon name="close-circle" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyOrnament}>
              <Ornament variant="lotus" color={colors.emphasis} size={14} />
            </View>
            <Text
              variant="body-italic"
              style={[styles.emptyText, { color: colors.textTertiary }]}>
              {t('library.emptyForQuery', { query: query.trim() })}
            </Text>
          </View>
        }
        ListFooterComponent={<AdBanner colors={colors} placement="libraryGodsInline" inline />}
      />

      {walkthroughStep === 3 && deityGridRect && (
        <WalkthroughSpotlight
          spotlight={deityGridRect}
          title={t('walkthrough.step3Title')}
          description={t('walkthrough.step3Desc')}
          tooltipPosition="below"
          stepIndex={2}
          totalSteps={4}
          onNext={() => {
            setWalkthroughStep(4);
            router.push('/(tabs)');
          }}
          onSkip={() => setWalkthroughStep(0)}
        />
      )}
    </SafeAreaView>
    </ScreenMount>
  );
}

// ─── Deity card ─────────────────────────────────────────────────────────────

interface DeityCardProps {
  deity: DeityMeta;
  colors: ColorPalette;
}

const DeityCard = memo(function DeityCard({ deity, colors }: DeityCardProps) {
  const { t, i18n } = useTranslation();
  const counts = COUNTS[deity.id] ?? { aartis: 0, chalisas: 0 };
  const image = getDeityImage(deity.id);

  // Solid-fill gradient is the fallback when no image is available; with an
  // image we layer a soft top-down deity-coloured tint to bind the photo to
  // the deity's brand colour and keep the halo legible against busy crops.
  const gradientColors = useMemo(
    () =>
      image
        ? [`${deity.color}00`, `${deity.color}66`] as const
        : [`${deity.color}E6`, `${deity.color}55`] as const,
    [deity.color, image]
  );

  const pillText = useMemo(() => {
    const parts: string[] = [];
    if (counts.aartis > 0) parts.push(t('library.countAartis', { count: counts.aartis }));
    if (counts.chalisas > 0) parts.push(t('library.countChalisas', { count: counts.chalisas }));
    if (parts.length === 0) parts.push(t('library.countNone') as string);
    return parts.join(' · ');
  }, [counts.aartis, counts.chalisas, t]);

  const tagline = t(`deities.${deity.id}.description`) as string;
  const isHindi = i18n.language?.startsWith('hi');

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={() => router.push(`/god/${deity.id}`)}
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.borderAccent },
      ]}
      accessibilityRole="button"
      accessibilityLabel={t('a11y.openDeity', { name: t(`deities.${deity.id}.displayName`) })}>

      <View style={[styles.portrait, !image && { backgroundColor: deity.color + '22' }]}>
        {image && (
          <Image source={image} style={styles.portraitImage} resizeMode="cover" />
        )}
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={styles.haloOuter} pointerEvents="none" />
        <View style={styles.haloInner} pointerEvents="none" />
        {!image && (
          <Text variant="deva-bold" style={styles.portraitInitial}>
            {deity.initial}
          </Text>
        )}
      </View>

      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
          {t(`deities.${deity.id}.displayName`)}
        </Text>
        <Text
          variant={isHindi ? 'deva' : 'body-italic'}
          style={[styles.tagline, { color: colors.textTertiary }]}
          numberOfLines={2}>
          {tagline}
        </Text>
        <Text
          variant="mono-caps"
          style={[styles.pill, { color: palette.gold }]}
          numberOfLines={1}>
          {pillText}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1 },

  listContent: { paddingTop: 4, paddingBottom: 32 },
  columnWrapper: { gap: COLUMN_GAP, marginBottom: COLUMN_GAP },

  // Hero
  hero: {
    paddingTop: 6,
    paddingBottom: 16,
  },
  heroTitle: {
    fontSize: 34,
    lineHeight: 40,
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    padding: 0,
  },

  // Cards
  cardCell: { flex: 1, maxWidth: '50%' },
  card: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  portrait: {
    height: 132,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 10,
    position: 'relative',
    overflow: 'hidden',
  },
  portraitImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  haloInner: {
    position: 'absolute',
    top: 8,
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: 'rgba(251,243,222,0.40)',
  },
  haloOuter: {
    position: 'absolute',
    top: 4,
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(251,243,222,0.28)',
  },
  portraitInitial: {
    fontSize: 38,
    lineHeight: 44,
    color: palette.parchmentBright,
    textShadowColor: 'rgba(20,10,4,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },

  info: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 4,
  },
  name: {
    ...typeScale.bodySerif,
    fontSize: 16,
    lineHeight: 20,
  },
  tagline: {
    fontSize: 11.5,
    lineHeight: 15,
  },
  pill: {
    fontSize: 8.5,
    marginTop: 4,
  },

  emptyState: {
    paddingTop: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 14,
  },
  emptyOrnament: {
    width: 120,
  },
  emptyText: {
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
  },
});
