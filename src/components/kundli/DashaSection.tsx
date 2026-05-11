import { memo, useCallback, useMemo, useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  computeVimshottariPratyantar,
  type AntarDasha,
  type CharaDashaResult,
  type DashaLord,
  type MahaDasha,
  type NarayanDashaResult,
  type PratyantarDasha,
  type YoginiDashaResult,
  type YoginiMahaDasha,
} from 'panchang-ts';

import { AppText as Text } from '@/components/common/AppText';
import { Icon } from '@/components/common/Icon';
import { Kicker } from '@/components/common/Kicker';
import { SectionLabel } from '@/components/common/SectionLabel';
import { NightCard, usePlinthColors } from '@/components/common/NightCard';
import { SegmentedChip } from '@/components/common/SegmentedChip';
import { DatePickerModal } from '@/components/common/DatePickerModal';
import { useStore } from '@/store/useStore';
import {
  borderRadius,
  darkColors,
  lightColors,
  palette,
  spacing,
  type ColorPalette,
} from '@/config/theme';
import {
  buildBirthInputs,
  computeAshtottariCached,
  computeCharaCached,
  computeDashaTimeline,
  computeKundli,
  computeNarayanCached,
  computeYoginiCached,
  moonSiderealLonFromChart,
  type DashaSystem,
} from '@/services/astrology/kundliService';
import { resolveLanguage } from '@/i18n';
import { ymd } from '@/utils/calendar';
import { DEFAULT_BIRTH_TIMEZONE, wallclockInZoneToUtc } from '@/utils/time';

const RASHI_NAMES_EN = [
  'Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya',
  'Tula', 'Vrischika', 'Dhanu', 'Makara', 'Kumbha', 'Meena',
];
const RASHI_NAMES_HI = [
  'मेष', 'वृषभ', 'मिथुन', 'कर्क', 'सिंह', 'कन्या',
  'तुला', 'वृश्चिक', 'धनु', 'मकर', 'कुम्भ', 'मीन',
];

const DASHA_SYSTEMS: DashaSystem[] = ['vimshottari', 'ashtottari', 'yogini', 'chara', 'narayan'];

const DASHA_LORD_TO_KEY: Record<DashaLord, string> = {
  Sun: 'sun',
  Moon: 'moon',
  Mars: 'mars',
  Mercury: 'mercury',
  Jupiter: 'jupiter',
  Venus: 'venus',
  Saturn: 'saturn',
  Rahu: 'rahu',
  Ketu: 'ketu',
};

function formatRangeDate(d: Date, lang: string): string {
  return d.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
    month: 'short',
    year: 'numeric',
  });
}

function formatYears(years: number, t: (k: string, o?: Record<string, unknown>) => string): string {
  const rounded = Math.round(years * 10) / 10;
  const key = Math.abs(rounded - 1) < 0.05 ? 'dasha.yearsOne' : 'dasha.yearsOther';
  return t(key, { years: rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1) });
}

