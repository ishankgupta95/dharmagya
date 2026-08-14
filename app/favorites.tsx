import { useMemo, memo } from 'react';
import { MotionPressable } from '@/components/common/MotionPressable';
import { View, ScrollView, StyleSheet } from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Icon, type IconName } from '@/components/common/Icon';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, spacing, type ColorPalette } from '@/config/theme';
import { AdBanner } from '@/components/common/AdBanner';
import { DeityAvatar } from '@/components/common/DeityAvatar';
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
  /** The full favorite id (`type-routeId`) — used for removal + key. It is
   *  also the reader's `readingPositions` key, so a saved text can show the
   *  verse it was left at (frame 18). */
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
  const { t, i18n } = useTranslation();
  const isDarkMode = useStore(s => s.isDarkMode);
  const favoriteIds = useStore(s => s.favoriteIds);
  const readingPositions = useStore(s => s.readingPositions);
  const toggleFavorite = useStore(s => s.toggleFavorite);
  const colors = isDarkMode ? darkColors : lightColors;
  const isHi = i18n.language === 'hi';

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

  const openItem = (item: FavoriteItem) => {
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
    <ScreenMount>
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>

      {/* ── Header: back · display title ─────────────────────────────── */}
      <View style={[styles.headerRow, { paddingHorizontal: spacing.screenH }]}>
        <MotionPressable
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.back')}>
          <Icon name="chevron-left" size={22} color={colors.textSecondary} />
        </MotionPressable>
        <Text
          variant={isHi ? 'deva-bold' : 'display'}
          style={[styles.headerTitle, { color: colors.textPrimary }]}>
          {t('favorites.title')}
        </Text>
      </View>

      {items.length === 0 ? (
        <EmptyState colors={colors} />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.listContent, { paddingHorizontal: spacing.screenH }]}
          showsVerticalScrollIndicator={false}>

          <Text variant="kicker-small" style={[styles.sectionKicker, { color: colors.textMuted }]}>
            {t('favorites.textsSection', { count: items.length })}
          </Text>

          <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {items.map((item, i) => (
              <View key={item.favId}>
                {i > 0 && <View style={[styles.rowDivider, { backgroundColor: colors.divider }]} />}
                <FavoriteRow
                  item={item}
                  colors={colors}
                  isHi={isHi}
                  verseIndex={readingPositions[item.favId]}
                  onPress={() => openItem(item)}
                  onRemove={() => toggleFavorite(item.favId)}
                />
              </View>
            ))}
          </View>

          <View style={styles.adWrap}>
            <AdBanner colors={colors} placement="favoritesInline" inline />
          </View>
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

    </SafeAreaView>
    </ScreenMount>
  );
}

interface FavoriteRowProps {
  item: FavoriteItem;
  colors: ColorPalette;
  isHi: boolean;
  /** Saved reading position (verse index) from the reader, if any. */
  verseIndex: number | undefined;
  onPress: () => void;
  onRemove: () => void;
}

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

const FavoriteRow = memo(function FavoriteRow({ item, colors, isHi, verseIndex, onPress, onRemove }: FavoriteRowProps) {
  const { t } = useTranslation();
  const typeLabel = t(TYPE_BADGE[item.type]);
  // "Chalisa · Verse 18" — the reader stores positions under the same key.
  const caption =
    verseIndex != null && verseIndex > 0
      ? `${typeLabel} · ${t('reader.verseLabel', { num: verseIndex + 1 })}`
      : item.deityLabel
        ? `${typeLabel} · ${item.deityLabel}`
        : typeLabel;

  return (
    <MotionPressable
      pressedScale={0.98}
      onPress={onPress}
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={`${item.titleEnglish} — ${caption}`}>
      {item.deity ? (
        <DeityAvatar deity={item.deity} size={36} />
      ) : (
        <View style={styles.rowIconWrap}>
          <Icon name={TYPE_ICON[item.type]} size={19} color={colors.textTertiary} />
        </View>
      )}
      <View style={styles.rowText}>
        <Text variant="deva" style={[styles.rowTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {isHi ? item.titleHindi : item.titleEnglish}
        </Text>
        <Text variant="body-small" style={[styles.rowCaption, { color: colors.textMuted }]} numberOfLines={1}>
          {caption}
        </Text>
      </View>
      <FavoriteHeart
        active
        onPress={onRemove}
        size={18}
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
      <Icon name="heart-outline" size={30} color={colors.textDisabled} />
      <Text variant="title" style={[styles.emptyTitle, { color: colors.textPrimary }]}>
        {t('favorites.emptyTitle')}
      </Text>
      <Text variant="body" style={[styles.emptySub, { color: colors.textTertiary }]}>
        {t('favorites.emptyDesc')}
      </Text>
      <MotionPressable
        onPress={() => router.push('/(tabs)/library')}
        style={[styles.browseBtn, { borderColor: colors.borderAccent }]}
        accessibilityRole="button"
        accessibilityLabel={t('favorites.browseLibrary')}>
        <Text variant="title" style={[styles.browseBtnText, { color: colors.accentText }]}>
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
    alignItems: 'flex-end',
    gap: 12,
    paddingTop: 6,
    paddingBottom: 14,
  },
  headerTitle: { fontSize: 30, lineHeight: 38 },

  listContent: { paddingTop: 2, paddingBottom: 32 },
  sectionKicker: { fontSize: 9.5, marginBottom: 11, paddingHorizontal: 4 },

  listCard: {
    borderRadius: borderRadius.list,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 14,
    paddingHorizontal: 17,
  },
  rowDivider: { height: StyleSheet.hairlineWidth, marginLeft: 48 },
  rowIconWrap: { width: 36, alignItems: 'center' },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 16, lineHeight: 22 },
  rowCaption: { fontSize: 12, marginTop: 1 },

  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 40,
  },
  emptyTitle: { fontSize: 18, marginTop: 4 },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  browseBtn: {
    marginTop: 12,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: borderRadius.button,
    borderWidth: 1,
  },
  browseBtnText: { fontSize: 13.5 },

  adWrap: { marginTop: 16 },
});
