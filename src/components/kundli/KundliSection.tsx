import { useMemo, useState } from 'react';
import { View, StyleSheet, TextInput, ScrollView, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import type { Dignity, Divisional, DivisionalChart } from 'panchang-ts';

import { AppText as Text } from '@/components/common/AppText';
import { Icon, type IconName } from '@/components/common/Icon';
import { Kicker } from '@/components/common/Kicker';
import { SectionLabel } from '@/components/common/SectionLabel';
import { NightCard, usePlinthColors } from '@/components/common/NightCard';
import { SegmentedChip } from '@/components/common/SegmentedChip';
import { DatePickerModal } from '@/components/common/DatePickerModal';
import { TimePickerModal } from '@/components/common/TimePickerModal';
import { useStore, type Sex } from '@/store/useStore';
import { borderRadius, darkColors, lightColors, palette, spacing, type ColorPalette } from '@/config/theme';
import { resolveLanguage } from '@/i18n';
import { MotionPressable } from '@/components/common/MotionPressable';
import {
  computeKundli,
  computeDivisional,
  computeDashaTimeline,
  computeShadbalaCached,
  computeBhavaBalaCached,
  computeKpCuspalSubLordsCached,
  computeSpecialLagnasCached,
  computeUpagrahasCached,
  buildBirthInputs,
  DIVISIONAL_CHARTS_BEYOND_D9,
} from '@/services/astrology/kundliService';
import { DEFAULT_BIRTH_TIMEZONE, wallclockInZoneToUtc } from '@/utils/time';
import { buildKundliReading, getDashaPeriodTheme } from '@/config/kundliReading';
import { DoshaCard } from './DoshaCard';
import { RemedyNudge } from './RemedyNudge';
import { ShadbalaChart } from './ShadbalaChart';
import { BhavaBalaChart } from './BhavaBalaChart';
import { AspectsCard } from './AspectsCard';
import { YogasCard } from './YogasCard';
import { KarakasCard } from './KarakasCard';
import { AshtakavargaCard } from './AshtakavargaCard';
import { AdvancedPointsCard } from './AdvancedPointsCard';
import { KpCard } from './KpCard';
import { DashaSection } from './DashaSection';
import { SadeSatiSection } from './SadeSatiSection';
import { AccordionSection } from '@/components/panchang/AccordionSection';
import { useLocaleFormatters } from '@/utils/format';
import { ymd } from '@/utils/calendar';
import { NorthChart } from './NorthChart';
import { SouthChart } from './SouthChart';
import { PlanetaryDignityChart } from './PlanetaryDignityChart';
import { cellsFromD1, cellsFromD9 } from './chartCells';

const RASHI_NAMES_EN = [
  'Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya',
  'Tula', 'Vrischika', 'Dhanu', 'Makara', 'Kumbha', 'Meena',
];
const RASHI_NAMES_HI = [
  'मेष', 'वृषभ', 'मिथुन', 'कर्क', 'सिंह', 'कन्या',
  'तुला', 'वृश्चिक', 'धनु', 'मकर', 'कुम्भ', 'मीन',
];

// Persisted-disclosure key for the one "Advanced chart" switch (P16.2). Reuses
// the store's generic keyed open-state map so the switch remembers its state
// across launches without a schema change.
const ADVANCED_KEY = 'kundli.advancedChart';

export function KundliSection() {
  const { t, i18n } = useTranslation();
  // Single shallow-compared slice of the store fields this component touches.
  // Without `useShallow`, each field is its own subscription and a
  // theme/language toggle fires up to N re-renders before React batches.
  const {
    isDarkMode,
    language,
    userBirthDate,
    userBirthTime,
    userBirthPlace,
    userSex,
    userName,
    setUserBirthDate,
    setUserBirthTime,
    setUserSex,
    setUserName,
    ayanamsa,
    houseSystem,
    chartStyle,
    setChartStyle,
    panchangCategoriesOpen,
    togglePanchangCategory,
  } = useStore(
    useShallow((s) => ({
      isDarkMode: s.isDarkMode,
      language: s.language,
      userBirthDate: s.userBirthDate,
      userBirthTime: s.userBirthTime,
      userBirthPlace: s.userBirthPlace,
      userSex: s.userSex,
      userName: s.userName,
      setUserBirthDate: s.setUserBirthDate,
      setUserBirthTime: s.setUserBirthTime,
      setUserSex: s.setUserSex,
      setUserName: s.setUserName,
      ayanamsa: s.ayanamsa,
      houseSystem: s.houseSystem,
      chartStyle: s.chartStyle,
      setChartStyle: s.setChartStyle,
      panchangCategoriesOpen: s.panchangCategoriesOpen,
      togglePanchangCategory: s.togglePanchangCategory,
    })),
  );
  const colors = isDarkMode ? darkColors : lightColors;
  const plinth = usePlinthColors();
  const { width } = useWindowDimensions();
  const { formatTime } = useLocaleFormatters();

  // 'D1' = natal rashi chart; everything else is a divisional (varga) chart
  // computed lazily through `computeDivisional` so we don't pay the BPHS varga
  // math up front for charts the user never opens. Defaults to D9 (Navamsa /
  // marriage) so the Advanced selector opens on a chart other than the D1
  // already shown in Basics.
  const [activeChart, setActiveChart] = useState<'D1' | Divisional>('D9');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [aspectsOpen, setAspectsOpen] = useState(false);
  const [ashtakavargaOpen, setAshtakavargaOpen] = useState(false);
  const [advancedPointsOpen, setAdvancedPointsOpen] = useState(false);
  const [kpOpen, setKpOpen] = useState(false);
  const [shadbalaOpen, setShadbalaOpen] = useState(false);
  const [bhavaBalaOpen, setBhavaBalaOpen] = useState(false);
  // Local draft for the name TextInput so we only commit on blur, not on
  // every keystroke (avoids re-renders + per-key store writes).
  const [nameDraft, setNameDraft] = useState<string>(userName ?? '');
  // "Now" for the running-mahadasha progress bar, captured once at mount:
  // dasha progress moves by years, so a static snapshot is exact enough and
  // keeps render pure.
  const [progressNowMs] = useState(() => Date.now());

  // The one "Advanced chart" disclosure. Default off; persisted so a power
  // user who opens it once keeps it open. Hiding the advanced stack costs the
  // power user zero compute because the heavy computes are gated below.
  const advancedOpen = panchangCategoriesOpen[ADVANCED_KEY] ?? false;

  const inputs = useMemo(
    () =>
      buildBirthInputs({
        birthDateIso: userBirthDate,
        birthTimeHHmm: userBirthTime,
        birthPlace: userBirthPlace,
        ayanamsa,
        language: resolveLanguage(language),
        houseSystem,
      }),
    [userBirthDate, userBirthTime, userBirthPlace, ayanamsa, language, houseSystem],
  );

  const bundle = useMemo(() => (inputs ? computeKundli(inputs) : null), [inputs]);

  // Birth instant (UTC) for the current-dasha plain-words line in Basics. Same
  // wall-clock-in-zone conversion DashaSection uses, so both agree.
  const birthInstant = useMemo<Date | null>(() => {
    if (!userBirthDate) return null;
    const tz = userBirthPlace?.timezone ?? DEFAULT_BIRTH_TIMEZONE;
    try {
      return wallclockInZoneToUtc(userBirthDate, userBirthTime ?? '12:00', tz);
    } catch {
      return null;
    }
  }, [userBirthDate, userBirthTime, userBirthPlace]);

  // Current Vimshottari Mahadasha for the Basics summary line. Cheap relative
  // to the full timeline UI; gated on birth instant existing.
  const currentDasha = useMemo(() => {
    if (!birthInstant) return null;
    try {
      return computeDashaTimeline(birthInstant, ayanamsa);
    } catch {
      return null;
    }
  }, [birthInstant, ayanamsa]);

  // Plain-language reading (P16-era): personality + strengths + cautions drawn
  // from signals the bundle already carries. Built here (before early returns)
  // to keep hook order stable; cheap string assembly.
  const reading = useMemo(() => {
    if (!bundle) return null;
    const moonIdx = bundle.d1.planets.find((p) => p.planet === 'Moon')?.rashi.index ?? null;
    return buildKundliReading({
      lagnaRashiIndex: bundle.d1.lagna.rashi.index,
      moonRashiIndex: moonIdx,
      dignity: bundle.dignity,
      hasMangal: bundle.mangal.afflicted,
      hasKaalSarp: bundle.kaalSarp.afflicted,
      hasPitru: bundle.pitru.afflicted,
      hasPositiveYoga: bundle.yogas.some((g) => g.type !== 'negative' && g.bhanga?.applies !== true),
      lang: resolveLanguage(language) === 'hi' ? 'hi' : 'en',
    });
  }, [bundle, language]);

  // Shadbala + Bhava Bala live in default-closed accordions (advanced
  // diagnostic; not a primary read). Gate the compute on the open flag — the
  // service-layer cache will keep subsequent re-opens instant.
  const shadbala = useMemo(
    () => (inputs && shadbalaOpen ? computeShadbalaCached(inputs) : null),
    [inputs, shadbalaOpen],
  );
  const bhavaBala = useMemo(
    () => (inputs && bhavaBalaOpen ? computeBhavaBalaCached(inputs) : null),
    [inputs, bhavaBalaOpen],
  );

  // Upagrahas + special lagnas + KP cuspal sub-lords are all gated on their
  // accordions actually being open — math is cheap individually but there are
  // 11 lib calls in total; no point paying them on a chart load nobody sees.
  const upagrahas = useMemo(
    () => (inputs && advancedPointsOpen ? computeUpagrahasCached(inputs) : null),
    [inputs, advancedPointsOpen],
  );
  const specialLagnas = useMemo(
    () => (inputs && advancedPointsOpen ? computeSpecialLagnasCached(inputs) : null),
    [inputs, advancedPointsOpen],
  );
  const kpCuspal = useMemo(
    () => (inputs && kpOpen ? computeKpCuspalSubLordsCached(inputs) : null),
    [inputs, kpOpen],
  );

  const lang = resolveLanguage(language);
  const rashiNames = lang === 'hi' ? RASHI_NAMES_HI : RASHI_NAMES_EN;

  // Style memos — every render of the chip strip used to allocate fresh
  // arrays + color objects, defeating SegmentedChip's structural-equality
  // checks and trickling re-renders into Text. Hoisted here so they only
  // change when the underlying inputs do.
  const chipActiveBg = palette.turmeric;
  const styleChipTextNorth = useMemo(
    () => [
      styles.styleChipText,
      { color: chartStyle === 'north' ? palette.parchmentBright : colors.textSecondary },
    ],
    [chartStyle, colors.textSecondary],
  );
  const styleChipTextSouth = useMemo(
    () => [
      styles.styleChipText,
      { color: chartStyle === 'south' ? palette.parchmentBright : colors.textSecondary },
    ],
    [chartStyle, colors.textSecondary],
  );

  const userBirthDateObj = userBirthDate ? new Date(userBirthDate + 'T12:00:00') : null;
  const birthDateLabel = userBirthDateObj
    ? userBirthDateObj.toLocaleDateString(i18n.language === 'hi' ? 'hi-IN' : 'en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : t('settings.birthDateNotSet');
  const birthTimeLabel = userBirthTime ? formatTime(userBirthTime) : t('settings.birthTimeNotSet');
  const birthPlaceLabel = userBirthPlace?.name ?? t('settings.birthPlaceNotSet');

  // Inline editable form. Rendered in every state — empty, compute-failed,
  // and chart-rendered — so the user can adjust inputs without leaving the
  // Kundli surface. All field writes go straight to the store, so changes
  // re-trigger the kundli memo and the chart updates live.
  const formCard = (
    <View style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <NameInputRow
        value={nameDraft}
        placeholder={t('kundli.fieldNamePlaceholder')}
        label={t('kundli.fieldName')}
        optionalLabel={t('kundli.optional')}
        onChangeText={setNameDraft}
        onCommit={() => setUserName(nameDraft)}
        colors={colors}
      />
      <View style={[styles.formDivider, { backgroundColor: colors.divider }]} />
      <FormFieldRow
        icon="gift"
        label={t('settings.birthDate')}
        value={birthDateLabel}
        valueIsSet={!!userBirthDate}
        onPress={() => setDatePickerOpen(true)}
        colors={colors}
      />
      <View style={[styles.formDivider, { backgroundColor: colors.divider }]} />
      <FormFieldRow
        icon="clock"
        label={t('settings.birthTime')}
        value={birthTimeLabel}
        valueIsSet={!!userBirthTime}
        onPress={() => setTimePickerOpen(true)}
        colors={colors}
      />
      <View style={[styles.formDivider, { backgroundColor: colors.divider }]} />
      <FormFieldRow
        icon="location"
        label={t('settings.birthPlace')}
        value={birthPlaceLabel}
        valueIsSet={!!userBirthPlace}
        onPress={() => router.push('/settings/birth-place')}
        colors={colors}
      />
      <View style={[styles.formDivider, { backgroundColor: colors.divider }]} />
      <SexSelectRow
        value={userSex}
        label={t('settings.sex.label')}
        optionalLabel={t('kundli.optional')}
        maleLabel={t('settings.sex.male')}
        femaleLabel={t('settings.sex.female')}
        onChange={setUserSex}
        colors={colors}
        isDarkMode={isDarkMode}
      />
    </View>
  );

  const pickerModals = (
    <>
      <DatePickerModal
        visible={datePickerOpen}
        onClose={() => setDatePickerOpen(false)}
        value={userBirthDateObj}
        onPick={(d) => setUserBirthDate(ymd(d))}
        onClear={() => setUserBirthDate(null)}
        minYear={1900}
        maxYear={new Date().getFullYear()}
        maxDate={new Date()}
        colors={colors}
        title={t('settings.birthDatePickerTitle')}
      />
      <TimePickerModal
        visible={timePickerOpen}
        onClose={() => setTimePickerOpen(false)}
        value={userBirthTime ?? '12:00'}
        onPick={setUserBirthTime}
        title={t('settings.birthTimePickerTitle')}
      />
    </>
  );

  // Empty state — ONE clean "Set up your kundli" form so the user can enter
  // their details without leaving the Kundli tab. Values write directly to the
  // same store settings reads, so the two surfaces stay in sync.
  if (!userBirthDate || !userBirthPlace) {
    return (
      <View>
        <SectionLabel style={styles.sectionLabelSpacing}>
          {t('kundli.setupTitle')}
        </SectionLabel>
        <Text variant="body-italic" style={[styles.formIntro, { color: colors.textSecondary }]}>
          {t('kundli.formIntro')}
        </Text>
        {formCard}

        {/* Match-others CTA — available even before the user fills their own
            details, since matching two other people doesn't need them. */}
        <MatchOthersCard colors={colors} t={t} />

        {pickerModals}
      </View>
    );
  }

  if (!bundle) {
    return (
      <View>
        <SectionLabel style={styles.sectionLabelSpacing}>
          {t('kundli.title')}
        </SectionLabel>
        <Text variant="body-italic" style={[styles.computeFailed, { color: colors.textMuted }]}>
          {t('kundli.computeFailed')}
        </Text>

        <SectionLabel style={styles.sectionLabelSpacing}>
          {t('kundli.yourDetailsLabel')}
        </SectionLabel>
        {formCard}
        {pickerModals}
      </View>
    );
  }

  const lagna = bundle.d1.lagna;
  const lagnaRashiName = rashiNames[lagna.rashi.index];

  // Moon + Sun signs for the Basics identity card.
  const moonRashiIdx = bundle.d1.planets.find((p) => p.planet === 'Moon')?.rashi.index ?? null;
  const sunRashiIdx = bundle.d1.planets.find((p) => p.planet === 'Sun')?.rashi.index ?? null;
  const moonName = moonRashiIdx !== null ? rashiNames[moonRashiIdx] : '—';
  const sunName = sunRashiIdx !== null ? rashiNames[sunRashiIdx] : '—';

  // Current Mahadasha (plain words) for the Basics summary.
  const currentLord = currentDasha?.full.currentMahaDashaLord ?? null;
  const currentMd = currentDasha?.full.mahaDashas[currentDasha.full.currentIndex] ?? null;
  const currentEndDate = currentMd?.endDate ?? null;
  const currentEndYear = currentEndDate ? currentEndDate.getFullYear() : null;
  // Elapsed fraction of the running mahadasha — the frame-08 progress bar.
  const periodProgress = (() => {
    if (!currentMd) return null;
    const span = currentMd.endDate.getTime() - currentMd.startDate.getTime();
    if (span <= 0) return null;
    return Math.min(1, Math.max(0, (progressNowMs - currentMd.startDate.getTime()) / span));
  })();
  const periodRangeLocale = lang === 'hi' ? 'hi-IN' : 'en-IN';
  const periodRange = currentMd
    ? {
        start: currentMd.startDate.toLocaleDateString(periodRangeLocale, { month: 'short', year: 'numeric' }),
        end: currentMd.endDate.toLocaleDateString(periodRangeLocale, { month: 'short', year: 'numeric' }),
      }
    : null;
  // Plain-words theme for the current Mahadasha, shown under the period card.
  const periodTheme = getDashaPeriodTheme(currentLord, lang === 'hi' ? 'hi' : 'en');

  // Top doshas/yogas as plain chips. Afflictions first (warning tone), then up
  // to two notable positive yogas (skipping cancelled/negative ones).
  const flags: { key: string; label: string; tone: 'warn' | 'good' }[] = [];
  if (bundle.mangal.afflicted) flags.push({ key: 'mangal', label: t('kundli.flagMangal'), tone: 'warn' });
  if (bundle.kaalSarp.afflicted) flags.push({ key: 'kaalSarp', label: t('kundli.flagKaalSarp'), tone: 'warn' });
  if (bundle.pitru.afflicted) flags.push({ key: 'pitru', label: t('kundli.flagPitru'), tone: 'warn' });
  for (const y of bundle.yogas.filter((g) => g.type !== 'negative' && g.bhanga?.applies !== true).slice(0, 2)) {
    flags.push({ key: `yoga-${y.name}`, label: y.name, tone: 'good' });
  }

  // Chart cells. D1 is shown in Basics; the Advanced varga is computed lazily
  // and only when the Advanced switch is open.
  const d1Cells = cellsFromD1(bundle.d1, lang);
  const advChartCells = (() => {
    if (!advancedOpen) return null;
    if (activeChart === 'D1') return cellsFromD1(bundle.d1, lang);
    const dv: DivisionalChart | null =
      activeChart === 'D9' ? bundle.d9 : inputs ? computeDivisional(inputs, activeChart) : null;
    return dv ? cellsFromD9(dv, lang) : cellsFromD1(bundle.d1, lang);
  })();

  // Chart fills screen width minus screen padding.
  const chartSize = Math.min(width - spacing.screenH * 2, 360);
  const dignityLabel = (d: Dignity): string => t(`kundli.dignity.${d}`);
  const weakMoon = bundle.dignity.some((d) => d.graha === 'Moon' && d.dignity === 'debilitated');

  return (
    <View>
      {/* ── Your details (always at top) ─────────────────────────────────
          Editable inline so birth-data tweaks happen without scrolling past
          the whole chart. The chart re-renders whenever any field changes. */}
      <SectionLabel style={styles.sectionLabelSpacing}>
        {t('kundli.yourDetailsLabel')}
      </SectionLabel>
      {formCard}
      {pickerModals}

      {/* ── BASICS ───────────────────────────────────────────────────────── */}

      {/* Identity snapshot — Lagna + Moon sign + Sun sign. */}
      <View style={styles.lagnaWrap}>
        <NightCard padding={20} mandalaSize={180} mandalaOpacity={0.08}>
          <Kicker color={plinth.accent} size={10}>
            {t('kundli.lagnaLabel')}
          </Kicker>
          <Text variant="display-italic" style={[styles.lagnaRashi, { color: plinth.text }]}>
            {lagnaRashiName}
          </Text>
          <Text variant="mono" style={[styles.lagnaMeta, { color: plinth.textSubdued }]}>
            {lagna.degreeInRashi.toFixed(2)}° · {lagna.nakshatra.name} ·{' '}
            {t('kundli.padaShort', { pada: lagna.pada })}
          </Text>

          <View style={[styles.identityDivider, { backgroundColor: plinth.divider }]} />
          <View style={styles.identityRow}>
            <View style={styles.identityCol}>
              <Text variant="mono-caps" style={[styles.identityLabel, { color: plinth.textSubdued }]}>
                {t('kundli.moonSignLabel')}
              </Text>
              <Text variant="body" style={[styles.identityValue, { color: plinth.text }]}>
                {moonName}
              </Text>
            </View>
            <View style={styles.identityCol}>
              <Text variant="mono-caps" style={[styles.identityLabel, { color: plinth.textSubdued }]}>
                {t('kundli.sunSignLabel')}
              </Text>
              <Text variant="body" style={[styles.identityValue, { color: plinth.text }]}>
                {sunName}
              </Text>
            </View>
          </View>
        </NightCard>
      </View>

      {/* ── YOUR READING ─────────────────────────────────────────────────
          Plain-language interpretation (personality + strengths + cautions)
          so a non-astrology reader understands what the chart actually says.
          Driven entirely by signals the bundle already carries. */}
      {reading && (
        <>
          <SectionLabel style={styles.sectionLabelSpacing}>
            {t('kundli.reading.label')}
          </SectionLabel>
          <Text variant="body-italic" style={[styles.readingIntro, { color: colors.textSecondary }]}>
            {t('kundli.reading.intro')}
          </Text>
          <View style={[styles.readingCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text variant="mono-caps" style={[styles.readingSubLabel, { color: colors.accent }]}>
              {t('kundli.reading.natureLabel')}
            </Text>
            <Text variant="body" style={[styles.readingText, { color: colors.textPrimary }]}>
              {reading.lagnaText}
            </Text>
            {reading.moonText && (
              <Text
                variant="body"
                style={[styles.readingText, styles.readingTextGap, { color: colors.textPrimary }]}>
                {reading.moonText}
              </Text>
            )}

            <View style={[styles.readingDivider, { backgroundColor: colors.divider }]} />
            <Text variant="mono-caps" style={[styles.readingSubLabel, { color: colors.textTertiary }]}>
              {t('kundli.reading.strengthsLabel')}
            </Text>
            {reading.strengths.map((s) => (
              <View key={s} style={styles.readingBulletRow}>
                <View style={styles.readingBulletIc}>
                  <Icon name="check-circle" size={13} color={colors.accent} />
                </View>
                <Text variant="body" style={[styles.readingBulletText, { color: colors.textSecondary }]}>
                  {s}
                </Text>
              </View>
            ))}

            <View style={[styles.readingDivider, { backgroundColor: colors.divider }]} />
            <Text variant="mono-caps" style={[styles.readingSubLabel, { color: colors.textTertiary }]}>
              {t('kundli.reading.cautionsLabel')}
            </Text>
            {reading.cautions.map((c) => (
              <View key={c} style={styles.readingBulletRow}>
                <View style={styles.readingBulletIc}>
                  <Icon name="alert-circle" size={13} color={colors.danger} />
                </View>
                <Text variant="body" style={[styles.readingBulletText, { color: colors.textSecondary }]}>
                  {c}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Current period (plain words). */}
      {currentLord && currentEndYear !== null && (
        <View style={[styles.periodCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text variant="mono-caps" style={[styles.periodKicker, { color: colors.accent }]}>
            {t('kundli.currentPeriodLabel')}
          </Text>
          <Text variant="body" style={[styles.periodBody, { color: colors.textPrimary }]}>
            {t('kundli.currentPeriodBody', {
              planet: t(`dasha.planet.${currentLord.toLowerCase()}`),
              year: currentEndYear,
            })}
          </Text>
          {periodTheme && (
            <Text variant="body-italic" style={[styles.periodThemeText, { color: colors.textSecondary }]}>
              {periodTheme}
            </Text>
          )}
          {periodProgress !== null && periodRange && (
            <>
              <View style={[styles.periodTrack, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.periodFill,
                    { backgroundColor: colors.accent, width: `${Math.round(periodProgress * 100)}%` },
                  ]}
                />
              </View>
              <View style={styles.periodRangeRow}>
                <Text variant="mono" style={[styles.periodRangeText, { color: colors.textMuted }]}>
                  {periodRange.start}
                </Text>
                <Text variant="mono" style={[styles.periodRangeText, { color: colors.textMuted }]}>
                  {periodRange.end}
                </Text>
              </View>
            </>
          )}
        </View>
      )}

      {/* Sade Sati status (chart-derived sub-section). */}
      <SadeSatiSection />

      {/* Highlights — top doshas / yogas as plain chips. */}
      <SectionLabel style={styles.sectionLabelSpacing}>
        {t('kundli.highlightsLabel')}
      </SectionLabel>
      {flags.length > 0 ? (
        <View style={styles.flagsWrap}>
          {flags.map((f) => (
            <View
              key={f.key}
              style={[
                styles.flagChip,
                {
                  backgroundColor: colors.surface,
                  borderColor: f.tone === 'warn' ? colors.danger : colors.borderAccent,
                },
              ]}>
              <Icon
                name={f.tone === 'warn' ? 'alert-circle' : 'check-circle'}
                size={12}
                color={f.tone === 'warn' ? colors.danger : colors.accent}
              />
              <Text variant="mono-caps" style={[styles.flagChipText, { color: colors.textPrimary }]}>
                {f.label}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text variant="body-italic" style={[styles.noFlags, { color: colors.textMuted }]}>
          {t('kundli.noFlags')}
        </Text>
      )}

      {/* ── D1 chart + style toggle ──────────────────────────────────────── */}
      <View style={styles.toggleRow}>
        <View style={styles.styleGroup}>
          <SegmentedChip
            active={chartStyle === 'north'}
            onPress={() => setChartStyle('north')}
            inactiveBg="transparent"
            activeBg={chipActiveBg}
            inactiveBorder={colors.border}
            activeBorder="transparent"
            style={styles.styleChip}
            accessibilityLabel={t('kundli.chartNorth')}>
            <Text variant="mono-caps" style={styleChipTextNorth}>
              {t('kundli.chartNorth')}
            </Text>
          </SegmentedChip>
          <SegmentedChip
            active={chartStyle === 'south'}
            onPress={() => setChartStyle('south')}
            inactiveBg="transparent"
            activeBg={chipActiveBg}
            inactiveBorder={colors.border}
            activeBorder="transparent"
            style={styles.styleChip}
            accessibilityLabel={t('kundli.chartSouth')}>
            <Text variant="mono-caps" style={styleChipTextSouth}>
              {t('kundli.chartSouth')}
            </Text>
          </SegmentedChip>
        </View>
      </View>

      <View style={styles.chartWrap}>
        {chartStyle === 'north' ? (
          <NorthChart cells={d1Cells} size={chartSize} />
        ) : (
          <SouthChart cells={d1Cells} size={chartSize} />
        )}
      </View>

      {/* ── Tools ────────────────────────────────────────────────────────
          Promotes the formerly-buried match / annual / prashna routes into a
          visible row near the top of the Kundli tab (P16.1). */}
      <SectionLabel style={styles.sectionLabelSpacing}>
        {t('kundli.toolsLabel')}
      </SectionLabel>
      <View style={styles.toolsRow}>
        <ToolTile
          icon="people"
          label={t('kundli.toolMatch')}
          onPress={() => router.push('/kundli/match')}
          colors={colors}
        />
        <ToolTile
          icon="calendar"
          label={t('kundli.toolVarshaphala')}
          onPress={() => router.push('/kundli/varshaphala')}
          colors={colors}
        />
        <ToolTile
          icon="compass"
          label={t('kundli.toolPrashna')}
          onPress={() => router.push('/kundli/prashna')}
          colors={colors}
        />
      </View>

      {/* ── ADVANCED CHART ───────────────────────────────────────────────
          One switch (default off, persisted) reveals the full expert stack:
          divisional charts, dignity, doshas, yogas, karakas, Shadbala,
          Bhava Bala, Ashtakavarga, Aspects, Advanced Points, KP, and the full
          dasha timeline. Each heavy sub-section keeps its own lazy-compute gate
          so opening the switch only pays for what's actually shown. */}
      <View style={styles.advancedSection}>
        <AccordionSection
          storageKey={ADVANCED_KEY}
          title={t('kundli.advancedChart')}
          open={advancedOpen}
          onToggle={() => togglePanchangCategory(ADVANCED_KEY)}
          colors={colors}>
          {/* Divisional (varga) chart selector + chart. */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.divScrollContent}
            style={styles.divScroll}>
            {(['D1', 'D9', ...DIVISIONAL_CHARTS_BEYOND_D9] as const).map((kind) => {
              const active = activeChart === kind;
              const meaning = t(`kundli.divisional.${kind}`);
              return (
                <SegmentedChip
                  key={kind}
                  active={active}
                  onPress={() => setActiveChart(kind)}
                  inactiveBg="transparent"
                  activeBg={colors.surface}
                  inactiveBorder={colors.border}
                  activeBorder={colors.borderAccent}
                  style={styles.divChip}
                  accessibilityLabel={`${kind} · ${meaning}`}>
                  <Text
                    variant="mono-caps"
                    style={[
                      styles.divChipText,
                      { color: active ? colors.textPrimary : colors.textTertiary },
                    ]}>
                    {kind}
                  </Text>
                  <Text
                    variant="mono-caps"
                    numberOfLines={1}
                    style={[
                      styles.divChipMeaning,
                      { color: active ? colors.textSecondary : colors.textMuted },
                    ]}>
                    {meaning}
                  </Text>
                </SegmentedChip>
              );
            })}
          </ScrollView>

          <View style={styles.chartWrap}>
            {advChartCells &&
              (chartStyle === 'north' ? (
                <NorthChart cells={advChartCells} size={chartSize} />
              ) : (
                <SouthChart cells={advChartCells} size={chartSize} />
              ))}
          </View>

          {/* Planetary dignity strip. */}
          <SectionLabel style={styles.sectionLabelSpacing}>
            {t('kundli.dignitySection')}
          </SectionLabel>
          <PlanetaryDignityChart items={bundle.dignity} labelFor={dignityLabel} />
          {weakMoon && (
            <RemedyNudge
              text={t('vaar.nudgeWeakChandra')}
              dayKey="monday"
              icon="moon"
              colors={colors}
              style={styles.remedyNudge}
            />
          )}

          {/* Doshas (Mangal + Kaal Sarp + Pitru). */}
          <SectionLabel style={styles.sectionLabelSpacing}>
            {t('kundli.doshasSection')}
          </SectionLabel>
          <DoshaCard
            mangal={bundle.mangal}
            kaalSarp={bundle.kaalSarp}
            pitru={bundle.pitru}
            colors={colors}
          />

          {/* Yogas (named classical combinations). */}
          <SectionLabel style={styles.sectionLabelSpacing}>
            {t('kundli.yogas.sectionTitle')}
          </SectionLabel>
          <YogasCard yogas={bundle.yogas} colors={colors} />

          {/* Jaimini Karakas. */}
          <SectionLabel style={styles.sectionLabelSpacing}>
            {t('kundli.karakas.sectionTitle')}
          </SectionLabel>
          <KarakasCard karakas={bundle.karakas} karakas8={bundle.karakas8} colors={colors} />

          {/* Shadbala — advanced diagnostic, default-collapsed. */}
          <View style={styles.aspectsWrap}>
            <AccordionSection
              storageKey="kundli.shadbala"
              title={t('kundli.shadbalaSection')}
              open={shadbalaOpen}
              onToggle={() => setShadbalaOpen((o) => !o)}
              colors={colors}>
              {shadbala && <ShadbalaChart shadbala={shadbala} />}
            </AccordionSection>
          </View>

          {/* Bhava Bala — advanced diagnostic, default-collapsed. */}
          <View style={styles.aspectsWrap}>
            <AccordionSection
              storageKey="kundli.bhavaBala"
              title={t('kundli.bhavaBala.sectionTitle')}
              open={bhavaBalaOpen}
              onToggle={() => setBhavaBalaOpen((o) => !o)}
              colors={colors}>
              {bhavaBala && <BhavaBalaChart bhavaBala={bhavaBala} colors={colors} />}
            </AccordionSection>
          </View>

          {/* Ashtakavarga — math-heavy, default-collapsed. */}
          <View style={styles.aspectsWrap}>
            <AccordionSection
              storageKey="kundli.ashtakavarga"
              title={t('kundli.ashtakavarga.sectionTitle')}
              open={ashtakavargaOpen}
              onToggle={() => setAshtakavargaOpen((o) => !o)}
              colors={colors}>
              <AshtakavargaCard result={bundle.ashtakavarga} colors={colors} />
            </AccordionSection>
          </View>

          {/* Aspects (Drishti) — collapsible, default-closed. */}
          <View style={styles.aspectsWrap}>
            <AccordionSection
              storageKey="kundli.aspects"
              title={t('aspects.sectionTitle')}
              open={aspectsOpen}
              onToggle={() => setAspectsOpen((o) => !o)}
              colors={colors}>
              <AspectsCard d1={bundle.d1} aspects={bundle.aspects} colors={colors} />
            </AccordionSection>
          </View>

          {/* Advanced points — Arudhas + Argala + Upagrahas + Special lagnas. */}
          <View style={styles.aspectsWrap}>
            <AccordionSection
              storageKey="kundli.advancedPoints"
              title={t('kundli.advancedPoints.sectionTitle')}
              open={advancedPointsOpen}
              onToggle={() => setAdvancedPointsOpen((o) => !o)}
              colors={colors}>
              <AdvancedPointsCard
                arudhas={bundle.arudhas}
                argala={bundle.argala}
                upagrahas={upagrahas}
                specialLagnas={specialLagnas}
                colors={colors}
                isDarkMode={isDarkMode}
              />
            </AccordionSection>
          </View>

          {/* KP layer — cuspal sub-lords + significators. */}
          <View style={styles.aspectsWrap}>
            <AccordionSection
              storageKey="kundli.kp"
              title={t('kundli.kp.sectionTitle')}
              open={kpOpen}
              onToggle={() => setKpOpen((o) => !o)}
              colors={colors}>
              <KpCard cuspal={kpCuspal} significators={bundle.kpSignificators} colors={colors} />
            </AccordionSection>
          </View>

          {/* Full dasha timeline (system chips + 120-year cycle). The birth
              date is owned by the details form above, so DashaSection renders
              embedded (its own birth-date row hidden). */}
          <SectionLabel style={styles.sectionLabelSpacing}>
            {t('kundli.dashaTimelineLabel')}
          </SectionLabel>
          <DashaSection embedded />

          {/* Match two other people — lives in Advanced so the Tools row stays
              to the three primary tools; matching others is a power-user path. */}
          <View style={styles.aspectsWrap}>
            <MatchOthersCard colors={colors} t={t} />
          </View>
        </AccordionSection>
      </View>
    </View>
  );
}

interface ToolTileProps {
  icon: IconName;
  label: string;
  onPress: () => void;
  colors: ColorPalette;
}

function ToolTile({ icon, label, onPress, colors }: ToolTileProps) {
  return (
    <MotionPressable
      pressedScale={0.96}
      onPress={onPress}
      style={[styles.toolTile, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityRole="button"
      accessibilityLabel={label}>
      <View style={[styles.toolTileIc, { backgroundColor: colors.surfaceRecessed, borderColor: colors.borderAccent }]}>
        <Icon name={icon} size={18} color={colors.accent} />
      </View>
      <Text variant="mono-caps" numberOfLines={1} style={[styles.toolTileLabel, { color: colors.textPrimary }]}>
        {label}
      </Text>
    </MotionPressable>
  );
}

interface FormFieldRowProps {
  icon: IconName;
  label: string;
  value: string;
  valueIsSet: boolean;
  onPress: () => void;
  colors: ColorPalette;
}

function FormFieldRow({ icon, label, value, valueIsSet, onPress, colors }: FormFieldRowProps) {
  return (
    <MotionPressable
      onPress={onPress}
      style={styles.formRow}
      accessibilityRole="button"
      accessibilityLabel={label}>
      <View style={[styles.formIc, { backgroundColor: colors.surfaceRecessed }]}>
        <Icon name={icon} size={16} color={colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="mono-caps" style={[styles.formRowLabel, { color: colors.textTertiary }]}>
          {label}
        </Text>
        <Text
          variant={valueIsSet ? 'body' : 'body-italic'}
          style={[styles.formRowValue, { color: valueIsSet ? colors.textPrimary : colors.textMuted }]}
          numberOfLines={1}>
          {value}
        </Text>
      </View>
      <Icon name="chevron-right" size={14} color={colors.textMuted} />
    </MotionPressable>
  );
}

interface NameInputRowProps {
  value: string;
  placeholder: string;
  label: string;
  optionalLabel: string;
  onChangeText: (next: string) => void;
  onCommit: () => void;
  colors: ColorPalette;
}

function NameInputRow({
  value,
  placeholder,
  label,
  optionalLabel,
  onChangeText,
  onCommit,
  colors,
}: NameInputRowProps) {
  return (
    <View style={styles.formRow}>
      <View style={[styles.formIc, { backgroundColor: colors.surfaceRecessed }]}>
        <Icon name="person" size={16} color={colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="mono-caps" style={[styles.formRowLabel, { color: colors.textTertiary }]}>
          {label} · {optionalLabel}
        </Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onBlur={onCommit}
          onSubmitEditing={onCommit}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          returnKeyType="done"
          maxLength={40}
          style={[styles.nameInput, { color: colors.textPrimary }]}
          accessibilityLabel={label}
        />
      </View>
    </View>
  );
}

interface SexSelectRowProps {
  value: Sex | null;
  label: string;
  optionalLabel: string;
  maleLabel: string;
  femaleLabel: string;
  onChange: (next: Sex) => void;
  colors: ColorPalette;
  isDarkMode: boolean;
}

function SexSelectRow({
  value,
  label,
  optionalLabel,
  maleLabel,
  femaleLabel,
  onChange,
  colors,
  isDarkMode,
}: SexSelectRowProps) {
  const activeBg = palette.turmeric;
  return (
    <View style={styles.formRow}>
      <View style={[styles.formIc, { backgroundColor: colors.surfaceRecessed }]}>
        <Icon name="people" size={16} color={colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="mono-caps" style={[styles.formRowLabel, { color: colors.textTertiary }]}>
          {label} · {optionalLabel}
        </Text>
        <View style={styles.sexChipRow}>
          <SegmentedChip
            active={value === 'male'}
            onPress={() => onChange('male')}
            inactiveBg="transparent"
            activeBg={activeBg}
            inactiveBorder={colors.border}
            activeBorder="transparent"
            style={styles.sexChip}
            accessibilityLabel={maleLabel}>
            <Text
              variant="mono-caps"
              style={[
                styles.sexChipText,
                { color: value === 'male' ? palette.parchmentBright : colors.textSecondary },
              ]}>
              {maleLabel}
            </Text>
          </SegmentedChip>
          <SegmentedChip
            active={value === 'female'}
            onPress={() => onChange('female')}
            inactiveBg="transparent"
            activeBg={activeBg}
            inactiveBorder={colors.border}
            activeBorder="transparent"
            style={styles.sexChip}
            accessibilityLabel={femaleLabel}>
            <Text
              variant="mono-caps"
              style={[
                styles.sexChipText,
                { color: value === 'female' ? palette.parchmentBright : colors.textSecondary },
              ]}>
              {femaleLabel}
            </Text>
          </SegmentedChip>
        </View>
      </View>
    </View>
  );
}

interface MatchOthersCardProps {
  colors: ColorPalette;
  t: (k: string) => string;
}

function MatchOthersCard({ colors, t }: MatchOthersCardProps) {
  return (
    <MotionPressable
      pressedScale={0.97}
      onPress={() => router.push('/kundli/match?mode=others')}
      style={[styles.matchCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityRole="button"
      accessibilityLabel={t('kundli.matchOthersTitle')}>
      <View style={[styles.matchIc, { backgroundColor: colors.surfaceRecessed, borderColor: colors.borderAccent }]}>
        <Icon name="people" size={18} color={colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="mono-caps" style={[styles.matchKicker, { color: colors.accent }]}>
          {t('kundli.matchOthersKicker')}
        </Text>
        <Text variant="body-italic" style={[styles.matchBody, { color: colors.textPrimary }]}>
          {t('kundli.matchOthersTitle')}
        </Text>
      </View>
      <Icon name="chevron-right" size={18} color={colors.textTertiary} />
    </MotionPressable>
  );
}

const styles = StyleSheet.create({
  sectionLabelSpacing: { marginTop: 24, marginBottom: 10 },
  remedyNudge: { marginTop: 12 },

  formIntro: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  formCard: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  formIc: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.iconContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formRowLabel: { fontSize: 9, marginBottom: 3, letterSpacing: 1.4 },
  formRowValue: { fontSize: 14, lineHeight: 19 },
  formDivider: { height: StyleSheet.hairlineWidth, marginLeft: 58 },
  nameInput: {
    fontSize: 14,
    lineHeight: 19,
    paddingVertical: 0,
    fontFamily: 'Geist_400Regular',
  },
  sexChipRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  sexChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: borderRadius.chip,
    borderWidth: 1,
    alignItems: 'center',
  },
  sexChipText: { fontSize: 9 },

  computeFailed: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 16,
  },

  lagnaWrap: { marginTop: 8 },
  lagnaRashi: { fontSize: 30, lineHeight: 36, marginTop: 8, marginBottom: 4 },
  lagnaMeta: { fontSize: 11, letterSpacing: 0.2 },
  identityDivider: { height: StyleSheet.hairlineWidth, marginVertical: 14 },
  identityRow: { flexDirection: 'row', gap: 16 },
  identityCol: { flex: 1, gap: 4 },
  identityLabel: { fontSize: 9, letterSpacing: 1.4 },
  identityValue: { fontSize: 16, lineHeight: 22 },

  periodCard: {
    marginTop: 12,
    padding: 16,
    borderRadius: borderRadius.card,
    borderWidth: 1,
  },
  periodKicker: { fontSize: 9, letterSpacing: 1.4, marginBottom: 4 },
  periodBody: { fontSize: 15, lineHeight: 21 },
  periodThemeText: { fontSize: 13, lineHeight: 19, marginTop: 6 },
  periodTrack: { height: 5, borderRadius: 3, overflow: 'hidden', marginTop: 13 },
  periodFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 3 },
  periodRangeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 },
  periodRangeText: { fontSize: 11.5 },

  readingIntro: { fontSize: 13, lineHeight: 19, marginBottom: 12, paddingHorizontal: 4 },
  readingCard: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    padding: 16,
  },
  readingSubLabel: { fontSize: 9, letterSpacing: 1.4, marginBottom: 4 },
  readingText: { fontSize: 14, lineHeight: 21 },
  readingTextGap: { marginTop: 8 },
  readingDivider: { height: StyleSheet.hairlineWidth, marginVertical: 14 },
  readingBulletRow: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'flex-start' },
  readingBulletIc: { marginTop: 3 },
  readingBulletText: { flex: 1, fontSize: 13.5, lineHeight: 20 },

  flagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  flagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: borderRadius.chip,
    borderWidth: 1,
  },
  flagChipText: { fontSize: 9, letterSpacing: 0.8 },
  noFlags: { fontSize: 13, lineHeight: 19, paddingHorizontal: 4 },

  toolsRow: { flexDirection: 'row', gap: 10 },
  toolTile: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: borderRadius.card,
    borderWidth: 1,
  },
  toolTileIc: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolTileLabel: { fontSize: 9, letterSpacing: 0.6 },

  advancedSection: { marginTop: 24 },

  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 10,
    gap: 10,
  },
  styleGroup: { flexDirection: 'row', gap: 6 },
  styleChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: borderRadius.chip,
    borderWidth: 1,
  },
  styleChipText: { fontSize: 9 },
  divScroll: { marginTop: 4 },
  divScrollContent: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 0,
    paddingBottom: 4,
  },
  divChip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: borderRadius.chip,
    borderWidth: 1,
    minWidth: 56,
    alignItems: 'center',
  },
  divChipText: { fontSize: 10 },
  divChipMeaning: { fontSize: 7.5, marginTop: 2, letterSpacing: 0.6 },

  chartWrap: {
    alignItems: 'center',
    paddingVertical: 8,
  },

  matchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: borderRadius.card,
    borderWidth: 1,
    marginTop: 18,
  },
  matchIc: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  matchKicker: { fontSize: 9, marginBottom: 2 },
  matchBody: { fontSize: 14, lineHeight: 20 },

  aspectsWrap: { marginTop: 14 },
});
