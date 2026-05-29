import { useMemo, useState, type ReactNode } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, spacing, type ColorPalette } from '@/config/theme';
import { Icon } from '@/components/common/Icon';
import { Kicker } from '@/components/common/Kicker';
import { LangToggle, type ContentLang } from '@/components/common/LangToggle';
import { Ornament } from '@/components/common/Ornament';
import { ScreenMount } from '@/components/common/ScreenMount';
import i18n, { resolveLanguage } from '@/i18n';

import { KANYA_PUJAN, NAVRATRI_SOURCES } from '@/config/navratri';
import { MotionPressable } from '@/components/common/MotionPressable';

type Lang = ContentLang;

/**
 * Kanya Pujan — the Ashtami/Navami rite of honouring nine young girls as the
 * Devi. All content (the nine age-names, the protocol, offerings, notes) is
 * sourced from the `hindu-devotional-texts` `navratri/` module via the
 * `@/config/navratri` shim. The data is bilingual, so this screen keeps the
 * in-screen language toggle (unlike the English-primary katha reader).
 *
 * Reached from the Day 8/9 callout on the Navratri 9-day guide.
 */
export default function KanyaPujanScreen() {
  const { t } = useTranslation();
  const isDarkMode = useStore((s) => s.isDarkMode);
  const appLanguage = useStore((s) => s.language);
  const colors = isDarkMode ? darkColors : lightColors;
  const ornamentTone = isDarkMode ? 'dark' : 'light';

  // In-screen content-language toggle, seeded from the app-wide preference —
  // same pattern as the vrat screen and aarti/chalisa.
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
            {tForLang('navratri.kanyaTitle')}
          </Text>
          <View style={[styles.backPill, { borderWidth: 0 }]} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
          showsVerticalScrollIndicator={false}>

          {/* ── Lang toggle (same pattern as aarti/chalisa) ─────────────── */}
          <LangToggle lang={lang} onChange={setLang} colors={colors} style={styles.langTogglePad} />

          {/* ── Intro masthead ──────────────────────────────────────────── */}
          <View style={styles.intro}>
            <Kicker color={colors.accent} size={11} style={styles.introEyebrow}>
              {tForLang('navratri.kanyaEyebrow')}
            </Kicker>
            <Ornament variant="lotus" tone={ornamentTone} style={styles.introOrnament} />
          </View>

          {/* ── About the rite ──────────────────────────────────────────── */}
          <SectionCard title={tForLang('navratri.kanyaAboutLabel')} colors={colors}>
            <Text variant="body" style={[styles.paragraph, { color: colors.textSecondary }]}>
              {KANYA_PUJAN.about[lang]}
            </Text>
          </SectionCard>

          {/* ── When it is kept ─────────────────────────────────────────── */}
          <SectionCard title={tForLang('navratri.kanyaWhenLabel')} colors={colors}>
            <Text variant="body" style={[styles.paragraph, { color: colors.textSecondary }]}>
              {KANYA_PUJAN.whenObserved[lang]}
            </Text>
          </SectionCard>

          {/* ── The nine kanyas ─────────────────────────────────────────── */}
          <SectionCard title={tForLang('navratri.kanyaAgeNamesLabel')} colors={colors}>
            {KANYA_PUJAN.ageNames.map((k, i) => (
              <View
                key={k.age}
                style={[
                  styles.kanyaRow,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
                ]}>
                <View style={[styles.ageBadge, { backgroundColor: colors.surfaceRecessed, borderColor: colors.borderAccent }]}>
                  <Text variant="display-italic" style={[styles.ageNum, { color: colors.textPrimary }]}>
                    {String(k.age)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="body" style={[styles.kanyaName, { color: colors.textPrimary }]}>
                    {k.name[lang]}
                  </Text>
                  <Text variant="mono-caps" style={[styles.kanyaAge, { color: colors.accent }]}>
                    {tForLang('navratri.kanyaAgeLabel', { age: k.age })}
                  </Text>
                </View>
              </View>
            ))}
          </SectionCard>

          {/* ── The rite, step by step ──────────────────────────────────── */}
          <SectionCard title={tForLang('navratri.kanyaProtocolLabel')} colors={colors}>
            {KANYA_PUJAN.protocol.map((step, i) => (
              <View
                key={i}
                style={[styles.stepRow, i === KANYA_PUJAN.protocol.length - 1 && { marginBottom: 0 }]}>
                <View style={[styles.stepNum, { backgroundColor: colors.surfaceRecessed, borderColor: colors.borderAccent }]}>
                  <Text variant="mono-caps" style={[styles.stepNumText, { color: colors.accent }]}>
                    {String(i + 1)}
                  </Text>
                </View>
                <Text variant="body" style={[styles.stepText, { color: colors.textSecondary }]}>
                  {step[lang]}
                </Text>
              </View>
            ))}
          </SectionCard>

          {/* ── Offerings ───────────────────────────────────────────────── */}
          <SectionCard title={tForLang('navratri.kanyaOfferingsLabel')} colors={colors}>
            {KANYA_PUJAN.offerings.map((o, i) => (
              <View key={i} style={styles.bulletRow}>
                <View style={[styles.bulletDot, { backgroundColor: colors.accent }]} />
                <Text variant="body" style={[styles.bulletText, { color: colors.textSecondary }]}>
                  {o[lang]}
                </Text>
              </View>
            ))}
          </SectionCard>

          {/* ── Notes ───────────────────────────────────────────────────── */}
          <SectionCard title={tForLang('navratri.kanyaNotesLabel')} colors={colors}>
            {KANYA_PUJAN.notes.map((n, i) => (
              <Text
                key={i}
                variant="body-italic"
                style={[styles.noteText, { color: colors.textSecondary }, i > 0 && styles.noteSpaced]}>
                {n[lang]}
              </Text>
            ))}
          </SectionCard>

          {/* ── Sources / disclaimer ────────────────────────────────────── */}
          <View style={styles.sourcesBlock}>
            <Kicker color={colors.textMuted} size={9}>{tForLang('navratri.sourcesLabel')}</Kicker>
            <Text variant="body-italic" style={[styles.sourcesText, { color: colors.textMuted }]}>
              {NAVRATRI_SOURCES[lang]}
            </Text>
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </ScreenMount>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionCard({ title, colors, children }: { title: string; colors: ColorPalette; children: ReactNode }) {
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Kicker color={colors.accent} size={10}>{title}</Kicker>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

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

  langTogglePad: { paddingBottom: 10 },

  // Intro masthead
  intro: { alignItems: 'center', marginBottom: 18 },
  introEyebrow: { letterSpacing: 3.5, textAlign: 'center' },
  introOrnament: { marginTop: 12, width: '55%' },

  // Cards
  card: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    padding: spacing.cardPadLg,
    marginBottom: spacing.cardGap,
  },
  cardBody: { marginTop: 12 },

  paragraph: { fontSize: 14, lineHeight: 22 },

  // The nine kanyas
  kanyaRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  ageBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ageNum: { fontSize: 19, lineHeight: 24 },
  kanyaName: { fontSize: 15.5, lineHeight: 21 },
  kanyaAge: { fontSize: 8.5, letterSpacing: 1.5, marginTop: 3 },

  // Protocol steps
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: { fontSize: 11 },
  stepText: { flex: 1, fontSize: 14, lineHeight: 22, paddingTop: 3 },

  // Bulleted list (offerings)
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 4 },
  bulletDot: { width: 5, height: 5, borderRadius: 2.5, marginTop: 9 },
  bulletText: { flex: 1, fontSize: 14, lineHeight: 21 },

  // Notes
  noteText: { fontSize: 13, lineHeight: 20 },
  noteSpaced: { marginTop: 12 },

  // Sources
  sourcesBlock: { marginTop: 4, gap: 8 },
  sourcesText: { fontSize: 12, lineHeight: 19 },
});
