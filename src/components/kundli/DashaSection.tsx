import { memo, useCallback, useMemo, useState, type ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { MotionPressable } from '@/components/common/MotionPressable';
import {
  computeVimshottariPratyantarIn,
  type AntarDasha,
  type CharaDashaResult,
  type DashaLord,
  type MahaDasha,
  type NarayanDashaResult,
  type PratyantarDasha,
  type YoginiAntarDasha,
  type YoginiDashaResult,
  type YoginiMahaDasha,
} from 'panchang-ts';

import { AppText as Text } from '@/components/common/AppText';
import { Icon } from '@/components/common/Icon';
import { SectionLabel } from '@/components/common/SectionLabel';
import { SegmentedChip } from '@/components/common/SegmentedChip';
import { DatePickerModal } from '@/components/common/DatePickerModal';
import { RemedyNudge } from './RemedyNudge';
import { getVaarDevataByGraha, type GrahaKey } from '@/config/vaarDevata';
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

// Graha-ruled mahādaśā lords → their Vaar Devata day. Rāhu/Ketu have no
// weekday, so they're absent — the daśā-lord remedy nudge simply doesn't show
// for those periods.
const DASHA_LORD_GRAHA: Partial<Record<DashaLord, GrahaKey>> = {
  Sun: 'surya',
  Moon: 'chandra',
  Mars: 'mangal',
  Mercury: 'budh',
  Jupiter: 'guru',
  Venus: 'shukra',
  Saturn: 'shani',
};

function formatRangeDate(d: Date, lang: string): string {
  return d.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
    month: 'short',
    year: 'numeric',
  });
}

// Fraction of a period elapsed at `now`, clamped to [0, 1]. Rendered as a
// static bar — dasha dates never animate (MOTION.md).
function elapsedFraction(start: Date, end: Date, now: number): number {
  const span = end.getTime() - start.getTime();
  if (span <= 0) return 0;
  return Math.max(0, Math.min(1, (now - start.getTime()) / span));
}

