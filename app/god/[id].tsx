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
import { Icon } from '@/components/common/Icon';
import { useTranslation } from 'react-i18next';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

import { durations, easings } from '@/config/motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, palette, spacing, type ColorPalette } from '@/config/theme';
import { AdBanner } from '@/components/common/AdBanner';
import { Kicker } from '@/components/common/Kicker';
import { Ornament } from '@/components/common/Ornament';
import { ScreenMount } from '@/components/common/ScreenMount';
import { FavoriteHeart } from '@/components/common/FavoriteHeart';
import { DEITY_BY_ID } from '@/config/deities';
import { useInterstitialOnExit } from '@/hooks/useInterstitialOnExit';
import { getDeityImage } from '@/config/deityImages';
import { useShareSheet } from '@/store/useShareSheet';
import { getPujasForDeity } from '@/config/pujas';
import {
  getAartiForDeity,
  getChalisaForDeity,
  getAllAppMantras,
  type Recitation,
  type Chalisa,
} from '@/services/content';

const AnimatedImage = Animated.createAnimatedComponent(Image);

type ListItem =
  | { type: 'aarti'; data: Recitation }
  | { type: 'chalisa'; data: Chalisa };

interface ListSection {
  title: string;
  data: ListItem[];
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const HERO_HEIGHT = 280;

export default function GodDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isDarkMode = useStore(s => s.isDarkMode);
  const favoriteIds = useStore(s => s.favoriteIds);
  const toggleFavorite = useStore(s => s.toggleFavorite);
  const colors = isDarkMode ? darkColors : lightColors;
  const deity = DEITY_BY_ID[id ?? ''];

  useInterstitialOnExit();

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
          <ContentCard
            titleHindi={a.titleHindi}
            titleEnglish={a.titleEnglish}
            badge={t('god.aartiBadge')}
            colors={colors}
            isFavorite={favoriteIds.includes(favKey)}
            onToggleFavorite={() => toggleFavorite(favKey)}
            onPress={() => router.push(`/aarti/${a.deity}`)}
          />
        );
      }
      const c = item.data;
      const favKey = `chalisa-${c.deity}`;
      const chaupaiCount = c.chaupai.hindi.length;
      return (
        <ContentCard
          titleHindi={c.titleHindi}
          titleEnglish={c.titleEnglish}
          badge={t('god.chalisaBadge')}
          secondary={chaupaiCount > 0 ? t('god.chaupaiCount', { count: chaupaiCount }) : undefined}
          colors={colors}
          isFavorite={favoriteIds.includes(favKey)}
          onToggleFavorite={() => toggleFavorite(favKey)}
          onPress={() => router.push(`/chalisa/${c.deity}`)}
        />
      );
    },
    [colors, favoriteIds, toggleFavorite, t]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionListData<ListItem, ListSection> }) => (
      <View style={[styles.sectionHeader, { backgroundColor: colors.base }]}>
        <Kicker
          color={colors.accent}
          size={10}
          withTrailingRule
          ruleColor={colors.divider}>
          {section.title}
        </Kicker>
      </View>
    ),
    [colors]
  );

  if (!deity) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
        <Text variant="body-italic" style={[styles.emptyText, { color: colors.textMuted }]}>
          {t('god.deityNotFound')}
        </Text>
      </SafeAreaView>
    );
  }

  const deityImage = getDeityImage(deity.id);
  const hasImage = !!deityImage;
  const deityColor = deity.color;

  return (
    <ScreenMount>
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>

      <SectionList
        sections={sections}
        keyExtractor={(item) => `${item.type}-${item.data.deity}`}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={ListItemSeparator}
        SectionSeparatorComponent={ListSectionSeparator}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <HeroBlock
            deityId={deity.id}
            deityColor={deityColor}
            displayName={t(`deities.${deity.id}.displayName`)}
            description={t(`deities.${deity.id}.description`)}
            image={hasImage ? deityImage : null}
            colors={colors}
            onBack={() => router.back()}
          />
        }
        ListEmptyComponent={
          <Text variant="body-italic" style={[styles.emptyText, { color: colors.textMuted }]}>
            {t('god.noContent')}
          </Text>
        }
        ListFooterComponent={
          <View style={styles.adWrap}>
            <AdBanner colors={colors} placement="godDetailInline" inline />
          </View>
        }
      />
    </SafeAreaView>
    </ScreenMount>
  );
}

