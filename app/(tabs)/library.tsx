import { useState, useCallback, useEffect, useRef, memo } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  ListRenderItemInfo,
} from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, spacing, type ColorPalette } from '@/config/theme';
import { DeityAvatar } from '@/components/common/DeityAvatar';
import { getDeityImage } from '@/config/deityImages';
import { AdBanner } from '@/components/common/AdBanner';
import { WalkthroughSpotlight, type SpotlightRect } from '@/components/common/WalkthroughOverlay';
import { ALL_DEITIES, type DeityMeta } from '@/config/deities';

// ─── Types ───────────────────────────────────────────────────────────────────

type Segment = 'gods' | 'kathas';

type DeityCardData = DeityMeta;

interface KathaListItem {
  id: string;
  titleEnglish: string;
  titleNative: string;
  deity: string;
  summary: string;
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function LibraryScreen() {
  const { isDarkMode, favoriteIds, toggleFavorite, walkthroughStep, setWalkthroughStep } = useStore();
  const colors = isDarkMode ? darkColors : lightColors;
  const db = useSQLiteContext();
  const { t } = useTranslation();
  const [segment, setSegment] = useState<Segment>('gods');
  const [kathas, setKathas] = useState<KathaListItem[]>([]);

  // ── Walkthrough ref & measurement ──────────────────────────────────────
  const deityGridRef = useRef<View>(null);
  const [deityGridRect, setDeityGridRect] = useState<SpotlightRect | null>(null);

  const measureDeityGrid = useCallback(() => {
    deityGridRef.current?.measureInWindow((x, y, width, height) => {
      if (width > 0) {
        // Spotlight just the top portion (first ~2 cards) so the tooltip fits below
        setDeityGridRect({ x, y, width, height: Math.min(height, 210) });
      }
    });
  }, []);

  // Measure when this tab gains focus and walkthrough is on step 3
  useFocusEffect(
    useCallback(() => {
      if (walkthroughStep === 3) {
        const timer = setTimeout(measureDeityGrid, 300);
        return () => clearTimeout(timer);
      }
    }, [walkthroughStep, measureDeityGrid])
  );

  const deities: DeityCardData[] = ALL_DEITIES;

  useEffect(() => {
    if (segment === 'kathas') {
      const rows = db.getAllSync<KathaListItem>(
        'SELECT id, titleEnglish, titleNative, deity, summary FROM kathas ORDER BY titleEnglish'
      );
      setKathas(rows);
    }
  }, [db, segment]);

  const renderDeity = useCallback(
    ({ item }: ListRenderItemInfo<DeityCardData>) => (
      <DeityCard deity={item} colors={colors} />
    ),
    [colors]
  );

  const renderKatha = useCallback(
    ({ item }: ListRenderItemInfo<KathaListItem>) => (
      <KathaCard
        item={item}
        colors={colors}
        isFavorite={favoriteIds.includes(`katha-${item.id}`)}
        onToggleFavorite={() => toggleFavorite(`katha-${item.id}`)}
      />
    ),
    [colors, favoriteIds, toggleFavorite]
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top']}>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <View style={[styles.headerRow, { paddingHorizontal: spacing.screenH }]}>
        <View>
          <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>
            {segment === 'gods' ? t('library.godsTitle') : t('library.kathasTitle')}
          </Text>
          <Text style={[styles.screenTitleEn, { color: colors.textMuted }]}>
            {segment === 'gods' ? t('library.godsTitleEn') : t('library.kathasTitleEn')}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/search')}
          style={[styles.searchBtn, { backgroundColor: colors.surfaceRecessed }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* ── Segment Control ──────────────────────────────────────────── */}
      <View style={[styles.segmentRow, { paddingHorizontal: spacing.screenH }]}>
        <SegmentButton
          label={t('library.godsSegment')}
          active={segment === 'gods'}
          onPress={() => setSegment('gods')}
          colors={colors}
        />
        <SegmentButton
          label={t('library.kathaSegment')}
          active={segment === 'kathas'}
          onPress={() => setSegment('kathas')}
          colors={colors}
        />
      </View>

      {/* ── Content ──────────────────────────────────────────────────── */}
      {segment === 'gods' ? (
        <View ref={deityGridRef} style={{ flex: 1 }}>
          <FlatList
            data={deities}
            keyExtractor={(item) => item.id}
            renderItem={renderDeity}
            getItemLayout={(_, index) => ({ length: 98, offset: 98 * index, index })}
            contentContainerStyle={[styles.listContent, { paddingHorizontal: spacing.screenH }]}
            showsVerticalScrollIndicator={false}
          />
        </View>
      ) : (
        <FlatList
          data={kathas}
          keyExtractor={(item) => item.id}
          renderItem={renderKatha}
          contentContainerStyle={[styles.listContent, { paddingHorizontal: spacing.screenH }]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={ItemSeparator}
        />
      )}

      <AdBanner colors={colors} />

      {/* ── Walkthrough Step 3: Spotlight deity grid ── */}
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
          colors={colors}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Segment Button ──────────────────────────────────────────────────────────

interface SegmentButtonProps {
  label: string;
  active: boolean;
  onPress: () => void;
  colors: ColorPalette;
}

function SegmentButton({ label, active, onPress, colors }: SegmentButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.segmentBtn,
        {
          backgroundColor: active ? colors.accent + '20' : 'transparent',
          borderColor: active ? colors.accent : colors.border,
        },
      ]}>
      <Text
        style={[
          styles.segmentText,
          { color: active ? colors.accent : colors.textSecondary },
        ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Item Separator ──────────────────────────────────────────────────────────

const ItemSeparator = () => <View style={{ height: spacing.gridGap }} />;

// ─── Deity Card ──────────────────────────────────────────────────────────────

interface DeityCardProps {
  deity: DeityCardData;
  colors: ColorPalette;
}

const DeityCard = memo(function DeityCard({ deity, colors }: DeityCardProps) {
  const { t } = useTranslation();
  const image = getDeityImage(deity.name);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => router.push(`/god/${deity.id}`)}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: deity.color + '25' }]}>

      {/* ── Portrait ── */}
      <View style={[styles.imageBox, { backgroundColor: deity.color + '15' }]}>
        {image ? (
          <Image source={image} style={styles.image} resizeMode="cover" />
        ) : (
          <DeityAvatar deity={deity.name} size={72} />
        )}
      </View>

      {/* ── Info ── */}
      <View style={styles.cardInfo}>
        <Text style={[styles.cardName, { color: colors.textPrimary }]} numberOfLines={1}>
          {t(`deities.${deity.id}.displayName`)}
        </Text>
        <Text style={[styles.cardDesc, { color: colors.textMuted }]} numberOfLines={1}>
          {t(`deities.${deity.id}.description`)}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={{ marginRight: 4 }} />
    </TouchableOpacity>
  );
});

// ─── Katha Card ──────────────────────────────────────────────────────────────

interface KathaCardProps {
  item: KathaListItem;
  colors: ColorPalette;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}

const KathaCard = memo(function KathaCard({ item, colors, isFavorite, onToggleFavorite }: KathaCardProps) {
  const { t } = useTranslation();
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => router.push(`/katha/${item.id}`)}
      style={[styles.kathaCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>

      <View style={styles.kathaCardTop}>
        <DeityAvatar deity={item.deity} size={44} />
        <View style={styles.kathaCardText}>
          <Text style={[styles.kathaTitleNative, { color: colors.textPrimary }]} numberOfLines={1}>
            {item.titleNative}
          </Text>
          <Text style={[styles.kathaTitleEn, { color: colors.textTertiary }]} numberOfLines={1}>
            {item.titleEnglish}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onToggleFavorite}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons
            name={isFavorite ? 'heart' : 'heart-outline'}
            size={22}
            color={isFavorite ? colors.accent : colors.textMuted}
          />
        </TouchableOpacity>
      </View>

      <Text style={[styles.kathaSummary, { color: colors.textMuted }]} numberOfLines={2}>
        {item.summary}
      </Text>

      <View style={styles.kathaBadgeRow}>
        <View style={[styles.kathaBadge, { backgroundColor: colors.borderAccent }]}>
          <Text style={[styles.kathaBadgeText, { color: colors.accent }]}>{t('library.kathaBadge')}</Text>
        </View>
        <View style={[styles.kathaBadge, { backgroundColor: colors.surfaceRecessed }]}>
          <Text style={[styles.kathaBadgeText, { color: colors.textSecondary }]}>{item.deity}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 8,
  },
  screenTitle: { fontSize: 22, fontFamily: 'Mukta_700Bold', lineHeight: 28 },
  screenTitleEn: { fontSize: 12, fontFamily: 'Mukta_400Regular', letterSpacing: 0.5, marginTop: 1 },
  searchBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },

