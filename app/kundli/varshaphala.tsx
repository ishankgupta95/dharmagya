import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { MotionPressable } from '@/components/common/MotionPressable';
import {
  ALL_SAHAM_NAMES,
  GRAHA_ABBR,
  type GrahaName,
  type Language,
  type SahamName,
  type SahamPosition,
  type TithiPraveshaChart,
  type VarshaphalaChart,
} from 'panchang-ts';

import { AppText as Text } from '@/components/common/AppText';
import { Icon } from '@/components/common/Icon';
import { Kicker } from '@/components/common/Kicker';
import { SectionLabel } from '@/components/common/SectionLabel';
import { NightCard, usePlinthColors } from '@/components/common/NightCard';
import { ScreenMount } from '@/components/common/ScreenMount';
import { SegmentedChip } from '@/components/common/SegmentedChip';
import { AccordionSection } from '@/components/panchang/AccordionSection';
import { NorthChart } from '@/components/kundli/NorthChart';
import { SouthChart } from '@/components/kundli/SouthChart';
import { cellsFromLagnaPlanets } from '@/components/kundli/chartCells';
import {
  borderRadius,
  darkColors,
  lightColors,
  palette,
  spacing,
  type ColorPalette,
} from '@/config/theme';
import { resolveLanguage } from '@/i18n';
import { localizeRashi } from '@/i18n/panchangNames';
import {
  buildBirthInputs,
  computeTithiPraveshaCached,
  computeVarshaphalaCached,
} from '@/services/astrology/kundliService';
import { useStore } from '@/store/useStore';
import { useLocaleFormatters } from '@/utils/format';

type Mode = 'varshaphala' | 'tithiPravesha';

const RASHI_NAMES_EN = [
  'Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya',
  'Tula', 'Vrischika', 'Dhanu', 'Makara', 'Kumbha', 'Meena',
];

// Solar-return year ~= 365.25636 mean solar days. Used to derive the
// 1-indexed yearAge that's currently in effect from `userBirthDate` so
// the picker opens on a sensible default for most users.
const SOLAR_YEAR_MS = 365.25636 * 86_400_000;

function deriveCurrentYearAge(birthIso: string | null): number {
  if (!birthIso) return 1;
  const birth = new Date(`${birthIso}T12:00:00`).getTime();
  const elapsed = (Date.now() - birth) / SOLAR_YEAR_MS;
  // The chart cast at yearAge=N runs from solar return N to solar return
  // N+1 — i.e. floor(elapsed) is the year currently in effect.
  return Math.max(1, Math.floor(elapsed));
}

