import { useMemo, useState } from 'react';
import { MotionPressable } from '@/components/common/MotionPressable';
import { View, StyleSheet } from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Icon } from '@/components/common/Icon';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, spacing } from '@/config/theme';
import { ScreenMount } from '@/components/common/ScreenMount';
import { FavoriteHeart } from '@/components/common/FavoriteHeart';
import { LangToggle } from '@/components/common/LangToggle';
import { FocusReader, type FocusVerse } from '@/components/reader/FocusReader';
import { useInterstitialOnExit } from '@/hooks/useInterstitialOnExit';
import i18n, { resolveLanguage } from '@/i18n';
import {
  getChalisaForDeity,
  chalisaSections,
  titleFor,
  type ContentLang,
} from '@/services/content';

// Diya reader (frame 07): the chalisa is the reference text for the focus
// reader — the current chaupai holds full weight, neighbours fade back, the
// glass pill steps between verses and keeps the position. Doha/soratha
// sections keep their own labels; chaupais number globally ("चौपाई 18").
export default function ChalisaDetailScreen() {
  useInterstitialOnExit();
  const { t } = useTranslation();
  const { id: deitySlug } = useLocalSearchParams<{ id: string }>();
  const isDarkMode = useStore(s => s.isDarkMode);
  const favoriteIds = useStore(s => s.favoriteIds);
  const toggleFavorite = useStore(s => s.toggleFavorite);
  const appLanguage = useStore(s => s.language);
  const colors = isDarkMode ? darkColors : lightColors;

  const chalisa = useMemo(() => (deitySlug ? getChalisaForDeity(deitySlug) : undefined), [deitySlug]);

  const [lang, setLang] = useState<ContentLang>(() => resolveLanguage(appLanguage));

  const favoriteKey = `chalisa-${deitySlug ?? ''}`;
  const isFavorite = favoriteIds.includes(favoriteKey);

  const tForLang = useMemo(() => i18n.getFixedT(lang, 'translation'), [lang]);

  const verses = useMemo<FocusVerse[]>(() => {
    if (!chalisa) return [];
    const flat: FocusVerse[] = [];
    let chaupaiNum = 0;
    for (const section of chalisaSections(chalisa, lang)) {
      for (const text of section.verses) {
        const label = section.type === 'chaupai'
          ? `${section.label} ${++chaupaiNum}`
          : section.label;
        flat.push({ label, text });
      }
    }
    return flat;
  }, [chalisa, lang]);

  if (!chalisa) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
        <View style={styles.notFoundWrap}>
          <Text variant="body" style={[styles.notFoundText, { color: colors.textMuted }]}>
            {t('chalisa.notFound')}
          </Text>
          <MotionPressable
            onPress={() => router.back()}
            style={[styles.notFoundBtn, { borderColor: colors.accent }]}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.back')}>
            <Text variant="kicker" style={[styles.notFoundBtnText, { color: colors.accentText }]}>
              {t('common.back') ?? 'Back'}
            </Text>
          </MotionPressable>
        </View>
      </SafeAreaView>
    );
  }

  const title = titleFor(chalisa, lang);

  return (
    <ScreenMount>
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>

      {/* ── Nav row: back · title · favorite ────────────────────────────── */}
      <View style={styles.navRow}>
        <MotionPressable
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.back')}>
          <Icon name="chevron-left" size={22} color={colors.textSecondary} />
        </MotionPressable>
        <Text variant="deva" style={[styles.navTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {title}
        </Text>
        <FavoriteHeart
          active={isFavorite}
          onPress={() => toggleFavorite(favoriteKey)}
          size={18}
          inactiveColor={colors.textSecondary}
          activeColor={colors.accent}
          accessibilityLabel={t(isFavorite ? 'a11y.removeFavorite' : 'a11y.addFavorite')}
        />
      </View>

      {/* ── Lang toggle ─────────────────────────────────────────────────── */}
      <View style={styles.toggleWrap}>
        <LangToggle lang={lang} onChange={setLang} colors={colors} />
      </View>

      {/* ── Verses ──────────────────────────────────────────────────────── */}
      <FocusReader
        verses={verses}
        positionKey={favoriteKey}
        isDeva={lang === 'hi'}
        colors={colors}
        footer={
          <Text variant="body-small" style={[styles.verifyNote, { color: colors.textMuted }]}>
            {tForLang('reader.verifyNote')}
          </Text>
        }
      />

    </SafeAreaView>
    </ScreenMount>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.screenH - 2,
    paddingTop: 4,
    paddingBottom: 12,
  },
  navTitle: { flex: 1, fontSize: 15, lineHeight: 22 },

  toggleWrap: { paddingHorizontal: spacing.screenH - 2, paddingBottom: 16 },

  verifyNote: { fontSize: 11.5, lineHeight: 17, marginTop: 16, textAlign: 'center' },

  // Not-found
  notFoundWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, paddingHorizontal: 40 },
  notFoundText: { fontSize: 15, textAlign: 'center' },
  notFoundBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5 },
  notFoundBtnText: { fontSize: 10 },
});