interface HeroBlockProps {
  deityId: string;
  deityColor: string;
  displayName: string;
  description: string;
  image: ReturnType<typeof getDeityImage> | null;
  colors: ColorPalette;
  onBack: () => void;
}

function HeroBlock({ deityId, deityColor, displayName, description, image, colors, onBack }: HeroBlockProps) {
  const { t, i18n } = useTranslation();
  const lang: 'en' | 'hi' = i18n.language === 'hi' ? 'hi' : 'en';
  const meta = DEITY_BY_ID[deityId];
  const initial = meta?.initial ?? 'ॐ';
  const openShare = useShareSheet(s => s.open);
  const sigMantra = useMemo(
    () => getAllAppMantras().find(m => m.deity === deityId)?.text.devanagari?.split('\n')[0],
    [deityId],
  );
  const featuredPuja = useMemo(() => getPujasForDeity(deityId)[0], [deityId]);
  // Hero photo fades 0→1 over 320ms once decoded (P11.6). Deity-color gradient
  // sits at full opacity underneath as the always-visible scrim, so the user
  // never sees a blank container — only the gradient, then the photo settling
  // in on top of it.
  const { dur } = useReducedMotion();
  const heroOpacity = useSharedValue(0);
  const heroAnimStyle = useAnimatedStyle(() => ({ opacity: heroOpacity.value }));

  return (
    <View style={styles.heroWrap}>
      <View style={styles.heroPortrait}>
        <LinearGradient
          colors={[`${deityColor}E6`, `${deityColor}55`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {image ? (
          <>
            <AnimatedImage
              source={image}
              style={[styles.heroImage, heroAnimStyle]}
              resizeMode="cover"
              onLoad={() => {
                heroOpacity.value = withTiming(1, {
                  duration: dur(durations.slow),
                  easing: easings.standard,
                });
              }}
            />
            <LinearGradient
              colors={['transparent', 'rgba(20,10,4,0.55)']}
              style={styles.heroImageShade}
            />
          </>
        ) : (
          <>
            {/* Bone-white double halo (solid inner + dashed outer) — Library card treatment at hero scale. */}
            <View style={styles.heroHaloOuter} />
            <View style={styles.heroHaloInner} />
            <Text
              variant="deva-bold"
              style={styles.heroInitial}>
              {initial}
            </Text>
          </>
        )}
      </View>

      <TouchableOpacity
        onPress={onBack}
        style={styles.heroBackBtn}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={t('a11y.back')}>
        <Icon name="chevron-left" size={18} color={palette.parchmentBright} />
      </TouchableOpacity>

      <View style={styles.heroMeta}>
        <Text variant="display-italic" style={[styles.heroName, { color: colors.textPrimary }]}>
          {displayName}
        </Text>
        <Text variant="body-italic" style={[styles.heroDescription, { color: colors.textTertiary }]}>
          {description}
        </Text>
        <View style={styles.heroCtaRow}>
          <TouchableOpacity
            onPress={() => openShare({ kind: 'deity-blessing', deityId, mantraHi: sigMantra })}
            activeOpacity={0.85}
            style={[styles.heroShareBtn, { borderColor: colors.borderAccent, backgroundColor: colors.surface }]}
            accessibilityRole="button"
            accessibilityLabel={t('share.a11yShare')}>
            <Icon name="share" size={13} color={colors.accent} />
            <Text variant="mono-caps" style={[styles.heroShareText, { color: colors.accent }]}>
              {t('share.ctaDeity')}
            </Text>
          </TouchableOpacity>
          {featuredPuja && (
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/puja/[slug]', params: { slug: featuredPuja.slug } })}
              activeOpacity={0.85}
              style={[styles.heroShareBtn, { borderColor: colors.borderAccent, backgroundColor: colors.surface }]}
              accessibilityRole="button"
              accessibilityLabel={t('puja.openDeityPuja', { name: featuredPuja.name[lang] })}>
              <Icon name="gift" size={13} color={colors.accent} />
              <Text variant="mono-caps" style={[styles.heroShareText, { color: colors.accent }]}>
                {t('puja.openPujaCta')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <Ornament variant="lotus" style={styles.heroOrnament} />
      </View>
    </View>
  );
}

const ListItemSeparator = () => <View style={{ height: spacing.gridGap }} />;
const ListSectionSeparator = ({ leadingItem }: { leadingItem?: unknown }) =>
  leadingItem ? <View style={{ height: 8 }} /> : null;

interface ContentCardProps {
  titleHindi: string;
  titleEnglish: string;
  badge: string;
  secondary?: string;
  colors: ColorPalette;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onPress: () => void;
}

const ContentCard = memo(function ContentCard({
  titleHindi,
  titleEnglish,
  badge,
  secondary,
  colors,
  isFavorite,
  onToggleFavorite,
  onPress,
}: ContentCardProps) {
  const { t } = useTranslation();
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityRole="button"
      accessibilityLabel={`${titleEnglish} — ${badge}`}>
      <View style={styles.cardText}>
        <Text variant="deva-bold" style={[styles.cardTitleNative, { color: colors.textPrimary }]} numberOfLines={1}>
          {titleHindi}
        </Text>
        <Text variant="body-italic" style={[styles.cardTitleEn, { color: colors.textTertiary }]} numberOfLines={1}>
          {titleEnglish}
        </Text>
        <View style={styles.metaRow}>
          <Text variant="mono-caps" style={[styles.metaKicker, { color: palette.gold }]}>
            {badge}
          </Text>
          {secondary && (
            <>
              <View style={[styles.metaDot, { backgroundColor: colors.textMuted }]} />
              <Text variant="body-italic" style={[styles.metaSecondary, { color: colors.textTertiary }]}>
                {secondary}
              </Text>
            </>
          )}
        </View>
      </View>
      <FavoriteHeart
        active={isFavorite}
        onPress={onToggleFavorite}
        size={20}
        inactiveColor={colors.textMuted}
        activeColor={colors.accent}
        accessibilityLabel={t(isFavorite ? 'a11y.removeFavorite' : 'a11y.addFavorite')}
      />
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1 },

  listContent: { paddingBottom: 32 },

  // Hero
  heroWrap: {
    marginBottom: 12,
  },
  heroPortrait: {
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImage: {
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
  },
  heroImageShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 120,
  },
  heroHaloOuter: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(251,243,222,0.25)',
  },
  heroHaloInner: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 1,
    borderColor: 'rgba(251,243,222,0.38)',
  },
  heroInitial: {
    fontSize: 96,
    lineHeight: 110,
    color: 'rgba(251,243,222,0.97)',
    textShadowColor: 'rgba(20,10,4,0.28)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  heroBackBtn: {
    position: 'absolute',
    top: 8,
    left: spacing.screenH,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(20,10,4,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  heroMeta: {
    alignItems: 'center',
    paddingHorizontal: spacing.screenH,
    paddingTop: 18,
    gap: 6,
  },
  heroName: {
    fontSize: 32,
    lineHeight: 38,
    textAlign: 'center',
    marginTop: 4,
  },
  heroDescription: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: spacing.cardPadLg,
  },
  heroCtaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
  },
  heroShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: borderRadius.chip,
    borderWidth: 1,
  },
  heroShareText: { fontSize: 9 },
  heroOrnament: {
    marginTop: 12,
    width: '55%',
  },

  // Sections + list
  sectionHeader: {
    paddingTop: 20,
    paddingBottom: 12,
    paddingHorizontal: spacing.screenH,
  },

  emptyText: {
    textAlign: 'center',
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
    marginHorizontal: spacing.screenH,
  },
  cardText: { flex: 1 },
  cardTitleNative: { fontSize: 16, lineHeight: 22, marginBottom: 2 },
  cardTitleEn: { fontSize: 12, lineHeight: 16, marginBottom: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaKicker: { fontSize: 9 },
  metaDot: { width: 3, height: 3, borderRadius: 1.5 },
  metaSecondary: { fontSize: 12, flexShrink: 1 },

  adWrap: { marginHorizontal: spacing.screenH, marginTop: 20 },
});