export default function VarshaphalaScreen() {
  const { t, i18n } = useTranslation();
  const isDarkMode = useStore((s) => s.isDarkMode);
  const language = useStore((s) => s.language);
  const userBirthDate = useStore((s) => s.userBirthDate);
  const userBirthTime = useStore((s) => s.userBirthTime);
  const userBirthPlace = useStore((s) => s.userBirthPlace);
  const ayanamsa = useStore((s) => s.ayanamsa);
  const houseSystem = useStore((s) => s.houseSystem);
  const chartStyle = useStore((s) => s.chartStyle);
  const setChartStyle = useStore((s) => s.setChartStyle);

  const colors = isDarkMode ? darkColors : lightColors;
  const plinth = usePlinthColors();
  const { width } = useWindowDimensions();
  const { digits, formatDateTime } = useLocaleFormatters();

  const lang = resolveLanguage(language);
  const rashiNames = useMemo(
    () => RASHI_NAMES_EN.map((n) => (lang === 'hi' ? localizeRashi(n, 'hi') : n)),
    [lang],
  );

  const [mode, setMode] = useState<Mode>('varshaphala');
  const [yearAge, setYearAge] = useState<number>(() =>
    deriveCurrentYearAge(userBirthDate),
  );
  const [sahamsOpen, setSahamsOpen] = useState(false);

  const inputs = useMemo(
    () =>
      buildBirthInputs({
        birthDateIso: userBirthDate,
        birthTimeHHmm: userBirthTime,
        birthPlace: userBirthPlace,
        ayanamsa,
        language: lang,
        houseSystem,
      }),
    [userBirthDate, userBirthTime, userBirthPlace, ayanamsa, lang, houseSystem],
  );

  // Both computes are gated on the same inputs + yearAge — only the active
  // mode pays the cost on render, but we let the cache hold the inactive
  // result so toggling stays instant on the second flip.
  const varsha = useMemo(
    () =>
      mode === 'varshaphala' && inputs ? computeVarshaphalaCached(inputs, yearAge) : null,
    [mode, inputs, yearAge],
  );
  const pravesha = useMemo(
    () =>
      mode === 'tithiPravesha' && inputs ? computeTithiPraveshaCached(inputs, yearAge) : null,
    [mode, inputs, yearAge],
  );

  const headerTitle = t('kundli.varshaphala.headerTitle');
  const accent = isDarkMode ? palette.goldLeaf : palette.sindoor;

  if (!userBirthDate || !userBirthPlace) {
    return (
      <ScreenMount>
        <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
          <Header title={headerTitle} colors={colors} t={t} />
          <View style={[styles.emptyWrap, { paddingHorizontal: spacing.screenH }]}>
            <Text variant="body-italic" style={[styles.emptyText, { color: colors.textMuted }]}>
              {t('kundli.varshaphala.noBirthDetails')}
            </Text>
            <MotionPressable
              pressedScale={0.97}
              onPress={() => router.push('/settings')}
              style={[styles.emptyCta, { borderColor: colors.borderAccent }]}
              accessibilityRole="button"
              accessibilityLabel={t('kundli.openSettings')}>
              <Icon name="gear" size={16} color={colors.accent} />
              <Text variant="mono-caps" style={[styles.emptyCtaText, { color: colors.accent }]}>
                {t('kundli.openSettings')}
              </Text>
            </MotionPressable>
          </View>
        </SafeAreaView>
      </ScreenMount>
    );
  }

  return (
    <ScreenMount>
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
        <Header title={headerTitle} colors={colors} t={t} />

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
          showsVerticalScrollIndicator={false}>
          {/* ── System toggle ──────────────────────────────────────────── */}
          <View style={styles.systemToggleRow}>
            <SegmentedChip
              active={mode === 'varshaphala'}
              onPress={() => setMode('varshaphala')}
              inactiveBg="transparent"
              activeBg={accent}
              inactiveBorder={colors.border}
              activeBorder="transparent"
              style={styles.systemChip}
              accessibilityLabel={t('kundli.varshaphala.systemVarshaphala')}>
              <Text
                variant="mono-caps"
                style={[
                  styles.systemChipText,
                  {
                    color:
                      mode === 'varshaphala'
                        ? palette.parchmentBright
                        : colors.textSecondary,
                  },
                ]}>
                {t('kundli.varshaphala.systemVarshaphala')}
              </Text>
            </SegmentedChip>
            <SegmentedChip
              active={mode === 'tithiPravesha'}
              onPress={() => setMode('tithiPravesha')}
              inactiveBg="transparent"
              activeBg={accent}
              inactiveBorder={colors.border}
              activeBorder="transparent"
              style={styles.systemChip}
              accessibilityLabel={t('kundli.tithiPravesha.systemTithiPravesha')}>
              <Text
                variant="mono-caps"
                style={[
                  styles.systemChipText,
                  {
                    color:
                      mode === 'tithiPravesha'
                        ? palette.parchmentBright
                        : colors.textSecondary,
                  },
                ]}>
                {t('kundli.tithiPravesha.systemTithiPravesha')}
              </Text>
            </SegmentedChip>
          </View>

          {/* ── Year/age picker ────────────────────────────────────────── */}
          <YearAgePicker
            value={yearAge}
            onChange={setYearAge}
            colors={colors}
            digits={digits}
            t={t}
          />

          {/* ── Mode body ──────────────────────────────────────────────── */}
          {mode === 'varshaphala' ? (
            <VarshaphalaBody
              data={varsha}
              yearAge={yearAge}
              rashiNames={rashiNames}
              colors={colors}
              plinth={plinth}
              sahamsOpen={sahamsOpen}
              onToggleSahams={() => setSahamsOpen((o) => !o)}
              digits={digits}
              formatDateTime={formatDateTime}
              hiLocale={i18n.language === 'hi'}
              t={t}
            />
          ) : (
            <TithiPraveshaBody
              data={pravesha}
              chartStyle={chartStyle}
              setChartStyle={setChartStyle}
              chartSize={Math.min(width - spacing.screenH * 2, 360)}
              lang={lang}
              rashiNames={rashiNames}
              colors={colors}
              plinth={plinth}
              accent={accent}
              digits={digits}
              formatDateTime={formatDateTime}
              t={t}
            />
          )}

          <Text variant="body-italic" style={[styles.footnote, { color: colors.textMuted }]}>
            {t(
              mode === 'varshaphala'
                ? 'kundli.varshaphala.disclaimer'
                : 'kundli.tithiPravesha.disclaimer',
            )}
          </Text>

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </ScreenMount>
  );
}

