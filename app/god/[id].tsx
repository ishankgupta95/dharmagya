import { useState, useEffect, useCallback, memo } from 'react';
import {
  View,
  Image,
  Dimensions,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  SectionListRenderItemInfo,
  SectionListData,
} from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, spacing, type ColorPalette } from '@/config/theme';
import { DeityAvatar } from '@/components/common/DeityAvatar';
import { getDeityImage } from '@/config/deityImages';
import { DEITY_BY_ID } from '@/config/deities';
import type { IAarti, IChalisaSection, IKatha } from '@/types';

// ─── Row / Item Types ────────────────────────────────────────────────────────

interface AartiRow {
  id: string;
  titleEnglish: string;
  titleNative: string;
  content: string;
  deity: string;
}

interface ChalisaRow {
  id: string;
  titleEnglish: string;
  titleNative: string;
  deity: string;
  sections: string;
}

interface ChalisaItem {
  id: string;
  titleEnglish: string;
  titleNative: string;
  deity: string;
  sections: IChalisaSection[];
}

interface KathaRow {
  id: string;
  titleEnglish: string;
  titleNative: string;
  deity: string;
  summary: string;
}

interface KathaItem {
  id: string;
  titleEnglish: string;
  titleNative: string;
  deity: string;
  summary: string;
}

type ListItem =
  | { type: 'aarti'; data: IAarti }
  | { type: 'chalisa'; data: ChalisaItem }
  | { type: 'katha'; data: KathaItem };

