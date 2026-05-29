import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { GRAHA_ABBR, type BirthChart, type GrahaName, type Language } from 'panchang-ts';

import { AppText as Text } from '@/components/common/AppText';
import { Icon } from '@/components/common/Icon';
import { Kicker } from '@/components/common/Kicker';
import { SectionLabel } from '@/components/common/SectionLabel';
import { NightCard, usePlinthColors } from '@/components/common/NightCard';
import { ScreenMount } from '@/components/common/ScreenMount';
import { SegmentedChip } from '@/components/common/SegmentedChip';
import { DatePickerModal } from '@/components/common/DatePickerModal';
import { TimePickerModal } from '@/components/common/TimePickerModal';
import { NorthChart } from '@/components/kundli/NorthChart';
import { SouthChart } from '@/components/kundli/SouthChart';
import { cellsFromLagnaPlanets } from '@/components/kundli/chartCells';
import { MotionPressable } from '@/components/common/MotionPressable';
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
import { computePrashnaChartCached } from '@/services/astrology/kundliService';
import { useStore } from '@/store/useStore';
import { useLocaleFormatters } from '@/utils/format';
import { ymd } from '@/utils/calendar';

const RASHI_NAMES_EN = [
  'Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya',
  'Tula', 'Vrischika', 'Dhanu', 'Makara', 'Kumbha', 'Meena',
];

interface QueryLocation {
  lat: number;
  lon: number;
  name: string;
}

