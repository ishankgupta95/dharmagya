import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSpring,
  interpolateColor,
} from 'react-native-reanimated';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, controlHeight, palette, spacing, type ColorPalette } from '@/config/theme';
import { durations, easings, springs, stagger } from '@/config/motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { AppText as Text } from '@/components/common/AppText';
import { Icon } from '@/components/common/Icon';
import { LangToggle, type ContentLang } from '@/components/common/LangToggle';
import { ScreenMount } from '@/components/common/ScreenMount';
import { MotionPressable } from '@/components/common/MotionPressable';
import { GlassSurface } from '@/components/common/GlassSurface';
import { useLocaleFormatters } from '@/utils/format';
import i18n, { resolveLanguage } from '@/i18n';

import {
  getPujaBySlug,
  PUJA_DISCLAIMER,
  type ArcStep,
  type PostPujaLink,
  type PujaContent,
  type PujaMantra,
  type SamagriItem,
  type Upachara,
} from '@/config/poojas';

type Lang = ContentLang;

// One flow step of the vidhi — opening arc, an upachara, or closing arc.
type FlowStep =
  | { kind: 'arc'; step: ArcStep }
  | { kind: 'upachara'; step: Upachara };

type Stage = 'overview' | 'steps' | 'done';

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

// The step slides in 24px on a settle spring while crossfading (MOTION.md,
// "Pooja step transitions"). The outgoing step only crossfades so a direction
// reversal never shows a stale slide. Module-scope worklet builders.
function stepEnterForward() {
  'worklet';
  return {
    initialValues: { opacity: 0, transform: [{ translateX: 24 }] },
    animations: {
      opacity: withTiming(1, { duration: durations.base, easing: easings.standard }),
      transform: [{ translateX: withSpring(0, springs.settle) }],
    },
  };
}

function stepEnterBack() {
  'worklet';
  return {
    initialValues: { opacity: 0, transform: [{ translateX: -24 }] },
    animations: {
      opacity: withTiming(1, { duration: durations.base, easing: easings.standard }),
      transform: [{ translateX: withSpring(0, springs.settle) }],
    },
  };
}

function stepExitFade() {
  'worklet';
  return {
    initialValues: { opacity: 1 },
    animations: {
      opacity: withTiming(0, { duration: durations.instant, easing: easings.standard }),
    },
  };
}

