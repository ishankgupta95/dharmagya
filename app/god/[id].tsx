import { useMemo, memo } from 'react';
import { MotionPressable } from '@/components/common/MotionPressable';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Icon, type IconName } from '@/components/common/Icon';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, palette, spacing, type ColorPalette } from '@/config/theme';
import { AdBanner } from '@/components/common/AdBanner';
import { ScreenMount } from '@/components/common/ScreenMount';
import { FavoriteHeart } from '@/components/common/FavoriteHeart';
import { DEITY_BY_ID } from '@/config/deities';
import { useInterstitialOnExit } from '@/hooks/useInterstitialOnExit';
import { getDeityImage } from '@/config/deityImages';
import { getPujasForDeity } from '@/config/poojas';
import { getKathasForDeity } from '@/config/kathas';
import { getScripturesForDeity } from '@/config/scriptures';
import { VAAR_DEVATA } from '@/config/vaarDevata';
import {
  getAartiForDeity,
  getChalisaForDeity,
  getAshtottaraForDeity,
  getSahasranamaForDeity,
  getStotrasForDeity,
  getSuktasForDeity,
  getAllAppMantras,
} from '@/services/content';

// One row in the texts card. `fav` swaps the trailing chevron for the heart.
interface TextRow {
  key: string;
  icon: IconName;
  titleHindi: string;
  titleEnglish: string;
  caption?: string;
  favKey?: string;
  onPress: () => void;
}

/**
 * Deity detail (frame 19) — portrait tile under a bottom scrim on the deity's
 * colour wash, the mool-mantra card as the primary action, then every text for
 * this form as one grouped list.
 */
