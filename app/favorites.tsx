import { useCallback, useMemo, memo } from 'react';
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
import { Icon } from '@/components/common/Icon';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, palette, spacing, type ColorPalette } from '@/config/theme';
import { AdBanner } from '@/components/common/AdBanner';
import { DeityAvatar } from '@/components/common/DeityAvatar';
import { Ornament } from '@/components/common/Ornament';
import { ScreenMount } from '@/components/common/ScreenMount';
import { FavoriteHeart } from '@/components/common/FavoriteHeart';
import { getAartiForDeity, getChalisaForDeity } from '@/services/content';

interface FavoriteItem {
  type: 'aarti' | 'chalisa';
  /** Deity slug (also the route param). */
  deity: string;
  titleEnglish: string;
  titleHindi: string;
  deityLabel: string;
}

export default function FavoritesScreen() {
  const { t } = useTranslation();
  const isDarkMode = useStore(s => s.isDarkMode);
  const favoriteIds = useStore(s => s.favoriteIds);
  const toggleFavorite = useStore(s => s.toggleFavorite);
  const colors = isDarkMode ? darkColors : lightColors;

  const items = useMemo<FavoriteItem[]>(() => {
    const result: FavoriteItem[] = [];
    for (const favId of favoriteIds) {
      if (favId.startsWith('aarti-')) {
        const slug = favId.slice('aarti-'.length);
        const a = getAartiForDeity(slug);
        if (!a) continue;
        result.push({
          type: 'aarti',
          deity: a.deity,
          titleEnglish: a.titleEnglish,
          titleHindi: a.titleHindi,
          deityLabel: t(`deities.${a.deity}.displayName`),
        });
      } else if (favId.startsWith('chalisa-')) {
        const slug = favId.slice('chalisa-'.length);
        const c = getChalisaForDeity(slug);
        if (!c) continue;
        result.push({
          type: 'chalisa',
          deity: c.deity,
          titleEnglish: c.titleEnglish,
          titleHindi: c.titleHindi,
          deityLabel: t(`deities.${c.deity}.displayName`),
        });
      }
    }
    return result;
  }, [favoriteIds, t]);

  const renderItem = useCallback(({ item }: ListRenderItemInfo<FavoriteItem>) => {
    const onPress = () => {
      if (item.type === 'aarti') router.push(`/aarti/${item.deity}`);
      else router.push(`/chalisa/${item.deity}`);
    };
    return (
      <FavoriteCard
        item={item}
        colors={colors}
        onPress={onPress}
        onRemove={() => toggleFavorite(`${item.type}-${item.deity}`)}
      />
    );
  }, [colors, toggleFavorite]);

  return (
    <ScreenMount>
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>

      <View style={[styles.headerRow, { paddingHorizontal: spacing.screenH, borderBottomColor: colors.divider }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.back')}>
          <Icon name="chevron-left" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text variant="display-italic" style={[styles.headerTitle, { color: colors.textPrimary }]}>
          {t('favorites.title')}
        </Text>
        <View style={[styles.backPill, { borderWidth: 0 }]} />
      </View>

      {items.length === 0 ? (
        <EmptyState colors={colors} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => `${item.type}-${item.deity}`}
          renderItem={renderItem}
          contentContainerStyle={[styles.listContent, { paddingHorizontal: spacing.screenH }]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={ItemSeparator}
          ListFooterComponent={
            <View style={styles.adWrap}>
              <AdBanner colors={colors} placement="favoritesInline" inline />
            </View>
          }
        />
      )}

    </SafeAreaView>
    </ScreenMount>
  );
}

interface FavoriteCardProps {
  item: FavoriteItem;
  colors: ColorPalette;
  onPress: () => void;
  onRemove: () => void;
}

const ItemSeparator = () => <View style={{ height: spacing.gridGap }} />;

const FavoriteCard = memo(function FavoriteCard({ item, colors, onPress, onRemove }: FavoriteCardProps) {
  const { t } = useTranslation();
  const typeLabel = item.type === 'aarti' ? t('favorites.aartiBadge') : t('favorites.chalisaBadge');
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityRole="button"
      accessibilityLabel={`${item.titleEnglish} — ${typeLabel}`}>
      <DeityAvatar deity={item.deity} size={46} />
      <View style={styles.cardText}>
        <Text variant="deva-bold" style={[styles.cardNative, { color: colors.textPrimary }]} numberOfLines={1}>
          {item.titleHindi}
        </Text>
        <Text variant="body-italic" style={[styles.cardEnglish, { color: colors.textTertiary }]} numberOfLines={1}>
          {item.titleEnglish}
        </Text>
        <View style={styles.metaRow}>
          <Text variant="mono-caps" style={[styles.metaKicker, { color: palette.gold }]}>
            {typeLabel}
          </Text>
          <View style={[styles.metaDot, { backgroundColor: colors.textMuted }]} />
          <Text variant="body-italic" style={[styles.metaDeity, { color: colors.textTertiary }]} numberOfLines={1}>
            {item.deityLabel}
          </Text>
        </View>
      </View>
      <FavoriteHeart
        active
        onPress={onRemove}
        size={20}
        inactiveColor={colors.textMuted}
        activeColor={colors.accent}
        accessibilityLabel={t('a11y.removeFavorite')}
      />
    </TouchableOpacity>
  );
});

function EmptyState({ colors }: { colors: ColorPalette }) {
  const { t } = useTranslation();
  return (
    <View style={styles.emptyWrap}>
      <Ornament variant="lotus" style={styles.emptyOrnament} />
      <Text variant="display-italic" style={[styles.emptyTitle, { color: colors.textPrimary }]}>
        {t('favorites.emptyTitle')}
      </Text>
      <Text variant="body-italic" style={[styles.emptySub, { color: colors.textTertiary }]}>
        {t('favorites.emptyDesc')}
      </Text>
      <TouchableOpacity
        onPress={() => router.push('/(tabs)/library')}
        style={[styles.browseBtn, { borderColor: colors.accent }]}
        accessibilityRole="button"
        accessibilityLabel={t('favorites.browseLibrary')}>
        <Text variant="mono-caps" style={[styles.browseBtnText, { color: colors.accent }]}>
          {t('favorites.browseLibrary')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 22 },
  listContent: { paddingTop: 16, paddingBottom: 32 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: borderRadius.card,
    borderWidth: 1,
    padding: spacing.cardPad,
  },
  cardText: { flex: 1 },
  cardNative: { fontSize: 16, lineHeight: 22, marginBottom: 2 },
  cardEnglish: { fontSize: 12, lineHeight: 16, marginBottom: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaKicker: { fontSize: 9 },
  metaDot: { width: 3, height: 3, borderRadius: 1.5 },
  metaDeity: { fontSize: 12, flexShrink: 1 },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 40,
  },
  emptyOrnament: { width: 140, marginBottom: 8 },
  emptyTitle: { fontSize: 26 },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  browseBtn: {
    marginTop: 10,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: borderRadius.button,
    borderWidth: 1.5,
  },
  browseBtnText: { fontSize: 10 },
  adWrap: { marginTop: 16 },
});
