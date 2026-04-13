import { useState, useEffect, useCallback, memo } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ListRenderItemInfo,
} from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, spacing, type ColorPalette } from '@/config/theme';
import { DeityAvatar } from '@/components/common/DeityAvatar';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FavoriteItem {
  type: 'aarti' | 'chalisa' | 'katha';
  id: string;
  titleEnglish: string;
  titleNative: string;
  deity: string;
}

interface AartiRow {
  id: string;
  titleEnglish: string;
  titleNative: string;
  deity: string;
}

interface ChalisaRow {
  id: string;
  titleEnglish: string;
  titleNative: string;
  deity: string;
}

interface KathaRow {
  id: string;
  titleEnglish: string;
  titleNative: string;
  deity: string;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FavoritesScreen() {
  const { t } = useTranslation();
  const isDarkMode = useStore(s => s.isDarkMode);
  const favoriteIds = useStore(s => s.favoriteIds);
  const toggleFavorite = useStore(s => s.toggleFavorite);
  const colors = isDarkMode ? darkColors : lightColors;
  const db = useSQLiteContext();

  const [items, setItems] = useState<FavoriteItem[]>([]);

  useEffect(() => {
    const aartiIds = favoriteIds
      .filter((id) => id.startsWith('aarti-'))
      .map((id) => id.slice('aarti-'.length));

    const chalisaIds = favoriteIds
      .filter((id) => id.startsWith('chalisa-'))
      .map((id) => id.slice('chalisa-'.length));

    const kathaIds = favoriteIds
      .filter((id) => id.startsWith('katha-'))
      .map((id) => id.slice('katha-'.length));

    const results: FavoriteItem[] = [];

    if (aartiIds.length > 0) {
      const placeholders = aartiIds.map(() => '?').join(',');
      const rows = db.getAllSync<AartiRow>(
        `SELECT id, titleEnglish, titleNative, deity FROM aartis WHERE id IN (${placeholders})`,
        aartiIds
      );
      rows.forEach((r) => results.push({ ...r, type: 'aarti' }));
    }

    if (chalisaIds.length > 0) {
      const placeholders = chalisaIds.map(() => '?').join(',');
      const rows = db.getAllSync<ChalisaRow>(
        `SELECT id, titleEnglish, titleNative, deity FROM chalisas WHERE id IN (${placeholders})`,
        chalisaIds
      );
      rows.forEach((r) => results.push({ ...r, type: 'chalisa' }));
    }

    if (kathaIds.length > 0) {
      const placeholders = kathaIds.map(() => '?').join(',');
      const rows = db.getAllSync<KathaRow>(
        `SELECT id, titleEnglish, titleNative, deity FROM kathas WHERE id IN (${placeholders})`,
        kathaIds
      );
      rows.forEach((r) => results.push({ ...r, type: 'katha' }));
    }

    // Preserve the order from favoriteIds
    results.sort((a, b) => {
      const aKey = `${a.type}-${a.id}`;
      const bKey = `${b.type}-${b.id}`;
      return favoriteIds.indexOf(aKey) - favoriteIds.indexOf(bKey);
    });

    setItems(results);
  }, [db, favoriteIds]);

  const renderItem = useCallback(({ item }: ListRenderItemInfo<FavoriteItem>) => {
    const onPress = () => {
      if (item.type === 'aarti') router.push(`/aarti/${item.id}`);
      else if (item.type === 'chalisa') router.push(`/chalisa/${item.id}`);
      else router.push(`/katha/${item.id}`);
    };
    return (
      <FavoriteCard
        item={item}
        colors={colors}
        onPress={onPress}
        onRemove={() => toggleFavorite(`${item.type}-${item.id}`)}
      />
    );
  }, [colors, toggleFavorite]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <View style={[styles.headerRow, { paddingHorizontal: spacing.screenH, borderBottomColor: colors.divider }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('favorites.title')}</Text>
        <View style={styles.backBtn} />
      </View>

      {/* ── List / Empty ──────────────────────────────────────────────── */}
      {items.length === 0 ? (
        <EmptyState colors={colors} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => `${item.type}-${item.id}`}
          renderItem={renderItem}
          contentContainerStyle={[styles.listContent, { paddingHorizontal: spacing.screenH }]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={ItemSeparator}
        />
      )}

    </SafeAreaView>
  );
}

// ─── Favorite Card ────────────────────────────────────────────────────────────

interface FavoriteCardProps {
  item: FavoriteItem;
  colors: ColorPalette;
  onPress: () => void;
  onRemove: () => void;
}

const ItemSeparator = () => <View style={{ height: spacing.gridGap }} />;

const FavoriteCard = memo(function FavoriteCard({ item, colors, onPress, onRemove }: FavoriteCardProps) {
  const { t } = useTranslation();
  const typeLabel = item.type === 'aarti' ? t('favorites.aartiBadge') : item.type === 'chalisa' ? t('favorites.chalisaBadge') : t('favorites.kathaBadge');
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <DeityAvatar deity={item.deity} size={46} />
      <View style={styles.cardText}>
        <Text style={[styles.cardNative, { color: colors.textPrimary }]} numberOfLines={1}>
          {item.titleNative}
        </Text>
        <Text style={[styles.cardEnglish, { color: colors.textTertiary }]} numberOfLines={1}>
          {item.titleEnglish}
        </Text>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: colors.surfaceRecessed }]}>
            <Text style={[styles.badgeText, { color: colors.accent }]}>{item.deity}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: colors.surfaceRecessed }]}>
            <Text style={[styles.badgeText, { color: colors.textMuted }]}>{typeLabel}</Text>
          </View>
        </View>
      </View>
      <TouchableOpacity
        onPress={onRemove}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="heart" size={22} color={colors.accent} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ colors }: { colors: ColorPalette }) {
  const { t } = useTranslation();
  return (
    <View style={styles.emptyWrap}>
      {/* Dashed heart */}
      <View style={[styles.dashedHeart, { borderColor: colors.border }]}>
        <Ionicons name="heart-outline" size={40} color={colors.textDisabled} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
        {t('favorites.emptyTitle')}
      </Text>
      <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
        {t('favorites.emptyDesc')}
      </Text>
      <TouchableOpacity
        onPress={() => router.push('/(tabs)/library')}
        style={[styles.browseBtn, { borderColor: colors.accent }]}>
        <Text style={[styles.browseBtnText, { color: colors.accent }]}>{t('favorites.browseLibrary')}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.screenH,
  },
  backBtn: { width: 38, height: 38, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontFamily: 'Mukta_500Medium' },

  // List
  listContent: { paddingTop: 16, paddingBottom: 32 },

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
  cardNative: { fontSize: 16, fontFamily: 'Mukta_700Bold', marginBottom: 2 },
  cardEnglish: { fontSize: 12, fontFamily: 'Mukta_400Regular', marginBottom: 6 },
  badgeRow: { flexDirection: 'row', gap: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: borderRadius.chip },
  badgeText: { fontSize: 11, fontFamily: 'Mukta_400Regular', letterSpacing: 0.3 },

  // Empty state
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 40,
  },
  dashedHeart: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 18, fontFamily: 'Mukta_500Medium' },
  emptySub: { fontSize: 14, fontFamily: 'Mukta_400Regular', textAlign: 'center', lineHeight: 22 },
  browseBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: borderRadius.button,
    borderWidth: 1.5,
  },
  browseBtnText: { fontSize: 14, fontFamily: 'Mukta_500Medium' },
});