  // Segment control
  segmentRow: {
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 12,
  },
  segmentBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: borderRadius.chip,
    borderWidth: 1,
  },
  segmentText: {
    fontSize: 13,
    fontFamily: 'Mukta_500Medium',
  },

  // List
  listContent: { paddingTop: 4, paddingBottom: 32, gap: 10 },

  // Deity Card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  imageBox: {
    width: 88,
    height: 88,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: 88,
    height: 88,
  },
  cardInfo: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, gap: 2 },
  cardName: { fontSize: 16, fontFamily: 'Mukta_600SemiBold', lineHeight: 22 },
  cardDesc: { fontSize: 12, fontFamily: 'Mukta_400Regular', lineHeight: 16 },

  // Katha Card
  kathaCard: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    padding: spacing.cardPad,
    gap: 8,
  },
  kathaCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  kathaCardText: { flex: 1 },
  kathaTitleNative: { fontSize: 16, fontFamily: 'Mukta_700Bold', marginBottom: 1 },
  kathaTitleEn: { fontSize: 12, fontFamily: 'Mukta_400Regular' },
  kathaSummary: { fontSize: 13, fontFamily: 'Mukta_400Regular', lineHeight: 20, marginLeft: 56 },
  kathaBadgeRow: { flexDirection: 'row', gap: 6, marginLeft: 56 },
  kathaBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: borderRadius.chip },
  kathaBadgeText: { fontSize: 11, fontFamily: 'Mukta_400Regular', letterSpacing: 0.3 },
});