interface ListSection {
  title: string;
  data: ListItem[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rowToAarti(row: AartiRow): IAarti {
  return { ...row, content: JSON.parse(row.content) as string[] };
}

function rowToChalisa(row: ChalisaRow): ChalisaItem {
  return { ...row, sections: JSON.parse(row.sections) as IChalisaSection[] };
}

function countChaupais(sections: IChalisaSection[]): number {
  return sections.filter((s) => s.type === 'chaupai').length;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const SCREEN_WIDTH = Dimensions.get('window').width;
const BANNER_HEIGHT = 260;

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function GodDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isDarkMode, favoriteIds, toggleFavorite } = useStore();
  const colors = isDarkMode ? darkColors : lightColors;
  const db = useSQLiteContext();
  const deity = DEITY_BY_ID[id ?? ''];

  const [aartis, setAartis] = useState<IAarti[]>([]);
  const [chalisas, setChalisas] = useState<ChalisaItem[]>([]);
  const [kathas, setKathas] = useState<KathaItem[]>([]);

  useEffect(() => {
    if (!deity) return;
    const aartiRows = db.getAllSync<AartiRow>(
      'SELECT * FROM aartis WHERE deity = ? ORDER BY titleEnglish',
      [deity.name]
    );
    setAartis(aartiRows.map(rowToAarti));

    const chalisaRows = db.getAllSync<ChalisaRow>(
      'SELECT * FROM chalisas WHERE deity = ? ORDER BY titleEnglish',
      [deity.name]
    );
    setChalisas(chalisaRows.map(rowToChalisa));

    const kathaRows = db.getAllSync<KathaRow>(
      'SELECT id, titleEnglish, titleNative, deity, summary FROM kathas WHERE deity = ? ORDER BY titleEnglish',
      [deity.name]
    );
    setKathas(kathaRows);
  }, [db, deity]);

  const sections: ListSection[] = [];
  if (aartis.length > 0) {
    sections.push({
      title: t('god.aartisCount', { count: aartis.length }),
      data: aartis.map((a) => ({ type: 'aarti' as const, data: a })),
    });
  }
  if (chalisas.length > 0) {
    sections.push({
      title: t('god.chalisasCount', { count: chalisas.length }),
      data: chalisas.map((c) => ({ type: 'chalisa' as const, data: c })),
    });
  }
  if (kathas.length > 0) {
    sections.push({
      title: t('god.kathasCount', { count: kathas.length }),
      data: kathas.map((k) => ({ type: 'katha' as const, data: k })),
    });
  }

  const renderItem = useCallback(
    ({ item }: SectionListRenderItemInfo<ListItem, ListSection>) => {
      if (item.type === 'aarti') {
        const a = item.data;
        return (
          <AartiCard
            item={a}
            colors={colors}
            isFavorite={favoriteIds.includes(`aarti-${a.id}`)}
            onToggleFavorite={() => toggleFavorite(`aarti-${a.id}`)}
            onPress={() => router.push(`/aarti/${a.id}`)}
          />
        );
      }
      if (item.type === 'chalisa') {
        const c = item.data;
        return (
          <ChalisaCard
            item={c}
            colors={colors}
            isFavorite={favoriteIds.includes(`chalisa-${c.id}`)}
            onToggleFavorite={() => toggleFavorite(`chalisa-${c.id}`)}
            onPress={() => router.push(`/chalisa/${c.id}`)}
          />
        );
      }
      const k = item.data;
      return (
        <KathaCard
          item={k}
          colors={colors}
          isFavorite={favoriteIds.includes(`katha-${k.id}`)}
          onToggleFavorite={() => toggleFavorite(`katha-${k.id}`)}
          onPress={() => router.push(`/katha/${k.id}`)}
        />
      );
    },
    [colors, favoriteIds, toggleFavorite]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionListData<ListItem, ListSection> }) => (
      <View style={[styles.sectionHeader, { backgroundColor: colors.base }]}>
        <Text style={[styles.sectionHeaderText, { color: colors.textSecondary }]}>
          {section.title}
        </Text>
      </View>
    ),
    [colors]
  );

  if (!deity) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top']}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('god.deityNotFound')}</Text>
      </SafeAreaView>
    );
  }

  const deityImage = getDeityImage(deity.name);
  const hasImage = !!deityImage;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top']}>

      {/* ── Fixed Header ───────────────────────────────────────────── */}
      <View style={[styles.headerWrap, hasImage && { height: BANNER_HEIGHT }]}>
        {hasImage ? (
          <>
            {/* Banner image */}
            <View style={styles.bannerBox}>
              <Image
                source={deityImage}
                style={styles.bannerImage}
                resizeMode="cover"
              />
              {/* Bottom gradient fade */}
              <LinearGradient
                colors={['transparent', colors.base]}
                style={styles.bannerGradientBottom}
              />
              {/* Name overlay on banner */}
              <View style={styles.bannerOverlay}>
                <Text style={styles.bannerName}>{deity.displayName}</Text>
                <Text style={styles.bannerDesc}>{deity.description}</Text>
              </View>
            </View>
          </>
        ) : (
          /* No image: simple gradient header */
          <LinearGradient colors={[deity.color + '30', colors.base]} style={styles.fallbackHeader}>
            <View style={styles.fallbackContent}>
              <DeityAvatar deity={deity.name} size={72} />
              <Text style={[styles.fallbackName, { color: colors.textPrimary }]}>
                {deity.displayName}
              </Text>
              <Text style={[styles.fallbackSubname, { color: colors.textSecondary }]}>
                {deity.name}
              </Text>
              <Text style={[styles.fallbackDesc, { color: colors.textMuted }]}>
                {deity.description}
              </Text>
            </View>
          </LinearGradient>
        )}

        {/* Back button */}
        <View style={styles.bannerBackWrap}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.bannerBackBtn, !hasImage && { backgroundColor: 'rgba(0,0,0,0.25)' }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── List ──────────────────────────────────────────────────────── */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => `${item.type}-${item.data.id}`}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        contentContainerStyle={[styles.listContent, { paddingHorizontal: spacing.screenH }]}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={ListItemSeparator}
        SectionSeparatorComponent={ListSectionSeparator}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            {t('god.noContent')}
          </Text>
        }
      />
    </SafeAreaView>
  );
}

// ─── List Separators ────────────────────────────────────────────────────────

const ListItemSeparator = () => <View style={{ height: spacing.gridGap }} />;
const ListSectionSeparator = ({ leadingItem }: { leadingItem?: unknown }) =>
  leadingItem ? <View style={{ height: 8 }} /> : null;

// ─── Aarti Card ──────────────────────────────────────────────────────────────

interface AartiCardProps {
  item: IAarti;
  colors: ColorPalette;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onPress: () => void;
}

const AartiCard = memo(function AartiCard({ item, colors, isFavorite, onToggleFavorite, onPress }: AartiCardProps) {
  const { t } = useTranslation();
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.cardText}>
        <Text style={[styles.cardTitleNative, { color: colors.textPrimary }]} numberOfLines={1}>
          {item.titleNative}
        </Text>
        <Text style={[styles.cardTitleEn, { color: colors.textTertiary }]} numberOfLines={1}>
          {item.titleEnglish}
        </Text>
        <View style={[styles.badge, { backgroundColor: colors.borderAccent }]}>
          <Text style={[styles.badgeText, { color: colors.accent }]}>{t('god.aartiBadge')}</Text>
        </View>
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
    </TouchableOpacity>
  );
});