export default function PrashnaScreen() {
  const { t, i18n } = useTranslation();
  const isDarkMode = useStore((s) => s.isDarkMode);
  const language = useStore((s) => s.language);
  const userLocation = useStore((s) => s.userLocation);
  const locationName = useStore((s) => s.locationName);
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

  // Default the query location to the querent's *current* location (the
  // canonical Prashna anchor). Fall back to userBirthPlace for users who
  // skipped the location-permission flow — they can still cast a chart at
  // their birth coordinates rather than dead-end on an empty state.
  const initialLocation: QueryLocation | null = useMemo(() => {
    if (userLocation) {
      return {
        lat: userLocation.lat,
        lon: userLocation.lon,
        name: locationName ?? t('common.gpsLabel'),
      };
    }
    if (userBirthPlace) {
      return {
        lat: userBirthPlace.lat,
        lon: userBirthPlace.lon,
        name: userBirthPlace.name,
      };
    }
    return null;
  }, [userLocation, locationName, userBirthPlace, t]);

  const [queryDateIso, setQueryDateIso] = useState<string>(() => ymd(new Date()));
  const [queryTimeHHmm, setQueryTimeHHmm] = useState<string>(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [queryLocation] = useState<QueryLocation | null>(initialLocation);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  // Cast on demand — the chart updates only when the user taps "Cast" so
  // they can dial the inputs without re-computing on every keystroke.
  const [chart, setChart] = useState<BirthChart | null>(null);
  const [didTryCast, setDidTryCast] = useState(false);

  const queryDateObj = useMemo(() => {
    return new Date(`${queryDateIso}T12:00:00`);
  }, [queryDateIso]);

  const headerTitle = t('kundli.prashna.headerTitle');
  const accent = isDarkMode ? palette.goldLeaf : palette.sindoor;
  const canCast = !!queryLocation;

  const onCast = () => {
    if (!queryLocation) return;
    const [h, m] = queryTimeHHmm.split(':').map((n) => parseInt(n, 10));
    // Use the device's local-tz interpretation of the wallclock since the
    // querent is "here" — the same convention as Date(`${iso}T${time}:00`)
    // with no explicit timezone, but written explicitly to make the intent
    // visible at the call site.
    const queryMoment = new Date(queryDateIso + `T${queryTimeHHmm}:00`);
    if (Number.isNaN(queryMoment.getTime()) || !Number.isFinite(h) || !Number.isFinite(m)) return;
    setDidTryCast(true);
    const result = computePrashnaChartCached({
      timestamp: queryMoment,
      location: { lat: queryLocation.lat, lon: queryLocation.lon },
      ayanamsa,
      language: lang,
      houseSystem,
    });
    setChart(result);
  };

  const queryDateLabel = queryDateObj.toLocaleDateString(
    i18n.language === 'hi' ? 'hi-IN' : 'en-IN',
    { day: 'numeric', month: 'long', year: 'numeric' },
  );
  const queryTimeLabel = formatDateTime(
    new Date(`${queryDateIso}T${queryTimeHHmm}:00`),
  );

  return (
    <ScreenMount>
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
        <Header title={headerTitle} colors={colors} t={t} />

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
          showsVerticalScrollIndicator={false}>
          <Text variant="body-italic" style={[styles.intro, { color: colors.textMuted }]}>
            {t('kundli.prashna.intro')}
          </Text>

          {/* ── Form: when + where ───────────────────────────────────────── */}
          <View style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <FormFieldRow
              icon="calendar"
              label={t('kundli.prashna.queryDate')}
              value={queryDateLabel}
              onPress={() => setDatePickerOpen(true)}
              colors={colors}
            />
            <View style={[styles.formDivider, { backgroundColor: colors.divider }]} />
            <FormFieldRow
              icon="clock"
              label={t('kundli.prashna.queryTime')}
              value={queryTimeLabel}
              onPress={() => setTimePickerOpen(true)}
              colors={colors}
            />
            <View style={[styles.formDivider, { backgroundColor: colors.divider }]} />
            <View style={styles.formRow}>
              <View style={[styles.formIc, { backgroundColor: colors.surfaceRecessed }]}>
                <Icon name="location" size={16} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="mono-caps" style={[styles.formRowLabel, { color: colors.textTertiary }]}>
                  {t('kundli.prashna.queryLocation')}
                </Text>
                <Text
                  variant={queryLocation ? 'body' : 'body-italic'}
                  style={[styles.formRowValue, { color: queryLocation ? colors.textPrimary : colors.textMuted }]}
                  numberOfLines={1}>
                  {queryLocation?.name ?? t('kundli.prashna.locationMissing')}
                </Text>
              </View>
            </View>
          </View>

          {/* ── Cast button ──────────────────────────────────────────────── */}
          <MotionPressable
            pressedScale={0.97}
            onPress={onCast}
            disabled={!canCast}
            style={[
              styles.castBtn,
              {
                backgroundColor: canCast ? accent : colors.surfaceRecessed,
                borderColor: canCast ? 'transparent' : colors.border,
                opacity: canCast ? 1 : 0.7,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('kundli.prashna.castCta')}>
            <Icon
              name="compass"
              size={18}
              color={canCast ? palette.parchmentBright : colors.textMuted}
            />
            <Text
              variant="mono-caps"
              style={[
                styles.castBtnText,
                { color: canCast ? palette.parchmentBright : colors.textMuted },
              ]}>
              {t('kundli.prashna.castCta')}
            </Text>
          </MotionPressable>

          {/* ── Result body ──────────────────────────────────────────────── */}
          {chart ? (
            <PrashnaResult
              chart={chart}
              chartStyle={chartStyle}
              setChartStyle={setChartStyle}
              chartSize={Math.min(width - spacing.screenH * 2, 360)}
              lang={lang}
              rashiNames={rashiNames}
              colors={colors}
              plinth={plinth}
              accent={accent}
              digits={digits}
              t={t}
            />
          ) : didTryCast ? (
            <Text variant="body-italic" style={[styles.computeFailed, { color: colors.textMuted }]}>
              {t('kundli.prashna.computeFailed')}
            </Text>
          ) : (
            <Text variant="body-italic" style={[styles.placeholder, { color: colors.textMuted }]}>
              {t('kundli.prashna.placeholder')}
            </Text>
          )}

          <Text variant="body-italic" style={[styles.footnote, { color: colors.textMuted }]}>
            {t('kundli.prashna.disclaimer')}
          </Text>

          <View style={{ height: 32 }} />
        </ScrollView>

        <DatePickerModal
          visible={datePickerOpen}
          onClose={() => setDatePickerOpen(false)}
          value={queryDateObj}
          onPick={(d) => setQueryDateIso(ymd(d))}
          minYear={1900}
          maxYear={new Date().getFullYear() + 1}
          colors={colors}
          title={t('kundli.prashna.queryDatePickerTitle')}
        />
        <TimePickerModal
          visible={timePickerOpen}
          onClose={() => setTimePickerOpen(false)}
          value={queryTimeHHmm}
          onPick={setQueryTimeHHmm}
          title={t('kundli.prashna.queryTimePickerTitle')}
        />
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

interface FormFieldRowProps {
  icon: 'calendar' | 'clock' | 'location';
  label: string;
  value: string;
  onPress: () => void;
  colors: ColorPalette;
}

function FormFieldRow({ icon, label, value, onPress, colors }: FormFieldRowProps) {
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
        <Text variant="body" style={[styles.formRowValue, { color: colors.textPrimary }]} numberOfLines={1}>
          {value}
        </Text>
      </View>
      <Icon name="chevron-right" size={14} color={colors.textMuted} />
    </MotionPressable>
  );
}

interface PrashnaResultProps {
  chart: BirthChart;
  chartStyle: 'north' | 'south';
  setChartStyle: (next: 'north' | 'south') => void;
  chartSize: number;
  lang: Language;
  rashiNames: string[];
  colors: ColorPalette;
  plinth: ReturnType<typeof usePlinthColors>;
  accent: string;
  digits: (s: string) => string;
  t: (k: string, o?: Record<string, unknown>) => string;
}

function PrashnaResult({
  chart,
  chartStyle,
  setChartStyle,
  chartSize,
  lang,
  rashiNames,
  colors,
  plinth,
  accent,
  digits,
  t,
}: PrashnaResultProps) {
  const cells = useMemo(
    () => cellsFromLagnaPlanets(chart.lagna.rashi.index, chart.planets, lang),
    [chart, lang],
  );
  const lagnaRashiName = rashiNames[chart.lagna.rashi.index];

  return (
    <>
      {/* ── Prashna Lagna NightCard ────────────────────────────────────── */}
      <View style={styles.heroWrap}>
        <NightCard padding={20} mandalaSize={180} mandalaOpacity={0.08}>
          <Kicker color={plinth.accent} size={10}>
            {t('kundli.prashna.prashnaLagnaLabel')}
          </Kicker>
          <Text variant="display-italic" style={[styles.heroRashi, { color: plinth.text }]}>
            {lagnaRashiName}
          </Text>
          <Text variant="mono" style={[styles.heroMeta, { color: plinth.textSubdued }]}>
            {digits(chart.lagna.degreeInRashi.toFixed(2))}° · {chart.lagna.nakshatra.name} ·{' '}
            {t('kundli.padaShort', { pada: digits(String(chart.lagna.pada)) })}
          </Text>
        </NightCard>
      </View>

      {/* ── Chart style toggle ────────────────────────────────────────── */}
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
              { color: chartStyle === 'north' ? palette.parchmentBright : colors.textSecondary },
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
              { color: chartStyle === 'south' ? palette.parchmentBright : colors.textSecondary },
            ]}>
            {t('kundli.chartSouth')}
          </Text>
        </SegmentedChip>
      </View>

      {/* ── Chart ──────────────────────────────────────────────────────── */}
      <View style={styles.chartWrap}>
        {chartStyle === 'north' ? (
          <NorthChart cells={cells} size={chartSize} />
        ) : (
          <SouthChart cells={cells} size={chartSize} />
        )}
      </View>

      {/* ── Bhava cusps strip ──────────────────────────────────────────── */}
      <SectionLabel style={styles.sectionLabelSpacing}>
        {t('kundli.prashna.bhavaCuspsSection')}
      </SectionLabel>
      <View style={[styles.cuspsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {chart.bhava.houses.map((h, i) => (
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
              {digits(h.degreeInRashi.toFixed(2))}°
            </Text>
          </View>
        ))}
      </View>
      <Text variant="body-italic" style={[styles.cuspsHint, { color: colors.textMuted }]}>
        {t('kundli.prashna.cuspsHint', { system: chart.bhava.system })}
      </Text>

      {/* ── Planets at the query moment ─────────────────────────────────── */}
      <SectionLabel style={styles.sectionLabelSpacing}>
        {t('kundli.prashna.planetsSection')}
      </SectionLabel>
      <View style={[styles.planetsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {chart.planets.map((p, i) => (
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
                {rashiNames[p.rashi.index]} · {digits(p.degreeInRashi.toFixed(2))}°
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

  intro: {
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

  castBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: borderRadius.button,
    borderWidth: 1,
    marginTop: 14,
  },
  castBtnText: { fontSize: 11, letterSpacing: 1.4 },

  placeholder: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 24,
    paddingHorizontal: 12,
  },
  computeFailed: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 24,
    paddingHorizontal: 12,
  },

  heroWrap: { marginTop: 18 },
  heroRashi: { fontSize: 30, lineHeight: 36, marginTop: 8, marginBottom: 4 },
  heroMeta: { fontSize: 11, letterSpacing: 0.2 },

  sectionLabelSpacing: { marginTop: 24, marginBottom: 10 },

  chartStyleRow: { flexDirection: 'row', gap: 6, marginTop: 18, marginBottom: 6 },
  chartStyleChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: borderRadius.chip,
    borderWidth: 1,
  },
  chartStyleChipText: { fontSize: 9 },
  chartWrap: { alignItems: 'center', paddingVertical: 8 },

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
  cuspsHint: { fontSize: 11, lineHeight: 16, marginTop: 8, paddingHorizontal: 4 },

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

  footnote: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 24,
    paddingHorizontal: 8,
    textAlign: 'center',
  },
});
