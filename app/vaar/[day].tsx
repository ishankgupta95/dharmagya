import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, palette, spacing, type ColorPalette } from '@/config/theme';
import { Icon } from '@/components/common/Icon';
import { Kicker } from '@/components/common/Kicker';
import { LangToggle, type ContentLang } from '@/components/common/LangToggle';
import { Ornament } from '@/components/common/Ornament';
import { ScreenMount } from '@/components/common/ScreenMount';
import { SegmentedChip } from '@/components/common/SegmentedChip';
import { DeityAvatar } from '@/components/common/DeityAvatar';
import i18n, { resolveLanguage } from '@/i18n';
import {
  getVaarDevataByKey,
  VAAR_DEVATA,
  VAAR_SOURCES,
  type VaarDeity,
  type VaarDevata,
} from '@/config/vaarDevata';
import { getPujasForDeity, type PujaContent } from '@/config/pujas';

type Lang = ContentLang;

function startJaap(vaar: VaarDevata) {
  if (vaar.mantra.jaapSlug) {
    router.push(`/jaap/${vaar.mantra.jaapSlug}`);
  } else {
    router.push({
      pathname: '/jaap/[slug]',
      params: { slug: 'custom', text: vaar.mantra.devanagari },
    });
  }
}

export default function VaarDevataScreen() {
  const { t } = useTranslation();
  const isDarkMode = useStore((s) => s.isDarkMode);
  const appLanguage = useStore((s) => s.language);
  const colors = isDarkMode ? darkColors : lightColors;
  const ornamentTone = isDarkMode ? 'dark' : 'light';

  // In-screen content-language toggle, seeded from the app-wide preference —
  // same pattern as aarti/chalisa.
  const [lang, setLang] = useState<Lang>(() => resolveLanguage(appLanguage));
  const tForLang = useMemo(() => i18n.getFixedT(lang, 'translation'), [lang]);

  const { day: routeDay } = useLocalSearchParams<{ day?: string }>();
  const [dayKey, setDayKey] = useState<string>(getVaarDevataByKey(routeDay)?.dayKey ?? 'sunday');

  // Keep the local selection in sync if the route param itself changes while
  // the screen is already mounted (e.g. a remedy-nudge tap from underneath).
  useEffect(() => {
    const k = getVaarDevataByKey(routeDay)?.dayKey;
    if (k) setDayKey(k);
  }, [routeDay]);

  // `dayKey` is only ever set from a valid lookup, so the fallback is defensive.
  const vaar: VaarDevata = getVaarDevataByKey(dayKey) ?? VAAR_DEVATA[0];

  // Surface every featured puja whose primary deity is in today's roster
  // (de-duplicated). Tuesday + Saturday → Hanuman Puja (the explicit
  // P14.2 wiring); Monday → Rudrabhishek; Wednesday → Ganesh; Thursday →
  // Satyanarayan; Friday → Lakshmi. Sunday has no roster-pair v1 puja.
  const linkedPujas: PujaContent[] = useMemo(() => {
    const seen = new Set<string>();
    const result: PujaContent[] = [];
    for (const d of vaar.deities) {
      if (!d.rosterId) continue;
      for (const p of getPujasForDeity(d.rosterId)) {
        if (!seen.has(p.slug)) {
          seen.add(p.slug);
          result.push(p);
        }
      }
    }
    return result;
  }, [vaar]);

  return (
    <ScreenMount>
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
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
            {tForLang('vaar.detailTitle', { day: vaar.dayName[lang] })}
          </Text>
          <View style={[styles.backPill, { borderWidth: 0 }]} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
          showsVerticalScrollIndicator={false}>

          {/* ── Day picker ──────────────────────────────────────────────── */}
          <View style={styles.dayPicker}>
            {VAAR_DEVATA.map((v) => {
              const active = v.dayKey === dayKey;
              return (
                <SegmentedChip
                  key={v.dayKey}
                  active={active}
                  onPress={() => setDayKey(v.dayKey)}
                  inactiveBg="transparent"
                  activeBg={isDarkMode ? palette.goldLeaf : palette.sindoor}
                  inactiveBorder={colors.border}
                  activeBorder="transparent"
                  style={styles.dayChip}
                  accessibilityLabel={t('vaar.a11yBrowseDay', { day: v.dayName[lang] })}>
                  <Text
                    variant="mono-caps"
                    numberOfLines={1}
                    style={[styles.dayChipText, { color: active ? palette.parchmentBright : colors.textSecondary }]}>
                    {v.dayShort[lang]}
                  </Text>
                </SegmentedChip>
              );
            })}
          </View>

          {/* ── Lang toggle (same pattern as aarti/chalisa) ─────────────── */}
          <LangToggle lang={lang} onChange={setLang} colors={colors} />

          {/* ── Day facts: ruling graha + colour ────────────────────────── */}
          <View style={styles.facts}>
            <Text variant="mono-caps" style={[styles.factsGraha, { color: colors.accent }]}>
              {tForLang('vaar.rulingGraha', { graha: vaar.grahaName[lang] })}
            </Text>
            <View style={styles.factsColorRow}>
              <View style={[styles.factsSwatch, { backgroundColor: vaar.color.hex, borderColor: colors.textTertiary }]} />
              <Text variant="mono-caps" style={[styles.factsColorText, { color: colors.textTertiary }]}>
                {tForLang('vaar.dayColorLabel')} — {vaar.color.name[lang]}
              </Text>
            </View>
            <Ornament variant="lotus" tone={ornamentTone} style={styles.factsOrnament} />
          </View>

          {/* ── Deities of the day (all equal weight) ───────────────────── */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Kicker color={colors.accent} size={10}>{tForLang('vaar.deitiesSectionLabel')}</Kicker>
            <View style={styles.cardBody}>
              {vaar.deities.map((d, i, arr) => (
                <DeityRow
                  key={d.rosterId ?? `named-${i}`}
                  deity={d}
                  lang={lang}
                  colors={colors}
                  last={i === arr.length - 1}
                />
              ))}
            </View>
          </View>

          {/* ── Mantra for the day ──────────────────────────────────────── */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Kicker color={colors.accent} size={10}>{tForLang('vaar.mantraLabel')}</Kicker>
            <Text variant="deva-bold" style={[styles.mantraDeva, { color: colors.textPrimary }]}>
              {vaar.mantra.devanagari}
            </Text>
            <Text variant="body-italic" style={[styles.mantraIast, { color: colors.textTertiary }]}>
              {vaar.mantra.iast}
            </Text>
            <Text variant="body" style={[styles.mantraMeaning, { color: colors.textSecondary }]}>
              {vaar.mantra.meaning[lang]}
            </Text>
            <TouchableOpacity
              onPress={() => startJaap(vaar)}
              activeOpacity={0.85}
              style={[styles.jaapBtn, { backgroundColor: isDarkMode ? palette.goldLeaf : palette.sindoor }]}
              accessibilityRole="button"
              accessibilityLabel={t('vaar.a11yStartJaap')}>
              <Icon name="flower" size={14} color={palette.parchmentBright} />
              <Text variant="mono-caps" style={styles.jaapBtnText}>{tForLang('vaar.startJaap')}</Text>
            </TouchableOpacity>
            <Text variant="body-italic" style={[styles.reviewNote, { color: colors.textMuted }]}>
              {tForLang('vaar.mantraReviewNote')}
            </Text>
          </View>

          {/* ── Linked puja vidhi (P14.2) ───────────────────────────────── */}
          {linkedPujas.length > 0 && (
            <SectionCard title={tForLang('vaar.linkedPujaLabel')} colors={colors}>
              {linkedPujas.map((p) => (
                <TouchableOpacity
                  key={p.slug}
                  onPress={() => router.push({ pathname: '/puja/[slug]', params: { slug: p.slug } })}
                  activeOpacity={0.85}
                  style={[styles.linkedPujaRow, { borderColor: colors.borderAccent, backgroundColor: colors.surfaceRecessed }]}
                  accessibilityRole="button"
                  accessibilityLabel={t('puja.openNamedPuja', { name: p.name[lang] })}>
                  <Icon name="gift" size={14} color={colors.accent} />
                  <View style={{ flex: 1 }}>
                    <Text variant="body" style={[styles.linkedPujaName, { color: colors.textPrimary }]}>
                      {p.name[lang]}
                    </Text>
                    <Text variant="mono-caps" style={[styles.linkedPujaKicker, { color: colors.accent }]} numberOfLines={1}>
                      {p.kicker[lang]}
                    </Text>
                  </View>
                  <Icon name="chevron-right" size={14} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
            </SectionCard>
          )}

          {/* ── Offerings ───────────────────────────────────────────────── */}
          <SectionCard title={tForLang('vaar.offeringsLabel')} colors={colors}>
            {vaar.offerings.map((o, i) => (
              <View key={i} style={styles.bulletRow}>
                <View style={[styles.bulletDot, { backgroundColor: colors.accent }]} />
                <Text variant="body" style={[styles.bulletText, { color: colors.textSecondary }]}>
                  {o.label[lang]}
                </Text>
              </View>
            ))}
          </SectionCard>

          {/* ── Fasting / vrat ──────────────────────────────────────────── */}
          <SectionCard title={tForLang('vaar.fastingLabel')} colors={colors}>
            <Text variant="body" style={[styles.paragraph, { color: colors.textSecondary }]}>
              {vaar.fasting[lang]}
            </Text>
          </SectionCard>

          {/* ── Regional & traditional variants ─────────────────────────── */}
          {vaar.variantNotes.length > 0 && (
            <SectionCard title={tForLang('vaar.variantNotesLabel')} colors={colors}>
              {vaar.variantNotes.map((n, i) => (
                <View key={i} style={i > 0 ? styles.variantRowSpaced : undefined}>
                  <Text variant="mono-caps" style={[styles.variantLabel, { color: colors.accent }]}>
                    {n.label[lang]}
                  </Text>
                  <Text variant="body" style={[styles.paragraph, styles.variantText, { color: colors.textSecondary }]}>
                    {n.text[lang]}
                  </Text>
                </View>
              ))}
            </SectionCard>
          )}

          {/* ── Sources / disclaimer ────────────────────────────────────── */}
          <View style={styles.sourcesBlock}>
            <Kicker color={colors.textMuted} size={9}>{tForLang('vaar.sourcesLabel')}</Kicker>
            <Text variant="body-italic" style={[styles.sourcesText, { color: colors.textMuted }]}>
              {VAAR_SOURCES[lang]}
            </Text>
          </View>

          <View style={{ height: 24 }} />
        </ScrollView>
      </SafeAreaView>
    </ScreenMount>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ title, colors, children }: { title: string; colors: ColorPalette; children: ReactNode }) {
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Kicker color={colors.accent} size={10}>{title}</Kicker>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

/** Neutral monogram stand-in for a deity that has no Library avatar. */
function Monogram({ colors, size = 44 }: { colors: ColorPalette; size?: number }) {
  return (
    <View
      style={[
        styles.monogram,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surfaceRecessed, borderColor: colors.border },
      ]}>
      <Text variant="deva" style={[styles.monogramText, { color: colors.textTertiary, fontSize: size * 0.4 }]}>
        ॐ
      </Text>
    </View>
  );
}

function DeityRowInner({ deity, lang, colors }: { deity: VaarDeity; lang: Lang; colors: ColorPalette }) {
  return (
    <>
      {deity.rosterId
        ? <DeityAvatar deity={deity.rosterId} size={44} ring="none" />
        : <Monogram colors={colors} size={44} />}
      <View style={styles.deityRowText}>
        <View style={styles.deityRowHead}>
          <Text variant="body" style={[styles.deityRowName, { color: colors.textPrimary }]}>
            {deity.name[lang]}
          </Text>
          {deity.context && (
            <View style={[styles.contextChip, { borderColor: colors.borderAccent }]}>
              <Text variant="mono-caps" style={[styles.contextChipText, { color: colors.accent }]}>
                {deity.context[lang]}
              </Text>
            </View>
          )}
        </View>
        <Text variant="body" style={[styles.deityRowNote, { color: colors.textSecondary }]}>
          {deity.note[lang]}
        </Text>
      </View>
    </>
  );
}

function DeityRow({
  deity, lang, colors, last,
}: { deity: VaarDeity; lang: Lang; colors: ColorPalette; last: boolean }) {
  const { t } = useTranslation();
  const divider = last
    ? undefined
    : { borderBottomColor: colors.divider, borderBottomWidth: StyleSheet.hairlineWidth };

  if (deity.rosterId) {
    return (
      <TouchableOpacity
        onPress={() => router.push(`/god/${deity.rosterId}`)}
        activeOpacity={0.85}
        style={[styles.deityRow, divider]}
        accessibilityRole="button"
        accessibilityLabel={t('vaar.openInLibrary', { name: deity.name[lang] })}>
        <DeityRowInner deity={deity} lang={lang} colors={colors} />
        <Icon name="chevron-right" size={14} color={colors.textMuted} />
      </TouchableOpacity>
    );
  }
  return (
    <View style={[styles.deityRow, divider]}>
      <DeityRowInner deity={deity} lang={lang} colors={colors} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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

  // Day picker
  dayPicker: { flexDirection: 'row', gap: 5, marginBottom: 20 },
  dayChip: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: borderRadius.chip,
    borderWidth: 1,
    alignItems: 'center',
  },
  dayChipText: { fontSize: 8.5 },

  // Day facts
  facts: { alignItems: 'center', marginBottom: 18 },
  factsGraha: { fontSize: 10, letterSpacing: 1.8 },
  factsColorRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8 },
  factsSwatch: { width: 13, height: 13, borderRadius: 6.5, borderWidth: StyleSheet.hairlineWidth },
  factsColorText: { fontSize: 9, letterSpacing: 1.4 },
  factsOrnament: { marginTop: 16, width: '55%' },

  // Cards
  card: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    padding: spacing.cardPadLg,
    marginBottom: spacing.cardGap,
  },
  cardBody: { marginTop: 12 },

  // Deity rows
  monogram: { alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  monogramText: { textAlign: 'center', includeFontPadding: false },
  deityRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  deityRowText: { flex: 1 },
  deityRowHead: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  deityRowName: { fontSize: 16, lineHeight: 22 },
  contextChip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4, borderWidth: StyleSheet.hairlineWidth },
  contextChipText: { fontSize: 8 },
  deityRowNote: { fontSize: 13, lineHeight: 19.5, marginTop: 5 },

  // Mantra
  mantraDeva: { fontSize: 22, lineHeight: 32, marginTop: 12 },
  mantraIast: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  mantraMeaning: { fontSize: 14, lineHeight: 21, marginTop: 12 },
  jaapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: borderRadius.button,
    marginTop: 16,
  },
  jaapBtnText: { fontSize: 11, color: palette.parchmentBright },
  reviewNote: { fontSize: 11.5, lineHeight: 17, marginTop: 12 },

  // Bulleted list (offerings)
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  bulletDot: { width: 5, height: 5, borderRadius: 2.5, marginTop: 8 },
  bulletText: { flex: 1, fontSize: 14, lineHeight: 21 },

  paragraph: { fontSize: 14, lineHeight: 22 },

  // Variants
  variantRowSpaced: { marginTop: 14 },
  variantLabel: { fontSize: 9, letterSpacing: 1.4 },
  variantText: { marginTop: 4 },

  // Linked puja rows (P14.2)
  linkedPujaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: borderRadius.cardInner,
    borderWidth: 1,
    marginTop: 4,
  },
  linkedPujaName: { fontSize: 14.5, lineHeight: 20 },
  linkedPujaKicker: { fontSize: 8.5, letterSpacing: 1.4, marginTop: 3 },

  // Sources
  sourcesBlock: { marginTop: 4, gap: 8 },
  sourcesText: { fontSize: 12, lineHeight: 19 },
});
