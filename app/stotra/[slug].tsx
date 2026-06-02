import { useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, spacing } from '@/config/theme';
import { AppText as Text } from '@/components/common/AppText';
import { Icon } from '@/components/common/Icon';
import { Kicker } from '@/components/common/Kicker';
import { Ornament } from '@/components/common/Ornament';
import { ScreenMount } from '@/components/common/ScreenMount';
import { AdBanner } from '@/components/common/AdBanner';
import { MotionPressable } from '@/components/common/MotionPressable';
import { FavoriteHeart } from '@/components/common/FavoriteHeart';
import { LangToggle } from '@/components/common/LangToggle';
import { VerseBlock } from '@/components/reader/VerseBlock';
import { SCRIPTURE_DISCLAIMER } from '@/config/scriptures';
import i18n, { resolveLanguage } from '@/i18n';
import { getStotraBySlug, titleFor, type ContentLang } from '@/services/content';

/**
 * Stotra / ashtakam reader — a flat verse list (no chapters), modelled on the
 * single-chapter scripture reader. The in-screen toggle selects the meaning
 * language; the Devanagari/IAST recitation is driven by `VerseBlock`. Carries
 * a form/language caption (Ashtakam · Awadhi) and the provisional-review note
 * when the lib flags the transliteration `reviewPending`.
 */
export default function StotraReaderScreen() {
  const { t } = useTranslation();
  const isDarkMode = useStore((s) => s.isDarkMode);
  const colors = isDarkMode ? darkColors : lightColors;
  const ornamentTone = isDarkMode ? 'dark' : 'light';
  const appLanguage = useStore((s) => s.language);
  const favoriteIds = useStore((s) => s.favoriteIds);
  const toggleFavorite = useStore((s) => s.toggleFavorite);

  const [lang, setLang] = useState<ContentLang>(() => resolveLanguage(appLanguage));
  const tForLang = useMemo(() => i18n.getFixedT(lang, 'translation'), [lang]);

  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const stotra = useMemo(() => (slug ? getStotraBySlug(slug) : undefined), [slug]);

  if (!stotra) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
        <View style={[styles.navRow, { borderBottomColor: colors.divider }]}>
          <MotionPressable
            onPress={() => router.back()}
            style={[styles.navPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.back')}>
            <Icon name="chevron-left" size={18} color={colors.textSecondary} />
          </MotionPressable>
          <View style={[styles.navPill, { borderWidth: 0 }]} />
        </View>
        <View style={styles.emptyWrap}>
          <Text variant="body-italic" style={[styles.emptyText, { color: colors.textMuted }]}>
            {t('stotra.notFound')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const favKey = `stotra-${stotra.slug}`;
  const isFavorite = favoriteIds.includes(favKey);
  const heroTitle = titleFor(stotra, lang);
  const formLabel = stotra.form ? tForLang(`stotra.form.${stotra.form}`) : tForLang('stotra.form.stotra');
  const langLabel = stotra.language ? tForLang(`stotra.language.${stotra.language}`) : undefined;
  const subtitle = [formLabel, langLabel, tForLang('scripture.versesNCount', { count: stotra.verses.length })]
    .filter(Boolean)
    .join(' · ');
  const about = stotra.about[lang]?.trim();

  return (
    <ScreenMount>
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>

        <View style={[styles.navRow, { borderBottomColor: colors.divider }]}>
          <MotionPressable
            onPress={() => router.back()}
            style={[styles.navPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.back')}>
            <Icon name="chevron-left" size={18} color={colors.textSecondary} />
          </MotionPressable>
          <FavoriteHeart
            active={isFavorite}
            onPress={() => toggleFavorite(favKey)}
            size={20}
            inactiveColor={colors.textMuted}
            activeColor={colors.accent}
            accessibilityLabel={t(isFavorite ? 'a11y.removeFavorite' : 'a11y.addFavorite')}
          />
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
          showsVerticalScrollIndicator={false}>

          <View style={styles.heroBlock}>
            <Text
              variant={lang === 'hi' ? 'deva-bold' : 'display-italic'}
              style={[styles.heroTitle, { color: colors.textPrimary }]}>
              {heroTitle}
            </Text>
            <Text variant="mono-caps" style={[styles.heroSubtitle, { color: colors.textMuted }]}>
              {subtitle}
            </Text>
            <Ornament variant="lotus" tone={ornamentTone} style={styles.heroOrnament} />
          </View>

          <LangToggle lang={lang} onChange={setLang} colors={colors} />

          {!!about && (
            <View style={[styles.aboutCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Kicker color={colors.accent} size={10}>{tForLang('scripture.aboutLabel')}</Kicker>
              <Text variant="body" style={[styles.aboutText, { color: colors.textSecondary }]}>
                {about}
              </Text>
            </View>
          )}

          {stotra.verses.map((verse, i) => (
            <VerseBlock key={i} verse={verse} index={i + 1} lang={lang} colors={colors} t={tForLang} />
          ))}

          <View style={styles.footer}>
            {stotra.reviewPending && (
              <Text variant="body-italic" style={[styles.reviewNote, { color: colors.textMuted }]}>
                {tForLang('reader.reviewNote')}
              </Text>
            )}
            <Kicker color={colors.textMuted} size={9}>{tForLang('scripture.sourcesLabel')}</Kicker>
            <Text variant="body-italic" style={[styles.sourcesText, { color: colors.textMuted }]}>
              {SCRIPTURE_DISCLAIMER[lang]}
            </Text>
            <View style={styles.adWrap}>
              <AdBanner colors={colors} placement="godDetailInline" inline />
            </View>
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </ScreenMount>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenH,
    paddingTop: 6,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navPill: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  scroll: { paddingTop: 16, paddingBottom: 24 },
  heroBlock: { alignItems: 'center', marginBottom: 18, paddingHorizontal: 4 },
  heroTitle: { fontSize: 26, lineHeight: 34, textAlign: 'center' },
  heroSubtitle: { fontSize: 9, letterSpacing: 1.6, marginTop: 12, textAlign: 'center' },
  heroOrnament: { marginTop: 14, width: '50%' },
  aboutCard: { borderRadius: 14, borderWidth: 1, padding: spacing.cardPadLg, marginTop: 4, marginBottom: 4 },
  aboutText: { fontSize: 14, lineHeight: 22, marginTop: 8 },
  footer: { marginTop: 12, gap: 8 },
  reviewNote: { fontSize: 12, lineHeight: 18 },
  sourcesText: { fontSize: 12, lineHeight: 19 },
  adWrap: { marginTop: 12 },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  emptyText: { fontSize: 14, lineHeight: 22, textAlign: 'center' },
});
