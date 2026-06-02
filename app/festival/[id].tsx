import { useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, palette, spacing } from '@/config/theme';
import { AppText as Text } from '@/components/common/AppText';
import { AdBanner } from '@/components/common/AdBanner';
import { DeityAvatar } from '@/components/common/DeityAvatar';
import { Icon, type IconName } from '@/components/common/Icon';
import { Kicker } from '@/components/common/Kicker';
import { Ornament } from '@/components/common/Ornament';
import { ScreenMount } from '@/components/common/ScreenMount';
import { MotionPressable } from '@/components/common/MotionPressable';
import { DEITY_BY_ID } from '@/config/deities';
import { getFestivalContentById, FESTIVAL_SOURCES } from '@/config/festivalContent';
import { getKathaBySlug } from '@/config/kathas';
import { getPujaBySlug } from '@/config/pujas';
import { getScriptureBySlug } from '@/config/scriptures';
import { getMantraBySlug, getStotraBySlug, getSuktaBySlug, titleFor, type ContentLang } from '@/services/content';

interface CrossLink {
  key: string;
  icon: IconName;
  kicker: string;
  title: string;
  href: Href;
}

/**
 * Festival detail — significance + origin story + scriptural source + presiding
 * deity + cross-links to the katha / puja / mantras / suktas / stotras /
 * scripture the lib associates with the observance. Dates are NOT shown here
 * (they live on the Festivals calendar this screen is reached from). Reached via
 * `/festival/[id]` where `id` is the lib festival slug.
 */
