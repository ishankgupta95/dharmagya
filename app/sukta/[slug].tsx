import { useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, palette, spacing } from '@/config/theme';
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
import { getSuktaBySlug, titleFor, type ContentLang } from '@/services/content';

/**
 * Sukta reader — sectioned Vedic hymn (Sri Suktam, Purusha Suktam, Sri Rudram
 * Namakam/Chamakam, …). Each `SuktaSection` becomes a kicker-headed block of
 * `VerseBlock`s (header suppressed for single-section suktas). Carries the
 * `vedicSource` provenance line (scriptural origin = devotional content, kept)
 * and the provisional-review note when `reviewPending`.
 */
export default function SuktaReaderScreen() {
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
  const sukta = useMemo(() => (slug ? getSuktaBySlug(slug) : undefined), [slug]);

  if (!sukta) {
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
            {t('sukta.notFound')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const favKey = `sukta-${sukta.slug}`;
  const isFavorite = favoriteIds.includes(favKey);
  const heroTitle = titleFor(sukta, lang);
  const multiSection = sukta.sections.length > 1;
  const about = sukta.about[lang]?.trim();

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
            <Text variant="body-italic" style={[styles.heroSource, { color: colors.textTertiary }]}>
              {sukta.vedicSource[lang]}
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

          {sukta.sections.map((section) => {
            const sectionTitle = lang === 'hi'
              ? (section.titleHindi ?? section.titleSanskrit ?? section.titleEnglish)
              : (section.titleEnglish ?? section.titleSanskrit);
            return (
              <View key={section.number}>
                {multiSection && !!sectionTitle && (
                  <Kicker
                    color={palette.gold}
                    size={10}
                    withTrailingRule
                    ruleColor={colors.divider}
                    wrapperStyle={styles.sectionKicker}
                    style={styles.sectionKickerText}>
                    {sectionTitle}
                  </Kicker>
                )}
                {section.verses.map((verse, i) => (
                  <VerseBlock key={i} verse={verse} index={i + 1} lang={lang} colors={colors} t={tForLang} />
                ))}
              </View>
            );
          })}

          <View style={styles.footer}>
            {sukta.reviewPending && (
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.screenH, paddingTop: 6, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navPill: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingTop: 16, paddingBottom: 24 },
  heroBlock: { alignItems: 'center', marginBottom: 18, paddingHorizontal: 4 },
  heroTitle: { fontSize: 26, lineHeight: 34, textAlign: 'center' },
  heroSource: { fontSize: 12.5, lineHeight: 19, marginTop: 8, textAlign: 'center' },
  heroOrnament: { marginTop: 14, width: '50%' },
  aboutCard: { borderRadius: 14, borderWidth: 1, padding: spacing.cardPadLg, marginTop: 4, marginBottom: 4 },
  aboutText: { fontSize: 14, lineHeight: 22, marginTop: 8 },
  sectionKicker: { marginTop: 16, marginBottom: 4 },
  sectionKickerText: { letterSpacing: 2.4 },
  footer: { marginTop: 12, gap: 8 },
  reviewNote: { fontSize: 12, lineHeight: 18 },
  sourcesText: { fontSize: 12, lineHeight: 19 },
  adWrap: { marginTop: 12 },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  emptyText: { fontSize: 14, lineHeight: 22, textAlign: 'center' },
});