export function DashaSection() {
  const { t, i18n } = useTranslation();
  const isDarkMode = useStore((s) => s.isDarkMode);
  const language = useStore((s) => s.language);
  const userBirthDate = useStore((s) => s.userBirthDate);
  const userBirthTime = useStore((s) => s.userBirthTime);
  const userBirthPlace = useStore((s) => s.userBirthPlace);
  const setUserBirthDate = useStore((s) => s.setUserBirthDate);
  const ayanamsa = useStore((s) => s.ayanamsa);
  const houseSystem = useStore((s) => s.houseSystem);
  const colors = isDarkMode ? darkColors : lightColors;
  const plinth = usePlinthColors();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [openAntardashaInsideMaha, setOpenAntardashaInsideMaha] = useState<number | null>(null);
  const [system, setSystem] = useState<DashaSystem>('vimshottari');

  const birthDate = useMemo<Date | null>(() => {
    if (!userBirthDate) return null;
    const tz = userBirthPlace?.timezone ?? DEFAULT_BIRTH_TIMEZONE;
    try {
      return wallclockInZoneToUtc(userBirthDate, userBirthTime ?? '12:00', tz);
    } catch {
      return null;
    }
  }, [userBirthDate, userBirthTime, userBirthPlace]);

  // Birth inputs for systems that need a full chart (Chara: lagna; Yogini /
  // Ashtottari: sidereal moon longitude). All three only run when their tab
  // is active so we don't pay for unused dashas on first mount.
  const birthInputs = useMemo(
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

  const timeline = useMemo(() => {
    if (!birthDate || system !== 'vimshottari') return null;
    return computeDashaTimeline(birthDate, ayanamsa);
  }, [birthDate, ayanamsa, system]);

  const ashtottari = useMemo(() => {
    if (!birthDate || !birthInputs || system !== 'ashtottari') return null;
    const bundle = computeKundli(birthInputs);
    if (!bundle) return null;
    const moonLon = moonSiderealLonFromChart(bundle.d1);
    return computeAshtottariCached(birthDate, ayanamsa, moonLon);
  }, [birthDate, birthInputs, ayanamsa, system]);

  const yogini = useMemo(() => {
    if (!birthDate || !birthInputs || system !== 'yogini') return null;
    const bundle = computeKundli(birthInputs);
    if (!bundle) return null;
    const moonLon = moonSiderealLonFromChart(bundle.d1);
    return computeYoginiCached(birthDate, ayanamsa, moonLon);
  }, [birthDate, birthInputs, ayanamsa, system]);

  const chara = useMemo(() => {
    if (!birthInputs || system !== 'chara') return null;
    return computeCharaCached(birthInputs);
  }, [birthInputs, system]);

  // Narayan Dasha — Chara skeleton with the vishama-/sama-pada parity-direction
  // rule. Same row UI as Chara since the result shape is identical except for
  // the `direction` flag (surfaced in the current-card subtitle).
  const narayan = useMemo(() => {
    if (!birthInputs || system !== 'narayan') return null;
    return computeNarayanCached(birthInputs);
  }, [birthInputs, system]);

  // Vimshottari and Ashtottari both return `VimshottariDashaResult`, so they
  // share the same row UI. The only difference at this seam is which result
  // the renderer feeds into MahadashaRow.
  const dashaResult = system === 'vimshottari' ? (timeline?.full ?? null) : ashtottari;
  const activeIndex = dashaResult?.currentIndex ?? null;
  const effectiveExpanded = expandedIndex ?? activeIndex;

  // Stable toggles so memoized rows don't re-render on every parent state
  // churn. Each row receives its `index` and calls these with that index, so
  // we don't have to allocate a new closure per row per render.
  const handleMahaToggle = useCallback(
    (i: number) => {
      setExpandedIndex((prev) => {
        const eff = prev ?? activeIndex;
        return eff === i ? -1 : i;
      });
      setOpenAntardashaInsideMaha(null);
    },
    [activeIndex],
  );
  const handleAntardashaToggle = useCallback((adIdx: number) => {
    setOpenAntardashaInsideMaha((prev) => (prev === adIdx ? null : adIdx));
  }, []);
  const now = Date.now();
  const currentMaha = dashaResult?.mahaDashas[dashaResult.currentIndex];
  const currentAntardasha =
    system === 'vimshottari'
      ? (timeline?.currentAntardasha ?? null)
      : (currentMaha?.antarDashas.find(
          (ad) => ad.startDate.getTime() <= now && ad.endDate.getTime() > now,
        ) ?? null);
  const currentPratyantars = useMemo(() => {
    if (system === 'vimshottari') return timeline?.currentPratyantars ?? [];
    if (system === 'ashtottari' && currentAntardasha) {
      try {
        return computeVimshottariPratyantar(currentAntardasha);
      } catch {
        return [];
      }
    }
    return [];
  }, [system, timeline, currentAntardasha]);

  const birthDateLabel = birthDate
    ? birthDate.toLocaleDateString(i18n.language === 'hi' ? 'hi-IN' : 'en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  if (!birthDate) {
    return (
      <View>
        <SectionLabel style={styles.sectionLabelSpacing}>
          {t('dasha.birthDateLabel')}
        </SectionLabel>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setPickerOpen(true)}
          style={[styles.setBirthBtn, { backgroundColor: palette.sindoor }]}
          accessibilityRole="button"
          accessibilityLabel={t('dasha.setBirthDate')}>
          <Icon name="calendar" size={18} color={palette.parchmentBright} />
          <Text variant="mono-caps" style={styles.setBirthText}>
            {t('dasha.setBirthDate')}
          </Text>
        </TouchableOpacity>
        <Text variant="body-italic" style={[styles.prompt, { color: colors.textMuted }]}>
          {t('dasha.notSetPrompt')}
        </Text>

        <DatePickerModal
          visible={pickerOpen}
          onClose={() => setPickerOpen(false)}
          value={null}
          onPick={(d) => setUserBirthDate(ymd(d))}
          maxDate={new Date()}
          colors={colors}
          title={t('dasha.birthDatePickerTitle')}
        />
      </View>
    );
  }

  return (
    <View>
      <SectionLabel style={styles.sectionLabelSpacing}>
        {t('dasha.birthDateLabel')}
      </SectionLabel>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setPickerOpen(true)}
        style={[styles.birthRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
        accessibilityRole="button"
        accessibilityLabel={t('dasha.changeBirthDate')}>
        <Icon name="calendar" size={18} color={colors.accent} />
        <Text variant="body" style={[styles.birthDateText, { color: colors.textPrimary }]}>
          {birthDateLabel}
        </Text>
        <Text variant="mono-caps" style={[styles.birthChangeText, { color: colors.accent }]}>
          {t('dasha.changeBirthDate')}
        </Text>
      </TouchableOpacity>

      {/* ── Dasha system selector ─────────────────────────────────────────
          Vimshottari is the headline; Ashtottari, Yogini, and Chara are
          alternate classical timings the panchang-ts library now exposes.
          Each system is computed lazily so we never pay for tabs the user
          doesn't open. */}
      <View style={styles.systemRow}>
        {DASHA_SYSTEMS.map((sys) => (
          <SegmentedChip
            key={sys}
            active={system === sys}
            onPress={() => {
              setSystem(sys);
              setExpandedIndex(null);
              setOpenAntardashaInsideMaha(null);
            }}
            inactiveBg="transparent"
            activeBg={isDarkMode ? palette.goldLeaf : palette.sindoor}
            inactiveBorder={colors.border}
            activeBorder="transparent"
            style={styles.systemChip}
            accessibilityLabel={t(`dasha.system.${sys}`)}>
            <Text
              variant="mono-caps"
              style={[
                styles.systemChipText,
                { color: system === sys ? palette.parchmentBright : colors.textSecondary },
              ]}>
              {t(`dasha.system.${sys}`)}
            </Text>
          </SegmentedChip>
        ))}
      </View>

      {(system === 'vimshottari' || system === 'ashtottari') && dashaResult && (
        <>
          <View style={styles.currentWrap}>
            <NightCard padding={20} mandalaSize={180} mandalaOpacity={0.08}>
              <Kicker color={plinth.accent} size={10}>
                {t('dasha.currentLabel')}
              </Kicker>
              <Text variant="display-italic" style={[styles.currentMahaLord, { color: plinth.text }]}>
                {t(`dasha.planet.${DASHA_LORD_TO_KEY[dashaResult.currentMahaDashaLord]}`)} {t('dasha.mahadashaSuffix')}
              </Text>
              {(() => {
                const md = dashaResult.mahaDashas[dashaResult.currentIndex];
                return md ? (
                  <Text variant="mono" style={[styles.currentUntil, { color: plinth.textSubdued }]}>
                    {t('dasha.untilDate', { date: formatRangeDate(md.endDate, i18n.language) })}
                  </Text>
                ) : null;
              })()}

              {currentAntardasha && (
                <>
                  <View style={[styles.currentDivider, { backgroundColor: plinth.divider }]} />
                  <Text variant="body-italic" style={[styles.currentAntardasha, { color: plinth.text }]}>
                    {t(`dasha.planet.${DASHA_LORD_TO_KEY[currentAntardasha.lord]}`)} {t('dasha.antardashaSuffix')}
                  </Text>
                  <Text variant="mono" style={[styles.currentUntil, { color: plinth.textSubdued }]}>
                    {t('dasha.untilDate', { date: formatRangeDate(currentAntardasha.endDate, i18n.language) })}
                  </Text>

                  {/* Pratyantar drilldown — third level. */}
                  {currentPratyantars.length > 0 && (
                    <CurrentPratyantarStrip
                      pratyantars={currentPratyantars}
                      plinth={plinth}
                      lang={i18n.language}
                      t={t}
                    />
                  )}
                </>
              )}
            </NightCard>
          </View>

          <SectionLabel style={styles.sectionLabelSpacing}>
            {t('dasha.fullCycle')}
          </SectionLabel>
          {dashaResult.mahaDashas.map((md, i) => (
            <MahadashaRow
              key={i}
              index={i}
              md={md}
              expanded={effectiveExpanded === i}
              isActive={i === activeIndex}
              lang={i18n.language}
              onToggle={handleMahaToggle}
              openAntardashaIndex={effectiveExpanded === i ? openAntardashaInsideMaha : null}
              onAntardashaToggle={handleAntardashaToggle}
              colors={colors}
              t={t}
            />
          ))}

          <Text variant="body-italic" style={[styles.approxNote, { color: colors.textMuted }]}>
            {t('dasha.approxNote')}
          </Text>
        </>
      )}

      {system === 'yogini' && yogini && (
        <YoginiTimeline
          result={yogini}
          plinth={plinth}
          colors={colors}
          isDarkMode={isDarkMode}
          lang={i18n.language}
          t={t}
        />
      )}

      {system === 'chara' && chara && (
        <CharaTimeline
          result={chara}
          plinth={plinth}
          colors={colors}
          rashiNames={resolveLanguage(language) === 'hi' ? RASHI_NAMES_HI : RASHI_NAMES_EN}
          lang={i18n.language}
          t={t}
        />
      )}

      {system === 'narayan' && narayan && (
        <NarayanTimeline
          result={narayan}
          plinth={plinth}
          colors={colors}
          rashiNames={resolveLanguage(language) === 'hi' ? RASHI_NAMES_HI : RASHI_NAMES_EN}
          lang={i18n.language}
          t={t}
        />
      )}

      <DatePickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        value={birthDate}
        onPick={(d) => setUserBirthDate(ymd(d))}
        onClear={() => setUserBirthDate(null)}
        maxDate={new Date()}
        colors={colors}
        title={t('dasha.birthDatePickerTitle')}
      />
    </View>
  );
}

interface CurrentPratyantarStripProps {
  pratyantars: PratyantarDasha[];
  plinth: ReturnType<typeof usePlinthColors>;
  lang: string;
  t: (k: string, o?: Record<string, unknown>) => string;
}

const CurrentPratyantarStrip = memo(function CurrentPratyantarStrip({
  pratyantars,
  plinth,
  lang,
  t,
}: CurrentPratyantarStripProps) {
  const now = Date.now();
  const activePratyantara =
    pratyantars.find((p) => p.startDate.getTime() <= now && p.endDate.getTime() > now) ?? null;
  if (!activePratyantara) return null;
  return (
    <>
      <View style={[styles.currentDivider, { backgroundColor: plinth.divider }]} />
      <Text variant="body-italic" style={[styles.currentPratyantar, { color: plinth.text }]}>
        {t(`dasha.planet.${DASHA_LORD_TO_KEY[activePratyantara.lord]}`)} {t('dasha.pratyantarSuffix')}
      </Text>
      <Text variant="mono" style={[styles.currentUntil, { color: plinth.textSubdued }]}>
        {t('dasha.untilDate', { date: formatRangeDate(activePratyantara.endDate, lang) })}
      </Text>
    </>
  );
});

interface MahadashaRowProps {
  index: number;
  md: MahaDasha;
  expanded: boolean;
  isActive: boolean;
  lang: string;
  onToggle: (index: number) => void;
  openAntardashaIndex: number | null;
  onAntardashaToggle: (idx: number) => void;
  colors: ColorPalette;
  t: (k: string, o?: Record<string, unknown>) => string;
}

const MahadashaRow = memo(function MahadashaRow({
  index,
  md,
  expanded,
  isActive,
  lang,
  onToggle,
  openAntardashaIndex,
  onAntardashaToggle,
  colors,
  t,
}: MahadashaRowProps) {
  const lordLabel = t(`dasha.planet.${DASHA_LORD_TO_KEY[md.lord]}`);
  const range = t('dasha.dateRangeLong', {
    start: formatRangeDate(md.startDate, lang),
    end: formatRangeDate(md.endDate, lang),
  });
  // Bind row index into the stable parent handler so we can pass a closure-
  // free `onPress` down without breaking memoization.
  const handlePress = useCallback(() => onToggle(index), [onToggle, index]);
  return (
    <View
      style={[
        styles.mahaCard,
        {
          backgroundColor: colors.surface,
          borderColor: isActive ? colors.accent : colors.border,
          borderWidth: isActive ? 1.5 : 1,
        },
      ]}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={handlePress}
        style={styles.mahaRowHeader}
        accessibilityRole="button"
        accessibilityLabel={`${lordLabel} ${t('dasha.mahadashaSuffix')}`}
        accessibilityState={{ expanded }}>
        <View style={[styles.spine, { backgroundColor: isActive ? colors.accent : palette.rule }]} />
        <View style={{ flex: 1 }}>
          <View style={styles.mahaTitleRow}>
            <Text variant="body" style={[styles.mahaLord, { color: colors.textPrimary }]}>
              {lordLabel}{' '}
              <Text variant="body-italic" style={{ color: colors.textTertiary }}>
                {t('dasha.mahadashaSuffix')}
              </Text>
            </Text>
            {isActive && <View style={[styles.activeChip, { backgroundColor: colors.accent }]} />}
          </View>
          <Text variant="mono" style={[styles.mahaMeta, { color: colors.textMuted }]}>
            {range} · {formatYears(md.years, t)}
          </Text>
        </View>
        <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
      </TouchableOpacity>

      {expanded && (
        <View style={[styles.antarWrap, { borderTopColor: colors.divider }]}>
          <Kicker color={palette.gold} size={9} style={styles.antarHeader}>
            {t('dasha.antardashasHeader')}
          </Kicker>
          {md.antarDashas.map((ad, j) => (
            <AntardashaRow
              key={j}
              index={j}
              ad={ad}
              lang={lang}
              colors={colors}
              t={t}
              expanded={openAntardashaIndex === j}
              onToggle={onAntardashaToggle}
            />
          ))}
        </View>
      )}
    </View>
  );
});

interface AntardashaRowProps {
  index: number;
  ad: AntarDasha;
  lang: string;
  colors: ColorPalette;
  t: (k: string, o?: Record<string, unknown>) => string;
  expanded: boolean;
  onToggle: (index: number) => void;
}

const AntardashaRow = memo(function AntardashaRow({
  index,
  ad,
  lang,
  colors,
  t,
  expanded,
  onToggle,
}: AntardashaRowProps) {
  const now = Date.now();
  const adActive = ad.startDate.getTime() <= now && ad.endDate.getTime() > now;
  // Pratyantars are computed lazily on expand to avoid 9×9×9 work for the
  // full 120-year cycle. Memo per-row keeps re-renders cheap.
  const pratyantars = useMemo(() => (expanded ? computeVimshottariPratyantar(ad) : []), [expanded, ad]);
  const handlePress = useCallback(() => onToggle(index), [onToggle, index]);

  return (
    <View>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={handlePress}
        style={styles.antarRow}
        accessibilityRole="button"
        accessibilityState={{ expanded }}>
        <View
          style={[
            styles.antarDot,
            { backgroundColor: adActive ? colors.accent : colors.divider },
          ]}
        />
        <Text
          variant="body"
          style={[
            styles.antarLord,
            { color: adActive ? colors.textPrimary : colors.textSecondary },
          ]}>
          {t(`dasha.planet.${DASHA_LORD_TO_KEY[ad.lord]}`)}
        </Text>
        <Text variant="mono" style={[styles.antarRange, { color: colors.textMuted }]}>
          {t('dasha.dateRangeLong', {
            start: formatRangeDate(ad.startDate, lang),
            end: formatRangeDate(ad.endDate, lang),
          })}
        </Text>
        <Icon
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={12}
          color={colors.textMuted}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={[styles.pratyantarWrap, { borderLeftColor: colors.borderAccent }]}>
          {pratyantars.map((p, i) => {
            const pActive = p.startDate.getTime() <= now && p.endDate.getTime() > now;
            return (
              <View key={i} style={styles.pratyantarRow}>
                <View
                  style={[
                    styles.pratyantarDot,
                    { backgroundColor: pActive ? colors.accent : colors.divider },
                  ]}
                />
                <Text
                  variant="body"
                  style={[
                    styles.pratyantarLord,
                    { color: pActive ? colors.textPrimary : colors.textSecondary },
                  ]}>
                  {t(`dasha.planet.${DASHA_LORD_TO_KEY[p.lord]}`)}
                </Text>
                <Text variant="mono" style={[styles.pratyantarRange, { color: colors.textMuted }]}>
                  {t('dasha.dateRangeShort', {
                    start: formatRangeDate(p.startDate, lang),
                    end: formatRangeDate(p.endDate, lang),
                  })}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
});

interface YoginiTimelineProps {
  result: YoginiDashaResult;
  plinth: ReturnType<typeof usePlinthColors>;
  colors: ColorPalette;
  isDarkMode: boolean;
  lang: string;
  t: (k: string, o?: Record<string, unknown>) => string;
}

function YoginiTimeline({ result, plinth, colors, lang, t }: YoginiTimelineProps) {
  const now = Date.now();
  const currentMaha = result.mahaDashas[result.currentIndex];
  const currentAntar =
    currentMaha?.antarDashas.find(
      (ad) => ad.startDate.getTime() <= now && ad.endDate.getTime() > now,
    ) ?? null;
  return (
    <>
      {currentMaha && (
        <View style={styles.currentWrap}>
          <NightCard padding={20} mandalaSize={180} mandalaOpacity={0.08}>
            <Kicker color={plinth.accent} size={10}>
              {t('dasha.currentLabel')}
            </Kicker>
            <Text variant="display-italic" style={[styles.currentMahaLord, { color: plinth.text }]}>
              {t(`dasha.yoginiName.${currentMaha.yogini.toLowerCase()}`)} {t('dasha.mahadashaSuffix')}
            </Text>
            <Text variant="mono" style={[styles.yoginiSubtitle, { color: plinth.textSubdued }]}>
              {t(`dasha.planet.${DASHA_LORD_TO_KEY[currentMaha.lord]}`)}
            </Text>
            <Text variant="mono" style={[styles.currentUntil, { color: plinth.textSubdued }]}>
              {t('dasha.untilDate', { date: formatRangeDate(currentMaha.endDate, lang) })}
            </Text>
            {currentAntar && (
              <>
                <View style={[styles.currentDivider, { backgroundColor: plinth.divider }]} />
                <Text variant="body-italic" style={[styles.currentAntardasha, { color: plinth.text }]}>
                  {t(`dasha.yoginiName.${currentAntar.yogini.toLowerCase()}`)} {t('dasha.antardashaSuffix')}
                </Text>
                <Text variant="mono" style={[styles.currentUntil, { color: plinth.textSubdued }]}>
                  {t('dasha.untilDate', { date: formatRangeDate(currentAntar.endDate, lang) })}
                </Text>
              </>
            )}
          </NightCard>
        </View>
      )}

      <SectionLabel style={styles.sectionLabelSpacing}>
        {t('dasha.yoginiFullCycle')}
      </SectionLabel>
      {result.mahaDashas.map((md, i) => (
        <YoginiRow
          key={i}
          md={md}
          isActive={i === result.currentIndex}
          colors={colors}
          lang={lang}
          t={t}
        />
      ))}
    </>
  );
}

interface YoginiRowProps {
  md: YoginiMahaDasha;
  isActive: boolean;
  colors: ColorPalette;
  lang: string;
  t: (k: string, o?: Record<string, unknown>) => string;
}

const YoginiRow = memo(function YoginiRow({ md, isActive, colors, lang, t }: YoginiRowProps) {
  const yoginiLabel = t(`dasha.yoginiName.${md.yogini.toLowerCase()}`);
  const planetLabel = t(`dasha.planet.${DASHA_LORD_TO_KEY[md.lord]}`);
  return (
    <View
      style={[
        styles.mahaCard,
        {
          backgroundColor: colors.surface,
          borderColor: isActive ? colors.accent : colors.border,
          borderWidth: isActive ? 1.5 : 1,
        },
      ]}>
      <View style={styles.mahaRowHeader}>
        <View style={[styles.spine, { backgroundColor: isActive ? colors.accent : palette.rule }]} />
        <View style={{ flex: 1 }}>
          <View style={styles.mahaTitleRow}>
            <Text variant="body" style={[styles.mahaLord, { color: colors.textPrimary }]}>
              {yoginiLabel}{' '}
              <Text variant="body-italic" style={{ color: colors.textTertiary }}>
                {planetLabel}
              </Text>
            </Text>
            {isActive && <View style={[styles.activeChip, { backgroundColor: colors.accent }]} />}
          </View>
          <Text variant="mono" style={[styles.mahaMeta, { color: colors.textMuted }]}>
            {t('dasha.dateRangeLong', {
              start: formatRangeDate(md.startDate, lang),
              end: formatRangeDate(md.endDate, lang),
            })}{' '}
            · {formatYears(md.years, t)}
          </Text>
        </View>
      </View>
    </View>
  );
});

interface CharaTimelineProps {
  result: CharaDashaResult;
  plinth: ReturnType<typeof usePlinthColors>;
  colors: ColorPalette;
  rashiNames: string[];
  lang: string;
  t: (k: string, o?: Record<string, unknown>) => string;
}

function CharaTimeline({ result, plinth, colors, rashiNames, lang, t }: CharaTimelineProps) {
  const currentMaha = result.mahaDashas[result.currentIndex];
  return (
    <>
      {currentMaha && (
        <View style={styles.currentWrap}>
          <NightCard padding={20} mandalaSize={180} mandalaOpacity={0.08}>
            <Kicker color={plinth.accent} size={10}>
              {t('dasha.currentLabel')}
            </Kicker>
            <Text variant="display-italic" style={[styles.currentMahaLord, { color: plinth.text }]}>
              {rashiNames[currentMaha.rashi]} {t('dasha.mahadashaSuffix')}
            </Text>
            <Text variant="mono" style={[styles.yoginiSubtitle, { color: plinth.textSubdued }]}>
              {t(`dasha.planet.${DASHA_LORD_TO_KEY[currentMaha.lord]}`)}
            </Text>
            <Text variant="mono" style={[styles.currentUntil, { color: plinth.textSubdued }]}>
              {t('dasha.untilDate', { date: formatRangeDate(currentMaha.endDate, lang) })}
            </Text>
          </NightCard>
        </View>
      )}

      <SectionLabel style={styles.sectionLabelSpacing}>
        {t('dasha.charaFullCycle')}
      </SectionLabel>
      {result.mahaDashas.map((md, i) => {
        const isActive = i === result.currentIndex;
        return (
          <View
            key={i}
            style={[
              styles.mahaCard,
              {
                backgroundColor: colors.surface,
                borderColor: isActive ? colors.accent : colors.border,
                borderWidth: isActive ? 1.5 : 1,
              },
            ]}>
            <View style={styles.mahaRowHeader}>
              <View style={[styles.spine, { backgroundColor: isActive ? colors.accent : palette.rule }]} />
              <View style={{ flex: 1 }}>
                <View style={styles.mahaTitleRow}>
                  <Text variant="body" style={[styles.mahaLord, { color: colors.textPrimary }]}>
                    {rashiNames[md.rashi]}{' '}
                    <Text variant="body-italic" style={{ color: colors.textTertiary }}>
                      {t(`dasha.planet.${DASHA_LORD_TO_KEY[md.lord]}`)}
                    </Text>
                  </Text>
                  {isActive && <View style={[styles.activeChip, { backgroundColor: colors.accent }]} />}
                </View>
                <Text variant="mono" style={[styles.mahaMeta, { color: colors.textMuted }]}>
                  {t('dasha.dateRangeLong', {
                    start: formatRangeDate(md.startDate, lang),
                    end: formatRangeDate(md.endDate, lang),
                  })}{' '}
                  · {formatYears(md.years, t)}
                </Text>
              </View>
            </View>
          </View>
        );
      })}
    </>
  );
}

interface NarayanTimelineProps {
  result: NarayanDashaResult;
  plinth: ReturnType<typeof usePlinthColors>;
  colors: ColorPalette;
  rashiNames: string[];
  lang: string;
  t: (k: string, o?: Record<string, unknown>) => string;
}

function NarayanTimeline({ result, plinth, colors, rashiNames, lang, t }: NarayanTimelineProps) {
  const currentMaha = result.mahaDashas[result.currentIndex];
  const directionLabel =
    result.direction === 'forward'
      ? t('dasha.narayan.directionForward')
      : t('dasha.narayan.directionBackward');
  return (
    <>
      {currentMaha && (
        <View style={styles.currentWrap}>
          <NightCard padding={20} mandalaSize={180} mandalaOpacity={0.08}>
            <Kicker color={plinth.accent} size={10}>
              {t('dasha.currentLabel')}
            </Kicker>
            <Text variant="display-italic" style={[styles.currentMahaLord, { color: plinth.text }]}>
              {rashiNames[currentMaha.rashi]} {t('dasha.mahadashaSuffix')}
            </Text>
            <Text variant="mono" style={[styles.yoginiSubtitle, { color: plinth.textSubdued }]}>
              {t(`dasha.planet.${DASHA_LORD_TO_KEY[currentMaha.lord]}`)} · {directionLabel}
            </Text>
            <Text variant="mono" style={[styles.currentUntil, { color: plinth.textSubdued }]}>
              {t('dasha.untilDate', { date: formatRangeDate(currentMaha.endDate, lang) })}
            </Text>
          </NightCard>
        </View>
      )}

      <SectionLabel style={styles.sectionLabelSpacing}>
        {t('dasha.narayanFullCycle')}
      </SectionLabel>
      {result.mahaDashas.map((md, i) => {
        const isActive = i === result.currentIndex;
        return (
          <View
            key={i}
            style={[
              styles.mahaCard,
              {
                backgroundColor: colors.surface,
                borderColor: isActive ? colors.accent : colors.border,
                borderWidth: isActive ? 1.5 : 1,
              },
            ]}>
            <View style={styles.mahaRowHeader}>
              <View style={[styles.spine, { backgroundColor: isActive ? colors.accent : palette.rule }]} />
              <View style={{ flex: 1 }}>
                <View style={styles.mahaTitleRow}>
                  <Text variant="body" style={[styles.mahaLord, { color: colors.textPrimary }]}>
                    {rashiNames[md.rashi]}{' '}
                    <Text variant="body-italic" style={{ color: colors.textTertiary }}>
                      {t(`dasha.planet.${DASHA_LORD_TO_KEY[md.lord]}`)}
                    </Text>
                  </Text>
                  {isActive && <View style={[styles.activeChip, { backgroundColor: colors.accent }]} />}
                </View>
                <Text variant="mono" style={[styles.mahaMeta, { color: colors.textMuted }]}>
                  {t('dasha.dateRangeLong', {
                    start: formatRangeDate(md.startDate, lang),
                    end: formatRangeDate(md.endDate, lang),
                  })}{' '}
                  · {formatYears(md.years, t)}
                </Text>
              </View>
            </View>
          </View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  sectionLabelSpacing: { marginTop: 24, marginBottom: 10 },
  birthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: borderRadius.card,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  birthDateText: { flex: 1, fontSize: 15, lineHeight: 20 },
  birthChangeText: { fontSize: 10 },

  setBirthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: borderRadius.button,
  },
  setBirthText: { color: palette.parchmentBright, fontSize: 11 },

  prompt: { fontSize: 14, lineHeight: 22, textAlign: 'center', marginTop: 24 },

  currentWrap: { marginTop: 24 },
  currentMahaLord: { fontSize: 26, lineHeight: 32, marginTop: 10, marginBottom: 4 },
  currentUntil: { fontSize: 11, letterSpacing: 0.2 },
  currentDivider: { height: StyleSheet.hairlineWidth, marginVertical: 14 },
  currentAntardasha: { fontSize: 16, lineHeight: 22, marginBottom: 4 },
  currentPratyantar: { fontSize: 14, lineHeight: 20, marginBottom: 4 },

  mahaCard: {
    borderRadius: borderRadius.card,
    marginBottom: 8,
  },
  mahaRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
  },
  spine: { width: 2, alignSelf: 'stretch', borderRadius: 1 },
  mahaTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mahaLord: { fontSize: 15, lineHeight: 21 },
  mahaMeta: { fontSize: 11, marginTop: 3, letterSpacing: 0.2 },
  activeChip: { width: 8, height: 8, borderRadius: 4 },

  antarWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
  },
  antarHeader: { marginBottom: 8 },
  antarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  antarDot: { width: 6, height: 6, borderRadius: 3 },
  antarLord: { width: 84, fontSize: 13, lineHeight: 18 },
  antarRange: { flex: 1, fontSize: 11, textAlign: 'right', letterSpacing: 0.2 },

  pratyantarWrap: {
    marginLeft: 16,
    paddingLeft: 12,
    paddingTop: 6,
    paddingBottom: 8,
    borderLeftWidth: StyleSheet.hairlineWidth,
  },
  pratyantarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 3,
  },
  pratyantarDot: { width: 4, height: 4, borderRadius: 2 },
  pratyantarLord: { width: 76, fontSize: 12, lineHeight: 16 },
  pratyantarRange: { flex: 1, fontSize: 10, textAlign: 'right', letterSpacing: 0.2 },

  approxNote: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 18,
    marginBottom: spacing.cardGap,
    paddingHorizontal: 8,
  },

  systemRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 16,
  },
  systemChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: borderRadius.chip,
    borderWidth: 1,
  },
  systemChipText: { fontSize: 9 },

  yoginiSubtitle: { fontSize: 11, letterSpacing: 0.2, marginTop: 4 },
});
