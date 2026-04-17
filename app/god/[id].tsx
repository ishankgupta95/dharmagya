import { useCallback, useMemo, memo } from 'react';
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
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, spacing, type ColorPalette } from '@/config/theme';
import { DeityAvatar } from '@/components/common/DeityAvatar';
import { getDeityImage } from '@/config/deityImages';
import { DEITY_BY_ID } from '@/config/deities';
import {
  getAartiForDeity,
  getChalisaForDeity,
  type Recitation,
  type Chalisa,
} from '@/services/content';

type ListItem =
  | { type: 'aarti'; data: Recitation }
  | { type: 'chalisa'; data: Chalisa };

interface ListSection {
  title: string;
  data: ListItem[];
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const BANNER_HEIGHT = 260;

export default function GodDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isDarkMode = useStore(s => s.isDarkMode);
  const favoriteIds = useStore(s => s.favoriteIds);
  const toggleFavorite = useStore(s => s.toggleFavorite);
  const colors = isDarkMode ? darkColors : lightColors;
  const deity = DEITY_BY_ID[id ?? ''];

  const aarti = useMemo(() => (deity ? getAartiForDeity(deity.id) : undefined), [deity]);
  const chalisa = useMemo(() => (deity ? getChalisaForDeity(deity.id) : undefined), [deity]);

  const sections = useMemo<ListSection[]>(() => {
    const result: ListSection[] = [];
    if (aarti) result.push({ title: t('god.aartiBadge'), data: [{ type: 'aarti', data: aarti }] });
    if (chalisa) result.push({ title: t('god.chalisaBadge'), data: [{ type: 'chalisa', data: chalisa }] });
    return result;
  }, [aarti, chalisa, t]);

  const renderItem = useCallback(
    ({ item }: SectionListRenderItemInfo<ListItem, ListSection>) => {
      if (item.type === 'aarti') {
        const a = item.data;
        const favKey = `aarti-${a.deity}`;
        return (
          <AartiCard
            item={a}
            colors={colors}
            isFavorite={favoriteIds.includes(favKey)}
            onToggleFavorite={() => toggleFavorite(favKey)}
            onPress={() => router.push(`/aarti/${a.deity}`)}
          />
        );
      }
      const c = item.data;
      const favKey = `chalisa-${c.deity}`;
      return (
        <ChalisaCard
          item={c}
          colors={colors}
          isFavorite={favoriteIds.includes(favKey)}
          onToggleFavorite={() => toggleFavorite(favKey)}
          onPress={() => router.push(`/chalisa/${c.deity}`)}
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
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('god.deityNotFound')}</Text>
      </SafeAreaView>
    );
  }

  const deityImage = getDeityImage(deity.id);
  const hasImage = !!deityImage;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>

      <View style={[styles.headerWrap, hasImage && { height: BANNER_HEIGHT }]}>
        {hasImage ? (
          <View style={styles.bannerBox}>
            <Image source={deityImage} style={styles.bannerImage} resizeMode="cover" />
            <LinearGradient
              colors={['transparent', colors.base]}
              style={styles.bannerGradientBottom}
            />
            <View style={styles.bannerOverlay}>
              <Text style={styles.bannerName}>{t(`deities.${deity.id}.displayName`)}</Text>
              <Text style={styles.bannerDesc}>{t(`deities.${deity.id}.description`)}</Text>
            </View>
          </View>
        ) : (
          <LinearGradient colors={[deity.color + '30', colors.base]} style={styles.fallbackHeader}>
            <View style={styles.fallbackContent}>
              <DeityAvatar deity={deity.id} size={72} />
              <Text style={[styles.fallbackName, { color: colors.textPrimary }]}>
                {t(`deities.${deity.id}.displayName`)}
              </Text>
              <Text style={[styles.fallbackSubname, { color: colors.textSecondary }]}>
                {deity.name}
              </Text>
              <Text style={[styles.fallbackDesc, { color: colors.textMuted }]}>
                {t(`deities.${deity.id}.description`)}
              </Text>
            </View>
          </LinearGradient>
        )}

        <View style={styles.bannerBackWrap}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.bannerBackBtn, !hasImage && { backgroundColor: 'rgba(0,0,0,0.25)' }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => `${item.type}-${item.data.deity}`}
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

const ListItemSeparator = () => <View style={{ height: spacing.gridGap }} />;
const ListSectionSeparator = ({ leadingItem }: { leadingItem?: unknown }) =>
  leadingItem ? <View style={{ height: 8 }} /> : null;

interface AartiCardProps {
  item: Recitation;
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
          {item.titleHindi}
        </Text>
        <Text style={[styles.cardTitleEn, { color: colors.textTertiary }]} numberOfLines={1}>
          {item.titleEnglish}
        </Text>
        <View style={[styles.badge, { backgroundColor: colors.borderAccent }]}>
          <Text style={[styles.badgeText, { color: colors.accent }]}>{t('god.aartiBadge')}</Text>
        </View>
      </View>
      <TouchableOpacity onPress={onToggleFavorite} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons
          name={isFavorite ? 'heart' : 'heart-outline'}
          size={22}
          color={isFavorite ? colors.accent : colors.textMuted}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

interface ChalisaCardProps {
  item: Chalisa;
  colors: ColorPalette;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onPress: () => void;
}

const ChalisaCard = memo(function ChalisaCard({ item, colors, isFavorite, onToggleFavorite, onPress }: ChalisaCardProps) {
  const { t } = useTranslation();
  const chaupaiCount = item.chaupai.hindi.length;
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.cardText}>
        <Text style={[styles.cardTitleNative, { color: colors.textPrimary }]} numberOfLines={1}>
          {item.titleHindi}
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
      <TouchableOpacity onPress={onToggleFavorite} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons
          name={isFavorite ? 'heart' : 'heart-outline'}
          size={22}
          color={isFavorite ? colors.accent : colors.textMuted}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerWrap: { overflow: 'hidden' },
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
  fallbackHeader: { paddingBottom: 20 },
  fallbackContent: { alignItems: 'center', gap: 4, paddingTop: 52 },
  fallbackName: { fontSize: 22, fontFamily: 'Mukta_700Bold', marginTop: 8 },
  fallbackSubname: { fontSize: 13, fontFamily: 'Mukta_400Regular' },
  fallbackDesc: { fontSize: 12, fontFamily: 'Mukta_400Regular', marginTop: 2 },
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
  listContent: { paddingTop: 2, paddingBottom: 32 },
  emptyText: {
    textAlign: 'center',
    fontFamily: 'Mukta_400Regular',
    fontSize: 15,
    marginTop: 48,
  },
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
  badgeRow: { flexDirection: 'row', gap: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: borderRadius.chip },
  badgeText: { fontSize: 11, fontFamily: 'Mukta_400Regular', letterSpacing: 0.3 },
});
