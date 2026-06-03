import { useMemo, useState, type ReactNode } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, palette, spacing, type ColorPalette } from '@/config/theme';
import { AppText as Text } from '@/components/common/AppText';
import { Icon } from '@/components/common/Icon';
import { Kicker } from '@/components/common/Kicker';
import { LangToggle, type ContentLang } from '@/components/common/LangToggle';
import { Ornament } from '@/components/common/Ornament';
import { ScreenMount } from '@/components/common/ScreenMount';
import i18n, { resolveLanguage } from '@/i18n';

import { MotionPressable } from '@/components/common/MotionPressable';
import {
  getPujaBySlug,
  PUJA_DISCLAIMER,
  type ArcStep,
  type PostPujaLink,
  type PujaMantra,
  type SamagriItem,
  type Upachara,
} from '@/config/poojas';

type Lang = ContentLang;

function openMantraJaap(jaapSlug: string | null, customText: string | undefined) {
  if (jaapSlug) {
    router.push({ pathname: '/jaap/[slug]', params: { slug: jaapSlug } });
    return;
  }
  router.push({
    pathname: '/jaap/[slug]',
    params: { slug: 'custom', text: customText ?? '' },
  });
}

function handlePostPujaLink(link: PostPujaLink) {
  switch (link.kind) {
    case 'aarti':
      router.push(`/aarti/${link.deity}`);
      return;
    case 'chalisa':
      router.push(`/chalisa/${link.deity}`);
      return;
    case 'mantra-jaap':
      openMantraJaap(link.jaapSlug, link.customText);
      return;
    case 'vaar':
      router.push({ pathname: '/vaar/[day]', params: { day: link.dayKey } });
      return;
    case 'festival':
      router.push('/festivals');
      return;
    case 'muhurat':
      // No dedicated route for tithi-keyed windows (pradosh/purnima/monday/
      // ekadashi). The chip is informational; the festival/panchang screens
      // surface the actual upcoming dates.
      return;
  }
}

function postPujaIconFor(link: PostPujaLink) {
  switch (link.kind) {
    case 'aarti':
    case 'chalisa':
    case 'mantra-jaap':
      return 'flower' as const;
    case 'vaar':
      return 'sun' as const;
    case 'festival':
    case 'muhurat':
      return 'calendar' as const;
  }
}

function isClickable(link: PostPujaLink) {
  return link.kind !== 'muhurat';
}