export default function PujaDetailScreen() {
  const { t } = useTranslation();
  const isDarkMode = useStore((s) => s.isDarkMode);
  const appLanguage = useStore((s) => s.language);
  const colors = isDarkMode ? darkColors : lightColors;
  const { formatNumber } = useLocaleFormatters();
  const { reduced } = useReducedMotion();

  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const puja = useMemo(() => getPujaBySlug(slug), [slug]);

  // In-screen language toggle (same pattern as aarti/chalisa) — initialised
  // from the app-wide preference but freely overridden per visit.
  const [lang, setLang] = useState<Lang>(() => resolveLanguage(appLanguage));
  // Chrome (section labels, accessibility) follows the in-screen toggle so
  // labels flip with the content, not with the global app setting.
  const tForLang = useMemo(() => i18n.getFixedT(lang, 'translation'), [lang]);

  const [stage, setStage] = useState<Stage>('overview');
  const [stepIndex, setStepIndex] = useState(0);
  // Slide direction for the incoming step. State, not a ref — it's read during
  // render to pick the entering animation; both updates batch into one render.
  const [dir, setDir] = useState<1 | -1>(1);

  // Interactive samagri checklist — transient per session (not persisted).
  // Shared between the overview checklist and each step's "needed now" card.
  const [checkedSamagri, setCheckedSamagri] = useState<Set<string>>(new Set());

  const flowSteps: FlowStep[] = useMemo(() => {
    if (!puja) return [];
    return [
      ...puja.preUpacharas.map((step): FlowStep => ({ kind: 'arc', step })),
      ...puja.upacharas.map((step): FlowStep => ({ kind: 'upachara', step })),
      ...puja.postUpacharas.map((step): FlowStep => ({ kind: 'arc', step })),
    ];
  }, [puja]);

  if (!puja) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
        <View style={[styles.headerRow, { paddingHorizontal: spacing.screenH }]}>
          <MotionPressable
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.back')}>
            <Icon name="chevron-left" size={22} color={colors.textSecondary} />
          </MotionPressable>
          <Text variant="title" style={[styles.headerName, { color: colors.textPrimary }]} numberOfLines={1}>
            {tForLang('puja.indexTitle')}
          </Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.emptyWrap}>
          <Text variant="body" style={[styles.emptyText, { color: colors.textMuted }]}>
            {tForLang('puja.notFound')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const total = flowSteps.length;
  const toggleSamagri = (key: string) => {
    setCheckedSamagri((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  function goForward() {
    if (stepIndex >= total - 1) {
      setStage('done');
      return;
    }
    setDir(1);
    setStepIndex((i) => i + 1);
  }

  function goBack() {
    if (stepIndex === 0) {
      setStage('overview');
      return;
    }
    setDir(-1);
    setStepIndex((i) => i - 1);
  }

  // ── Steps stage ─────────────────────────────────────────────────────────
  if (stage === 'steps') {
    const flow = flowSteps[stepIndex];
    const entering = reduced ? undefined : dir === 1 ? stepEnterForward : stepEnterBack;
    const exiting = reduced ? undefined : stepExitFade;
    const isLast = stepIndex === total - 1;

    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
        {/* X · name · n / N */}
        <View style={[styles.headerRow, { paddingHorizontal: spacing.screenH }]}>
          <MotionPressable
            onPress={() => setStage('overview')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={tForLang('puja.a11yExitSteps')}>
            <Icon name="close" size={20} color={colors.textSecondary} />
          </MotionPressable>
          <Text
            variant={lang === 'hi' ? 'deva' : 'title'}
            style={[styles.headerName, { color: colors.textPrimary }]}
            numberOfLines={1}>
            {puja.name[lang]}
          </Text>
          <Text variant="mono" style={[styles.headerCounter, { color: colors.textTertiary }]}>
            {formatNumber(stepIndex + 1)} / {formatNumber(total)}
          </Text>
        </View>

        <ProgressTicks
          total={total}
          filled={stepIndex + 1}
          colors={colors}
          isDark={isDarkMode}
          reduced={reduced}
        />

        <ScrollView
          contentContainerStyle={[styles.stepScroll, { paddingHorizontal: 28 }]}
          showsVerticalScrollIndicator={false}>
          <Animated.View key={stepIndex} entering={entering} exiting={exiting}>
            <StepBody
              flow={flow}
              index={stepIndex}
              puja={puja}
              lang={lang}
              tForLang={tForLang}
              colors={colors}
              checked={checkedSamagri}
              onToggle={toggleSamagri}
            />
          </Animated.View>
          <View style={{ height: 24 }} />
        </ScrollView>

        {/* back circle + Done CTA */}
        <View style={[styles.stepFooter, { paddingHorizontal: spacing.screenH }]}>
          <MotionPressable
            onPress={goBack}
            pressedScale={0.94}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.back')}>
            <GlassSurface style={styles.backCircle}>
              <Icon name="chevron-left" size={20} color={colors.textSecondary} />
            </GlassSurface>
          </MotionPressable>
          <MotionPressable
            onPress={goForward}
            pressedScale={0.97}
            style={styles.doneCta}
            accessibilityRole="button"
            accessibilityLabel={isLast ? tForLang('puja.finish') : tForLang('puja.doneNext')}>
            <Text variant="button" style={styles.doneCtaText}>
              {isLast ? tForLang('puja.finish') : tForLang('puja.doneNext')}
            </Text>
          </MotionPressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Done stage ──────────────────────────────────────────────────────────
  if (stage === 'done') {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
        <View style={[styles.headerRow, { paddingHorizontal: spacing.screenH }]}>
          <MotionPressable
            onPress={() => setStage('overview')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.back')}>
            <Icon name="chevron-left" size={22} color={colors.textSecondary} />
          </MotionPressable>
          <Text
            variant={lang === 'hi' ? 'deva' : 'title'}
            style={[styles.headerName, { color: colors.textPrimary }]}
            numberOfLines={1}>
            {puja.name[lang]}
          </Text>
          <View style={{ width: 22 }} />
        </View>

        <ProgressTicks total={total} filled={total} colors={colors} isDark={isDarkMode} reduced={reduced} />

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
          showsVerticalScrollIndicator={false}>

          <Text variant="kicker" style={[styles.doneKicker, { color: colors.accentText }]}>
            {tForLang('puja.completeTitle')}
          </Text>
          <Text variant="body" style={[styles.doneSubtitle, { color: colors.textSecondary }]}>
            {tForLang('puja.completeSubtitle')}
          </Text>

          {/* Stotra / Katha */}
          {puja.stotraKathaRef && (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderAccent }]}>
              <Text variant="kicker-small" style={[styles.cardKicker, { color: colors.accentText }]}>
                {puja.stotraKathaRef.label[lang]}
              </Text>
              <Text variant="body" style={[styles.paragraph, { color: colors.textSecondary, marginTop: 10 }]}>
                {puja.stotraKathaRef.note[lang]}
              </Text>
              {puja.stotraKathaRef.kind === 'aarti' && puja.stotraKathaRef.deity && (
                <MotionPressable
                  onPress={() => router.push(`/aarti/${puja.stotraKathaRef!.deity!}`)}
                  pressedScale={0.97}
                  style={styles.stotraCta}
                  accessibilityRole="button"
                  accessibilityLabel={tForLang('puja.openAarti')}>
                  <Text variant="button" style={styles.stotraCtaText}>{tForLang('puja.openAarti')}</Text>
                </MotionPressable>
              )}
              {puja.stotraKathaRef.kind === 'chalisa' && puja.stotraKathaRef.deity && (
                <MotionPressable
                  onPress={() => router.push(`/chalisa/${puja.stotraKathaRef!.deity!}`)}
                  pressedScale={0.97}
                  style={styles.stotraCta}
                  accessibilityRole="button"
                  accessibilityLabel={tForLang('puja.openChalisa')}>
                  <Text variant="button" style={styles.stotraCtaText}>{tForLang('puja.openChalisa')}</Text>
                </MotionPressable>
              )}
            </View>
          )}

          {/* Post-puja links */}
          {puja.postPujaLinks.length > 0 && (
            <SectionCard title={tForLang('puja.afterTheLabel')} colors={colors}>
              <View style={styles.linksGrid}>
                {puja.postPujaLinks.map((link, i) => {
                  const clickable = isClickable(link);
                  const Container = clickable ? MotionPressable : View;
                  const label = 'label' in link && link.label ? link.label[lang] : '';
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
                        variant="body-small"
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

          {/* Variant notes */}
          {puja.variantNotes.length > 0 && (
            <SectionCard title={tForLang('puja.variantsLabel')} colors={colors}>
              {puja.variantNotes.map((n, i) => (
                <View key={i} style={i > 0 ? styles.variantSpaced : undefined}>
                  <Text variant="kicker-small" style={[styles.variantLabel, { color: colors.accentText }]}>
                    {n.label[lang]}
                  </Text>
                  <Text variant="body" style={[styles.paragraph, styles.variantText, { color: colors.textSecondary }]}>
                    {n.text[lang]}
                  </Text>
                </View>
              ))}
            </SectionCard>
          )}

          {/* Sources / disclaimer */}
          <View style={styles.sourcesBlock}>
            <Text variant="kicker-small" style={{ color: colors.textMuted, fontSize: 9 }}>
              {tForLang('puja.sourcesLabel')}
            </Text>
            <Text variant="body-small" style={[styles.sourcesText, { color: colors.textMuted }]}>
              {PUJA_DISCLAIMER[lang]}
            </Text>
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Overview stage ──────────────────────────────────────────────────────
  return (
    <ScreenMount>
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>

        <View style={[styles.headerRow, { paddingHorizontal: spacing.screenH }]}>
          <MotionPressable
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.back')}>
            <Icon name="chevron-left" size={22} color={colors.textSecondary} />
          </MotionPressable>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
          showsVerticalScrollIndicator={false}>

          {/* Title block */}
          <Text variant="kicker" style={[styles.heroKicker, { color: colors.accentText }]}>
            {puja.kicker[lang]}
          </Text>
          <Text
            variant={lang === 'hi' ? 'deva-bold' : 'display'}
            style={[styles.heroTitle, { color: colors.textPrimary }]}>
            {puja.name[lang]}
          </Text>
          <Text variant="body-small" style={[styles.heroMeta, { color: colors.textTertiary }]}>
            {tForLang('puja.stepCount', { count: total })} · {tForLang('puja.samagriCount', { count: puja.samagri.length })}
          </Text>

          <LangToggle lang={lang} onChange={setLang} colors={colors} />

          {/* When / why */}
          <SectionCard title={tForLang('puja.whenWhyLabel')} colors={colors}>
            <Text variant="body" style={[styles.paragraph, { color: colors.textSecondary }]}>
              {puja.whenWhy[lang]}
            </Text>
          </SectionCard>

          {/* Review banner — accuracy posture */}
          <View style={[styles.disclaimerBanner, { backgroundColor: colors.accentSurface, borderColor: colors.borderAccent }]}>
            <Icon name="info-circle" size={14} color={colors.accentText} />
            <Text variant="body-small" style={[styles.disclaimerBannerText, { color: colors.textSecondary }]}>
              {tForLang('puja.reviewBanner')}
            </Text>
          </View>

          {/* Full samagri checklist */}
          <SectionCard title={tForLang('puja.samagriLabel')} colors={colors}>
            <Text variant="body-small" style={[styles.sectionHint, { color: colors.textMuted }]}>
              {tForLang('puja.samagriHint')}
            </Text>
            <SamagriList
              items={puja.samagri}
              checked={checkedSamagri}
              onToggle={toggleSamagri}
              lang={lang}
              colors={colors}
            />
          </SectionCard>

          {/* Sankalpa — recited before the steps begin */}
          <SectionCard title={tForLang('puja.sankalpaLabel')} colors={colors}>
            <Text variant="body-small" style={[styles.sectionHint, { color: colors.textMuted }]}>
              {tForLang('puja.sankalpaHint')}
            </Text>
            <Text variant="body" style={[styles.paragraph, { color: colors.textSecondary }]}>
              {puja.sankalpa[lang]}
            </Text>
          </SectionCard>

          <View style={{ height: 8 }} />
        </ScrollView>

        {/* Begin CTA */}
        <View style={[styles.stepFooter, { paddingHorizontal: spacing.screenH }]}>
          <MotionPressable
            onPress={() => { setDir(1); setStepIndex(0); setStage('steps'); }}
            pressedScale={0.97}
            style={[styles.doneCta, { flex: 1 }]}
            accessibilityRole="button"
            accessibilityLabel={tForLang('puja.beginCta')}>
            <Text variant="button" style={styles.doneCtaText}>{tForLang('puja.beginCta')}</Text>
          </MotionPressable>
        </View>
      </SafeAreaView>
    </ScreenMount>
  );
}

// ─── Step body ────────────────────────────────────────────────────────────────

interface StepBodyProps {
  flow: FlowStep;
  index: number;
  puja: PujaContent;
  lang: Lang;
  tForLang: (key: string, opts?: Record<string, unknown>) => string;
  colors: ColorPalette;
  checked: Set<string>;
  onToggle: (key: string) => void;
}

function StepBody({ flow, index, puja, lang, tForLang, colors, checked, onToggle }: StepBodyProps) {
  const { formatNumber } = useLocaleFormatters();
  const step = flow.step;

  // Per-step samagri ("needed now") — driven entirely by the library's
  // `samagriRefs` linkage (refs match `label.en`). Most pujas don't carry the
  // linkage yet, so the card simply doesn't render; the overview checklist
  // remains the complete list. Never guessed app-side (accuracy posture).
  const neededNow = useMemo(() => {
    const refs = flow.kind === 'upachara' ? flow.step.samagriRefs : undefined;
    if (!refs?.length) return [];
    return puja.samagri.filter((s) => refs.includes(s.label.en));
  }, [flow, puja.samagri]);
  const neededDone = neededNow.filter((s) => checked.has(s.label.en)).length;

  const conditional = flow.kind === 'arc' ? flow.step.conditional : undefined;

  return (
    <View>
      {/* Kicker: STEP N · devanagari name */}
      <Text variant="kicker" style={[styles.stepKicker, { color: colors.accentText }]}>
        {tForLang('puja.stepKicker', { n: formatNumber(index + 1) })}
        <Text variant="deva" style={[styles.stepKickerDeva, { color: colors.accentText }]}>
          {'  ·  '}{step.name.sanskrit}
        </Text>
      </Text>

      <Text
        variant={lang === 'hi' ? 'deva-bold' : 'display'}
        style={[styles.stepTitle, { color: colors.textPrimary }]}>
        {step.name[lang]}
      </Text>

      <Text variant="body" style={[styles.stepLine, { color: colors.textSecondary }]}>
        {step.line[lang]}
      </Text>

      {conditional && (
        <Text variant="body-small" style={[styles.stepConditional, { color: colors.textMuted }]}>
          {conditional[lang]}
        </Text>
      )}

      {step.mantra && (
        <StepMantra mantra={step.mantra} tForLang={tForLang} lang={lang} colors={colors} />
      )}

      {neededNow.length > 0 && (
        <View style={[styles.neededCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.neededHead}>
            <Text variant="kicker-small" style={[styles.neededLabel, { color: colors.textMuted }]}>
              {tForLang('puja.neededNow')}
            </Text>
            <Text variant="mono" style={[styles.neededCount, { color: colors.textMuted }]}>
              {formatNumber(neededDone)} / {formatNumber(neededNow.length)}
            </Text>
          </View>
          <SamagriList items={neededNow} checked={checked} onToggle={onToggle} lang={lang} colors={colors} />
        </View>
      )}
    </View>
  );
}

interface StepMantraProps {
  mantra: PujaMantra;
  tForLang: (key: string) => string;
  lang: Lang;
  colors: ColorPalette;
}

function StepMantra({ mantra, tForLang, lang, colors }: StepMantraProps) {
  return (
    <View style={[styles.mantraCard, { backgroundColor: colors.surface, borderColor: colors.borderAccent }]}>
      <Text variant="deva-bold" style={[styles.mantraDeva, { color: colors.textPrimary }]}>
        {mantra.devanagari}
      </Text>
      {/* IAST kept — this line predates the redesign (grandfathered surface). */}
      <Text variant="body-small" style={[styles.mantraIast, { color: colors.textTertiary }]}>
        {mantra.iast}
      </Text>
      <Text variant="body-small" style={[styles.mantraMeaning, { color: colors.textSecondary }]}>
        {mantra.meaning[lang]}
      </Text>
      <View style={[styles.mantraRule, { backgroundColor: colors.divider }]} />
      <MotionPressable
        onPress={() => openMantraJaap(mantra.jaapSlug, mantra.devanagari)}
        pressedScale={0.97}
        style={styles.mantraJaapBtn}
        accessibilityRole="button"
        accessibilityLabel={tForLang('puja.a11yStartJaap')}>
        <Icon name="flower" size={15} color={colors.accent} />
        <Text variant="title" style={[styles.mantraJaapText, { color: colors.accentText }]}>
          {tForLang('puja.startJaap')}
        </Text>
      </MotionPressable>
    </View>
  );
}

// ─── Progress ticks ───────────────────────────────────────────────────────────

function ProgressTicks({
  total,
  filled,
  colors,
  isDark,
  reduced,
}: {
  total: number;
  filled: number;
  colors: ColorPalette;
  isDark: boolean;
  reduced: boolean;
}) {
  const empty = isDark ? 'rgba(237,232,240,0.13)' : 'rgba(34,27,36,0.10)';

  return (
    <View style={[styles.ticksRow, { paddingHorizontal: spacing.screenH }]}>
      {Array.from({ length: total }, (_, i) => (
        <Tick
          key={i}
          filled={i < filled}
          index={i}
          emptyColor={empty}
          fillColor={colors.accent}
          reduced={reduced}
        />
      ))}
    </View>
  );
}

// Ticks fill one at a time, fast, staggered 40ms (MOTION.md). The cascade only
// happens when the row mounts already-partly-filled (entering the flow at step
// N); a single forward step fills its one tick with no delay. The mount check
// lives inside the effect so no ref is read during render.
function Tick({
  filled,
  index,
  emptyColor,
  fillColor,
  reduced,
}: {
  filled: boolean;
  index: number;
  emptyColor: string;
  fillColor: string;
  reduced: boolean;
}) {
  const v = useSharedValue(0);
  const mountedRef = useRef(false);
  useEffect(() => {
    const isMount = !mountedRef.current;
    mountedRef.current = true;
    const target = filled ? 1 : 0;
    const delay = filled && isMount ? index * stagger.tight : 0;
    v.value = reduced
      ? withTiming(target, { duration: 0 })
      : withDelay(delay, withTiming(target, { duration: durations.instant, easing: easings.standard }));
  }, [filled, index, reduced, v]);

  const style = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(v.value, [0, 1], [emptyColor, fillColor]),
  }));

  return <Animated.View style={[styles.tick, style]} />;
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function SectionCard({ title, colors, children }: { title: string; colors: ColorPalette; children: ReactNode }) {
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text variant="kicker-small" style={[styles.cardKicker, { color: colors.accentText }]}>{title}</Text>
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
  // single bucket. Preserves original list order within each group.
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
            <Text variant="kicker-small" style={[styles.samagriGroupLabel, { color: colors.accentText }]}>
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 6,
    paddingBottom: 10,
  },
  headerName: { flex: 1, fontSize: 15, lineHeight: 21, textAlign: 'center' },
  headerCounter: { fontSize: 13, minWidth: 44, textAlign: 'right' },

  ticksRow: { flexDirection: 'row', gap: 4, paddingTop: 4, paddingBottom: 10 },
  tick: { flex: 1, height: 3, borderRadius: 2 },

  scroll: { paddingTop: 8, paddingBottom: 24 },
  stepScroll: { paddingTop: 22, paddingBottom: 16 },

  // Overview hero
  heroKicker: { fontSize: 10.5 },
  heroTitle: { fontSize: 30, lineHeight: 38, marginTop: 8 },
  heroMeta: { fontSize: 13, marginTop: 6, marginBottom: 14 },

  // Step body
  stepKicker: { fontSize: 10.5 },
  stepKickerDeva: { fontSize: 13, letterSpacing: 0, textTransform: 'none' },
  stepTitle: { fontSize: 30, lineHeight: 37, marginTop: 9 },
  stepLine: { fontSize: 15, lineHeight: 25, marginTop: 12 },
  stepConditional: { fontSize: 13, lineHeight: 19, marginTop: 10 },

  // Mantra card
  mantraCard: {
    marginTop: 24,
    borderRadius: borderRadius.card,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 22,
  },
  mantraDeva: { fontSize: 21, lineHeight: 34, textAlign: 'center' },
  mantraIast: { fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 10, fontStyle: 'italic' },
  mantraMeaning: { fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 10 },
  mantraRule: { height: 1, marginVertical: 16 },
  mantraJaapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mantraJaapText: { fontSize: 13.5 },

  // Needed-now card
  neededCard: {
    marginTop: 14,
    borderRadius: borderRadius.list,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 15,
  },
  neededHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  neededLabel: { fontSize: 9.5 },
  neededCount: { fontSize: 12 },

  // Step footer
  stepFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 10,
    paddingBottom: 6,
  },
  backCircle: {
    width: controlHeight.button,
    height: controlHeight.button,
    borderRadius: controlHeight.button / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  doneCta: {
    flex: 1,
    height: controlHeight.button,
    borderRadius: borderRadius.button,
    backgroundColor: palette.turmeric,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: palette.turmeric,
    shadowOpacity: 0.3,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  doneCtaText: { fontSize: 15.5, color: palette.night },

  // Done stage
  doneKicker: { fontSize: 10.5, marginTop: 10 },
  doneSubtitle: { fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 16 },

  // Cards
  card: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    padding: spacing.cardPadLg,
    marginBottom: spacing.cardGap,
  },
  cardKicker: { fontSize: 9.5 },
  cardBody: { marginTop: 12 },

  paragraph: { fontSize: 14, lineHeight: 22 },
  sectionHint: { fontSize: 12, lineHeight: 18, marginTop: 2, marginBottom: 12 },

  // Disclaimer banner
  disclaimerBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: borderRadius.list,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: spacing.cardGap,
  },
  disclaimerBannerText: { flex: 1, fontSize: 12.5, lineHeight: 18 },

  // Samagri
  samagriGroupSpaced: { marginTop: 14 },
  samagriGroupLabel: { fontSize: 9, marginBottom: 6 },
  samagriRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 5,
  },
  samagriText: { flex: 1, fontSize: 13.5, lineHeight: 20 },

  // Stotra/Katha card CTA
  stotraCta: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: borderRadius.button,
    marginTop: 14,
    backgroundColor: palette.turmeric,
  },
  stotraCtaText: { fontSize: 14, color: palette.night },

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
  linkChipText: { flex: 1, fontSize: 11.5, lineHeight: 15 },

  // Variants
  variantSpaced: { marginTop: 14 },
  variantLabel: { fontSize: 9 },
  variantText: { marginTop: 4 },

  // Sources
  sourcesBlock: { marginTop: 4, gap: 8 },
  sourcesText: { fontSize: 12, lineHeight: 19 },

  // Empty / not-found
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  emptyText: { fontSize: 14, lineHeight: 22, textAlign: 'center' },
});
