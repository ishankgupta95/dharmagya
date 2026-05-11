import { useMemo, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, TextInput, ScrollView, useWindowDimensions } from 'react-native';
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
import {
  computeKundli,
  computeDivisional,
  computeShadbalaCached,
  computeBhavaBalaCached,
  computeKpCuspalSubLordsCached,
  computeSpecialLagnasCached,
  computeUpagrahasCached,
  buildBirthInputs,
  DIVISIONAL_CHARTS_BEYOND_D9,
} from '@/services/astrology/kundliService';
import { DoshaCard } from './DoshaCard';
import { ShadbalaChart } from './ShadbalaChart';
import { BhavaBalaChart } from './BhavaBalaChart';
import { AspectsCard } from './AspectsCard';
import { YogasCard } from './YogasCard';
import { KarakasCard } from './KarakasCard';
import { AshtakavargaCard } from './AshtakavargaCard';
import { AdvancedPointsCard } from './AdvancedPointsCard';
import { KpCard } from './KpCard';
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

export function KundliSection() {
  const { t, i18n } = useTranslation();
  // Single shallow-compared slice of the 15 store fields this component
  // touches. Without `useShallow`, each field is its own subscription and a
  // theme/language toggle fires up to 15 re-renders before React batches.
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
    })),
  );
  const colors = isDarkMode ? darkColors : lightColors;
  const plinth = usePlinthColors();
  const { width } = useWindowDimensions();
  const { formatTime } = useLocaleFormatters();

  // 'D1' = natal rashi chart; everything else is a divisional (varga) chart
  // computed lazily through `computeDivisional` so we don't pay the BPHS varga
  // math up front for charts the user never opens.
  const [activeChart, setActiveChart] = useState<'D1' | Divisional>('D1');
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
  // 11 lib calls in total (7 upagrahas + 4 lagnas + KP cuspal); no point
  // paying them on a chart load nobody will see.
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
  const chipActiveBg = isDarkMode ? palette.goldLeaf : palette.sindoor;
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

  // Empty state — show an inline form so the user can enter their details
  // without leaving the Kundli tab. Values write directly to the same store
  // settings reads, so the two surfaces stay in sync automatically.
  if (!userBirthDate || !userBirthPlace) {
    return (
      <View>
        <SectionLabel style={styles.sectionLabelSpacing}>
          {t('kundli.title')}
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

  // Build the cells for whichever chart the user is currently looking at.
  // D1 and D9 are already in the bundle; the rest go through the lazy cache.
  const activeDivisional: DivisionalChart | null =
    activeChart === 'D1'
      ? null
      : activeChart === 'D9'
        ? bundle.d9
        : (inputs ? computeDivisional(inputs, activeChart) : null);
  const chartCells =
    activeChart === 'D1'
      ? cellsFromD1(bundle.d1, lang)
      : activeDivisional
        ? cellsFromD9(activeDivisional, lang)
        : cellsFromD1(bundle.d1, lang);

  // Chart fills screen width minus screen padding.
  const chartSize = Math.min(width - spacing.screenH * 2, 360);
  const dignityLabel = (d: Dignity): string => t(`kundli.dignity.${d}`);

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

      {/* ── Lagna NightCard ──────────────────────────────────────────────── */}
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
        </NightCard>
      </View>

      {/* ── Chart style + D1/D9 toggle row ──────────────────────────────── */}
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

      {/* ── Divisional (varga) chart selector ────────────────────────────
          D1 + D9 are pre-computed in the bundle; the rest are computed
          lazily on first open. Horizontal scroll keeps it readable on small
          screens since 8 chips wouldn't fit a single row. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.divScrollContent}
        style={styles.divScroll}>
        {(['D1', 'D9', ...DIVISIONAL_CHARTS_BEYOND_D9] as const).map((kind) => {
          const active = activeChart === kind;
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
              accessibilityLabel={kind}>
              <Text
                variant="mono-caps"
                style={[
                  styles.divChipText,
                  { color: active ? colors.textPrimary : colors.textTertiary },
                ]}>
                {kind}
              </Text>
            </SegmentedChip>
          );
        })}
      </ScrollView>

      {/* ── Chart ────────────────────────────────────────────────────────── */}
      <View style={styles.chartWrap}>
        {chartStyle === 'north' ? (
          <NorthChart cells={chartCells} size={chartSize} />
        ) : (
          <SouthChart cells={chartCells} size={chartSize} />
        )}
      </View>

      {/* ── Doshas (Mangal + Kaal Sarp + Pitru) ──────────────────────────── */}
      <SectionLabel style={styles.sectionLabelSpacing}>
        {t('kundli.doshasSection')}
      </SectionLabel>
      <DoshaCard
        mangal={bundle.mangal}
        kaalSarp={bundle.kaalSarp}
        pitru={bundle.pitru}
        colors={colors}
      />

      {/* ── Dignity strip ────────────────────────────────────────────────── */}
      <SectionLabel style={styles.sectionLabelSpacing}>
        {t('kundli.dignitySection')}
      </SectionLabel>
      <PlanetaryDignityChart items={bundle.dignity} labelFor={dignityLabel} />

      {/* ── Yogas (named classical combinations) ────────────────────────── */}
      <SectionLabel style={styles.sectionLabelSpacing}>
        {t('kundli.yogas.sectionTitle')}
      </SectionLabel>
      <YogasCard yogas={bundle.yogas} colors={colors} />

      {/* ── Jaimini Karakas (Atmakaraka..Darakaraka) ────────────────────── */}
      <SectionLabel style={styles.sectionLabelSpacing}>
        {t('kundli.karakas.sectionTitle')}
      </SectionLabel>
      <KarakasCard karakas={bundle.karakas} karakas8={bundle.karakas8} colors={colors} />

      {/* ── Shadbala — advanced diagnostic, default-collapsed ───────────── */}
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

      {/* ── Bhava Bala — advanced diagnostic, default-collapsed ─────────── */}
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

      {/* ── Ashtakavarga — math-heavy, default-collapsed ────────────────── */}
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

      {/* ── Aspects (Drishti) — collapsible, default-closed ────────────── */}
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

      {/* ── Advanced points — Arudhas + Argala + Upagrahas + Special lagnas
          (P12.4). Default-collapsed because it's a dense reference panel
          rather than a primary read; opening it triggers Upagrahas and
          Special-lagnas compute (gated by useMemo dependency on the open flag
          above), so the cost is paid only when the user looks. */}
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

      {/* ── KP layer — cuspal sub-lords + significators (P12.5). KP is
          analytically anchored to Krishnamurti-Paddhati ayanamsa; the card's
          internal note tells the user. We don't force-switch the app's
          ayanamsa since that's a global preference set in Settings. */}
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

      {/* ── Compatibility shortcuts ──────────────────────────────────────
          Two routes into Ashtakoot Guna Milan:
          1. Match the user with a partner (uses userBirth* + a saved chart).
          2. Match two other people (both selected from saved charts) —
             useful for parents matching their children's prospects, etc. */}
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => router.push('/kundli/match')}
        style={[styles.matchCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        accessibilityRole="button"
        accessibilityLabel={t('kundli.matchCardTitle')}>
        <View style={[styles.matchIc, { backgroundColor: colors.surfaceRecessed, borderColor: colors.borderAccent }]}>
          <Icon name="people" size={18} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="mono-caps" style={[styles.matchKicker, { color: colors.accent }]}>
            {t('kundli.matchKicker')}
          </Text>
          <Text variant="body-italic" style={[styles.matchBody, { color: colors.textPrimary }]}>
            {t('kundli.matchCardTitle')}
          </Text>
        </View>
        <Icon name="chevron-right" size={18} color={colors.textTertiary} />
      </TouchableOpacity>

      <MatchOthersCard colors={colors} t={t} />

      {/* ── Varshaphala / Tithi Pravesha entry ───────────────────────────
          Lives on its own screen (rather than the existing Kundli accordion
          stack) because every recompute is time-shifted by yearAge — the
          screen owns its own age picker + system toggle. */}
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => router.push('/kundli/varshaphala')}
        style={[styles.matchCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        accessibilityRole="button"
        accessibilityLabel={t('kundli.openVarshaphala')}>
        <View style={[styles.matchIc, { backgroundColor: colors.surfaceRecessed, borderColor: colors.borderAccent }]}>
          <Icon name="calendar" size={18} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="mono-caps" style={[styles.matchKicker, { color: colors.accent }]}>
            {t('kundli.openVarshaphalaKicker')}
          </Text>
          <Text variant="body-italic" style={[styles.matchBody, { color: colors.textPrimary }]}>
            {t('kundli.openVarshaphala')}
          </Text>
        </View>
        <Icon name="chevron-right" size={18} color={colors.textTertiary} />
      </TouchableOpacity>

      {/* ── Prashna (horary) CTA ─────────────────────────────────────────
          Cast-on-demand chart for the moment a question is asked, anchored
          to the querent's *current* location (not the natal location) per
          classical Prashna doctrine. Lives on its own route because the
          input flow (timestamp picker + cast button) is independent of the
          natal chart. */}
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => router.push('/kundli/prashna')}
        style={[styles.matchCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        accessibilityRole="button"
        accessibilityLabel={t('kundli.openPrashna')}>
        <View style={[styles.matchIc, { backgroundColor: colors.surfaceRecessed, borderColor: colors.borderAccent }]}>
          <Icon name="compass" size={18} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="mono-caps" style={[styles.matchKicker, { color: colors.accent }]}>
            {t('kundli.openPrashnaKicker')}
          </Text>
          <Text variant="body-italic" style={[styles.matchBody, { color: colors.textPrimary }]}>
            {t('kundli.openPrashna')}
          </Text>
        </View>
        <Icon name="chevron-right" size={18} color={colors.textTertiary} />
      </TouchableOpacity>
    </View>
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
    <TouchableOpacity
      activeOpacity={0.7}
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
    </TouchableOpacity>
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
  const activeBg = isDarkMode ? palette.goldLeaf : palette.sindoor;
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
    <TouchableOpacity
      activeOpacity={0.88}
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
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  sectionLabelSpacing: { marginTop: 24, marginBottom: 10 },

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
    fontFamily: 'Fraunces_400Regular',
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
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: borderRadius.chip,
    borderWidth: 1,
    minWidth: 48,
    alignItems: 'center',
  },
  divChipText: { fontSize: 10 },

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
