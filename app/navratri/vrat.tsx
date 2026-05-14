import { useMemo, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, palette, semanticColors, spacing, type ColorPalette } from '@/config/theme';
import { Icon } from '@/components/common/Icon';
import { Kicker } from '@/components/common/Kicker';
import { LangToggle, type ContentLang } from '@/components/common/LangToggle';
import { Ornament } from '@/components/common/Ornament';
import { ScreenMount } from '@/components/common/ScreenMount';
import i18n, { resolveLanguage } from '@/i18n';

import {
  NAVRATRI_SOURCES,
  VRAT_FOODS,
  VRAT_TIERS,
  type Bilingual,
  type VratTier,
} from '@/config/navratri';

type Lang = ContentLang;

export default function NavratriVratScreen() {
  const { t } = useTranslation();
  const isDarkMode = useStore(s => s.isDarkMode);
  const appLanguage = useStore(s => s.language);
  const colors = isDarkMode ? darkColors : lightColors;
  const ornamentTone = isDarkMode ? 'dark' : 'light';

  // In-screen content-language toggle, seeded from the app-wide preference —
  // same pattern as aarti/chalisa.
  const [lang, setLang] = useState<Lang>(() => resolveLanguage(appLanguage));
  const tForLang = useMemo(() => i18n.getFixedT(lang, 'translation'), [lang]);

  return (
    <ScreenMount>
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <View style={[styles.headerRow, { paddingHorizontal: spacing.screenH, borderBottomColor: colors.divider }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.back')}>
            <Icon name="chevron-left" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text variant="display-italic" style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {tForLang('navratri.vratTitle')}
          </Text>
          <View style={[styles.backPill, { borderWidth: 0 }]} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
          showsVerticalScrollIndicator={false}>

          {/* ── Editorial intro ────────────────────────────────────────── */}
          <View style={styles.intro}>
            <Kicker color={colors.accent} size={11} style={styles.introEyebrow}>
              {tForLang('navratri.vratEyebrow')}
            </Kicker>
            <Text variant="body" style={[styles.introText, { color: colors.textSecondary }]}>
              {tForLang('navratri.vratIntro')}
            </Text>
            <Ornament variant="lotus" tone={ornamentTone} style={styles.introOrnament} />
          </View>

          {/* ── Lang toggle (same pattern as aarti/chalisa) ─────────────── */}
          <LangToggle lang={lang} onChange={setLang} colors={colors} />

          {/* ── Tiers ───────────────────────────────────────────────────── */}
          <View style={styles.section}>
            <Kicker color={colors.accent} size={10} style={styles.sectionKicker}>
              {tForLang('navratri.vratTiersLabel')}
            </Kicker>
            {VRAT_TIERS.map((tier, i) => (
              <TierCard key={tier.slug} tier={tier} lang={lang} colors={colors} isLast={i === VRAT_TIERS.length - 1} />
            ))}
          </View>

          {/* ── Allowed foods ───────────────────────────────────────────── */}
          <FoodColumn
            title={tForLang('navratri.allowedLabel')}
            items={VRAT_FOODS.allowed}
            tint={palette.goldLeaf}
            lang={lang}
            colors={colors}
          />

          {/* ── Forbidden foods ─────────────────────────────────────────── */}
          <FoodColumn
            title={tForLang('navratri.forbiddenLabel')}
            items={VRAT_FOODS.forbidden}
            tint={semanticColors.error}
            lang={lang}
            colors={colors}
          />

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

interface TierCardProps {
  tier: VratTier;
  lang: Lang;
  colors: ColorPalette;
  isLast: boolean;
}

function TierCard({ tier, lang, colors, isLast }: TierCardProps) {
  return (
    <View
      style={[
        styles.tierCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
        !isLast && { marginBottom: spacing.cardGap },
      ]}>
      <Text variant="mono-caps" style={[styles.tierLabel, { color: colors.accent }]}>
        {tier.label[lang]}
      </Text>
      <Text variant="body" style={[styles.tierDesc, { color: colors.textSecondary }]}>
        {tier.description[lang]}
      </Text>
    </View>
  );
}

interface FoodColumnProps {
  title: string;
  items: Bilingual[];
  tint: string;
  lang: Lang;
  colors: ColorPalette;
}

function FoodColumn({ title, items, tint, lang, colors }: FoodColumnProps) {
  return (
    <View style={[styles.foodCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Kicker color={tint} size={10}>{title}</Kicker>
      <View style={styles.foodList}>
        {items.map((it, i) => (
          <View key={i} style={styles.foodRow}>
            <View style={[styles.foodDot, { backgroundColor: tint }]} />
            <Text variant="body" style={[styles.foodText, { color: colors.textSecondary }]}>
              {it[lang]}
            </Text>
          </View>
        ))}
      </View>
    </View>
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

  scroll: { paddingTop: 18, paddingBottom: 24 },

  intro: { alignItems: 'center', marginBottom: 22, paddingHorizontal: 8 },
  introEyebrow: { letterSpacing: 3.5, marginBottom: 12 },
  introText: { fontSize: 14, lineHeight: 22, textAlign: 'center' },
  introOrnament: { marginTop: 16, width: '55%' },

  section: { marginBottom: 8 },
  sectionKicker: { marginBottom: 12 },

  tierCard: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    padding: spacing.cardPadLg,
  },
  tierLabel: { fontSize: 10, letterSpacing: 1.8 },
  tierDesc: { fontSize: 14, lineHeight: 22, marginTop: 10 },

  foodCard: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    padding: spacing.cardPadLg,
    marginBottom: spacing.cardGap,
  },
  foodList: { marginTop: 12, gap: 8 },
  foodRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  foodDot: { width: 5, height: 5, borderRadius: 2.5, marginTop: 8 },
  foodText: { flex: 1, fontSize: 14, lineHeight: 21 },

  sourcesBlock: { marginTop: 4, gap: 8 },
  sourcesText: { fontSize: 12, lineHeight: 19 },
});