export default function GodDetailScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isDarkMode = useStore(s => s.isDarkMode);
  const favoriteIds = useStore(s => s.favoriteIds);
  const toggleFavorite = useStore(s => s.toggleFavorite);
  const colors = isDarkMode ? darkColors : lightColors;
  const isHi = i18n.language === 'hi';
  const deity = DEITY_BY_ID[id ?? ''];

  useInterstitialOnExit();

  // Weekdays traditionally associated with this form (vaar devata dataset).
  const vaarDays = useMemo(
    () =>
      deity
        ? VAAR_DEVATA.filter(day => day.deities.some(d => d.rosterId === deity.id))
        : [],
    [deity],
  );

  const moolMantra = useMemo(
    () => (deity ? getAllAppMantras().find(m => m.deity === deity.id) : undefined),
    [deity],
  );

  const rows = useMemo<TextRow[]>(() => {
    if (!deity) return [];
    const out: TextRow[] = [];
    const aarti = getAartiForDeity(deity.id);
    if (aarti) {
      out.push({
        key: 'aarti', icon: 'flame',
        titleHindi: aarti.titleHindi, titleEnglish: aarti.titleEnglish,
        favKey: `aarti-${aarti.deity}`,
        onPress: () => router.push(`/aarti/${aarti.deity}`),
      });
    }
    const chalisa = getChalisaForDeity(deity.id);
    if (chalisa) {
      const chaupaiCount = chalisa.chaupai.hindi.length;
      out.push({
        key: 'chalisa', icon: 'text',
        titleHindi: chalisa.titleHindi, titleEnglish: chalisa.titleEnglish,
        caption: chaupaiCount > 0 ? t('god.chaupaiCount', { count: chaupaiCount }) : undefined,
        favKey: `chalisa-${chalisa.deity}`,
        onPress: () => router.push(`/chalisa/${chalisa.deity}`),
      });
    }
    const ashtottara = getAshtottaraForDeity(deity.id);
    if (ashtottara) {
      out.push({
        key: 'ashtottara', icon: 'lotus',
        titleHindi: ashtottara.titleHindi, titleEnglish: ashtottara.titleEnglish,
        caption: t('ashtottara.nameCount', { count: ashtottara.names.length }),
        onPress: () => router.push({ pathname: '/ashtottara/[id]', params: { id: ashtottara.deity } }),
      });
    }
    const sahasranama = getSahasranamaForDeity(deity.id);
    if (sahasranama) {
      out.push({
        key: 'sahasranama', icon: 'lotus',
        titleHindi: sahasranama.titleHindi, titleEnglish: sahasranama.titleEnglish,
        caption: t('sahasranama.nameCount', { count: sahasranama.namavali.length }),
        onPress: () => router.push({ pathname: '/sahasranama/[slug]', params: { slug: sahasranama.slug } }),
      });
    }
    for (const s of getStotrasForDeity(deity.id)) {
      out.push({
        key: `stotra-${s.slug}`, icon: 'lotus',
        titleHindi: s.titleHindi, titleEnglish: s.titleEnglish,
        caption: t('god.stotraBadge'),
        onPress: () => router.push({ pathname: '/stotra/[slug]', params: { slug: s.slug } }),
      });
    }
    for (const s of getSuktasForDeity(deity.id)) {
      out.push({
        key: `sukta-${s.slug}`, icon: 'flower',
        titleHindi: s.titleHindi, titleEnglish: s.titleEnglish,
        caption: t('god.suktaBadge'),
        onPress: () => router.push({ pathname: '/sukta/[slug]', params: { slug: s.slug } }),
      });
    }
    for (const k of getKathasForDeity(deity.id)) {
      out.push({
        key: `katha-${k.slug}`, icon: 'text',
        titleHindi: k.titleHindi, titleEnglish: k.titleEnglish,
        caption: t('god.kathaBadge'),
        onPress: () => router.push({ pathname: '/katha/[slug]', params: { slug: k.slug } }),
      });
    }
    for (const s of getScripturesForDeity(deity.id)) {
      out.push({
        key: `scripture-${s.slug}`, icon: 'school',
        titleHindi: s.titleHindi, titleEnglish: s.titleEnglish,
        caption: t('god.scriptureBadge'),
        onPress: () => router.push({ pathname: '/scripture/[id]', params: { id: s.slug } }),
      });
    }
    for (const p of getPujasForDeity(deity.id)) {
      const stepCount = p.preUpacharas.length + p.upacharas.length + p.postUpacharas.length;
      out.push({
        key: `puja-${p.slug}`, icon: 'gift',
        titleHindi: p.name.hi, titleEnglish: p.name.en,
        caption: t('puja.stepCount', { count: stepCount }),
        onPress: () => router.push({ pathname: '/pooja/[slug]', params: { slug: p.slug } }),
      });
    }
    return out;
  }, [deity, t]);

  if (!deity) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
        <Text variant="body" style={[styles.emptyText, { color: colors.textMuted }]}>
          {t('god.deityNotFound')}
        </Text>
      </SafeAreaView>
    );
  }

  const image = getDeityImage(deity.id);
  const washColors = isDarkMode
    ? ([`${deity.color}4D`, `${deity.color}0D`, `${palette.night}00`] as const)
    : ([`${deity.color}38`, `${deity.color}0D`, `${palette.rice}00`] as const);

  return (
    <ScreenMount>
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
      <LinearGradient
        colors={washColors}
        locations={[0, 0.6, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.wash}
        pointerEvents="none"
      />

      <View style={[styles.headerRow, { paddingHorizontal: spacing.screenH }]}>
        <MotionPressable
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.back')}>
          <Icon name="chevron-left" size={22} color={colors.textPrimary} />
        </MotionPressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
        showsVerticalScrollIndicator={false}>

        {/* ── Portrait under a bottom scrim ─────────────────────────────── */}
        <View
          style={[
            styles.portrait,
            {
              borderColor: `${deity.color}59`,
              backgroundColor: colors.surfaceRaised,
              shadowColor: deity.color,
            },
          ]}>
          {image ? (
            <>
              <Image source={image} style={StyleSheet.absoluteFill} contentFit="cover" transition={320} cachePolicy="memory-disk" />
              <LinearGradient
                colors={['rgba(11,8,16,0)', 'rgba(11,8,16,0.55)']}
                locations={[0.45, 1]}
                style={StyleSheet.absoluteFill}
              />
            </>
          ) : (
            <Text variant="deva-bold" style={styles.portraitInitial}>
              {deity.initial}
            </Text>
          )}
        </View>

        <Text variant="deva-bold" style={[styles.heroName, { color: colors.textPrimary }]}>
          {deity.nameHindi}
        </Text>
        <Text variant="display" style={[styles.heroLatin, { color: colors.textSecondary }]}>
          {deity.name}
        </Text>
        <Text variant="body-small" style={[styles.heroDescription, { color: colors.textTertiary }]}>
          {t(`deities.${deity.id}.description`)}
        </Text>

        {/* ── Weekday association chips → vaar detail ───────────────────── */}
        {vaarDays.length > 0 && (
          <View style={styles.dayChips}>
            {vaarDays.map(day => (
              <MotionPressable
                key={day.dayKey}
                onPress={() => router.push({ pathname: '/vaar/[day]', params: { day: day.dayKey } })}
                pressedScale={0.97}
                style={[styles.dayChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
                accessibilityRole="button"
                accessibilityLabel={day.dayName.en}>
                <Text variant="body-small" style={[styles.dayChipText, { color: colors.textSecondary }]}>
                  {day.dayName.hi} · {day.dayName.en}
                </Text>
              </MotionPressable>
            ))}
          </View>
        )}

        {/* ── Mool mantra — the primary action ──────────────────────────── */}
        {moolMantra && (
          <View style={[styles.mantraCard, { backgroundColor: colors.surface, borderColor: colors.borderAccent }]}>
            <Text variant="kicker-small" style={[styles.mantraKicker, { color: colors.accentText }]}>
              {t('god.moolMantra')}
            </Text>
            <Text variant="deva-bold" style={[styles.mantraText, { color: colors.textPrimary }]}>
              {moolMantra.titleHindi}
            </Text>
            <MotionPressable
              onPress={() => router.push({ pathname: '/jaap/[slug]', params: { slug: moolMantra.slug } })}
              style={[styles.mantraCta, { borderTopColor: colors.divider }]}
              accessibilityRole="button"
              accessibilityLabel={t('puja.a11yStartJaap')}>
              <Icon name="flame" size={16} color={colors.accent} />
              <Text variant="title" style={[styles.mantraCtaText, { color: colors.accentText }]}>
                {t('puja.startJaap')}
              </Text>
              <Text variant="body-small" style={{ color: colors.textMuted }}>
                {t('god.jaapRecommended', { count: moolMantra.recommendedCount ?? 108 })}
              </Text>
            </MotionPressable>
          </View>
        )}

        {/* ── Every text for this form, one grouped list ────────────────── */}
        {rows.length > 0 ? (
          <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {rows.map((row, i) => (
              <View key={row.key}>
                {i > 0 && <View style={[styles.rowDivider, { backgroundColor: colors.divider }]} />}
                <TextRowItem
                  row={row}
                  colors={colors}
                  isHi={isHi}
                  isFavorite={row.favKey ? favoriteIds.includes(row.favKey) : false}
                  onToggleFavorite={row.favKey ? () => toggleFavorite(row.favKey!) : undefined}
                />
              </View>
            ))}
          </View>
        ) : (
          <Text variant="body" style={[styles.emptyText, { color: colors.textMuted }]}>
            {t('god.noContent')}
          </Text>
        )}

        <View style={styles.adWrap}>
          <AdBanner colors={colors} placement="godDetailInline" inline />
        </View>
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
    </ScreenMount>
  );
}

const TextRowItem = memo(function TextRowItem({
  row,
  colors,
  isHi,
  isFavorite,
  onToggleFavorite,
}: {
  row: TextRow;
  colors: ColorPalette;
  isHi: boolean;
  isFavorite: boolean;
  onToggleFavorite?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <MotionPressable
      pressedScale={0.98}
      onPress={row.onPress}
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={`${row.titleEnglish}${row.caption ? ` — ${row.caption}` : ''}`}>
      <Icon name={row.icon} size={19} color={colors.accent} />
      <Text variant="deva" style={[styles.rowTitle, { color: colors.textPrimary }]} numberOfLines={1}>
        {isHi ? row.titleHindi : row.titleEnglish}
      </Text>
      {row.caption && (
        <Text variant="body-small" style={[styles.rowCaption, { color: colors.textMuted }]} numberOfLines={1}>
          {row.caption}
        </Text>
      )}
      {onToggleFavorite ? (
        <FavoriteHeart
          active={isFavorite}
          onPress={onToggleFavorite}
          size={17}
          inactiveColor={colors.textMuted}
          activeColor={colors.accent}
          accessibilityLabel={t(isFavorite ? 'a11y.removeFavorite' : 'a11y.addFavorite')}
        />
      ) : (
        <Icon name="chevron-right" size={14} color={colors.textDisabled} />
      )}
    </MotionPressable>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  wash: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 300,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 8,
  },
  scroll: { paddingTop: 16, paddingBottom: 24 },

  portrait: {
    width: 88,
    height: 88,
    borderRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.22,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  portraitInitial: { fontSize: 40, lineHeight: 56, color: palette.bone },

  heroName: { fontSize: 38, lineHeight: 50, marginTop: 18 },
  heroLatin: { fontSize: 22, lineHeight: 28, marginTop: 2 },
  heroDescription: { fontSize: 13.5, lineHeight: 20, marginTop: 10 },

  dayChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  dayChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    borderWidth: 1,
  },
  dayChipText: { fontSize: 12.5, lineHeight: 18 },

  mantraCard: {
    marginTop: 22,
    borderRadius: borderRadius.card,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 17,
  },
  mantraKicker: { fontSize: 9.5, marginBottom: 10 },
  mantraText: { fontSize: 20, lineHeight: 31 },
  mantraCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  mantraCtaText: { fontSize: 13.5, flex: 1 },

  listCard: {
    marginTop: 16,
    borderRadius: borderRadius.list,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 15,
    paddingHorizontal: 18,
  },
  rowDivider: { height: StyleSheet.hairlineWidth, marginLeft: 50 },
  rowTitle: { flex: 1, fontSize: 15.5, lineHeight: 22 },
  rowCaption: { fontSize: 12, maxWidth: 110 },

  emptyText: {
    textAlign: 'center',
    fontSize: 15,
    marginTop: 48,
  },
  adWrap: { marginTop: 20 },
});
