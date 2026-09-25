import { useMemo } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, spacing } from '@/config/theme';
import { AppText as Text } from '@/components/common/AppText';
import { AdBanner } from '@/components/common/AdBanner';
import { Icon } from '@/components/common/Icon';
import { Kicker } from '@/components/common/Kicker';
import { Ornament } from '@/components/common/Ornament';
import { ScreenMount } from '@/components/common/ScreenMount';
import { MotionPressable } from '@/components/common/MotionPressable';
import { getAllAppSahasranamas, titleFor, type ContentLang } from '@/services/content';

/**
 * Sahasranama index — the 1000-name litanies (Vishnu, Lalita), each row showing
 * its title + presiding deity and pushing the `/sahasranama/[slug]` reader.
 */
export default function SahasranamaIndexScreen() {
  const { t, i18n: i18next } = useTranslation();
  const isDarkMode = useStore((s) => s.isDarkMode);
  const colors = isDarkMode ? darkColors : lightColors;
  const ornamentTone = isDarkMode ? 'dark' : 'light';
  const lang: ContentLang = i18next.language === 'hi' ? 'hi' : 'en';

  const items = useMemo(() => getAllAppSahasranamas(), []);

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
          <Text variant="display-italic" style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {t('sahasranama.indexTitle')}
          </Text>
          <View style={[styles.backPill, { borderWidth: 0 }]} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
          showsVerticalScrollIndicator={false}>

          <View style={styles.intro}>
            <Kicker color={colors.accent} size={11} style={styles.introEyebrow}>
              {t('sahasranama.indexEyebrow')}
            </Kicker>
            <Text variant="body" style={[styles.introText, { color: colors.textSecondary }]}>
              {t('sahasranama.indexIntro')}
            </Text>
            <Ornament variant="lotus" tone={ornamentTone} style={styles.introOrnament} />
          </View>

          {items.map((s) => (
            <MotionPressable
              key={s.slug}
              onPress={() => router.push({ pathname: '/sahasranama/[slug]', params: { slug: s.slug } })}
              pressedScale={0.97}
              style={[styles.rowCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel={t('sahasranama.a11yOpen', { name: s.titleEnglish })}>
              <View style={[styles.rowIcon, { backgroundColor: colors.surfaceRecessed, borderColor: colors.borderAccent }]}>
                <Icon name="lotus" size={18} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  variant={lang === 'hi' ? 'deva-bold' : 'body'}
                  style={[styles.rowTitle, { color: colors.textPrimary }]}
                  numberOfLines={2}>
                  {titleFor(s, lang)}
                </Text>
                <Text variant="body-italic" style={[styles.rowMeta, { color: colors.textMuted }]}>
                  {t(`deities.${s.deity}.displayName`)}
                </Text>
              </View>
              <Icon name="chevron-right" size={14} color={colors.textMuted} />
            </MotionPressable>
          ))}

          <View style={styles.adWrap}>
            <AdBanner colors={colors} placement="astrologyInline" inline />
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
    gap: 12, paddingTop: 6, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backPill: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 22, lineHeight: 28, textAlign: 'center' },
  scroll: { paddingTop: 16, paddingBottom: 24 },
  intro: { alignItems: 'center', marginBottom: 18, paddingHorizontal: 4 },
  introEyebrow: { letterSpacing: 3.5, marginBottom: 10 },
  introText: { fontSize: 14, lineHeight: 22, textAlign: 'center' },
  introOrnament: { marginTop: 14, width: '50%' },
  rowCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: spacing.cardPadLg, paddingVertical: 14,
    borderRadius: borderRadius.card, borderWidth: 1, marginBottom: 10,
  },
  rowIcon: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15.5, lineHeight: 21 },
  rowMeta: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  adWrap: { marginTop: 16 },
});
