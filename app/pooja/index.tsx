import { useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, spacing } from '@/config/theme';
import { AppText as Text } from '@/components/common/AppText';
import { AdBanner } from '@/components/common/AdBanner';
import { DeityAvatar } from '@/components/common/DeityAvatar';
import { Icon } from '@/components/common/Icon';
import { LangToggle, type ContentLang } from '@/components/common/LangToggle';
import { ScreenMount } from '@/components/common/ScreenMount';
import i18n, { resolveLanguage } from '@/i18n';

import { FEATURED_PUJAS, PUJA_DISCLAIMER, getPujasForDeity, type PujaContent } from '@/config/poojas';
import { getVaarDevataForDate } from '@/config/vaarDevata';
import { MotionPressable } from '@/components/common/MotionPressable';

type Lang = ContentLang;

function stepCountOf(p: PujaContent): number {
  return p.preUpacharas.length + p.upacharas.length + p.postUpacharas.length;
}

/**
 * Featured Poojas index (frame 26) — today's vaar pooja is promoted to the top
 * card (derived from the vaar-devata dataset's deities, never hardcoded), and
 * every row states its step + samagri count before opening. Still framed as
 * "Featured", not "Complete" (the v1 cap is deliberate — see PLAN §8).
 */
export default function PoojaIndexScreen() {
  const { t } = useTranslation();
  const isDarkMode = useStore((s) => s.isDarkMode);
  const appLanguage = useStore((s) => s.language);
  const colors = isDarkMode ? darkColors : lightColors;

  // Local in-screen content-language toggle, seeded from the app-wide
  // preference — same pattern as aarti/chalisa.
  const [lang, setLang] = useState<Lang>(() => resolveLanguage(appLanguage));
  const tForLang = useMemo(() => i18n.getFixedT(lang, 'translation'), [lang]);

  // Today's promoted pooja: the first featured pooja whose roster deity is one
  // of today's vaar devatas (Monday→Rudrabhishek, Wednesday→Ganesh, …). Days
  // whose deities have no featured pooja simply show no Today card.
  const vaarToday = useMemo(() => getVaarDevataForDate(new Date()), []);
  const todaysPuja = useMemo(() => {
    for (const d of vaarToday.deities) {
      if (!d.rosterId) continue;
      const pujas = getPujasForDeity(d.rosterId);
      if (pujas.length > 0) return pujas[0];
    }
    return null;
  }, [vaarToday]);

  const listPujas = useMemo(
    () => FEATURED_PUJAS.filter((p) => p.slug !== todaysPuja?.slug),
    [todaysPuja],
  );

  const openPuja = (slug: string) =>
    router.push({ pathname: '/pooja/[slug]', params: { slug } });

  return (
    <ScreenMount>
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={[styles.headerRow, { paddingHorizontal: spacing.screenH }]}>
          <MotionPressable
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.back')}>
            <Icon name="chevron-left" size={22} color={colors.textSecondary} />
          </MotionPressable>
          <Text
            variant={lang === 'hi' ? 'deva-bold' : 'display'}
            style={[styles.headerTitle, { color: colors.textPrimary }]}
            numberOfLines={1}>
            {tForLang('puja.indexTitle')}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
          showsVerticalScrollIndicator={false}>

          <LangToggle lang={lang} onChange={setLang} colors={colors} />

          {/* ── Today's vaar pooja, promoted ─────────────────────────────── */}
          {todaysPuja && (
            <MotionPressable
              onPress={() => openPuja(todaysPuja.slug)}
              pressedScale={0.97}
              style={[styles.todayCard, { borderColor: colors.borderAccent, backgroundColor: colors.surface }]}
              accessibilityRole="button"
              accessibilityLabel={todaysPuja.name[lang]}>
              <LinearGradient
                colors={
                  isDarkMode
                    ? (['rgba(216,163,26,0.13)', 'rgba(255,255,255,0.03)'] as const)
                    : ([colors.surfaceAccent, '#FFFFFF'] as const)
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 0.8, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.todayHead}>
                <View style={[styles.todayBadge, { backgroundColor: isDarkMode ? 'rgba(216,163,26,0.20)' : colors.surfaceAccent }]}>
                  <Text variant="kicker-small" style={[styles.todayBadgeText, { color: colors.accentText }]}>
                    {tForLang('puja.todayBadge')}
                  </Text>
                </View>
                <Text variant="body-small" style={[styles.todayDay, { color: colors.textTertiary }]}>
                  {vaarToday.dayName[lang]}
                </Text>
              </View>
              <Text variant="deva-bold" style={[styles.todayTitle, { color: colors.textPrimary }]}>
                {todaysPuja.name[lang]}
              </Text>
              <View style={styles.todayMetaRow}>
                <View style={styles.todayMeta}>
                  <Icon name="text" size={14} color={colors.textMuted} />
                  <Text variant="body-small" style={[styles.todayMetaText, { color: colors.textSecondary }]}>
                    {tForLang('puja.stepCount', { count: stepCountOf(todaysPuja) })}
                  </Text>
                </View>
                <View style={styles.todayMeta}>
                  <Icon name="gift" size={14} color={colors.textMuted} />
                  <Text variant="body-small" style={[styles.todayMetaText, { color: colors.textSecondary }]}>
                    {tForLang('puja.samagriCount', { count: todaysPuja.samagri.length })}
                  </Text>
                </View>
              </View>
            </MotionPressable>
          )}

          {/* ── The rest, one grouped card ───────────────────────────────── */}
          <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {listPujas.map((p, i) => (
              <View key={p.slug}>
                {i > 0 && <View style={[styles.rowDivider, { backgroundColor: colors.divider }]} />}
                <MotionPressable
                  onPress={() => openPuja(p.slug)}
                  pressedScale={0.98}
                  style={styles.row}
                  accessibilityRole="button"
                  accessibilityLabel={p.name[lang]}>
                  {p.rosterDeity ? (
                    <DeityAvatar deity={p.rosterDeity} size={38} />
                  ) : (
                    <View style={styles.rowIconWrap}>
                      <Icon name="gift" size={19} color={colors.textTertiary} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text variant="deva" style={[styles.rowTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                      {p.name[lang]}
                    </Text>
                    <Text variant="body-small" style={[styles.rowCaption, { color: colors.textMuted }]} numberOfLines={1}>
                      {tForLang('puja.stepCount', { count: stepCountOf(p) })} · {tForLang('puja.samagriCount', { count: p.samagri.length })}
                    </Text>
                  </View>
                  <Icon name="chevron-right" size={14} color={colors.textDisabled} />
                </MotionPressable>
              </View>
            ))}
          </View>

          {/* ── Disclaimer footer ────────────────────────────────────────── */}
          <View style={styles.disclaimerBlock}>
            <Text variant="kicker-small" style={{ color: colors.textMuted, fontSize: 9 }}>
              {tForLang('puja.sourcesLabel')}
            </Text>
            <Text variant="body-small" style={[styles.disclaimerText, { color: colors.textMuted }]}>
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
    alignItems: 'flex-end',
    gap: 12,
    paddingTop: 6,
    paddingBottom: 16,
  },
  headerTitle: { flex: 1, fontSize: 30, lineHeight: 40 },

  scroll: { paddingTop: 2, paddingBottom: 24 },

  // Today card
  todayCard: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    paddingHorizontal: 19,
    paddingVertical: 17,
    marginTop: 14,
    overflow: 'hidden',
  },
  todayHead: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 11 },
  todayBadge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 6 },
  todayBadgeText: { fontSize: 9.5 },
  todayDay: { fontSize: 12.5 },
  todayTitle: { fontSize: 22, lineHeight: 32 },
  todayMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 11 },
  todayMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  todayMetaText: { fontSize: 12.5 },

  // Grouped list
  listCard: {
    borderRadius: borderRadius.list,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: 11,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 15,
    paddingHorizontal: 17,
  },
  rowDivider: { height: StyleSheet.hairlineWidth, marginLeft: 51 },
  rowIconWrap: { width: 38, alignItems: 'center' },
  rowTitle: { fontSize: 16, lineHeight: 22 },
  rowCaption: { fontSize: 12, marginTop: 1 },

  // Disclaimer
  disclaimerBlock: { marginTop: 16, gap: 8 },
  disclaimerText: { fontSize: 12, lineHeight: 19 },

  adWrap: { marginTop: 16 },
});
