import { useCallback, useMemo, memo } from 'react';
import { MotionPressable } from '@/components/common/MotionPressable';
import {
  View,
  FlatList,
  StyleSheet,
  ListRenderItemInfo,
} from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Icon, type IconName } from '@/components/common/Icon';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, palette, spacing, type ColorPalette } from '@/config/theme';
import { AdBanner } from '@/components/common/AdBanner';
import { DeityAvatar } from '@/components/common/DeityAvatar';
import { Ornament } from '@/components/common/Ornament';
import { ScreenMount } from '@/components/common/ScreenMount';
import { FavoriteHeart } from '@/components/common/FavoriteHeart';
import {
  getAartiForDeity,
  getChalisaForDeity,
  getStotraBySlug,
  getSuktaBySlug,
  getSahasranamaBySlug,
} from '@/services/content';
import { getScriptureBySlug } from '@/config/scriptures';

type FavoriteType = 'aarti' | 'chalisa' | 'stotra' | 'sukta' | 'sahasranama' | 'scripture';

interface FavoriteItem {
  type: FavoriteType;
  /** The full favorite id (`type-routeId`) — used for removal + key. */
  favId: string;
  /** The route param: deity slug for aarti/chalisa, content slug otherwise. */
  routeId: string;
  /** Deity slug for the avatar, or `null` when the text isn't deity-bound. */
  deity: string | null;
  titleEnglish: string;
  titleHindi: string;
  /** Deity display name, or empty when not deity-bound. */
  deityLabel: string;
}