interface HeaderProps {
  title: string;
  colors: ColorPalette;
  t: (k: string) => string;
}

function Header({ title, colors, t }: HeaderProps) {
  return (
    <View
      style={[
        styles.header,
        { paddingHorizontal: spacing.screenH, borderBottomColor: colors.divider },
      ]}>
      <MotionPressable
        onPress={() => router.back()}
        hitSlop={12}
        style={[
          styles.backPill,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('a11y.back')}>
        <Icon name="chevron-left" size={18} color={colors.textSecondary} />
      </MotionPressable>
      <Text variant="display-italic" style={[styles.headerTitle, { color: colors.textPrimary }]}>
        {title}
      </Text>
      <View style={[styles.backPill, { borderWidth: 0 }]} />
    </View>
  );
}

interface YearAgePickerProps {
  value: number;
  onChange: (next: number) => void;
  colors: ColorPalette;
  digits: (s: string) => string;
  t: (k: string, o?: Record<string, unknown>) => string;
}

function YearAgePicker({ value, onChange, colors, digits, t }: YearAgePickerProps) {
  // Bound the picker at 1 (first solar return — yearAge is 1-indexed) and
  // 120 (the longest realistic life span; matches the Vimshottari cap).
  const dec = () => onChange(Math.max(1, value - 1));
  const inc = () => onChange(Math.min(120, value + 1));
  return (
    <View style={[styles.pickerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={{ flex: 1 }}>
        <Text variant="mono-caps" style={[styles.pickerKicker, { color: colors.textTertiary }]}>
          {t('kundli.varshaphala.solarReturnLabel')}
        </Text>
        <Text variant="display-italic" style={[styles.pickerValue, { color: colors.textPrimary }]}>
          {t('kundli.varshaphala.ageN', { n: digits(String(value)) })}
        </Text>
      </View>
      <MotionPressable
        onPress={dec}
        disabled={value <= 1}
        hitSlop={10}
        style={[
          styles.pickerBtn,
          {
            backgroundColor: colors.surfaceRecessed,
            borderColor: colors.border,
            opacity: value <= 1 ? 0.4 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('kundli.varshaphala.decAge')}>
        <Icon name="chevron-left" size={18} color={colors.textSecondary} />
      </MotionPressable>
      <MotionPressable
        onPress={inc}
        disabled={value >= 120}
        hitSlop={10}
        style={[
          styles.pickerBtn,
          {
            backgroundColor: colors.surfaceRecessed,
            borderColor: colors.border,
            opacity: value >= 120 ? 0.4 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('kundli.varshaphala.incAge')}>
        <Icon name="chevron-right" size={18} color={colors.textSecondary} />
      </MotionPressable>
    </View>
  );
}

// ── Varshaphala body ────────────────────────────────────────────────────────

interface VarshaphalaBodyProps {
  data: VarshaphalaChart | null;
  yearAge: number;
  rashiNames: string[];
  colors: ColorPalette;
  plinth: ReturnType<typeof usePlinthColors>;
  sahamsOpen: boolean;
  onToggleSahams: () => void;
  digits: (s: string) => string;
  formatDateTime: (d: Date) => string;
  hiLocale: boolean;
  t: (k: string, o?: Record<string, unknown>) => string;
}

function VarshaphalaBody({
  data,
  yearAge,
  rashiNames,
  colors,
  plinth,
  sahamsOpen,
  onToggleSahams,
  digits,
  formatDateTime,
  hiLocale,
  t,
}: VarshaphalaBodyProps) {
  if (!data) {
    return (
      <Text variant="body-italic" style={[styles.computeFailed, { color: colors.textMuted }]}>
        {t('kundli.varshaphala.computeFailed')}
      </Text>
    );
  }

  const lagnaRashiName = rashiNames[data.varshaLagna.rashi.index];
  const munthaRashiName = rashiNames[data.muntha.rashi];
  const returnDate = formatDateTime(data.solarReturnInstant);
  const returnDateLong = data.solarReturnInstant.toLocaleDateString(
    hiLocale ? 'hi-IN' : 'en-IN',
    { day: 'numeric', month: 'long', year: 'numeric' },
  );

  return (
    <>
      {/* ── Varsha Lagna + Year Lord NightCard ───────────────────────── */}
      <View style={styles.heroWrap}>
        <NightCard padding={20} mandalaSize={180} mandalaOpacity={0.08}>
          <Kicker color={plinth.accent} size={10}>
            {t('kundli.varshaphala.varshaLagnaLabel')}
          </Kicker>
          <Text variant="display-italic" style={[styles.heroRashi, { color: plinth.text }]}>
            {lagnaRashiName}
          </Text>
          <Text variant="mono" style={[styles.heroMeta, { color: plinth.textSubdued }]}>
            {data.varshaLagna.degreeInRashi.toFixed(2)}° · {data.varshaLagna.nakshatra.name} ·{' '}
            {t('kundli.padaShort', { pada: digits(String(data.varshaLagna.pada)) })}
          </Text>

          <View style={[styles.heroDivider, { backgroundColor: plinth.divider }]} />

          <Kicker color={plinth.accent} size={10}>
            {t('kundli.varshaphala.yearLordLabel')}
          </Kicker>
          <Text variant="display-italic" style={[styles.heroYearLord, { color: plinth.text }]}>
            {data.yearLord}
          </Text>
          <Text variant="body-italic" style={[styles.heroYearLordMeta, { color: plinth.textMuted }]}>
            {t('kundli.varshaphala.yearLordBasis')}
          </Text>

          <View style={[styles.heroDivider, { backgroundColor: plinth.divider }]} />

          <Text variant="mono-caps" style={[styles.heroReturnAt, { color: plinth.textSubdued }]}>
            {t('kundli.varshaphala.solarReturnAt', {
              date: returnDateLong,
              time: returnDate,
            })}
          </Text>
        </NightCard>
      </View>

      {/* ── Muntha ───────────────────────────────────────────────────── */}
      <SectionLabel style={styles.sectionLabelSpacing}>
        {t('kundli.varshaphala.munthaSection')}
      </SectionLabel>
      <View style={[styles.munthaCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <MunthaRow
          label={t('kundli.varshaphala.munthaRashi')}
          value={munthaRashiName}
          colors={colors}
        />
        <View style={[styles.munthaDivider, { backgroundColor: colors.divider }]} />
        <MunthaRow
          label={t('kundli.varshaphala.munthaLord')}
          value={data.muntha.lord}
          colors={colors}
        />
        <View style={[styles.munthaDivider, { backgroundColor: colors.divider }]} />
        <MunthaRow
          label={t('kundli.varshaphala.munthaHouse')}
          value={t('kundli.varshaphala.houseN', { n: digits(String(data.muntha.house)) })}
          colors={colors}
        />
      </View>
      <Text variant="body-italic" style={[styles.munthaHint, { color: colors.textMuted }]}>
        {t('kundli.varshaphala.munthaHint', {
          age: digits(String(yearAge)),
        })}
      </Text>

      {/* ── Sahams (27 annual points) — math-heavy, default-collapsed ── */}
      <View style={styles.aspectsWrap}>
        <AccordionSection
          storageKey="kundli.varshaphala.sahams"
          title={t('kundli.varshaphala.sahamsSection')}
          rightHint={digits('27')}
          open={sahamsOpen}
          onToggle={onToggleSahams}
          colors={colors}>
          <View style={[styles.sahamsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {ALL_SAHAM_NAMES.map((name, i) => (
              <SahamRow
                key={name}
                name={name}
                pos={data.sahams[name]}
                rashiNames={rashiNames}
                colors={colors}
                digits={digits}
                isFirst={i === 0}
                t={t}
              />
            ))}
          </View>
        </AccordionSection>
      </View>
    </>
  );
}

interface MunthaRowProps {
  label: string;
  value: string;
  colors: ColorPalette;
}

function MunthaRow({ label, value, colors }: MunthaRowProps) {
  return (
    <View style={styles.munthaRow}>
      <Text variant="mono-caps" style={[styles.munthaLabel, { color: colors.textTertiary }]}>
        {label}
      </Text>
      <Text variant="body" style={[styles.munthaValue, { color: colors.textPrimary }]}>
        {value}
      </Text>
    </View>
  );
}

interface SahamRowProps {
  name: SahamName;
  pos: SahamPosition;
  rashiNames: string[];
  colors: ColorPalette;
  digits: (s: string) => string;
  isFirst: boolean;
  t: (k: string, o?: Record<string, unknown>) => string;
}

function SahamRow({ name, pos, rashiNames, colors, digits, isFirst, t }: SahamRowProps) {
  return (
    <View
      style={[
        styles.sahamRow,
        !isFirst && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
      ]}>
      <View style={{ flex: 1 }}>
        <Text variant="mono-caps" style={[styles.sahamKicker, { color: colors.textTertiary }]}>
          {name}
        </Text>
        <Text variant="body" style={[styles.sahamRashi, { color: colors.textPrimary }]}>
          {rashiNames[pos.rashi]}
          <Text variant="body-italic" style={{ color: colors.textMuted }}>
            {'  '}· {pos.longitude.toFixed(2)}°
          </Text>
        </Text>
      </View>
      <View style={[styles.sahamHouse, { borderColor: colors.borderAccent }]}>
        <Text variant="mono-caps" style={[styles.sahamHouseLabel, { color: colors.textTertiary }]}>
          {t('kundli.varshaphala.houseAbbr')}
        </Text>
        <Text variant="display" style={[styles.sahamHouseNum, { color: colors.textPrimary }]}>
          {digits(String(pos.house))}
        </Text>
      </View>
    </View>
  );
}

// ── Tithi Pravesha body ─────────────────────────────────────────────────────

interface TithiPraveshaBodyProps {
  data: TithiPraveshaChart | null;
  chartStyle: 'north' | 'south';
  setChartStyle: (next: 'north' | 'south') => void;
  chartSize: number;
  lang: Language;
  rashiNames: string[];
  colors: ColorPalette;
  plinth: ReturnType<typeof usePlinthColors>;
  accent: string;
  digits: (s: string) => string;
  formatDateTime: (d: Date) => string;
  t: (k: string, o?: Record<string, unknown>) => string;
}

function TithiPraveshaBody({
  data,
  chartStyle,
  setChartStyle,
  chartSize,
  lang,
  rashiNames,
  colors,
  plinth,
  accent,
  digits,
  formatDateTime,
  t,
}: TithiPraveshaBodyProps) {
  const cells = useMemo(() => {
    if (!data) return [];
    return cellsFromLagnaPlanets(
      data.varshaLagna.rashi.index,
      data.planets,
      lang,
    );
  }, [data, lang]);

  if (!data) {
    return (
      <Text variant="body-italic" style={[styles.computeFailed, { color: colors.textMuted }]}>
        {t('kundli.tithiPravesha.computeFailed')}
      </Text>
    );
  }

  const lagnaRashiName = rashiNames[data.varshaLagna.rashi.index];
  const tithiNum = (data.praveshTithi % 15) + 1;
  const isShukla = data.praveshTithi < 15;
  const returnDate = formatDateTime(data.praveshInstant);
  const returnDateLong = data.praveshInstant.toLocaleDateString(
    lang === 'hi' ? 'hi-IN' : 'en-IN',
    { day: 'numeric', month: 'long', year: 'numeric' },
  );

  return (
    <>
      {/* ── Pravesha Lagna NightCard ─────────────────────────────────── */}
      <View style={styles.heroWrap}>
        <NightCard padding={20} mandalaSize={180} mandalaOpacity={0.08}>
          <Kicker color={plinth.accent} size={10}>
            {t('kundli.tithiPravesha.praveshaLagnaLabel')}
          </Kicker>
          <Text variant="display-italic" style={[styles.heroRashi, { color: plinth.text }]}>
            {lagnaRashiName}
          </Text>
          <Text variant="mono" style={[styles.heroMeta, { color: plinth.textSubdued }]}>
            {data.varshaLagna.degreeInRashi.toFixed(2)}° · {data.varshaLagna.nakshatra.name} ·{' '}
            {t('kundli.padaShort', { pada: digits(String(data.varshaLagna.pada)) })}
          </Text>

          <View style={[styles.heroDivider, { backgroundColor: plinth.divider }]} />

          <Kicker color={plinth.accent} size={10}>
            {t('kundli.tithiPravesha.natalTithiLabel')}
          </Kicker>
          <Text variant="display-italic" style={[styles.heroYearLord, { color: plinth.text }]}>
            {t(isShukla ? 'kundli.tithiPravesha.shuklaTithi' : 'kundli.tithiPravesha.krishnaTithi', {
              n: digits(String(tithiNum)),
            })}
          </Text>
          <Text variant="body-italic" style={[styles.heroYearLordMeta, { color: plinth.textMuted }]}>
            {t('kundli.tithiPravesha.tithiBasis')}
          </Text>

          <View style={[styles.heroDivider, { backgroundColor: plinth.divider }]} />

          <Text variant="mono-caps" style={[styles.heroReturnAt, { color: plinth.textSubdued }]}>
            {t('kundli.tithiPravesha.praveshAt', {
              date: returnDateLong,
              time: returnDate,
            })}
          </Text>
        </NightCard>
      </View>

      {/* ── Chart style toggle ───────────────────────────────────────── */}
      <View style={styles.chartStyleRow}>
        <SegmentedChip
          active={chartStyle === 'north'}
          onPress={() => setChartStyle('north')}
          inactiveBg="transparent"
          activeBg={accent}
          inactiveBorder={colors.border}
          activeBorder="transparent"
          style={styles.chartStyleChip}
          accessibilityLabel={t('kundli.chartNorth')}>
          <Text
            variant="mono-caps"
            style={[
              styles.chartStyleChipText,
              {
                color:
                  chartStyle === 'north' ? palette.parchmentBright : colors.textSecondary,
              },
            ]}>
            {t('kundli.chartNorth')}
          </Text>
        </SegmentedChip>
        <SegmentedChip
          active={chartStyle === 'south'}
          onPress={() => setChartStyle('south')}
          inactiveBg="transparent"
          activeBg={accent}
          inactiveBorder={colors.border}
          activeBorder="transparent"
          style={styles.chartStyleChip}
          accessibilityLabel={t('kundli.chartSouth')}>
          <Text
            variant="mono-caps"
            style={[
              styles.chartStyleChipText,
              {
                color:
                  chartStyle === 'south' ? palette.parchmentBright : colors.textSecondary,
              },
            ]}>
            {t('kundli.chartSouth')}
          </Text>
        </SegmentedChip>
      </View>

      {/* ── Chart ────────────────────────────────────────────────────── */}
      <View style={styles.chartWrap}>
        {chartStyle === 'north' ? (
          <NorthChart cells={cells} size={chartSize} />
        ) : (
          <SouthChart cells={cells} size={chartSize} />
        )}
      </View>

      {/* ── Bhava cusps strip ────────────────────────────────────────── */}
      <SectionLabel style={styles.sectionLabelSpacing}>
        {t('kundli.tithiPravesha.bhavaCuspsSection')}
      </SectionLabel>
      <View style={[styles.cuspsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {data.bhava.houses.map((h, i) => (
          <View
            key={h.house}
            style={[
              styles.cuspRow,
              i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
            ]}>
            <Text variant="mono-caps" style={[styles.cuspHouse, { color: colors.textTertiary }]}>
              {digits(String(h.house))}
            </Text>
            <Text variant="body" style={[styles.cuspRashi, { color: colors.textPrimary }]}>
              {rashiNames[h.rashi.index]}
            </Text>
            <Text variant="mono" style={[styles.cuspDeg, { color: colors.textMuted }]}>
              {h.degreeInRashi.toFixed(2)}°
            </Text>
          </View>
        ))}
      </View>
      <Text variant="body-italic" style={[styles.cuspsHint, { color: colors.textMuted }]}>
        {t('kundli.tithiPravesha.cuspsHint', { system: data.bhava.system })}
      </Text>

      {/* ── Planet placements ────────────────────────────────────────── */}
      <SectionLabel style={styles.sectionLabelSpacing}>
        {t('kundli.tithiPravesha.planetsSection')}
      </SectionLabel>
      <View style={[styles.planetsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {data.planets.map((p, i) => (
          <View
            key={p.planet}
            style={[
              styles.planetRow,
              i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
            ]}>
            <Text variant="mono-caps" style={[styles.planetAbbr, { color: colors.textTertiary }]}>
              {GRAHA_ABBR[p.planet as GrahaName]}
            </Text>
            <View style={{ flex: 1 }}>
              <Text variant="body" style={[styles.planetName, { color: colors.textPrimary }]}>
                {p.planet}
                {p.isRetrograde && p.planet !== 'Sun' && p.planet !== 'Moon' && (
                  <Text variant="mono-caps" style={[styles.planetRetro, { color: colors.accent }]}>
                    {'  '}· R
                  </Text>
                )}
              </Text>
              <Text variant="mono" style={[styles.planetMeta, { color: colors.textMuted }]}>
                {rashiNames[p.rashi.index]} · {p.degreeInRashi.toFixed(2)}°
              </Text>
            </View>
            <View style={[styles.planetHouse, { borderColor: colors.borderAccent }]}>
              <Text variant="display" style={[styles.planetHouseNum, { color: colors.textPrimary }]}>
                {digits(String(p.house))}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 22 },

  scroll: { paddingTop: 12, paddingBottom: 32 },

  emptyWrap: { paddingTop: 40, alignItems: 'center', gap: 16 },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: borderRadius.button,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyCtaText: { fontSize: 11, letterSpacing: 1.4 },

  systemToggleRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  systemChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: borderRadius.chip,
    borderWidth: 1,
    alignItems: 'center',
  },
  systemChipText: { fontSize: 9 },

  pickerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: borderRadius.card,
    borderWidth: 1,
    marginBottom: 18,
  },
  pickerKicker: { fontSize: 9, letterSpacing: 1.4, marginBottom: 4 },
  pickerValue: { fontSize: 22, lineHeight: 26 },
  pickerBtn: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.iconContainer,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  heroWrap: { marginTop: 4 },
  heroRashi: { fontSize: 30, lineHeight: 36, marginTop: 8, marginBottom: 4 },
  heroMeta: { fontSize: 11, letterSpacing: 0.2 },
  heroDivider: { height: StyleSheet.hairlineWidth, marginVertical: 14 },
  heroYearLord: { fontSize: 26, lineHeight: 32, marginTop: 6, marginBottom: 4 },
  heroYearLordMeta: { fontSize: 12, lineHeight: 17 },
  heroReturnAt: { fontSize: 9, letterSpacing: 1.2 },

  sectionLabelSpacing: { marginTop: 24, marginBottom: 10 },

  munthaCard: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  munthaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  munthaLabel: { fontSize: 9, letterSpacing: 1.4 },
  munthaValue: { fontSize: 14, lineHeight: 20 },
  munthaDivider: { height: StyleSheet.hairlineWidth, marginLeft: 14 },
  munthaHint: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 8,
    paddingHorizontal: 4,
  },

  aspectsWrap: { marginTop: 14 },

  sahamsCard: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: 4,
  },
  sahamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sahamKicker: { fontSize: 9, letterSpacing: 1.4, marginBottom: 2 },
  sahamRashi: { fontSize: 14, lineHeight: 20 },
  sahamHouse: {
    width: 46,
    paddingVertical: 6,
    borderRadius: borderRadius.iconContainer,
    borderWidth: 1,
    alignItems: 'center',
  },
  sahamHouseLabel: { fontSize: 8, letterSpacing: 1.2, marginBottom: 1 },
  sahamHouseNum: { fontSize: 16, lineHeight: 20 },

  chartStyleRow: { flexDirection: 'row', gap: 6, marginTop: 18, marginBottom: 6 },
  chartStyleChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: borderRadius.chip,
    borderWidth: 1,
  },
  chartStyleChipText: { fontSize: 9 },
  chartWrap: {
    alignItems: 'center',
    paddingVertical: 8,
  },

  cuspsCard: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cuspRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  cuspHouse: { fontSize: 11, letterSpacing: 1.2, width: 22 },
  cuspRashi: { flex: 1, fontSize: 13, lineHeight: 18 },
  cuspDeg: { fontSize: 11, letterSpacing: 0.2 },
  cuspsHint: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 8,
    paddingHorizontal: 4,
  },

  planetsCard: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  planetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  planetAbbr: { fontSize: 10, letterSpacing: 1.4, width: 28 },
  planetName: { fontSize: 14, lineHeight: 20 },
  planetMeta: { fontSize: 11, marginTop: 2, letterSpacing: 0.2 },
  planetRetro: { fontSize: 9, letterSpacing: 1.2 },
  planetHouse: {
    width: 36,
    paddingVertical: 6,
    borderRadius: borderRadius.iconContainer,
    borderWidth: 1,
    alignItems: 'center',
  },
  planetHouseNum: { fontSize: 16, lineHeight: 20 },

  computeFailed: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 24,
    paddingHorizontal: 12,
  },

  footnote: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 24,
    paddingHorizontal: 8,
    textAlign: 'center',
  },
});