export default function PujaDetailScreen() {
  const { t } = useTranslation();
  const isDarkMode = useStore((s) => s.isDarkMode);
  const appLanguage = useStore((s) => s.language);
  const colors = isDarkMode ? darkColors : lightColors;
  const ornamentTone = isDarkMode ? 'dark' : 'light';

  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const puja = useMemo(() => getPujaBySlug(slug), [slug]);

  // In-screen language toggle (same pattern as aarti/chalisa) — initialised
  // from the app-wide preference but freely overridden per visit.
  const [lang, setLang] = useState<Lang>(() => resolveLanguage(appLanguage));
  // Chrome (section labels, accessibility) follows the in-screen toggle so
  // labels flip with the content, not with the global app setting.
  const tForLang = useMemo(() => i18n.getFixedT(lang, 'translation'), [lang]);

  // Interactive samagri checklist — transient per session (not persisted).
  const [checkedSamagri, setCheckedSamagri] = useState<Set<string>>(new Set());

  if (!puja) {
    return (
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
            {tForLang('puja.indexTitle')}
          </Text>
          <View style={[styles.backPill, { borderWidth: 0 }]} />
        </View>
        <View style={styles.emptyWrap}>
          <Text variant="body-italic" style={[styles.emptyText, { color: colors.textMuted }]}>
            {tForLang('puja.notFound')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

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
            {puja.name[lang]}
          </Text>
          <View style={[styles.backPill, { borderWidth: 0 }]} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
          showsVerticalScrollIndicator={false}>

          {/* ── Hero: kicker + name (already in header) + ornament + when/why ── */}
          <View style={styles.hero}>
            <Text variant="mono-caps" style={[styles.heroKicker, { color: colors.accent }]}>
              {puja.kicker[lang]}
            </Text>
            <Ornament variant="lotus" tone={ornamentTone} style={styles.heroOrnament} />
          </View>

          {/* ── Lang toggle (same pattern as aarti/chalisa) ─────────────── */}
          <LangToggle lang={lang} onChange={setLang} colors={colors} />

          {/* ── When / Why ───────────────────────────────────────────────── */}
          <SectionCard title={tForLang('puja.whenWhyLabel')} colors={colors}>
            <Text variant="body" style={[styles.paragraph, { color: colors.textSecondary }]}>
              {puja.whenWhy[lang]}
            </Text>
          </SectionCard>

          {/* ── Disclaimer banner (top — accuracy posture) ───────────────── */}
          <View style={[styles.disclaimerBanner, { backgroundColor: palette.goldLeaf + '1E', borderColor: palette.goldLeaf + '66' }]}>
            <Icon name="info-circle" size={14} color={palette.goldLeaf} />
            <Text variant="body-italic" style={[styles.disclaimerBannerText, { color: colors.textPrimary }]}>
              {tForLang('puja.reviewBanner')}
            </Text>
          </View>

          {/* ── Samagri checklist ────────────────────────────────────────── */}
          <SectionCard title={tForLang('puja.samagriLabel')} colors={colors}>
            <Text variant="body-italic" style={[styles.sectionHint, { color: colors.textMuted }]}>
              {tForLang('puja.samagriHint')}
            </Text>
            <SamagriList
              items={puja.samagri}
              checked={checkedSamagri}
              onToggle={(key) => {
                setCheckedSamagri((prev) => {
                  const next = new Set(prev);
                  if (next.has(key)) next.delete(key);
                  else next.add(key);
                  return next;
                });
              }}
              lang={lang}
              colors={colors}
            />
          </SectionCard>

          {/* ── Sankalpa ─────────────────────────────────────────────────── */}
          <SectionCard title={tForLang('puja.sankalpaLabel')} colors={colors}>
            <Text variant="body-italic" style={[styles.sectionHint, { color: colors.textMuted }]}>
              {tForLang('puja.sankalpaHint')}
            </Text>
            <Text variant="body" style={[styles.paragraph, styles.sankalpaText, { color: colors.textSecondary }]}>
              {puja.sankalpa[lang]}
            </Text>
          </SectionCard>

          {/* ── Pre-arc steps ────────────────────────────────────────────── */}
          {puja.preUpacharas.length > 0 && (
            <SectionCard title={tForLang('puja.preArcLabel')} colors={colors}>
              {puja.preUpacharas.map((step, i) => (
                <ArcStepBlock
                  key={step.slug}
                  step={step}
                  index={i + 1}
                  total={puja.preUpacharas.length}
                  lang={lang}
                  colors={colors}
                  isDarkMode={isDarkMode}
                />
              ))}
            </SectionCard>
          )}

          {/* ── The 16 upacharas ─────────────────────────────────────────── */}
          <SectionCard title={tForLang('puja.shodashopacharaLabel')} colors={colors}>
            <Text variant="body-italic" style={[styles.sectionHint, { color: colors.textMuted }]}>
              {tForLang('puja.shodashopacharaHint')}
            </Text>
            {puja.upacharas.map((up, i) => (
              <UpacharaBlock
                key={`${up.slug}-${i}`}
                upachara={up}
                index={i + 1}
                last={i === puja.upacharas.length - 1}
                lang={lang}
                colors={colors}
                isDarkMode={isDarkMode}
              />
            ))}
          </SectionCard>

          {/* ── Post-arc steps ───────────────────────────────────────────── */}
          {puja.postUpacharas.length > 0 && (
            <SectionCard title={tForLang('puja.postArcLabel')} colors={colors}>
              {puja.postUpacharas.map((step, i) => (
                <ArcStepBlock
                  key={step.slug}
                  step={step}
                  index={i + 1}
                  total={puja.postUpacharas.length}
                  lang={lang}
                  colors={colors}
                  isDarkMode={isDarkMode}
                />
              ))}
            </SectionCard>
          )}

          {/* ── Stotra / Katha ───────────────────────────────────────────── */}
          {puja.stotraKathaRef && (
            <View style={[styles.stotraCard, { backgroundColor: colors.surface, borderColor: colors.borderAccent }]}>
              <Kicker color={colors.accent} size={10}>{puja.stotraKathaRef.label[lang]}</Kicker>
              <Text variant="body" style={[styles.paragraph, { color: colors.textSecondary, marginTop: 10 }]}>
                {puja.stotraKathaRef.note[lang]}
              </Text>
              {puja.stotraKathaRef.kind === 'aarti' && puja.stotraKathaRef.deity && (
                <MotionPressable
                  onPress={() => router.push(`/aarti/${puja.stotraKathaRef!.deity!}`)}
                  pressedScale={0.97}
                  style={[styles.stotraCta, { backgroundColor: isDarkMode ? palette.goldLeaf : palette.sindoor }]}
                  accessibilityRole="button"
                  accessibilityLabel={tForLang('puja.openAarti')}>
                  <Icon name="flower" size={14} color={palette.parchmentBright} />
                  <Text variant="mono-caps" style={styles.stotraCtaText}>{tForLang('puja.openAarti')}</Text>
                </MotionPressable>
              )}
              {puja.stotraKathaRef.kind === 'chalisa' && puja.stotraKathaRef.deity && (
                <MotionPressable
                  onPress={() => router.push(`/chalisa/${puja.stotraKathaRef!.deity!}`)}
                  pressedScale={0.97}
                  style={[styles.stotraCta, { backgroundColor: isDarkMode ? palette.goldLeaf : palette.sindoor }]}
                  accessibilityRole="button"
                  accessibilityLabel={tForLang('puja.openChalisa')}>
                  <Icon name="ribbon" size={14} color={palette.parchmentBright} />
                  <Text variant="mono-caps" style={styles.stotraCtaText}>{tForLang('puja.openChalisa')}</Text>
                </MotionPressable>
              )}
            </View>
          )}

          {/* ── Post-puja links ──────────────────────────────────────────── */}
          {puja.postPujaLinks.length > 0 && (
            <SectionCard title={tForLang('puja.afterTheLabel')} colors={colors}>
              <View style={styles.linksGrid}>
                {puja.postPujaLinks.map((link, i) => {
                  const clickable = isClickable(link);
                  const Container = clickable ? MotionPressable : View;
                  const label = 'label' in link && link.label
                    ? link.label[lang]
                    : '';
                  return (
                    <Container
                      key={`${link.kind}-${i}`}
                      onPress={clickable ? () => handlePostPujaLink(link) : undefined}
                      pressedScale={0.97}
                      style={[
                        styles.linkChip,
                        { backgroundColor: colors.surfaceRecessed, borderColor: colors.border },
                        !clickable && { opacity: 0.7 },
                      ]}
                      accessibilityRole={clickable ? 'button' : undefined}
                      accessibilityLabel={label}>
                      <Icon name={postPujaIconFor(link)} size={14} color={colors.accent} />
                      <Text
                        variant="mono-caps"
                        style={[styles.linkChipText, { color: colors.textSecondary }]}
                        numberOfLines={2}>
                        {label}
                      </Text>
                    </Container>
                  );
                })}
              </View>
            </SectionCard>
          )}

          {/* ── Variant notes ────────────────────────────────────────────── */}
          {puja.variantNotes.length > 0 && (
            <SectionCard title={tForLang('puja.variantsLabel')} colors={colors}>
              {puja.variantNotes.map((n, i) => (
                <View key={i} style={i > 0 ? styles.variantSpaced : undefined}>
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

          {/* ── Sources / disclaimer ─────────────────────────────────────── */}
          <View style={styles.sourcesBlock}>
            <Kicker color={colors.textMuted} size={9}>{tForLang('puja.sourcesLabel')}</Kicker>
            <Text variant="body-italic" style={[styles.sourcesText, { color: colors.textMuted }]}>
              {PUJA_DISCLAIMER[lang]}
            </Text>
          </View>

          <View style={{ height: 32 }} />
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

interface SamagriListProps {
  items: readonly SamagriItem[];
  checked: Set<string>;
  onToggle: (key: string) => void;
  lang: Lang;
  colors: ColorPalette;
}

function SamagriList({ items, checked, onToggle, lang, colors }: SamagriListProps) {
  // Group by `group` so items show as labeled sub-sections (Image / Vessels /
  // Offerings / Flowers / Naivedya / …). Items with no group fall into a
  // single "Other" bucket. Preserves original list order within each group.
  const groups = useMemo(() => {
    const result: { groupLabel: string | null; items: { key: string; item: SamagriItem }[] }[] = [];
    const lookup = new Map<string | null, number>();
    items.forEach((item) => {
      const groupKey = item.group ? item.group[lang] : null;
      let idx = lookup.get(groupKey);
      if (idx === undefined) {
        idx = result.length;
        lookup.set(groupKey, idx);
        result.push({ groupLabel: groupKey, items: [] });
      }
      result[idx].items.push({ key: item.label.en, item });
    });
    return result;
  }, [items, lang]);

  return (
    <View>
      {groups.map((g, gi) => (
        <View key={g.groupLabel ?? `_${gi}`} style={gi > 0 ? styles.samagriGroupSpaced : undefined}>
          {g.groupLabel && (
            <Text variant="mono-caps" style={[styles.samagriGroupLabel, { color: colors.accent }]}>
              {g.groupLabel}
            </Text>
          )}
          {g.items.map(({ key, item }) => {
            const isChecked = checked.has(key);
            return (
              <MotionPressable
                key={key}
                onPress={() => onToggle(key)}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                style={styles.samagriRow}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isChecked }}
                accessibilityLabel={item.label[lang]}>
                <Icon
                  name={isChecked ? 'check-circle' : 'circle-outline'}
                  size={18}
                  color={isChecked ? colors.accent : colors.textTertiary}
                />
                <Text
                  variant="body"
                  style={[
                    styles.samagriText,
                    {
                      color: isChecked ? colors.textTertiary : colors.textSecondary,
                      textDecorationLine: isChecked ? 'line-through' : 'none',
                    },
                  ]}>
                  {item.label[lang]}
                  {item.optional ? (lang === 'hi' ? ' · (वैकल्पिक)' : ' · (optional)') : ''}
                </Text>
              </MotionPressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

interface ArcStepBlockProps {
  step: ArcStep;
  index: number;
  total: number;
  lang: Lang;
  colors: ColorPalette;
  isDarkMode: boolean;
}

function ArcStepBlock({ step, index, total, lang, colors, isDarkMode }: ArcStepBlockProps) {
  const last = index === total;
  return (
    <View style={[styles.stepRow, last && { borderBottomWidth: 0 }, { borderBottomColor: colors.divider }]}>
      <View style={styles.stepHeadRow}>
        <View style={[styles.stepNumber, { backgroundColor: colors.surfaceRecessed, borderColor: colors.borderAccent }]}>
          <Text variant="mono-caps" style={[styles.stepNumberText, { color: colors.accent }]}>{String(index)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="deva-bold" style={[styles.stepNameSanskrit, { color: colors.textPrimary }]}>
            {step.name.sanskrit}
          </Text>
          <Text variant="body-italic" style={[styles.stepNameGloss, { color: colors.textTertiary }]}>
            {step.name[lang]}
          </Text>
        </View>
      </View>
      <Text variant="body" style={[styles.stepLine, { color: colors.textSecondary }]}>
        {step.line[lang]}
      </Text>
      {step.conditional && (
        <Text variant="body-italic" style={[styles.stepConditional, { color: colors.textMuted }]}>
          {step.conditional[lang]}
        </Text>
      )}
      {step.mantra && <StepMantra mantra={step.mantra} lang={lang} colors={colors} isDarkMode={isDarkMode} />}
    </View>
  );
}

interface UpacharaBlockProps {
  upachara: Upachara;
  index: number;
  last: boolean;
  lang: Lang;
  colors: ColorPalette;
  isDarkMode: boolean;
}

function UpacharaBlock({ upachara, index, last, lang, colors, isDarkMode }: UpacharaBlockProps) {
  return (
    <View style={[styles.stepRow, last && { borderBottomWidth: 0 }, { borderBottomColor: colors.divider }]}>
      <View style={styles.stepHeadRow}>
        <View style={[styles.stepNumber, { backgroundColor: colors.surfaceRecessed, borderColor: colors.borderAccent }]}>
          <Text variant="mono-caps" style={[styles.stepNumberText, { color: colors.accent }]}>{String(index)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="deva-bold" style={[styles.stepNameSanskrit, { color: colors.textPrimary }]}>
            {upachara.name.sanskrit}
          </Text>
          <Text variant="body-italic" style={[styles.stepNameGloss, { color: colors.textTertiary }]}>
            {upachara.name[lang]}
          </Text>
        </View>
      </View>
      <Text variant="body" style={[styles.stepLine, { color: colors.textSecondary }]}>
        {upachara.line[lang]}
      </Text>
      {upachara.mantra && <StepMantra mantra={upachara.mantra} lang={lang} colors={colors} isDarkMode={isDarkMode} />}
    </View>
  );
}

interface StepMantraProps {
  mantra: PujaMantra;
  lang: Lang;
  colors: ColorPalette;
  isDarkMode: boolean;
}

function StepMantra({ mantra, lang, colors, isDarkMode }: StepMantraProps) {
  const { t } = useTranslation();
  const tForLang = useMemo(() => i18n.getFixedT(lang, 'translation'), [lang]);
  return (
    <View style={[styles.stepMantra, { borderColor: colors.borderAccent, backgroundColor: colors.surfaceRecessed }]}>
      <Text variant="deva-bold" style={[styles.stepMantraDeva, { color: colors.textPrimary }]}>
        {mantra.devanagari}
      </Text>
      <Text variant="body-italic" style={[styles.stepMantraIast, { color: colors.textTertiary }]}>
        {mantra.iast}
      </Text>
      <Text variant="body" style={[styles.stepMantraMeaning, { color: colors.textSecondary }]}>
        {mantra.meaning[lang]}
      </Text>
      <MotionPressable
        onPress={() => openMantraJaap(mantra.jaapSlug, mantra.devanagari)}
        pressedScale={0.97}
        style={[styles.stepMantraJaapBtn, { borderColor: colors.borderAccent }]}
        accessibilityRole="button"
        accessibilityLabel={t('puja.a11yStartJaap')}>
        <Icon name="flower" size={12} color={isDarkMode ? palette.goldLeaf : palette.sindoor} />
        <Text variant="mono-caps" style={[styles.stepMantraJaapText, { color: isDarkMode ? palette.goldLeaf : palette.sindoor }]}>
          {tForLang('puja.startJaap')}
        </Text>
      </MotionPressable>
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
  headerTitle: { flex: 1, fontSize: 20, lineHeight: 26, textAlign: 'center' },

  scroll: { paddingTop: 16, paddingBottom: 24 },

  // Hero
  hero: { alignItems: 'center', marginBottom: 18 },
  heroKicker: { fontSize: 10, letterSpacing: 1.8, textAlign: 'center' },
  heroOrnament: { marginTop: 14, width: '55%' },

  // Disclaimer banner
  disclaimerBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: borderRadius.cardInner,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: spacing.cardGap,
  },
  disclaimerBannerText: { flex: 1, fontSize: 12.5, lineHeight: 18 },

  // Cards
  card: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    padding: spacing.cardPadLg,
    marginBottom: spacing.cardGap,
  },
  cardBody: { marginTop: 12 },

  paragraph: { fontSize: 14, lineHeight: 22 },
  sectionHint: { fontSize: 12, lineHeight: 18, marginTop: 2, marginBottom: 12 },

  // Samagri
  samagriGroupSpaced: { marginTop: 14 },
  samagriGroupLabel: { fontSize: 9, letterSpacing: 1.4, marginBottom: 6 },
  samagriRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 5,
  },
  samagriText: { flex: 1, fontSize: 13.5, lineHeight: 20 },

  // Sankalpa
  sankalpaText: { fontStyle: 'italic' },

  // Steps (pre-arc + 16 upacharas + post-arc)
  stepRow: {
    paddingTop: 14,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stepHeadRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: { fontSize: 11 },
  stepNameSanskrit: { fontSize: 17, lineHeight: 24 },
  stepNameGloss: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  stepLine: { fontSize: 14, lineHeight: 22, marginTop: 10, marginLeft: 40 },
  stepConditional: { fontSize: 12.5, lineHeight: 19, marginTop: 8, marginLeft: 40 },

  // Step mantra plinth
  stepMantra: {
    marginTop: 12,
    marginLeft: 40,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: borderRadius.cardInner,
    borderWidth: 1,
  },
  stepMantraDeva: { fontSize: 17, lineHeight: 26 },
  stepMantraIast: { fontSize: 12.5, lineHeight: 18, marginTop: 4 },
  stepMantraMeaning: { fontSize: 13, lineHeight: 19, marginTop: 8 },
  stepMantraJaapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.chip,
    borderWidth: 1,
    marginTop: 10,
  },
  stotraCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: borderRadius.button,
    marginTop: 14,
  },
  stotraCtaText: { fontSize: 11, color: palette.parchmentBright },
  stepMantraJaapText: { fontSize: 9, letterSpacing: 1.4 },

  // Stotra/Katha card
  stotraCard: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    padding: spacing.cardPadLg,
    marginBottom: spacing.cardGap,
  },

  // Post-puja link chips
  linksGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  linkChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: borderRadius.chip,
    borderWidth: 1,
    minWidth: '47%',
    flexShrink: 1,
  },
  linkChipText: { flex: 1, fontSize: 9, letterSpacing: 1.4 },

  // Variants
  variantSpaced: { marginTop: 14 },
  variantLabel: { fontSize: 9, letterSpacing: 1.4 },
  variantText: { marginTop: 4 },

  // Sources
  sourcesBlock: { marginTop: 4, gap: 8 },
  sourcesText: { fontSize: 12, lineHeight: 19 },

  // Empty / not-found
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  emptyText: { fontSize: 14, lineHeight: 22, textAlign: 'center' },
});
