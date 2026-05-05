import { useMemo, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, TextInput, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { Dignity } from 'panchang-ts';

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
import { computeKundli, buildBirthInputs } from '@/services/astrology/kundliService';
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
  const isDarkMode = useStore((s) => s.isDarkMode);
  const language = useStore((s) => s.language);
  const userBirthDate = useStore((s) => s.userBirthDate);
  const userBirthTime = useStore((s) => s.userBirthTime);
  const userBirthPlace = useStore((s) => s.userBirthPlace);
  const userSex = useStore((s) => s.userSex);
  const userName = useStore((s) => s.userName);
  const setUserBirthDate = useStore((s) => s.setUserBirthDate);
  const setUserBirthTime = useStore((s) => s.setUserBirthTime);
  const setUserSex = useStore((s) => s.setUserSex);
  const setUserName = useStore((s) => s.setUserName);
  const ayanamsa = useStore((s) => s.ayanamsa);
  const houseSystem = useStore((s) => s.houseSystem);
  const chartStyle = useStore((s) => s.chartStyle);
  const setChartStyle = useStore((s) => s.setChartStyle);
  const colors = isDarkMode ? darkColors : lightColors;
  const plinth = usePlinthColors();
  const { width } = useWindowDimensions();
  const { formatTime } = useLocaleFormatters();

  const [showD9, setShowD9] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
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

  const lang = resolveLanguage(language);
  const rashiNames = lang === 'hi' ? RASHI_NAMES_HI : RASHI_NAMES_EN;

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
  const chartCells = showD9 ? cellsFromD9(bundle.d9, lang) : cellsFromD1(bundle.d1, lang);

  // Chart fills screen width minus screen padding.
  const chartSize = Math.min(width - spacing.screenH * 2, 360);
  const dignityLabel = (d: Dignity): string => t(`kundli.dignity.${d}`);

  return (
    <View>
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
            activeBg={isDarkMode ? palette.goldLeaf : palette.sindoor}
            inactiveBorder={colors.border}
            activeBorder="transparent"
            style={styles.styleChip}
            accessibilityLabel={t('kundli.chartNorth')}>
            <Text
              variant="mono-caps"
              style={[
                styles.styleChipText,
                { color: chartStyle === 'north' ? palette.parchmentBright : colors.textSecondary },
              ]}>
              {t('kundli.chartNorth')}
            </Text>
          </SegmentedChip>
          <SegmentedChip
            active={chartStyle === 'south'}
            onPress={() => setChartStyle('south')}
            inactiveBg="transparent"
            activeBg={isDarkMode ? palette.goldLeaf : palette.sindoor}
            inactiveBorder={colors.border}
            activeBorder="transparent"
            style={styles.styleChip}
            accessibilityLabel={t('kundli.chartSouth')}>
            <Text
              variant="mono-caps"
              style={[
                styles.styleChipText,
                { color: chartStyle === 'south' ? palette.parchmentBright : colors.textSecondary },
              ]}>
              {t('kundli.chartSouth')}
            </Text>
          </SegmentedChip>
        </View>

        <View style={styles.divisionGroup}>
          <SegmentedChip
            active={!showD9}
            onPress={() => setShowD9(false)}
            inactiveBg="transparent"
            activeBg={colors.surface}
            inactiveBorder={colors.border}
            activeBorder={colors.borderAccent}
            style={styles.divChip}
            accessibilityLabel="D1">
            <Text
              variant="mono-caps"
              style={[styles.divChipText, { color: !showD9 ? colors.textPrimary : colors.textTertiary }]}>
              D1
            </Text>
          </SegmentedChip>
          <SegmentedChip
            active={showD9}
            onPress={() => setShowD9(true)}
            inactiveBg="transparent"
            activeBg={colors.surface}
            inactiveBorder={colors.border}
            activeBorder={colors.borderAccent}
            style={styles.divChip}
            accessibilityLabel="D9">
            <Text
              variant="mono-caps"
              style={[styles.divChipText, { color: showD9 ? colors.textPrimary : colors.textTertiary }]}>
              D9
            </Text>
          </SegmentedChip>
        </View>
      </View>

      {/* ── Chart ────────────────────────────────────────────────────────── */}
      <View style={styles.chartWrap}>
        {chartStyle === 'north' ? (
          <NorthChart cells={chartCells} size={chartSize} />
        ) : (
          <SouthChart cells={chartCells} size={chartSize} />
        )}
      </View>

      {/* ── Mangal Dosha card ────────────────────────────────────────────── */}
      <SectionLabel style={styles.sectionLabelSpacing}>
        {t('kundli.mangalSection')}
      </SectionLabel>
      <View style={[styles.mangalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.mangalHead}>
          <Icon
            name={bundle.mangal.afflicted ? 'alert-circle' : 'check-circle'}
            size={20}
            color={bundle.mangal.afflicted ? palette.sindoor : '#3FA37D'}
          />
          <Text variant="body" style={[styles.mangalStatus, { color: colors.textPrimary }]}>
            {bundle.mangal.afflicted ? t('kundli.mangalAfflicted') : t('kundli.mangalNotAfflicted')}
          </Text>
        </View>
        <View style={styles.mangalGrid}>
          <MangalCut
            label={t('kundli.fromLagna')}
            house={bundle.mangal.fromLagna.house}
            afflicted={bundle.mangal.fromLagna.afflicted}
            colors={colors}
          />
          <MangalCut
            label={t('kundli.fromMoon')}
            house={bundle.mangal.fromMoon.house}
            afflicted={bundle.mangal.fromMoon.afflicted}
            colors={colors}
          />
          <MangalCut
            label={t('kundli.fromVenus')}
            house={bundle.mangal.fromVenus.house}
            afflicted={bundle.mangal.fromVenus.afflicted}
            colors={colors}
          />
        </View>
        {bundle.mangal.cancellations.length > 0 && (
          <Text variant="body-italic" style={[styles.mangalCancel, { color: colors.textMuted }]}>
            {t('kundli.cancellation')}: {bundle.mangal.cancellations.join('; ')}
          </Text>
        )}
      </View>

      {/* ── Dignity strip ────────────────────────────────────────────────── */}
      <SectionLabel style={styles.sectionLabelSpacing}>
        {t('kundli.dignitySection')}
      </SectionLabel>
      <PlanetaryDignityChart items={bundle.dignity} labelFor={dignityLabel} />

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

      {/* ── Your details ─────────────────────────────────────────────────
          Editable inline so the user can adjust without leaving Kundli. The
          chart above re-renders whenever any of these values change. */}
      <SectionLabel style={styles.sectionLabelSpacing}>
        {t('kundli.yourDetailsLabel')}
      </SectionLabel>
      {formCard}
      {pickerModals}
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

interface MangalCutProps {
  label: string;
  house: number;
  afflicted: boolean;
  colors: ColorPalette;
}

function MangalCut({ label, house, afflicted, colors }: MangalCutProps) {
  return (
    <View style={[styles.mangalCol, { borderColor: colors.border }]}>
      <Text variant="mono-caps" style={[styles.mangalColLabel, { color: colors.textTertiary }]}>
        {label}
      </Text>
      <Text
        variant="body"
        style={[
          styles.mangalColValue,
          { color: afflicted ? palette.sindoor : colors.textPrimary },
        ]}>
        {house}
      </Text>
    </View>
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
  divisionGroup: { flexDirection: 'row', gap: 6 },
  styleChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: borderRadius.chip,
    borderWidth: 1,
  },
  styleChipText: { fontSize: 9 },
  divChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: borderRadius.chip,
    borderWidth: 1,
  },
  divChipText: { fontSize: 10 },

  chartWrap: {
    alignItems: 'center',
    paddingVertical: 8,
  },

  mangalCard: {
    padding: 16,
    borderRadius: borderRadius.card,
    borderWidth: 1,
  },
  mangalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  mangalStatus: { fontSize: 15, lineHeight: 21, flex: 1 },
  mangalGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  mangalCol: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: borderRadius.cardInner,
    borderWidth: 1,
    alignItems: 'center',
    gap: 4,
  },
  mangalColLabel: { fontSize: 9, letterSpacing: 1.4 },
  mangalColValue: { fontSize: 18, lineHeight: 24 },
  mangalCancel: { fontSize: 12, lineHeight: 18, marginTop: 12 },

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
});