// ─── Chalisa Card ────────────────────────────────────────────────────────────

interface ChalisaCardProps {
  item: ChalisaItem;
  colors: ColorPalette;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onPress: () => void;
}

const ChalisaCard = memo(function ChalisaCard({ item, colors, isFavorite, onToggleFavorite, onPress }: ChalisaCardProps) {
  const { t } = useTranslation();
  const chaupaiCount = countChaupais(item.sections);
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.cardText}>
        <Text style={[styles.cardTitleNative, { color: colors.textPrimary }]} numberOfLines={1}>
          {item.titleNative}
        </Text>
        <Text style={[styles.cardTitleEn, { color: colors.textTertiary }]} numberOfLines={1}>
          {item.titleEnglish}
        </Text>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: colors.borderAccent }]}>
            <Text style={[styles.badgeText, { color: colors.accent }]}>{t('god.chalisaBadge')}</Text>
          </View>
          {chaupaiCount > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.surfaceRecessed }]}>
              <Text style={[styles.badgeText, { color: colors.textSecondary }]}>
                {t('god.chaupaiCount', { count: chaupaiCount })}
              </Text>
            </View>
          )}
        </View>
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
    </TouchableOpacity>
  );
});

// ─── Katha Card ─────────────────────────────────────────────────────────────

interface KathaCardProps {
  item: KathaItem;
  colors: ColorPalette;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onPress: () => void;
}

const KathaCard = memo(function KathaCard({ item, colors, isFavorite, onToggleFavorite, onPress }: KathaCardProps) {
  const { t } = useTranslation();
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.cardText}>
        <Text style={[styles.cardTitleNative, { color: colors.textPrimary }]} numberOfLines={1}>
          {item.titleNative}
        </Text>
        <Text style={[styles.cardTitleEn, { color: colors.textTertiary }]} numberOfLines={1}>
          {item.titleEnglish}
        </Text>
        <View style={[styles.badge, { backgroundColor: colors.borderAccent }]}>
          <Text style={[styles.badgeText, { color: colors.accent }]}>{t('god.kathaBadge')}</Text>
        </View>
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
    </TouchableOpacity>
  );
});

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  // ── Collapsible header ──
  headerWrap: { overflow: 'hidden' },

  // Banner (expanded)
  bannerBox: {
    width: SCREEN_WIDTH,
    height: BANNER_HEIGHT,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  bannerImage: {
    width: SCREEN_WIDTH,
    height: BANNER_HEIGHT,
  },
  bannerGradientBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 100,
  },
  bannerOverlay: {
    position: 'absolute',
    bottom: 16,
    left: spacing.screenH,
    right: spacing.screenH,
  },
  bannerName: {
    fontSize: 24,
    fontFamily: 'Mukta_700Bold',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  bannerDesc: {
    fontSize: 13,
    fontFamily: 'Mukta_400Regular',
    color: 'rgba(255,255,255,0.85)',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    marginTop: 2,
  },
  bannerBackWrap: {
    position: 'absolute',
    top: 8,
    left: spacing.screenH,
    zIndex: 10,
  },
  bannerBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Fallback header (no image)
  fallbackHeader: { paddingBottom: 20 },
  fallbackContent: { alignItems: 'center', gap: 4, paddingTop: 52 },
  fallbackName: { fontSize: 22, fontFamily: 'Mukta_700Bold', marginTop: 8 },
  fallbackSubname: { fontSize: 13, fontFamily: 'Mukta_400Regular' },
  fallbackDesc: { fontSize: 12, fontFamily: 'Mukta_400Regular', marginTop: 2 },

  // Section headers
  sectionHeader: {
    paddingTop: 16,
    paddingBottom: 10,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontFamily: 'Mukta_500Medium',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // List
  listContent: { paddingTop: 2, paddingBottom: 32 },
  emptyText: {
    textAlign: 'center',
    fontFamily: 'Mukta_400Regular',
    fontSize: 15,
    marginTop: 48,
  },

  // Card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: borderRadius.card,
    borderWidth: 1,
    padding: spacing.cardPad,
  },
  cardText: { flex: 1 },
  cardTitleNative: { fontSize: 16, fontFamily: 'Mukta_700Bold', marginBottom: 2 },
  cardTitleEn: { fontSize: 12, fontFamily: 'Mukta_400Regular', marginBottom: 6 },

  // Badges
  badgeRow: { flexDirection: 'row', gap: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: borderRadius.chip },
  badgeText: { fontSize: 11, fontFamily: 'Mukta_400Regular', letterSpacing: 0.3 },
});
