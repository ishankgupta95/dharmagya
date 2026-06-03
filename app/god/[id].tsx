import { useCallback, useMemo, memo } from 'react';
import { MotionPressable } from '@/components/common/MotionPressable';
import {
  View,
  Dimensions,
  SectionList,
  StyleSheet,
  SectionListRenderItemInfo,
  SectionListData,
} from 'react-native';
import { Image } from 'expo-image';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Icon } from '@/components/common/Icon';
import { useTranslation } from 'react-i18next';

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
import { getPujasForDeity } from '@/config/poojas';
import { getKathasForDeity, type Katha } from '@/config/kathas';
import { getScripturesForDeity, type Scripture } from '@/config/scriptures';
import {
  getAartiForDeity,
  getChalisaForDeity,
  getAshtottaraForDeity,
  getSahasranamaForDeity,
  getStotrasForDeity,
  getSuktasForDeity,
  type Recitation,
  type Chalisa,
  type Ashtottara,
  type Sahasranama,
  type Stotra,
  type Sukta,
} from '@/services/content';

type ListItem =
  | { type: 'aarti'; data: Recitation }
  | { type: 'chalisa'; data: Chalisa }
  | { type: 'ashtottara'; data: Ashtottara }
  | { type: 'sahasranama'; data: Sahasranama }
  | { type: 'stotra'; data: Stotra }
  | { type: 'sukta'; data: Sukta }
  | { type: 'katha'; data: Katha }
  | { type: 'scripture'; data: Scripture };

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
  const ashtottara = useMemo(() => (deity ? getAshtottaraForDeity(deity.id) : undefined), [deity]);
  const sahasranama = useMemo(() => (deity ? getSahasranamaForDeity(deity.id) : undefined), [deity]);
  const stotras = useMemo(() => (deity ? getStotrasForDeity(deity.id) : []), [deity]);
  const suktas = useMemo(() => (deity ? getSuktasForDeity(deity.id) : []), [deity]);
  const kathas = useMemo(() => (deity ? getKathasForDeity(deity.id) : []), [deity]);
  const scriptures = useMemo(() => (deity ? getScripturesForDeity(deity.id) : []), [deity]);

  const sections = useMemo<ListSection[]>(() => {
    const result: ListSection[] = [];
    if (aarti) result.push({ title: t('god.aartiBadge'), data: [{ type: 'aarti', data: aarti }] });
    if (chalisa) result.push({ title: t('god.chalisaBadge'), data: [{ type: 'chalisa', data: chalisa }] });
    if (ashtottara) result.push({ title: t('god.ashtottaraBadge'), data: [{ type: 'ashtottara', data: ashtottara }] });
    if (sahasranama) result.push({ title: t('god.sahasranamaBadge'), data: [{ type: 'sahasranama', data: sahasranama }] });
    if (stotras.length > 0) {
      result.push({
        title: t('god.stotraBadge'),
        data: stotras.map((s) => ({ type: 'stotra', data: s })),
      });
    }
    if (suktas.length > 0) {
      result.push({
        title: t('god.suktaBadge'),
        data: suktas.map((s) => ({ type: 'sukta', data: s })),
      });
    }
    if (kathas.length > 0) {
      result.push({
        title: t('god.kathaBadge'),
        data: kathas.map((k) => ({ type: 'katha', data: k })),
      });
    }
    if (scriptures.length > 0) {
      result.push({
        title: t('god.scriptureBadge'),
        data: scriptures.map((s) => ({ type: 'scripture', data: s })),
      });
    }
    return result;
  }, [aarti, chalisa, ashtottara, sahasranama, stotras, suktas, kathas, scriptures, t]);

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
      if (item.type === 'chalisa') {
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
      }
      if (item.type === 'ashtottara') {
        // Ashtottara — 108-name litany; chevron card pushing the names reader.
        const a = item.data;
        return (
          <ContentCard
            titleHindi={a.titleHindi}
            titleEnglish={a.titleEnglish}
            badge={t('god.ashtottaraBadge')}
            secondary={t('ashtottara.nameCount', { count: a.names.length })}
            colors={colors}
            onPress={() => router.push({ pathname: '/ashtottara/[id]', params: { id: a.deity } })}
          />
        );
      }
      if (item.type === 'sahasranama') {
        const s = item.data;
        return (
          <ContentCard
            titleHindi={s.titleHindi}
            titleEnglish={s.titleEnglish}
            badge={t('god.sahasranamaBadge')}
            secondary={t('sahasranama.nameCount', { count: s.namavali.length })}
            colors={colors}
            onPress={() => router.push({ pathname: '/sahasranama/[slug]', params: { slug: s.slug } })}
          />
        );
      }
      if (item.type === 'stotra') {
        const s = item.data;
        return (
          <ContentCard
            titleHindi={s.titleHindi}
            titleEnglish={s.titleEnglish}
            badge={t('god.stotraBadge')}
            colors={colors}
            onPress={() => router.push({ pathname: '/stotra/[slug]', params: { slug: s.slug } })}
          />
        );
      }
      if (item.type === 'sukta') {
        const s = item.data;
        return (
          <ContentCard
            titleHindi={s.titleHindi}
            titleEnglish={s.titleEnglish}
            badge={t('god.suktaBadge')}
            colors={colors}
            onPress={() => router.push({ pathname: '/sukta/[slug]', params: { slug: s.slug } })}
          />
        );
      }
      if (item.type === 'katha') {
        // Katha — no favorite (favorites are aarti/chalisa-keyed); the card
        // shows a chevron and pushes the katha reader.
        const k = item.data;
        return (
          <ContentCard
            titleHindi={k.titleHindi}
            titleEnglish={k.titleEnglish}
            badge={t('god.kathaBadge')}
            colors={colors}
            onPress={() => router.push({ pathname: '/katha/[slug]', params: { slug: k.slug } })}
          />
        );
      }
      // Scripture — same chevron treatment as katha; pushes the scripture
      // detail screen (chapter list for Geeta, single-CTA for Sundarkand).
      const s = item.data;
      return (
        <ContentCard
          titleHindi={s.titleHindi}
          titleEnglish={s.titleEnglish}
          badge={t('god.scriptureBadge')}
          colors={colors}
          onPress={() => router.push({ pathname: '/scripture/[id]', params: { id: s.slug } })}
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
        keyExtractor={(item) => `${item.type}-${item.data.slug}`}
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
  const featuredPuja = useMemo(() => getPujasForDeity(deityId)[0], [deityId]);

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
            {/* Deity-color gradient sits at full opacity underneath as the
                always-visible scrim; the photo cross-fades in over it once
                decoded (expo-image transition), so the container is never
                blank — only the gradient, then the photo settling in. */}
            <Image
              source={image}
              style={styles.heroImage}
              contentFit="cover"
              transition={320}
              cachePolicy="memory-disk"
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

      <MotionPressable
        onPress={onBack}
        style={styles.heroBackBtn}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={t('a11y.back')}>
        <Icon name="chevron-left" size={18} color={palette.parchmentBright} />
      </MotionPressable>

      <View style={styles.heroMeta}>
        <Text variant="display-italic" style={[styles.heroName, { color: colors.textPrimary }]}>
          {displayName}
        </Text>
        <Text variant="body-italic" style={[styles.heroDescription, { color: colors.textTertiary }]}>
          {description}
        </Text>
        <View style={styles.heroCtaRow}>
          {featuredPuja && (
            <MotionPressable
              onPress={() => router.push({ pathname: '/pooja/[slug]', params: { slug: featuredPuja.slug } })}
              pressedScale={0.97}
              style={[styles.heroShareBtn, { borderColor: colors.borderAccent, backgroundColor: colors.surface }]}
              accessibilityRole="button"
              accessibilityLabel={t('puja.openDeityPuja', { name: featuredPuja.name[lang] })}>
              <Icon name="gift" size={13} color={colors.accent} />
              <Text variant="mono-caps" style={[styles.heroShareText, { color: colors.accent }]}>
                {t('puja.openPujaCta')}
              </Text>
            </MotionPressable>
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
  /** Favorite controls are optional — kathas have no favorite, so the card
   *  falls back to a chevron when `onToggleFavorite` is omitted. */
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
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
    <MotionPressable
      pressedScale={0.97}
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
      {onToggleFavorite ? (
        <FavoriteHeart
          active={!!isFavorite}
          onPress={onToggleFavorite}
          size={20}
          inactiveColor={colors.textMuted}
          activeColor={colors.accent}
          accessibilityLabel={t(isFavorite ? 'a11y.removeFavorite' : 'a11y.addFavorite')}
        />
      ) : (
        <Icon name="chevron-right" size={18} color={colors.textMuted} />
      )}
    </MotionPressable>
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