export default function FavoritesScreen() {
  const { t } = useTranslation();
  const isDarkMode = useStore(s => s.isDarkMode);
  const favoriteIds = useStore(s => s.favoriteIds);
  const toggleFavorite = useStore(s => s.toggleFavorite);
  const colors = isDarkMode ? darkColors : lightColors;

  const items = useMemo<FavoriteItem[]>(() => {
    const deityLabel = (d: string | null) => (d ? t(`deities.${d}.displayName`) : '');
    const result: FavoriteItem[] = [];
    for (const favId of favoriteIds) {
      const dash = favId.indexOf('-');
      if (dash < 0) continue;
      const type = favId.slice(0, dash) as FavoriteType;
      const routeId = favId.slice(dash + 1);
      switch (type) {
        case 'aarti': {
          const a = getAartiForDeity(routeId);
          if (a) result.push({ type, favId, routeId, deity: a.deity, titleEnglish: a.titleEnglish, titleHindi: a.titleHindi, deityLabel: deityLabel(a.deity) });
          break;
        }
        case 'chalisa': {
          const c = getChalisaForDeity(routeId);
          if (c) result.push({ type, favId, routeId, deity: c.deity, titleEnglish: c.titleEnglish, titleHindi: c.titleHindi, deityLabel: deityLabel(c.deity) });
          break;
        }
        case 'stotra': {
          const s = getStotraBySlug(routeId);
          if (s) { const d = s.deity ?? s.deities?.[0] ?? null; result.push({ type, favId, routeId, deity: d, titleEnglish: s.titleEnglish, titleHindi: s.titleHindi, deityLabel: deityLabel(d) }); }
          break;
        }
        case 'sukta': {
          const s = getSuktaBySlug(routeId);
          if (s) { const d = s.deity ?? s.deities?.[0] ?? null; result.push({ type, favId, routeId, deity: d, titleEnglish: s.titleEnglish, titleHindi: s.titleHindi, deityLabel: deityLabel(d) }); }
          break;
        }
        case 'sahasranama': {
          const s = getSahasranamaBySlug(routeId);
          if (s) result.push({ type, favId, routeId, deity: s.deity, titleEnglish: s.titleEnglish, titleHindi: s.titleHindi, deityLabel: deityLabel(s.deity) });
          break;
        }
        case 'scripture': {
          const s = getScriptureBySlug(routeId);
          if (s) result.push({ type, favId, routeId, deity: s.deity ?? null, titleEnglish: s.titleEnglish, titleHindi: s.titleHindi, deityLabel: deityLabel(s.deity ?? null) });
          break;
        }
        default:
          break;
      }
    }
    return result;
  }, [favoriteIds, t]);

  const renderItem = useCallback(({ item }: ListRenderItemInfo<FavoriteItem>) => {
    const onPress = () => {
      switch (item.type) {
        case 'aarti': router.push(`/aarti/${item.routeId}`); break;
        case 'chalisa': router.push(`/chalisa/${item.routeId}`); break;
        case 'stotra': router.push({ pathname: '/stotra/[slug]', params: { slug: item.routeId } }); break;
        case 'sukta': router.push({ pathname: '/sukta/[slug]', params: { slug: item.routeId } }); break;
        case 'sahasranama': router.push({ pathname: '/sahasranama/[slug]', params: { slug: item.routeId } }); break;
        case 'scripture': router.push({ pathname: '/scripture/[id]', params: { id: item.routeId } }); break;
      }
    };
    return (
      <FavoriteCard
        item={item}
        colors={colors}
        onPress={onPress}
        onRemove={() => toggleFavorite(item.favId)}
      />
    );
  }, [colors, toggleFavorite]);

  return (
    <ScreenMount>
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>

      <View style={[styles.headerRow, { paddingHorizontal: spacing.screenH, borderBottomColor: colors.divider }]}>
        <MotionPressable
          onPress={() => router.back()}
          style={[styles.backPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.back')}>
          <Icon name="chevron-left" size={18} color={colors.textSecondary} />
        </MotionPressable>
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
          keyExtractor={(item) => item.favId}
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

const TYPE_BADGE: Record<FavoriteType, string> = {
  aarti: 'favorites.aartiBadge',
  chalisa: 'favorites.chalisaBadge',
  stotra: 'god.stotraBadge',
  sukta: 'god.suktaBadge',
  sahasranama: 'god.sahasranamaBadge',
  scripture: 'god.scriptureBadge',
};

const TYPE_ICON: Record<FavoriteType, IconName> = {
  aarti: 'flame',
  chalisa: 'text',
  stotra: 'text',
  sukta: 'flower',
  sahasranama: 'lotus',
  scripture: 'school',
};

const FavoriteCard = memo(function FavoriteCard({ item, colors, onPress, onRemove }: FavoriteCardProps) {
  const { t } = useTranslation();
  const typeLabel = t(TYPE_BADGE[item.type]);
  return (
    <MotionPressable
      pressedScale={0.97}
      onPress={onPress}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityRole="button"
      accessibilityLabel={`${item.titleEnglish} — ${typeLabel}`}>
      {item.deity ? (
        <DeityAvatar deity={item.deity} size={46} />
      ) : (
        <View style={[styles.fallbackIcon, { backgroundColor: colors.surfaceRecessed, borderColor: colors.borderAccent }]}>
          <Icon name={TYPE_ICON[item.type]} size={20} color={colors.accent} />
        </View>
      )}
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
          {!!item.deityLabel && (
            <>
              <View style={[styles.metaDot, { backgroundColor: colors.textMuted }]} />
              <Text variant="body-italic" style={[styles.metaDeity, { color: colors.textTertiary }]} numberOfLines={1}>
                {item.deityLabel}
              </Text>
            </>
          )}
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
    </MotionPressable>
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
      <MotionPressable
        onPress={() => router.push('/(tabs)/library')}
        style={[styles.browseBtn, { borderColor: colors.accent }]}
        accessibilityRole="button"
        accessibilityLabel={t('favorites.browseLibrary')}>
        <Text variant="mono-caps" style={[styles.browseBtnText, { color: colors.accent }]}>
          {t('favorites.browseLibrary')}
        </Text>
      </MotionPressable>
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
  fallbackIcon: {
    width: 46, height: 46, borderRadius: 23, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
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