export default function FestivalDetailScreen() {
  const { t, i18n } = useTranslation();
  const isDarkMode = useStore((s) => s.isDarkMode);
  const colors = isDarkMode ? darkColors : lightColors;
  const ornamentTone = isDarkMode ? 'dark' : 'light';
  const lang: ContentLang = i18n.language === 'hi' ? 'hi' : 'en';

  const { id } = useLocalSearchParams<{ id?: string }>();
  const festival = useMemo(() => getFestivalContentById(id), [id]);
  const [storyOpen, setStoryOpen] = useState(false);

  const links = useMemo<CrossLink[]>(() => {
    if (!festival) return [];
    const out: CrossLink[] = [];
    const katha = festival.kathaSlug ? getKathaBySlug(festival.kathaSlug) : undefined;
    if (katha) {
      out.push({ key: 'katha', icon: 'text', kicker: t('festival.link.katha'), title: titleFor(katha, lang), href: { pathname: '/katha/[slug]', params: { slug: katha.slug } } });
    }
    const puja = festival.pujaSlug ? getPujaBySlug(festival.pujaSlug) : undefined;
    if (puja) {
      out.push({ key: 'puja', icon: 'gift', kicker: t('festival.link.puja'), title: puja.name[lang], href: { pathname: '/puja/[slug]', params: { slug: puja.slug } } });
    }
    const scripture = festival.scriptureSlug ? getScriptureBySlug(festival.scriptureSlug) : undefined;
    if (scripture) {
      out.push({ key: 'scripture', icon: 'school', kicker: t('festival.link.scripture'), title: lang === 'hi' ? scripture.titleHindi : scripture.titleEnglish, href: { pathname: '/scripture/[id]', params: { id: scripture.slug } } });
    }
    for (const slug of festival.mantraSlugs ?? []) {
      const m = getMantraBySlug(slug);
      if (m) out.push({ key: `mantra-${slug}`, icon: 'lotus', kicker: t('festival.link.mantra'), title: titleFor(m, lang), href: { pathname: '/jaap/[slug]', params: { slug } } });
    }
    for (const slug of festival.suktaSlugs ?? []) {
      const s = getSuktaBySlug(slug);
      if (s) out.push({ key: `sukta-${slug}`, icon: 'flower', kicker: t('festival.link.sukta'), title: titleFor(s, lang), href: { pathname: '/sukta/[slug]', params: { slug } } });
    }
    for (const slug of festival.stotraSlugs ?? []) {
      const s = getStotraBySlug(slug);
      if (s) out.push({ key: `stotra-${slug}`, icon: 'text', kicker: t('festival.link.stotra'), title: titleFor(s, lang), href: { pathname: '/stotra/[slug]', params: { slug } } });
    }
    return out;
  }, [festival, lang, t]);

  if (!festival) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
        <View style={[styles.headerRow, { borderBottomColor: colors.divider }]}>
          <MotionPressable
            onPress={() => router.back()}
            style={[styles.backPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.back')}>
            <Icon name="chevron-left" size={18} color={colors.textSecondary} />
          </MotionPressable>
          <View style={[styles.backPill, { borderWidth: 0 }]} />
        </View>
        <View style={styles.emptyWrap}>
          <Text variant="body-italic" style={[styles.emptyText, { color: colors.textMuted }]}>
            {t('festival.notFound')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const rosterDeity = festival.deity ? DEITY_BY_ID[festival.deity] : undefined;

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
          <View style={[styles.backPill, { borderWidth: 0 }]} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
          showsVerticalScrollIndicator={false}>

          <View style={styles.heroBlock}>
            <Kicker color={colors.accent} size={10} style={styles.heroEyebrow}>
              {t(`festival.category.${festival.category}`)}
            </Kicker>
            <Text variant="deva-bold" style={[styles.heroTitle, { color: colors.textPrimary }]}>
              {festival.name[lang]}
            </Text>
            <Text variant="body-italic" style={[styles.heroSubtitle, { color: colors.textTertiary }]}>
              {lang === 'hi' ? festival.name.en : (festival.nameSanskrit ?? festival.name.hi)}
            </Text>
            <Ornament variant="lotus" tone={ornamentTone} style={styles.heroOrnament} />
          </View>

          <Text variant={lang === 'hi' ? 'deva' : 'body'} style={[styles.significance, { color: colors.textSecondary }]}>
            {festival.significance[lang]}
          </Text>

          {/* Origin story — collapsed by default to keep the page scannable. */}
          {festival.story && (
            <View style={[styles.storyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <MotionPressable
                onPress={() => setStoryOpen((v) => !v)}
                style={styles.storyHead}
                accessibilityRole="button"
                accessibilityLabel={t('festival.story')}>
                <Kicker color={colors.accent} size={10}>{t('festival.story')}</Kicker>
                <Icon name={storyOpen ? 'caret-down' : 'chevron-right'} size={14} color={colors.textMuted} />
              </MotionPressable>
              {storyOpen && (
                <>
                  <Text variant={lang === 'hi' ? 'deva' : 'body'} style={[styles.storyText, { color: colors.textSecondary }]}>
                    {festival.story[lang]}
                  </Text>
                  {festival.storySource && (
                    <Text variant="body-italic" style={[styles.storySource, { color: colors.textMuted }]}>
                      {festival.storySource[lang]}
                    </Text>
                  )}
                </>
              )}
            </View>
          )}

          {rosterDeity && (
            <MotionPressable
              onPress={() => router.push({ pathname: '/god/[id]', params: { id: rosterDeity.id } })}
              pressedScale={0.97}
              style={[styles.deityCard, { backgroundColor: colors.surface, borderColor: colors.borderAccent }]}
              accessibilityRole="button"
              accessibilityLabel={t('festival.openDeity', { name: t(`deities.${rosterDeity.id}.displayName`) })}>
              <DeityAvatar deity={rosterDeity.id} size={42} />
              <View style={{ flex: 1 }}>
                <Text variant="mono-caps" style={[styles.cardKicker, { color: colors.accent }]}>
                  {t('festival.presidingDeity')}
                </Text>
                <Text variant="deva-bold" style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                  {t(`deities.${rosterDeity.id}.displayName`)}
                </Text>
              </View>
              <Icon name="chevron-right" size={16} color={colors.accent} />
            </MotionPressable>
          )}

          {links.length > 0 && (
            <View style={styles.linksBlock}>
              <Kicker color={palette.gold} size={9} withTrailingRule ruleColor={colors.divider} wrapperStyle={styles.linksKicker}>
                {t('festival.observeLabel')}
              </Kicker>
              {links.map((l) => (
                <MotionPressable
                  key={l.key}
                  onPress={() => router.push(l.href)}
                  pressedScale={0.97}
                  style={[styles.linkCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  accessibilityRole="button"
                  accessibilityLabel={l.title}>
                  <View style={[styles.linkIcon, { backgroundColor: colors.surfaceRecessed, borderColor: colors.borderAccent }]}>
                    <Icon name={l.icon} size={16} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="mono-caps" style={[styles.cardKicker, { color: colors.textMuted }]}>
                      {l.kicker}
                    </Text>
                    <Text variant="body" style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                      {l.title}
                    </Text>
                  </View>
                  <Icon name="chevron-right" size={14} color={colors.textMuted} />
                </MotionPressable>
              ))}
            </View>
          )}

          <View style={styles.disclaimerBlock}>
            {festival.reviewPending && (
              <Text variant="body-italic" style={[styles.reviewNote, { color: colors.textMuted }]}>
                {t('reader.reviewNote')}
              </Text>
            )}
            <Kicker color={colors.textMuted} size={9}>{t('festival.sourcesLabel')}</Kicker>
            <Text variant="body-italic" style={[styles.disclaimerText, { color: colors.textMuted }]}>
              {FESTIVAL_SOURCES[lang]}
            </Text>
          </View>

          <View style={styles.adWrap}>
            <AdBanner colors={colors} placement="godDetailInline" inline />
          </View>
          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </ScreenMount>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, paddingTop: 6, paddingBottom: 12, paddingHorizontal: spacing.screenH,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backPill: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingTop: 16, paddingBottom: 24 },
  heroBlock: { alignItems: 'center', marginBottom: 18, paddingHorizontal: 4 },
  heroEyebrow: { letterSpacing: 3.0, marginBottom: 12 },
  heroTitle: { fontSize: 28, lineHeight: 38, textAlign: 'center' },
  heroSubtitle: { fontSize: 13, lineHeight: 19, marginTop: 6, textAlign: 'center' },
  heroOrnament: { marginTop: 14, width: '50%' },
  significance: { fontSize: 14.5, lineHeight: 23, marginBottom: 16 },
  storyCard: { borderRadius: 14, borderWidth: 1, padding: spacing.cardPadLg, marginBottom: 16 },
  storyHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  storyText: { fontSize: 14, lineHeight: 23, marginTop: 12 },
  storySource: { fontSize: 12, lineHeight: 18, marginTop: 10 },
  deityCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: borderRadius.card, borderWidth: 1, padding: spacing.cardPad, marginBottom: 16,
  },
  cardKicker: { fontSize: 8.5, letterSpacing: 1.6, marginBottom: 3 },
  cardTitle: { fontSize: 15.5, lineHeight: 21 },
  linksBlock: { marginBottom: 8 },
  linksKicker: { marginBottom: 12 },
  linkCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: borderRadius.card, borderWidth: 1, padding: spacing.cardPad, marginBottom: 10,
  },
  linkIcon: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  disclaimerBlock: { marginTop: 8, gap: 8 },
  reviewNote: { fontSize: 12, lineHeight: 18 },
  disclaimerText: { fontSize: 12, lineHeight: 19 },
  adWrap: { marginTop: 16 },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  emptyText: { fontSize: 14, lineHeight: 22, textAlign: 'center' },
});
