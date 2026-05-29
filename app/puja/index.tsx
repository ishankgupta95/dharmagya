import { useMemo, useState } from 'react';
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
import { LangToggle, type ContentLang } from '@/components/common/LangToggle';
import { Ornament } from '@/components/common/Ornament';
import { ScreenMount } from '@/components/common/ScreenMount';
import i18n, { resolveLanguage } from '@/i18n';

import { FEATURED_PUJAS, PUJA_DISCLAIMER } from '@/config/pujas';
import { MotionPressable } from '@/components/common/MotionPressable';

type Lang = ContentLang;

/**
 * Featured Pujas — listing screen (Phase 14.2).
 *
 * Lists the seven v1 pujas as editorial rows. Framed as "Featured" not
 * "Complete" (the v1 cap is deliberate — see PLAN §8). The Pujas tab routes
 * here; tapping a row pushes `/puja/[slug]`.
 */
export default function PujaIndexScreen() {
  const { t } = useTranslation();
  const isDarkMode = useStore((s) => s.isDarkMode);
  const appLanguage = useStore((s) => s.language);
  const colors = isDarkMode ? darkColors : lightColors;
  const ornamentTone = isDarkMode ? 'dark' : 'light';

  // Local in-screen content-language toggle, seeded from the app-wide
  // preference — same pattern as aarti/chalisa.
  const [lang, setLang] = useState<Lang>(() => resolveLanguage(appLanguage));
  const tForLang = useMemo(() => i18n.getFixedT(lang, 'translation'), [lang]);

  return (
    <ScreenMount>
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
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
            {tForLang('puja.indexTitle')}
          </Text>
          <View style={[styles.backPill, { borderWidth: 0 }]} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
          showsVerticalScrollIndicator={false}>

          {/* ── Intro ───────────────────────────────────────────────────── */}
          <View style={styles.intro}>
            <Kicker color={colors.accent} size={11} style={styles.introEyebrow}>
              {tForLang('puja.indexEyebrow')}
            </Kicker>
            <Text variant="body" style={[styles.introText, { color: colors.textSecondary }]}>
              {tForLang('puja.indexIntro')}
            </Text>
            <Ornament variant="lotus" tone={ornamentTone} style={styles.introOrnament} />
          </View>

          {/* ── Lang toggle (same pattern as aarti/chalisa) ─────────────── */}
          <LangToggle lang={lang} onChange={setLang} colors={colors} />

          {/* ── Puja rows ────────────────────────────────────────────────── */}
          {FEATURED_PUJAS.map((p) => (
            <MotionPressable
              key={p.slug}
              onPress={() => router.push({ pathname: '/puja/[slug]', params: { slug: p.slug } })}
              pressedScale={0.97}
              style={[styles.rowCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel={p.name[lang]}>
              <View style={[styles.rowIcon, { backgroundColor: colors.surfaceRecessed, borderColor: colors.borderAccent }]}>
                <Icon name="gift" size={18} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="body" style={[styles.rowTitle, { color: colors.textPrimary }]}>
                  {p.name[lang]}
                </Text>
                <Text variant="mono-caps" style={[styles.rowKicker, { color: colors.accent }]} numberOfLines={1}>
                  {p.kicker[lang]}
                </Text>
              </View>
              <Icon name="chevron-right" size={14} color={colors.textMuted} />
            </MotionPressable>
          ))}

          {/* ── Disclaimer footer ────────────────────────────────────────── */}
          <View style={styles.disclaimerBlock}>
            <Kicker color={colors.textMuted} size={9}>{tForLang('puja.sourcesLabel')}</Kicker>
            <Text variant="body-italic" style={[styles.disclaimerText, { color: colors.textMuted }]}>
              {PUJA_DISCLAIMER[lang]}
            </Text>
          </View>

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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 6,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { flex: 1, fontSize: 22, lineHeight: 28, textAlign: 'center' },

  scroll: { paddingTop: 16, paddingBottom: 24 },

  // Intro
  intro: { alignItems: 'center', marginBottom: 22, paddingHorizontal: 4 },
  introEyebrow: { letterSpacing: 3.5, marginBottom: 10 },
  introText: { fontSize: 14, lineHeight: 22, textAlign: 'center' },
  introOrnament: { marginTop: 14, width: '50%' },

  // Puja rows
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: spacing.cardPadLg,
    paddingVertical: 14,
    borderRadius: borderRadius.card,
    borderWidth: 1,
    marginBottom: 10,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontSize: 15.5, lineHeight: 21 },
  rowKicker: { fontSize: 8.5, letterSpacing: 1.5, marginTop: 3 },

  // Disclaimer
  disclaimerBlock: { marginTop: 14, gap: 8 },
  disclaimerText: { fontSize: 12, lineHeight: 19 },

  adWrap: { marginTop: 16 },
});