// The running-dasha card (frame 28) — the one warm surface on the timeline.
function CurrentCard({ colors, isDark, children }: { colors: ColorPalette; isDark: boolean; children: ReactNode }) {
  return (
    <View style={[styles.currentCard, { backgroundColor: colors.surface, borderColor: colors.borderAccent }]}>
      <LinearGradient
        colors={
          isDark
            ? (['rgba(216,163,26,0.13)', 'rgba(255,255,255,0.03)'] as const)
            : ([colors.surfaceAccent, '#FFFFFF'] as const)
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

function formatYears(years: number, t: (k: string, o?: Record<string, unknown>) => string): string {
  const rounded = Math.round(years * 10) / 10;
  const key = Math.abs(rounded - 1) < 0.05 ? 'dasha.yearsOne' : 'dasha.yearsOther';
  return t(key, { years: rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1) });
}

interface DashaSectionProps {
  /** When embedded inside the Kundli view the birth-date is owned by the
   *  Kundli details form above, so we hide this section's own birth-date
   *  header/row to avoid a duplicate editor (P16.2). */
  embedded?: boolean;
}

export function DashaSection({ embedded = false }: DashaSectionProps = {}) {
  const { t, i18n } = useTranslation();
  const lang: 'en' | 'hi' = i18n.language === 'hi' ? 'hi' : 'en';
  const isDarkMode = useStore((s) => s.isDarkMode);
  const language = useStore((s) => s.language);
  const userBirthDate = useStore((s) => s.userBirthDate);
  const userBirthTime = useStore((s) => s.userBirthTime);
  const userBirthPlace = useStore((s) => s.userBirthPlace);
  const setUserBirthDate = useStore((s) => s.setUserBirthDate);
  const ayanamsa = useStore((s) => s.ayanamsa);
  const houseSystem = useStore((s) => s.houseSystem);
  const colors = isDarkMode ? darkColors : lightColors;

  const [pickerOpen, setPickerOpen] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [openAntardashaInsideMaha, setOpenAntardashaInsideMaha] = useState<number | null>(null);
  const [system, setSystem] = useState<DashaSystem>('vimshottari');
  // Vimshottari is the canonical reading; the other four classical systems
  // stay behind an "Other systems" reveal so the default Dasha view is one
  // chip, not five (P16.1). Once a non-default system is active we keep the
  // full row shown so the active chip never vanishes.
  const [othersRevealed, setOthersRevealed] = useState(false);
  const showAllSystems = othersRevealed || system !== 'vimshottari';

  const birthDate = useMemo<Date | null>(() => {
    if (!userBirthDate) return null;
    const tz = userBirthPlace?.timezone ?? DEFAULT_BIRTH_TIMEZONE;
    // Keep value blocks (`??`) out of the try body: the React Compiler
    // refuses to memoise any component with one inside a try/catch.
    const time = userBirthTime ?? '12:00';
    try {
      return wallclockInZoneToUtc(userBirthDate, time, tz);
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
  // Render-stable timestamp: fixed at mount (dasha periods span months, so
  // intra-session drift is irrelevant) and keeps the render pure.
  const [now] = useState(() => Date.now());
  const currentMaha = dashaResult?.mahaDashas[dashaResult.currentIndex];
  const currentAntardasha =
    system === 'vimshottari'
      ? (timeline?.currentAntardasha ?? null)
      : (currentMaha?.antarDashas.find(
          (ad) => ad.startDate.getTime() <= now && ad.endDate.getTime() > now,
        ) ?? null);
  // Third-level periods are Vimshottari-only. `computeVimshottariPratyantarIn`
  // is exactly what its name says — 9 lords in Vimshottari order, sliced by
  // years-out-of-120 — so feeding it an Ashtottari antardasha invented nine
  // sub-periods in the wrong sequence, the last of them ruled by Ketu, which
  // Satya Acharya's eight-lord scheme has no such thing as.
  const currentPratyantars = useMemo(
    () => (system === 'vimshottari' ? (timeline?.currentPratyantars ?? []) : []),
    [system, timeline],
  );
  const supportsPratyantar = system === 'vimshottari';

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
        <MotionPressable
          pressedScale={0.97}
          onPress={() => setPickerOpen(true)}
          style={[styles.setBirthBtn, { backgroundColor: palette.turmeric }]}
          accessibilityRole="button"
          accessibilityLabel={t('dasha.setBirthDate')}>
          <Icon name="calendar" size={18} color={palette.night} />
          <Text variant="mono-caps" style={styles.setBirthText}>
            {t('dasha.setBirthDate')}
          </Text>
        </MotionPressable>
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
      {!embedded && (
        <>
          <SectionLabel style={styles.sectionLabelSpacing}>
            {t('dasha.birthDateLabel')}
          </SectionLabel>
          <MotionPressable
            pressedScale={0.97}
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
          </MotionPressable>
        </>
      )}

      {/* ── Dasha system selector ─────────────────────────────────────────
          Vimshottari is the headline; Ashtottari, Yogini, and Chara are
          alternate classical timings the panchang-ts library now exposes.
          Each system is computed lazily so we never pay for tabs the user
          doesn't open. */}
      <View style={styles.systemRow}>
        {(showAllSystems ? DASHA_SYSTEMS : (['vimshottari'] as DashaSystem[])).map((sys) => (
          <SegmentedChip
            key={sys}
            active={system === sys}
            onPress={() => {
              setSystem(sys);
              setExpandedIndex(null);
              setOpenAntardashaInsideMaha(null);
            }}
            inactiveBg="transparent"
            activeBg={colors.accent}
            inactiveBorder={colors.border}
            activeBorder="transparent"
            style={styles.systemChip}
            accessibilityLabel={t(`dasha.system.${sys}`)}>
            <Text
              variant="mono-caps"
              style={[
                styles.systemChipText,
                { color: system === sys ? palette.night : colors.textSecondary },
              ]}>
              {t(`dasha.system.${sys}`)}
            </Text>
          </SegmentedChip>
        ))}
        {!showAllSystems && (
          <MotionPressable
            pressedScale={0.97}
            onPress={() => setOthersRevealed(true)}
            style={[styles.systemChip, styles.otherSystemsChip, { borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel={t('dasha.otherSystems')}>
            <Text variant="mono-caps" style={[styles.systemChipText, { color: colors.textSecondary }]}>
              {t('dasha.otherSystems')}
            </Text>
            <Icon name="chevron-down" size={12} color={colors.textTertiary} />
          </MotionPressable>
        )}
      </View>

      {(system === 'vimshottari' || system === 'ashtottari') && dashaResult && (
        <>
          <View style={styles.currentWrap}>
            <CurrentCard colors={colors} isDark={isDarkMode}>
              <Text variant="kicker-small" style={[styles.currentKicker, { color: colors.accentText }]}>
                {t('dasha.currentLabel')}
              </Text>
              <Text variant="deva-bold" style={[styles.currentMahaLord, { color: colors.textPrimary }]}>
                {t(`dasha.planet.${DASHA_LORD_TO_KEY[dashaResult.currentMahaDashaLord]}`)} {t('dasha.mahadashaSuffix')}
              </Text>
              {(() => {
                const md = dashaResult.mahaDashas[dashaResult.currentIndex];
                if (!md) return null;
                const frac = elapsedFraction(md.startDate, md.endDate, now);
                return (
                  <>
                    <Text variant="mono" style={[styles.currentUntil, { color: colors.textTertiary }]}>
                      {t('dasha.dateRangeLong', {
                        start: formatRangeDate(md.startDate, i18n.language),
                        end: formatRangeDate(md.endDate, i18n.language),
                      })}{' '}
                      · {formatYears(md.years, t)}
                    </Text>
                    <View style={[styles.elapsedTrack, { backgroundColor: isDarkMode ? 'rgba(237,232,240,0.14)' : 'rgba(34,27,36,0.10)' }]}>
                      <View style={[styles.elapsedFill, { backgroundColor: colors.accent, width: `${Math.round(frac * 100)}%` }]} />
                    </View>
                  </>
                );
              })()}

              {currentAntardasha && (
                <>
                  <View style={[styles.currentDivider, { backgroundColor: colors.divider }]} />
                  <Text variant="title" style={[styles.currentAntardasha, { color: colors.textPrimary }]}>
                    {t(`dasha.planet.${DASHA_LORD_TO_KEY[currentAntardasha.lord]}`)} {t('dasha.antardashaSuffix')}
                  </Text>
                  <Text variant="mono" style={[styles.currentUntil, { color: colors.textTertiary }]}>
                    {t('dasha.untilDate', { date: formatRangeDate(currentAntardasha.endDate, i18n.language) })}
                  </Text>

                  {/* Pratyantar drilldown — third level. */}
                  {currentPratyantars.length > 0 && (
                    <CurrentPratyantarStrip
                      pratyantars={currentPratyantars}
                      colors={colors}
                      lang={i18n.language}
                      t={t}
                    />
                  )}
                </>
              )}
            </CurrentCard>
          </View>

          {/* Remedy nudge — links the running mahādaśā lord to its weekday's
              Vaar Devata. Only for graha lords (Rāhu/Ketu have no weekday), and
              only on the graha-based systems (Vimshottari / Ashtottari) — the
              Chara/Yogini/Narayan tabs run on rāśis/yoginis, not grahas. */}
          {(() => {
            const gk = DASHA_LORD_GRAHA[dashaResult.currentMahaDashaLord];
            const vaar = gk ? getVaarDevataByGraha(gk) : undefined;
            if (!vaar) return null;
            return (
              <RemedyNudge
                text={t('vaar.nudgeDashaLord', {
                  planet: t(`dasha.planet.${DASHA_LORD_TO_KEY[dashaResult.currentMahaDashaLord]}`),
                  day: vaar.dayName[lang],
                })}
                dayKey={vaar.dayKey}
                colors={colors}
                style={styles.dashaNudge}
              />
            );
          })()}

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
              isPast={activeIndex != null && i < activeIndex}
              lang={i18n.language}
              onToggle={handleMahaToggle}
              openAntardashaIndex={effectiveExpanded === i ? openAntardashaInsideMaha : null}
              onAntardashaToggle={handleAntardashaToggle}
              supportsPratyantar={supportsPratyantar}
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
          colors={colors}
          isDarkMode={isDarkMode}
          lang={i18n.language}
          t={t}
        />
      )}

      {system === 'chara' && chara && (
        <CharaTimeline
          result={chara}
          colors={colors}
          isDarkMode={isDarkMode}
          rashiNames={resolveLanguage(language) === 'hi' ? RASHI_NAMES_HI : RASHI_NAMES_EN}
          lang={i18n.language}
          t={t}
        />
      )}

      {system === 'narayan' && narayan && (
        <NarayanTimeline
          result={narayan}
          colors={colors}
          isDarkMode={isDarkMode}
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
  colors: ColorPalette;
  lang: string;
  t: (k: string, o?: Record<string, unknown>) => string;
}

const CurrentPratyantarStrip = memo(function CurrentPratyantarStrip({
  pratyantars,
  colors,
  lang,
  t,
}: CurrentPratyantarStripProps) {
  const [now] = useState(() => Date.now());
  const activePratyantara =
    pratyantars.find((p) => p.startDate.getTime() <= now && p.endDate.getTime() > now) ?? null;
  if (!activePratyantara) return null;
  return (
    <>
      <View style={[styles.currentDivider, { backgroundColor: colors.divider }]} />
      <Text variant="body" style={[styles.currentPratyantar, { color: colors.textPrimary }]}>
        {t(`dasha.planet.${DASHA_LORD_TO_KEY[activePratyantara.lord]}`)} {t('dasha.pratyantarSuffix')}
      </Text>
      <Text variant="mono" style={[styles.currentUntil, { color: colors.textTertiary }]}>
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
  /** Past dashas dim (frame 28); the future keeps near-full presence. */
  isPast: boolean;
  lang: string;
  onToggle: (index: number) => void;
  openAntardashaIndex: number | null;
  onAntardashaToggle: (idx: number) => void;
  /** False for Ashtottari — see `currentPratyantars`. */
  supportsPratyantar: boolean;
  colors: ColorPalette;
  t: (k: string, o?: Record<string, unknown>) => string;
}

const MahadashaRow = memo(function MahadashaRow({
  index,
  md,
  expanded,
  isActive,
  isPast,
  lang,
  onToggle,
  openAntardashaIndex,
  onAntardashaToggle,
  supportsPratyantar,
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
          borderColor: isActive ? colors.borderAccent : colors.border,
          borderWidth: 1,
          opacity: expanded ? 1 : isPast ? 0.5 : 1,
        },
      ]}>
      <MotionPressable
        pressedScale={0.97}
        onPress={handlePress}
        style={styles.mahaRowHeader}
        accessibilityRole="button"
        accessibilityLabel={`${lordLabel} ${t('dasha.mahadashaSuffix')}`}
        accessibilityState={{ expanded }}>
        <View style={[styles.spine, { backgroundColor: isActive ? colors.accent : colors.divider }]} />
        <View style={{ flex: 1 }}>
          <View style={styles.mahaTitleRow}>
            <Text variant="body" style={[styles.mahaLord, { color: colors.textPrimary }]}>
              {lordLabel}{' '}
              <Text variant="body" style={{ color: colors.textTertiary }}>
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
      </MotionPressable>

      {expanded && (
        <View style={[styles.antarWrap, { borderTopColor: colors.divider }]}>
          <Text variant="kicker-small" style={[styles.antarHeader, { color: colors.textMuted }]}>
            {t('dasha.antardashasHeader')}
          </Text>
          {md.antarDashas.map((ad, j) => (
            <AntardashaRow
              key={j}
              index={j}
              md={md}
              ad={ad}
              lang={lang}
              colors={colors}
              t={t}
              expanded={supportsPratyantar && openAntardashaIndex === j}
              onToggle={onAntardashaToggle}
              supportsPratyantar={supportsPratyantar}
            />
          ))}
        </View>
      )}
    </View>
  );
});

interface AntardashaRowProps {
  index: number;
  /** The antardasha's own mahadasha: the birth antardasha is clipped at birth,
   *  and only its parent says where the full span it was cut from began. */
  md: MahaDasha;
  ad: AntarDasha;
  lang: string;
  colors: ColorPalette;
  t: (k: string, o?: Record<string, unknown>) => string;
  expanded: boolean;
  onToggle: (index: number) => void;
  /** False for Ashtottari — see `currentPratyantars`. The row then has no
   *  drilldown at all, so it renders as a plain non-pressable row: no chevron,
   *  no press feedback, no expanded state. */
  supportsPratyantar: boolean;
}

const AntardashaRow = memo(function AntardashaRow({
  index,
  md,
  ad,
  lang,
  colors,
  t,
  expanded,
  onToggle,
  supportsPratyantar,
}: AntardashaRowProps) {
  // Render-stable timestamp, as in the sections above: fixed at mount (an
  // antardasha spans months, so intra-session drift is irrelevant) and keeps
  // the render pure.
  const [now] = useState(() => Date.now());
  const adActive = ad.startDate.getTime() <= now && ad.endDate.getTime() > now;
  // Pratyantars are computed lazily on expand to avoid 9×9×9 work for the
  // full 120-year cycle. Memo per-row keeps re-renders cheap.
  const pratyantars = useMemo(
    () => (expanded && supportsPratyantar ? computeVimshottariPratyantarIn(md, ad) : []),
    [expanded, supportsPratyantar, md, ad],
  );
  const handlePress = useCallback(() => onToggle(index), [onToggle, index]);

  const rowContent = (
    <>
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
    </>
  );

  return (
    <View>
      {supportsPratyantar ? (
        <MotionPressable
          pressedScale={0.97}
          onPress={handlePress}
          style={styles.antarRow}
          accessibilityRole="button"
          accessibilityState={{ expanded }}>
          {rowContent}
          <Icon
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={12}
            color={colors.textMuted}
          />
        </MotionPressable>
      ) : (
        // Ashtottari rows have no third level to open, so they must not be a
        // MotionPressable at all: it wires onPressIn/onPressOut regardless of
        // whether `onPress` is set, so the row would still shrink under the
        // finger — a press affordance for a drilldown that cannot exist.
        <View style={styles.antarRow} accessible>{rowContent}</View>
      )}

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

/**
 * Index of the mahadasha actually containing `nowMs`, or -1.
 *
 * The library clamps its own "not found" to 0 (`Math.max(0, findIndex(...))`),
 * which is harmless for Vimshottari — 120 years always covers a lifetime — but
 * wrong for Yogini (one 36-year cycle) and for Chara / Narayan (96 years from
 * an arbitrary pre-1900 birth date). Past the end of the array the clamp made
 * the FIRST period the "CURRENT" one — for a 1985 birth, whose single 36-year
 * Yogini cycle closed in 2020, the card claimed the Ulka mahadasha with an
 * "until" date of June 1990. Resolve it from the dates instead. Yogini feeds
 * this its *projected* cycle (see `currentYoginiCycle`) so it always lands on
 * a real period; Chara / Narayan simply run out of list past ~96 years, and
 * then render no current card rather than a false one.
 */
function activeMahaIndex(
  mahaDashas: readonly { startDate: Date; endDate: Date }[],
  nowMs: number,
): number {
  return mahaDashas.findIndex(
    (md) => md.startDate.getTime() <= nowMs && md.endDate.getTime() > nowMs,
  );
}

/** The Yogini wheel is a fixed 36 years: 1+2+3+4+5+6+7+8. */
const YOGINI_CYCLE_YEARS = 36;

/**
 * The eight Yogini periods covering `nowMs`.
 *
 * `computeYoginiDasha` only ever returns the FIRST cycle — eight periods from
 * birth, the first of them the balance of the janma yogini — and `asOfDate`
 * merely picks an index inside that list, it does not advance it. So past
 * ~36 years of age the returned list has already run out and there is no
 * period containing today at all.
 *
 * The wheel repeats unchanged, though: after the eighth period the same eight
 * yoginis come round again in the same order, each now at its full nominal
 * length, 36 years end to end. So walk the returned cycle forward by whole
 * cycles until it contains `nowMs`, rebuilding each mahadasha's antardashas
 * the way the library does — a years/36 slice apiece, starting from the
 * mahadasha's own yogini. Everything is derived from the returned list, so the
 * projection inherits the library's own year length and rotation.
 *
 * Returned untouched while the user is still inside the first cycle.
 */
function currentYoginiCycle(mahaDashas: YoginiMahaDasha[], nowMs: number): YoginiMahaDasha[] {
  const last = mahaDashas[mahaDashas.length - 1];
  if (!last || nowMs < last.endDate.getTime()) return mahaDashas;

  const cycleEndMs = last.endDate.getTime();
  // The library's nominal year, read back off a full period rather than
  // guessed. (Only the first period is a partial, so the last is always full.)
  const lastSpanMs = cycleEndMs - last.startDate.getTime();
  if (lastSpanMs <= 0 || last.years <= 0) return mahaDashas;
  const msPerYear = lastSpanMs / last.years;
  const cycleMs = YOGINI_CYCLE_YEARS * msPerYear;
  const cyclesAhead = Math.floor((nowMs - cycleEndMs) / cycleMs) + 1;

  const out: YoginiMahaDasha[] = [];
  let cursor = cycleEndMs + (cyclesAhead - 1) * cycleMs;
  for (let i = 0; i < mahaDashas.length; i++) {
    const md = mahaDashas[i];
    const spanMs = md.years * msPerYear;
    const startMs = cursor;
    cursor += spanMs;
    const antarDashas: YoginiAntarDasha[] = [];
    let antarCursor = startMs;
    for (let k = 0; k < mahaDashas.length; k++) {
      const src = mahaDashas[(i + k) % mahaDashas.length];
      const antarStartMs = antarCursor;
      antarCursor += (src.years / YOGINI_CYCLE_YEARS) * spanMs;
      antarDashas.push({
        yogini: src.yogini,
        lord: src.lord,
        startDate: new Date(antarStartMs),
        endDate: new Date(antarCursor),
      });
    }
    out.push({
      yogini: md.yogini,
      lord: md.lord,
      startDate: new Date(startMs),
      endDate: new Date(cursor),
      years: md.years,
      antarDashas,
    });
  }
  return out;
}

interface YoginiTimelineProps {
  result: YoginiDashaResult;
  colors: ColorPalette;
  isDarkMode: boolean;
  lang: string;
  t: (k: string, o?: Record<string, unknown>) => string;
}

function YoginiTimeline({ result, colors, isDarkMode, lang, t }: YoginiTimelineProps) {
  // Render-stable timestamp, same as `CharaTimeline` / `NarayanTimeline`: fixed
  // at mount (Yogini periods run for years, so intra-session drift is
  // irrelevant) and keeps the render pure, so the compiler doesn't bail out.
  const [now] = useState(() => Date.now());
  // The 36-year wheel the user is living in — the library's own first cycle
  // until they turn ~36, a projected repeat of it after that. Memoised because
  // it rebuilds the whole cycle: without this the fresh array identity defeats
  // every `YoginiRow` memo() below.
  const mahaDashas = useMemo(() => currentYoginiCycle(result.mahaDashas, now), [result.mahaDashas, now]);
  const activeIdx = activeMahaIndex(mahaDashas, now);
  const currentMaha = activeIdx >= 0 ? mahaDashas[activeIdx] : null;
  const currentAntar =
    currentMaha?.antarDashas.find(
      (ad) => ad.startDate.getTime() <= now && ad.endDate.getTime() > now,
    ) ?? null;
  return (
    <>
      {currentMaha && (
        <View style={styles.currentWrap}>
          <CurrentCard colors={colors} isDark={isDarkMode}>
            <Text variant="kicker-small" style={[styles.currentKicker, { color: colors.accentText }]}>
              {t('dasha.currentLabel')}
            </Text>
            <Text variant="deva-bold" style={[styles.currentMahaLord, { color: colors.textPrimary }]}>
              {t(`dasha.yoginiName.${currentMaha.yogini.toLowerCase()}`)} {t('dasha.mahadashaSuffix')}
            </Text>
            <Text variant="mono" style={[styles.yoginiSubtitle, { color: colors.textTertiary }]}>
              {t(`dasha.planet.${DASHA_LORD_TO_KEY[currentMaha.lord]}`)}
            </Text>
            <Text variant="mono" style={[styles.currentUntil, { color: colors.textTertiary }]}>
              {t('dasha.untilDate', { date: formatRangeDate(currentMaha.endDate, lang) })}
            </Text>
            {currentAntar && (
              <>
                <View style={[styles.currentDivider, { backgroundColor: colors.divider }]} />
                <Text variant="title" style={[styles.currentAntardasha, { color: colors.textPrimary }]}>
                  {t(`dasha.yoginiName.${currentAntar.yogini.toLowerCase()}`)} {t('dasha.antardashaSuffix')}
                </Text>
                <Text variant="mono" style={[styles.currentUntil, { color: colors.textTertiary }]}>
                  {t('dasha.untilDate', { date: formatRangeDate(currentAntar.endDate, lang) })}
                </Text>
              </>
            )}
          </CurrentCard>
        </View>
      )}

      <SectionLabel style={styles.sectionLabelSpacing}>
        {t('dasha.yoginiFullCycle')}
      </SectionLabel>
      {mahaDashas.map((md, i) => (
        <YoginiRow
          key={i}
          md={md}
          isActive={i === activeIdx}
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
        <View style={[styles.spine, { backgroundColor: isActive ? colors.accent : colors.divider }]} />
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
  colors: ColorPalette;
  isDarkMode: boolean;
  rashiNames: string[];
  lang: string;
  t: (k: string, o?: Record<string, unknown>) => string;
}

function CharaTimeline({ result, colors, isDarkMode, rashiNames, lang, t }: CharaTimelineProps) {
  // Render-stable timestamp, same as `DashaSection`: fixed at mount (Chara
  // periods run for years, so intra-session drift is irrelevant) and keeps the
  // render pure, so the compiler doesn't bail out of this component.
  const [now] = useState(() => Date.now());
  const activeIdx = activeMahaIndex(result.mahaDashas, now);
  const currentMaha = activeIdx >= 0 ? result.mahaDashas[activeIdx] : null;
  return (
    <>
      {currentMaha && (
        <View style={styles.currentWrap}>
          <CurrentCard colors={colors} isDark={isDarkMode}>
            <Text variant="kicker-small" style={[styles.currentKicker, { color: colors.accentText }]}>
              {t('dasha.currentLabel')}
            </Text>
            <Text variant="deva-bold" style={[styles.currentMahaLord, { color: colors.textPrimary }]}>
              {rashiNames[currentMaha.rashi]} {t('dasha.mahadashaSuffix')}
            </Text>
            <Text variant="mono" style={[styles.yoginiSubtitle, { color: colors.textTertiary }]}>
              {t(`dasha.planet.${DASHA_LORD_TO_KEY[currentMaha.lord]}`)}
            </Text>
            <Text variant="mono" style={[styles.currentUntil, { color: colors.textTertiary }]}>
              {t('dasha.untilDate', { date: formatRangeDate(currentMaha.endDate, lang) })}
            </Text>
          </CurrentCard>
        </View>
      )}

      <SectionLabel style={styles.sectionLabelSpacing}>
        {t('dasha.charaFullCycle')}
      </SectionLabel>
      {result.mahaDashas.map((md, i) => {
        const isActive = i === activeIdx;
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
              <View style={[styles.spine, { backgroundColor: isActive ? colors.accent : colors.divider }]} />
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
  colors: ColorPalette;
  isDarkMode: boolean;
  rashiNames: string[];
  lang: string;
  t: (k: string, o?: Record<string, unknown>) => string;
}

function NarayanTimeline({ result, colors, isDarkMode, rashiNames, lang, t }: NarayanTimelineProps) {
  // Render-stable timestamp, same as `DashaSection`: fixed at mount (Narayan
  // periods run for years, so intra-session drift is irrelevant) and keeps the
  // render pure, so the compiler doesn't bail out of this component.
  const [now] = useState(() => Date.now());
  const activeIdx = activeMahaIndex(result.mahaDashas, now);
  const currentMaha = activeIdx >= 0 ? result.mahaDashas[activeIdx] : null;
  const directionLabel =
    result.direction === 'forward'
      ? t('dasha.narayan.directionForward')
      : t('dasha.narayan.directionBackward');
  return (
    <>
      {currentMaha && (
        <View style={styles.currentWrap}>
          <CurrentCard colors={colors} isDark={isDarkMode}>
            <Text variant="kicker-small" style={[styles.currentKicker, { color: colors.accentText }]}>
              {t('dasha.currentLabel')}
            </Text>
            <Text variant="deva-bold" style={[styles.currentMahaLord, { color: colors.textPrimary }]}>
              {rashiNames[currentMaha.rashi]} {t('dasha.mahadashaSuffix')}
            </Text>
            <Text variant="mono" style={[styles.yoginiSubtitle, { color: colors.textTertiary }]}>
              {t(`dasha.planet.${DASHA_LORD_TO_KEY[currentMaha.lord]}`)} · {directionLabel}
            </Text>
            <Text variant="mono" style={[styles.currentUntil, { color: colors.textTertiary }]}>
              {t('dasha.untilDate', { date: formatRangeDate(currentMaha.endDate, lang) })}
            </Text>
          </CurrentCard>
        </View>
      )}

      <SectionLabel style={styles.sectionLabelSpacing}>
        {t('dasha.narayanFullCycle')}
      </SectionLabel>
      {result.mahaDashas.map((md, i) => {
        const isActive = i === activeIdx;
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
              <View style={[styles.spine, { backgroundColor: isActive ? colors.accent : colors.divider }]} />
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
  setBirthText: { color: palette.night, fontSize: 11 },

  prompt: { fontSize: 14, lineHeight: 22, textAlign: 'center', marginTop: 24 },

  currentWrap: { marginTop: 24 },
  currentCard: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    padding: 20,
    overflow: 'hidden',
  },
  currentKicker: { fontSize: 9.5 },
  dashaNudge: { marginTop: 14 },
  currentMahaLord: { fontSize: 24, lineHeight: 34, marginTop: 8, marginBottom: 4 },
  currentUntil: { fontSize: 11.5, letterSpacing: 0.2 },
  elapsedTrack: { height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 12 },
  elapsedFill: { height: '100%', borderRadius: 4 },
  currentDivider: { height: StyleSheet.hairlineWidth, marginVertical: 14 },
  currentAntardasha: { fontSize: 15.5, lineHeight: 21, marginBottom: 4 },
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
  otherSystemsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  systemChipText: { fontSize: 9 },

  yoginiSubtitle: { fontSize: 11, letterSpacing: 0.2, marginTop: 4 },
});
