import { useState, useCallback, useEffect, useRef, useMemo, memo } from 'react';
import { router, useFocusEffect } from 'expo-router';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/common/Icon';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { useLocaleFormatters } from '@/utils/format';
import {
  darkColors,
  lightColors,
  palette,
  semanticColors,
  borderRadius,
  spacing,
  type ColorPalette,
} from '@/config/theme';
import { usePanchang } from '@/hooks/usePanchang';
import { computeJanmaNakshatraIndex, computeJanmaRashiIndex, fetchInstantPanchang } from '@/services/astrology/panchangService';
import { DEFAULT_BIRTH_TIMEZONE, wallclockInZoneToUtc } from '@/utils/time';
import { resolveLanguage } from '@/i18n';
import {
  localizeChandraMasa,
  localizeNakshatra,
  localizeRashi,
  localizeTithi,
  localizeYoga,
} from '@/i18n/panchangNames';
import { PanchangSkeleton, SkeletonCrossfade } from '@/components/common/SkeletonLoader';
import { ScreenMount } from '@/components/common/ScreenMount';
import { AdBanner } from '@/components/common/AdBanner';
import { WalkthroughSpotlight, type SpotlightRect } from '@/components/common/WalkthroughOverlay';
import { SectionLabel } from '@/components/common/SectionLabel';
import { Ornament } from '@/components/common/Ornament';
import { WheelDatePickerModal } from '@/components/common/WheelDatePickerModal';
import { QualitySlotsCard } from '@/components/panchang/QualitySlotsCard';
import { HoraCard } from '@/components/panchang/HoraCard';
import { PlanetaryPositionsCard } from '@/components/panchang/PlanetaryPositionsCard';
import { getFestivalDaysInMonth } from '@/services/astrology/calendarMonth';
import type { IInstantPanchang, IPanchangElement } from '@/types';

// Auspicious-yoga banner accent. Mid-green chosen to clear ~4.5:1 on both
// parchment (#F4E9CE) and nightPlinthDeep (#1A1008) so the banner reads
// editorial-green in both themes without a per-theme swap.
const AUSPICIOUS_GREEN = '#5DA85D';

// ─── Calendar helpers ─────────────────────────────────────────────────────────

function buildCalendarCells(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  // Leading overflow from previous month
  const prevDays = new Date(year, month, 0).getDate();
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push(new Date(year, month - 1, prevDays - i));
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(year, month, d));
  }
  // Trailing overflow to fill a 42-cell grid (6 rows × 7 cols)
  while (cells.length < 42) {
    const offset = cells.length - (firstDay + daysInMonth) + 1;
    cells.push(new Date(year, month + 1, offset));
  }
  return cells;
}

function isSameDay(a: Date, b: Date) {
  return a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear();
}

function isSameMonth(a: Date, b: Date) {
  return a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface LimbRowProps {
  label: string;
  elements: IPanchangElement[];
  colors: ColorPalette;
  isLast?: boolean;
  isToday?: boolean;
}

function parseTimeToMinutes(timeStr: string): number | null {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const ampm = match[3].toUpperCase();
  if (ampm === 'AM' && h === 12) h = 0;
  if (ampm === 'PM' && h !== 12) h += 12;
  return h * 60 + m;
}

function getActiveIndex(elements: IPanchangElement[]): number {
  if (elements.length <= 1) return 0;
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (!el.endTime) return i;
    const endMin = parseTimeToMinutes(el.endTime);
    if (endMin !== null && nowMinutes < endMin) return i;
  }
  return elements.length - 1;
}

const LimbRow = memo(function LimbRow({ label, elements, colors, isLast, isToday }: LimbRowProps) {
  const { t } = useTranslation();
  const activeIdx = isToday ? getActiveIndex(elements) : -1;
  const showSunriseDot = elements.length > 1 && elements.some(el => el.isActiveAtSunrise);
  return (
    <>
      <View style={styles.limbRow}>
        <Text style={[styles.limbLabel, { color: colors.accent }]}>{label}</Text>
        {elements.map((el, i) => {
          const isActive = i === activeIdx;
          // Pada is appended only when the lib didn't already encode it in the name.
          const padaSuffix = el.pada !== undefined ? ` · ${t('panchang.pada', { number: el.pada })}` : '';
          const completion = el.completionPercentage;
          const showProgress = typeof completion === 'number' && completion > 0 && completion < 1 && el.endTime;
          return (
            <View
              key={i}
              style={[
                styles.limbElement,
                i > 0 && styles.limbSecondary,
                isActive && { backgroundColor: colors.accent + '18', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginHorizontal: -10 },
              ]}>
              <View style={styles.limbNameRow}>
                <View style={styles.limbNameLeft}>
                  <Text style={[styles.limbValue, { color: colors.textPrimary }]}>
                    {el.name}{padaSuffix}
                  </Text>
                  {el.endTime && (
                    <Text style={[styles.limbEndTime, { color: colors.textMuted }]}>{t('home.untilTime', { time: el.endTime })}</Text>
                  )}
                </View>
                {showSunriseDot && el.isActiveAtSunrise && !isActive && (
                  <View style={[styles.limbSunriseChip, { borderColor: colors.accent }]}>
                    <Text style={[styles.limbSunriseChipText, { color: colors.accent }]}>{t('panchang.atSunrise')}</Text>
                  </View>
                )}
                {isActive && (
                  <View style={[styles.limbActiveBadge, { backgroundColor: colors.accent }]}>
                    <Text style={[styles.limbActiveText, { color: colors.base }]}>{t('panchang.activeNow')}</Text>
                  </View>
                )}
              </View>
              {showProgress && (
                <View style={[styles.limbProgressTrack, { backgroundColor: colors.divider }]}>
                  <View
                    style={[
                      styles.limbProgressFill,
                      { width: `${Math.round(completion * 100)}%`, backgroundColor: colors.accent + 'AA' },
                    ]}
                  />
                </View>
              )}
            </View>
          );
        })}
      </View>
      {!isLast && <View style={[styles.limbDivider, { backgroundColor: colors.divider }]} />}
    </>
  );
});

interface SunCardProps {
  icon: IconName;
  label: string;
  time: string;
  colors: ColorPalette;
  iconColor: string;
}

const SunCard = memo(function SunCard({ icon, label, time, colors, iconColor }: SunCardProps) {
  return (
    <View style={[styles.sunCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Icon name={icon} size={22} color={iconColor} />
      <Text style={[styles.sunCardLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.sunCardTime, { color: colors.textPrimary }]}>{time}</Text>
    </View>
  );
});

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PanchangScreen() {
  const { t } = useTranslation();
  const isDarkMode = useStore(s => s.isDarkMode);
  const userLocation = useStore(s => s.userLocation);
  const locationName = useStore(s => s.locationName);
  const language = useStore(s => s.language);
  const masaSystem = useStore(s => s.masaSystem);
  const setMasaSystem = useStore(s => s.setMasaSystem);
  const region = useStore(s => s.region);
  const ayanamsa = useStore(s => s.ayanamsa);
  const userBirthDate = useStore(s => s.userBirthDate);
  const userBirthTime = useStore(s => s.userBirthTime);
  const userBirthPlace = useStore(s => s.userBirthPlace);
  const showVikramSamvat = useStore(s => s.showVikramSamvat);
  const walkthroughStep = useStore(s => s.walkthroughStep);
  const setWalkthroughStep = useStore(s => s.setWalkthroughStep);
  const { digits } = useLocaleFormatters();
  const colors = isDarkMode ? darkColors : lightColors;

  const today = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [calMonth, setCalMonth] = useState<Date>(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  const panchangLang = resolveLanguage(language);
  const birthMoment = useMemo<Date | null>(() => {
    if (!userBirthDate) return null;
    const tz = userBirthPlace?.timezone ?? DEFAULT_BIRTH_TIMEZONE;
    try {
      return wallclockInZoneToUtc(userBirthDate, userBirthTime ?? '12:00', tz);
    } catch {
      return null;
    }
  }, [userBirthDate, userBirthTime, userBirthPlace]);
  const janmaNakshatra = useMemo<number | undefined>(() => {
    if (!birthMoment) return undefined;
    try { return computeJanmaNakshatraIndex(birthMoment); } catch { return undefined; }
  }, [birthMoment]);
  const janmaRashi = useMemo<number | undefined>(() => {
    if (!birthMoment) return undefined;
    try { return computeJanmaRashiIndex(birthMoment); } catch { return undefined; }
  }, [birthMoment]);
  const { panchang, loading, error, retry } = usePanchang(selectedDate, userLocation, panchangLang, region, janmaNakshatra, janmaRashi, ayanamsa);

  // ── Instant snapshot — only relevant when viewing today ─────────────────
  const [instant, setInstant] = useState<IInstantPanchang | null>(null);
  const isViewingToday = isSameDay(selectedDate, today);
  useEffect(() => {
    if (!isViewingToday) {
      setInstant(null);
      return;
    }
    const coords = userLocation ?? { lat: 25.3176, lon: 83.0103 };
    setInstant(fetchInstantPanchang(new Date(), coords, panchangLang, ayanamsa));
    const id = setInterval(() => {
      setInstant(fetchInstantPanchang(new Date(), coords, panchangLang, ayanamsa));
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [isViewingToday, userLocation, panchangLang, ayanamsa]);

  // Calendar cells + per-day tithi/festival data for the visible month.
  const calYear = calMonth.getFullYear();
  const calMonthIdx = calMonth.getMonth();
  const cells = useMemo(
    () => buildCalendarCells(calYear, calMonthIdx),
    [calYear, calMonthIdx],
  );
  const festivalDays = useMemo(
    () => getFestivalDaysInMonth(calYear, calMonthIdx),
    [calYear, calMonthIdx],
  );

  // Walkthrough ref & measurement
  const panchaAngaRef = useRef<View>(null);
  const [panchaAngaRect, setPanchaAngaRect] = useState<SpotlightRect | null>(null);

  const measurePanchaAnga = useCallback(() => {
    panchaAngaRef.current?.measureInWindow((x, y, width, height) => {
      if (width > 0) {
        setPanchaAngaRect({ x, y, width, height: Math.min(height, 320) });
      }
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (walkthroughStep === 2) {
        const timer = setTimeout(measurePanchaAnga, 300);
        return () => clearTimeout(timer);
      }
    }, [walkthroughStep, measurePanchaAnga])
  );

  const goPrevMonth = useCallback(() => {
    setCalMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  }, []);
  const goNextMonth = useCallback(() => {
    setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  }, []);
  const goToday = useCallback(() => {
    const now = new Date();
    setCalMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(now);
  }, []);

  const handlePickDay = useCallback((d: Date) => {
    setSelectedDate(d);
    if (!isSameMonth(d, calMonth)) {
      setCalMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  }, [calMonth]);

  const handlePickFromModal = useCallback((d: Date) => {
    setSelectedDate(d);
    setCalMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  }, []);

  const monthNames = t('panchang.monthNames', { returnObjects: true }) as string[];
  const dayHeaders = t('panchang.dayHeaders', { returnObjects: true }) as string[];

  const selectedGregorian = selectedDate.toLocaleDateString(
    panchangLang === 'hi' ? 'hi-IN' : 'en-IN',
    { weekday: 'short', day: 'numeric', month: 'short' },
  );

  return (
    <ScreenMount>
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top']}>

      {/* ── Editorial Header ──────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingHorizontal: spacing.screenH }]}>
        <View style={styles.headerSide} />
        <View style={styles.headerCenter}>
          <Text variant="display-italic" style={[styles.headerTitle, { color: colors.textPrimary }]}>
            {t('panchang.headerTitle')}
          </Text>
        </View>
        <View style={[styles.headerSide, styles.headerSideRight]}>
          <View style={[styles.locPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Icon name="location" size={10} color={colors.accent} />
            <Text variant="mono-caps" style={[styles.locText, { color: colors.textTertiary }]} numberOfLines={1}>
              {locationName ?? (userLocation ? t('common.gpsLabel') : t('common.locationDefault'))}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
        showsVerticalScrollIndicator={false}>

        {/* ── Month strip ──────────────────────────────────────────────────── */}
        <View style={styles.monthStrip}>
          <TouchableOpacity
            onPress={goPrevMonth}
            hitSlop={12}
            style={styles.monthBtn}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.previousMonth')}>
            <Icon name="chevron-left" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setPickerOpen(true)}
            activeOpacity={0.7}
            hitSlop={8}
            style={styles.monthLabelRow}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.openDatePicker')}>
            <Text variant="display-italic" style={[styles.monthName, { color: colors.textPrimary }]}>
              {monthNames[calMonthIdx]}
            </Text>
            <Text variant="mono" style={[styles.monthYear, { color: colors.textTertiary }]}>
              {calYear}
            </Text>
            <View style={styles.monthCaret}>
              <Icon name="chevron-down" size={11} color={palette.gold} />
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={goNextMonth}
            hitSlop={12}
            style={styles.monthBtn}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.nextMonth')}>
            <Icon name="chevron-right" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {!isViewingToday && (
          <View style={styles.todayRow}>
            <TouchableOpacity
              onPress={goToday}
              activeOpacity={0.7}
              style={[styles.todayChip, { borderColor: colors.accent }]}
              accessibilityRole="button"
              accessibilityLabel={t('a11y.today')}>
              <Icon name="return-back" size={12} color={colors.accent} />
              <Text variant="mono-caps" style={[styles.todayChipText, { color: colors.accent }]}>
                {t('panchang.todayChip')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Day-of-week headers ──────────────────────────────────────────── */}
        <View style={styles.calHeaderRow}>
          {dayHeaders.map((d, i) => (
            <Text
              key={i}
              variant="mono-caps"
              style={[styles.calDayHeader, { color: colors.textMuted }]}>
              {d}
            </Text>
          ))}
        </View>

        {/* ── Calendar grid ────────────────────────────────────────────────── */}
        <View style={styles.calGrid}>
          {cells.map((cellDate, idx) => {
            if (!cellDate) return <View key={`blank-${idx}`} style={styles.calCell} />;
            const inCurrentMonth = cellDate.getMonth() === calMonthIdx;
            const isTodayCell = isSameDay(cellDate, today);
            const isSelected = isSameDay(cellDate, selectedDate);
            const hasFestival = inCurrentMonth && festivalDays.has(cellDate.getDate());

            const baseNumColor = isSelected
              ? palette.parchmentBright
              : !inCurrentMonth
                ? colors.textDisabled
                : hasFestival
                  ? colors.accent
                  : colors.textPrimary;

            return (
              <TouchableOpacity
                key={idx}
                activeOpacity={0.7}
                onPress={() => handlePickDay(cellDate)}
                style={styles.calCell}
                accessibilityRole="button"
                accessibilityLabel={cellDate.toDateString()}
                accessibilityState={{ selected: isSelected }}>

                <View
                  style={[
                    styles.calCellInner,
                    isSelected && { backgroundColor: palette.sindoor },
                    !isSelected && isTodayCell && { borderColor: colors.accent, borderWidth: 1 },
                  ]}>
                  <Text style={[styles.calDayNum, { color: baseNumColor }]}>
                    {cellDate.getDate()}
                  </Text>
                  {hasFestival && !isSelected && (
                    <View style={[styles.festivalDot, { backgroundColor: colors.accent }]} />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <Ornament variant="double-rule" style={styles.postCalRule} />

        {/* ── Selected-day line ────────────────────────────────────────────── */}
        <View style={styles.selectedLine}>
          <Text variant="mono-caps" style={[styles.selectedKicker, { color: colors.accent }]}>
            {isViewingToday ? t('panchang.todayChip') : selectedGregorian}
          </Text>
          {panchang?.vikramSamvat && showVikramSamvat && (
            <Text variant="body-italic" style={[styles.selectedSamvat, { color: colors.textTertiary }]}>
              {t('panchang.vsSamvat', { year: digits(String(panchang.vikramSamvat)) })}
            </Text>
          )}
        </View>

        <SkeletonCrossfade
          ready={!loading}
          skeleton={<PanchangSkeleton colors={colors} />}>
          {error ? (
          <View style={styles.errorContainer}>
            <View style={[styles.errorIconCircle, { backgroundColor: colors.surfaceRecessed }]}>
              <Icon name="alert-circle" size={28} color={semanticColors.error} />
            </View>
            <Text style={[styles.errorTitle, { color: colors.textPrimary }]}>{t('panchang.calculationFailed')}</Text>
            <Text style={[styles.errorDesc, { color: colors.textTertiary }]}>
              {t('panchang.calculationFailedDesc')}
            </Text>
            <TouchableOpacity
              onPress={retry}
              style={[styles.retryBtn, { backgroundColor: colors.accent }]}
              accessibilityRole="button"
              accessibilityLabel={t('common.retry')}>
              <Text style={[styles.retryText, { color: colors.base }]}>{t('common.retry')}</Text>
            </TouchableOpacity>
            <Text style={[styles.fallbackNote, { color: colors.textMuted }]}>
              {t('panchang.fallbackNote')}
            </Text>
          </View>
        ) : panchang ? (
          <>
            {/* ── Muhurat finder entry ── */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.push('/muhurat')}
              style={[styles.muhuratEntry, { backgroundColor: colors.surface, borderColor: colors.borderAccent }]}
              accessibilityRole="button"
              accessibilityLabel={t('a11y.openMuhuratFinder')}>
              <Icon name="calendar" size={16} color={colors.accent} />
              <Text style={[styles.muhuratEntryText, { color: colors.accent }]}>
                {t('panchang.findAuspiciousDate')}
              </Text>
              <Icon name="chevron-right" size={14} color={colors.accent} />
            </TouchableOpacity>

            {/* ── Banners (festivals, adhika masa, special yogas, panchaka) ── */}
            {/* Tinted-semantic alerts compose on both parchment + nightPlinth grounds. */}
            {panchang.festivals.length > 0 && panchang.festivals.map((f, i) => (
              <View key={i} style={[styles.panchakaBar, { backgroundColor: palette.goldLeaf + '1E', borderColor: palette.goldLeaf + '66' }]}>
                <Icon name="star" size={14} color={palette.goldLeaf} />
                <Text style={[styles.panchakaText, { color: palette.goldLeaf }]}>
                  {f.description ?? f.name}
                </Text>
              </View>
            ))}
            {panchang.isAdhikaMasa && (
              <View style={[styles.panchakaBar, { backgroundColor: palette.goldLeaf + '1E', borderColor: palette.goldLeaf + '66' }]}>
                <Icon name="sparkles" size={14} color={palette.goldLeaf} />
                <Text style={[styles.panchakaText, { color: palette.goldLeaf }]}>{t('panchang.adhikaMasa')}</Text>
              </View>
            )}
            {/* AT THIS MOMENT — only on today */}
            {isViewingToday && instant && (
              <View style={[styles.instantRow, { borderColor: colors.divider }]}>
                <Text variant="mono-caps" style={[styles.instantKicker, { color: colors.accent }]}>
                  {t('panchang.atThisMoment')}
                </Text>
                <Text variant="body-italic" style={[styles.instantBody, { color: colors.textSecondary }]}>
                  {`${localizeTithi(instant.tithi, panchangLang)} · ${localizeNakshatra(instant.nakshatra, panchangLang)} · ${localizeYoga(instant.yoga, panchangLang)}`}
                </Text>
              </View>
            )}
            {panchang.specialYogas.length > 0 && panchang.specialYogas.map((y, i) => (
              <View key={i} style={[styles.panchakaBar, { backgroundColor: AUSPICIOUS_GREEN + '1E', borderColor: AUSPICIOUS_GREEN + '66' }]}>
                <Icon name="sparkles" size={14} color={AUSPICIOUS_GREEN} />
                <Text style={[styles.panchakaText, { color: AUSPICIOUS_GREEN }]}>{localizeYoga(y.name, panchangLang)}</Text>
              </View>
            ))}
            {panchang.panchaka && (
              <View style={[styles.panchakaBar, { backgroundColor: palette.sindoorWarm + '1E', borderColor: palette.sindoorWarm + '66' }]}>
                <Icon name="alert-circle" size={15} color={palette.sindoorWarm} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.panchakaText, { color: palette.sindoorWarm }]}>{t('panchang.panchaka')}</Text>
                  {panchang.panchakaRahita.length > 0 && (
                    <Text style={[styles.bhadraNote, { color: palette.sindoorWarm }]}>
                      {t('panchang.panchakaRahita', {
                        start: panchang.panchakaRahita[0].start,
                        end: panchang.panchakaRahita[0].end,
                      })}
                    </Text>
                  )}
                </View>
              </View>
            )}
            {panchang.gandaMula && (
              <View
                style={[
                  styles.panchakaBar,
                  panchang.gandaMula.severity === 'severe'
                    ? { backgroundColor: semanticColors.error + '1E', borderColor: semanticColors.error + '66' }
                    : { backgroundColor: palette.sindoorWarm + '1E', borderColor: palette.sindoorWarm + '66' },
                ]}>
                <Icon
                  name="alert-circle"
                  size={15}
                  color={panchang.gandaMula.severity === 'severe' ? semanticColors.error : palette.sindoorWarm}
                />
                <Text
                  style={[
                    styles.panchakaText,
                    { color: panchang.gandaMula.severity === 'severe' ? semanticColors.error : palette.sindoorWarm },
                  ]}>
                  {t(
                    panchang.gandaMula.severity === 'severe'
                      ? 'panchang.gandaMulaSevere'
                      : 'panchang.gandaMulaMild',
                    { nakshatra: panchang.gandaMula.nakshatraName },
                  )}
                </Text>
              </View>
            )}

            {/* ── Pancha Anga card ── */}
            <View
              ref={panchaAngaRef}
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <LimbRow label={t('panchang.tithiLunarDay')} elements={panchang.tithis} colors={colors} isToday={isViewingToday} />
              <LimbRow label={t('panchang.nakshatraLunarMansion')} elements={panchang.nakshatras} colors={colors} isToday={isViewingToday} />
              <LimbRow label={t('panchang.yogaSunMoon')} elements={panchang.yogas} colors={colors} isToday={isViewingToday} />
              <LimbRow label={t('home.karana')} elements={panchang.karanas} colors={colors} isToday={isViewingToday} />
              <LimbRow
                label={t('panchang.varaDayOfWeek')}
                elements={[{ name: panchang.vara ?? selectedDate.toLocaleDateString(panchangLang === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'long' }) }]}
                colors={colors}
              />
              {panchang.anandadiYoga && (
                <LimbRow label={t('panchang.anandadiYoga')} elements={[{ name: panchang.anandadiYoga.name }]} colors={colors} />
              )}
              {panchang.tarabala && (
                <LimbRow
                  label={t('panchang.tarabala')}
                  elements={[{ name: panchang.tarabala.name }]}
                  colors={colors}
                />
              )}
              {panchang.chandraBalam && (
                <LimbRow
                  label={t('panchang.chandraBalam')}
                  elements={[{ name: panchang.chandraBalam.name }]}
                  colors={colors}
                />
              )}
              {panchang.chandraRashi && (
                <LimbRow label={t('panchang.chandraRashi')} elements={[{ name: localizeRashi(panchang.chandraRashi, panchangLang) }]} colors={colors} />
              )}
              {panchang.suryaNakshatra && (
                <LimbRow label={t('panchang.suryaNakshatra')} elements={[{ name: localizeNakshatra(panchang.suryaNakshatra, panchangLang) }]} colors={colors} />
              )}
              {(panchang.hinduMonthPurnimanta || panchang.hinduMonthAmanta) && (
                <>
                  <View style={[styles.limbDivider, { backgroundColor: colors.divider }]} />
                  <View style={styles.limbRow}>
                    <Text style={[styles.limbLabel, { color: colors.accent }]}>{t('panchang.chandraMasa')}</Text>
                    <Text style={[styles.limbValue, { color: colors.textPrimary }]}>
                      {localizeChandraMasa(
                        (masaSystem === 'purnimanta' ? panchang.hinduMonthPurnimanta : panchang.hinduMonthAmanta) ?? '',
                        panchangLang,
                      )}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setMasaSystem(masaSystem === 'purnimanta' ? 'amanta' : 'purnimanta')}
                      activeOpacity={0.7}
                      style={[styles.masaChip, { backgroundColor: colors.accent + '18', borderColor: colors.accent + '40' }]}
                      accessibilityRole="button"
                      accessibilityLabel={masaSystem === 'purnimanta' ? t('panchang.amanta') : t('panchang.purnimanta')}>
                      <Text style={[styles.masaChipText, { color: colors.accent }]}>
                        {masaSystem === 'purnimanta' ? t('panchang.purnimanta') : t('panchang.amanta')}
                      </Text>
                      <Icon name="swap-horizontal" size={12} color={colors.accent} />
                    </TouchableOpacity>
                  </View>
                </>
              )}
              {panchang.masa && (
                <LimbRow label={t('panchang.masaSolarMonth')} elements={[{ name: panchang.masa }]} colors={colors} isLast />
              )}
            </View>

            {/* ── Sun / Moon times ── */}
            <View style={styles.sunGrid}>
              <SunCard icon="sun"  label={t('home.sunrise')}  time={panchang.sunrise}         colors={colors} iconColor={colors.accent} />
              <SunCard icon="moon" label={t('home.sunset')}   time={panchang.sunset}          colors={colors} iconColor={colors.textMuted} />
              <SunCard icon="sun"  label={t('panchang.nextSunrise')} time={panchang.nextSunrise ?? '—'} colors={colors} iconColor={colors.accent} />
              <SunCard icon="moon" label={t('panchang.moonrise')} time={panchang.moonrise ?? '—'} colors={colors} iconColor={colors.accent} />
              <SunCard icon="moon" label={t('panchang.moonset')}  time={panchang.moonset  ?? '—'} colors={colors} iconColor={colors.textMuted} />
            </View>

            {/* Day / Night duration */}
            <View style={[styles.durationRow, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
              <View style={styles.durationCell}>
                <Icon name="sun" size={13} color={colors.accent} />
                <Text style={[styles.durationText, { color: colors.textMuted }]}>{t('panchang.day')} </Text>
                <Text style={[styles.durationValue, { color: colors.textPrimary }]}>{formatDuration(panchang.dayDurationMinutes)}</Text>
              </View>
              <View style={[styles.durationDivider, { backgroundColor: colors.divider }]} />
              <View style={styles.durationCell}>
                <Icon name="moon" size={13} color={colors.textMuted} />
                <Text style={[styles.durationText, { color: colors.textMuted }]}>{t('panchang.night')} </Text>
                <Text style={[styles.durationValue, { color: colors.textPrimary }]}>{formatDuration(panchang.nightDurationMinutes)}</Text>
              </View>
            </View>

            {/* ── Inline Ad ── */}
            <AdBanner colors={colors} placement="panchangInline" inline />

            {/* ── Auspicious Times ── */}
            <SectionLabel style={styles.sectionLabel}>{t('panchang.auspiciousTimes')}</SectionLabel>

            {panchang.brahmaMuhurtaStart && panchang.brahmaMuhurtaEnd && (
              <View style={[styles.rahuBar, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
                <Icon name="sparkles" size={16} color={AUSPICIOUS_GREEN} />
                <Text style={[styles.rahuLabel, { color: colors.textMuted }]}>{t('panchang.brahmaMuhurta')}</Text>
                <Text style={[styles.rahuTime, { color: colors.textPrimary }]}>
                  {panchang.brahmaMuhurtaStart} – {panchang.brahmaMuhurtaEnd}
                </Text>
              </View>
            )}
            {panchang.abhijitMuhurtaStart && panchang.abhijitMuhurtaEnd && (
              <View style={[styles.rahuBar, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
                <Icon name="sparkles" size={16} color={AUSPICIOUS_GREEN} />
                <Text style={[styles.rahuLabel, { color: colors.textMuted }]}>{t('panchang.abhijitMuhurta')}</Text>
                <Text style={[styles.rahuTime, { color: colors.textPrimary }]}>
                  {panchang.abhijitMuhurtaStart} – {panchang.abhijitMuhurtaEnd}
                </Text>
              </View>
            )}
            {panchang.vijayaMuhurtaStart && panchang.vijayaMuhurtaEnd && (
              <View style={[styles.rahuBar, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
                <Icon name="sparkles" size={16} color={AUSPICIOUS_GREEN} />
                <Text style={[styles.rahuLabel, { color: colors.textMuted }]}>{t('panchang.vijayaMuhurta')}</Text>
                <Text style={[styles.rahuTime, { color: colors.textPrimary }]}>
                  {panchang.vijayaMuhurtaStart} – {panchang.vijayaMuhurtaEnd}
                </Text>
              </View>
            )}
            {panchang.godhuliMuhurtaStart && panchang.godhuliMuhurtaEnd && (
              <View style={[styles.rahuBar, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
                <Icon name="sparkles" size={16} color={AUSPICIOUS_GREEN} />
                <Text style={[styles.rahuLabel, { color: colors.textMuted }]}>{t('panchang.godhuliMuhurta')}</Text>
                <Text style={[styles.rahuTime, { color: colors.textPrimary }]}>
                  {panchang.godhuliMuhurtaStart} – {panchang.godhuliMuhurtaEnd}
                </Text>
              </View>
            )}
            {panchang.nishitaMuhurtaStart && panchang.nishitaMuhurtaEnd && (
              <View style={[styles.rahuBar, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
                <Icon name="sparkles" size={16} color={AUSPICIOUS_GREEN} />
                <Text style={[styles.rahuLabel, { color: colors.textMuted }]}>{t('panchang.nishitaMuhurta')}</Text>
                <Text style={[styles.rahuTime, { color: colors.textPrimary }]}>
                  {panchang.nishitaMuhurtaStart} – {panchang.nishitaMuhurtaEnd}
                </Text>
              </View>
            )}
            {panchang.amritKalaStart && panchang.amritKalaEnd && (
              <View style={[styles.rahuBar, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
                <Icon name="sparkles" size={16} color={AUSPICIOUS_GREEN} />
                <Text style={[styles.rahuLabel, { color: colors.textMuted }]}>{t('panchang.amritKala')}</Text>
                <Text style={[styles.rahuTime, { color: colors.textPrimary }]}>
                  {panchang.amritKalaStart} – {panchang.amritKalaEnd}
                </Text>
              </View>
            )}
            {panchang.pratahSandhyaStart && panchang.pratahSandhyaEnd && (
              <View style={[styles.rahuBar, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
                <Icon name="sparkles" size={16} color={AUSPICIOUS_GREEN} />
                <Text style={[styles.rahuLabel, { color: colors.textMuted }]}>{t('panchang.pratahSandhya')}</Text>
                <Text style={[styles.rahuTime, { color: colors.textPrimary }]}>
                  {panchang.pratahSandhyaStart} – {panchang.pratahSandhyaEnd}
                </Text>
              </View>
            )}
            {panchang.madhyahnaStart && panchang.madhyahnaEnd && (
              <View style={[styles.rahuBar, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
                <Icon name="sparkles" size={16} color={AUSPICIOUS_GREEN} />
                <Text style={[styles.rahuLabel, { color: colors.textMuted }]}>{t('panchang.madhyahna')}</Text>
                <Text style={[styles.rahuTime, { color: colors.textPrimary }]}>
                  {panchang.madhyahnaStart} – {panchang.madhyahnaEnd}
                </Text>
              </View>
            )}
            {panchang.sayahnaSandhyaStart && panchang.sayahnaSandhyaEnd && (
              <View style={[styles.rahuBar, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
                <Icon name="sparkles" size={16} color={AUSPICIOUS_GREEN} />
                <Text style={[styles.rahuLabel, { color: colors.textMuted }]}>{t('panchang.sayahnaSandhya')}</Text>
                <Text style={[styles.rahuTime, { color: colors.textPrimary }]}>
                  {panchang.sayahnaSandhyaStart} – {panchang.sayahnaSandhyaEnd}
                </Text>
              </View>
            )}

            {/* ── Inauspicious Times ── */}
            <SectionLabel style={styles.sectionLabel}>{t('panchang.inauspiciousTimes')}</SectionLabel>

            {panchang.rahuKalamStart && panchang.rahuKalamEnd && (
              <View style={[styles.rahuBar, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
                <Icon name="warning" size={16} color={semanticColors.error} />
                <Text style={[styles.rahuLabel, { color: colors.textMuted }]}>{t('panchang.rahuKalam')}</Text>
                <Text style={[styles.rahuTime, { color: colors.textPrimary }]}>
                  {panchang.rahuKalamStart} – {panchang.rahuKalamEnd}
                </Text>
              </View>
            )}
            {panchang.yamagandaStart && panchang.yamagandaEnd && (
              <View style={[styles.rahuBar, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
                <Icon name="warning" size={16} color={semanticColors.error} />
                <Text style={[styles.rahuLabel, { color: colors.textMuted }]}>{t('panchang.yamaganda')}</Text>
                <Text style={[styles.rahuTime, { color: colors.textPrimary }]}>
                  {panchang.yamagandaStart} – {panchang.yamagandaEnd}
                </Text>
              </View>
            )}
            {panchang.gulikaKalamStart && panchang.gulikaKalamEnd && (
              <View style={[styles.rahuBar, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
                <Icon name="warning" size={16} color={semanticColors.error} />
                <Text style={[styles.rahuLabel, { color: colors.textMuted }]}>{t('panchang.gulikaKalam')}</Text>
                <Text style={[styles.rahuTime, { color: colors.textPrimary }]}>
                  {panchang.gulikaKalamStart} – {panchang.gulikaKalamEnd}
                </Text>
              </View>
            )}
            {panchang.durMuhurta.map((dm, i) => (
              <View key={i} style={[styles.rahuBar, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
                <Icon name="warning" size={16} color={semanticColors.error} />
                <Text style={[styles.rahuLabel, { color: colors.textMuted }]}>{t('panchang.durMuhurta')}</Text>
                <Text style={[styles.rahuTime, { color: colors.textPrimary }]}>
                  {dm.start} – {dm.end}
                </Text>
              </View>
            ))}
            {panchang.varjyamStart && panchang.varjyamEnd && (
              <View style={[styles.rahuBar, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
                <Icon name="warning" size={16} color={semanticColors.error} />
                <Text style={[styles.rahuLabel, { color: colors.textMuted }]}>{t('panchang.varjyam')}</Text>
                <Text style={[styles.rahuTime, { color: colors.textPrimary }]}>
                  {panchang.varjyamStart} – {panchang.varjyamEnd}
                </Text>
              </View>
            )}
            {panchang.bhadra && (
              <View style={[styles.rahuBar, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
                <Icon name="warning" size={16} color={panchang.bhadra.location === 'earth' ? semanticColors.error : palette.goldLeaf} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rahuLabel, { color: colors.textMuted }]}>{t('panchang.bhadra')}</Text>
                  <Text style={[styles.bhadraNote, { color: colors.textSecondary }]}>
                    {t(`panchang.bhadra${panchang.bhadra.location === 'earth' ? 'Earth' : panchang.bhadra.location === 'heaven' ? 'Heaven' : 'Paatal'}`)}
                  </Text>
                </View>
                <Text style={[styles.rahuTime, { color: colors.textPrimary }]}>
                  {panchang.bhadra.start} – {panchang.bhadra.end}
                </Text>
              </View>
            )}

            {/* ── Eclipse (Grahan) ── */}
            {panchang.eclipse && (
              <>
                <SectionLabel style={styles.sectionLabel}>{t('panchang.eclipseSection')}</SectionLabel>
                <View style={[styles.eclipseCard, { backgroundColor: semanticColors.error + '1E', borderColor: semanticColors.error + '66' }]}>
                  <View style={styles.eclipseHeader}>
                    <Icon
                      name={panchang.eclipse.kind === 'solar' ? 'sun' : 'moon'}
                      size={18}
                      color={semanticColors.error}
                    />
                    <Text style={[styles.eclipseTitle, { color: colors.textPrimary }]}>
                      {panchang.eclipse.kind === 'solar' ? t('panchang.eclipseSolar') : t('panchang.eclipseLunar')}
                      {'  ·  '}
                      {t(`panchang.eclipseSubtype.${panchang.eclipse.subtype}`)}
                    </Text>
                  </View>
                  <Text style={[styles.eclipseRow, { color: colors.textSecondary }]}>
                    {t('panchang.eclipseWindow', { start: panchang.eclipse.start, end: panchang.eclipse.end })}
                  </Text>
                  <Text style={[styles.eclipseRow, { color: colors.textSecondary }]}>
                    {t('panchang.eclipsePeak', { time: panchang.eclipse.peak })}
                    {'  ·  '}
                    {t('panchang.eclipseMagnitude', { value: panchang.eclipse.magnitude.toFixed(2) })}
                  </Text>
                  <Text style={[styles.eclipseRow, { color: colors.textSecondary }]}>
                    {t('panchang.eclipseSutak', { start: panchang.eclipse.sutakStart, end: panchang.eclipse.sutakEnd })}
                  </Text>
                  <Text style={[styles.eclipseVisibility, { color: panchang.eclipse.visibleFromLocation ? semanticColors.success : colors.textMuted }]}>
                    {panchang.eclipse.visibleFromLocation ? t('panchang.eclipseVisible') : t('panchang.eclipseNotVisible')}
                  </Text>
                </View>
              </>
            )}

            {/* ── Time Slots ── */}
            <SectionLabel style={styles.sectionLabel}>{t('panchang.timeQuality')}</SectionLabel>

            <QualitySlotsCard label={t('panchang.choghadiya')} slots={panchang.choghadiya} colors={colors} />
            <QualitySlotsCard label={t('panchang.gowriPanchangam')} slots={panchang.gowriPanchangam} colors={colors} />
            <QualitySlotsCard label={t('panchang.doGhatiMuhurta')} slots={panchang.doGhatiMuhurta} colors={colors} />
            <HoraCard slots={panchang.hora} colors={colors} />

            {/* ── Planetary Positions ── */}
            {panchang.planetaryPositions && panchang.planetaryPositions.length > 0 && (
              <>
                <SectionLabel style={styles.sectionLabel}>{t('panchang.planetaryPositions')}</SectionLabel>
                <PlanetaryPositionsCard positions={panchang.planetaryPositions} colors={colors} />
              </>
            )}
          </>
        ) : null}
        </SkeletonCrossfade>

      </ScrollView>

      {/* ── Walkthrough Step 2: Spotlight Pancha Anga card ── */}
      {walkthroughStep === 2 && panchaAngaRect && (
        <WalkthroughSpotlight
          spotlight={panchaAngaRect}
          title={t('walkthrough.step2Title')}
          description={t('walkthrough.step2Desc')}
          tooltipPosition="above"
          stepIndex={1}
          totalSteps={4}
          onNext={() => {
            setWalkthroughStep(3);
            router.push('/(tabs)/library');
          }}
          onSkip={() => setWalkthroughStep(0)}
        />
      )}

      <WheelDatePickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        value={selectedDate}
        onPick={handlePickFromModal}
        minimumDate={new Date(1900, 0, 1)}
        maximumDate={new Date(2100, 11, 31)}
        title={t('panchang.datePickerTitle', { defaultValue: 'Pick a date' })}
      />
    </SafeAreaView>
    </ScreenMount>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingBottom: 40, paddingTop: 4 },

  // Editorial header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  headerSide: { width: 90 },
  headerSideRight: { alignItems: 'flex-end' },
  headerCenter: { flex: 1, alignItems: 'center', gap: 2 },
  headerTitle: { fontSize: 20, lineHeight: 26 },
  locPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: 104,
  },
  locText: { fontSize: 8.5 },

  // Month strip
  monthStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    paddingBottom: 6,
  },
  monthBtn: { padding: 6 },
  monthLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  monthName: { fontSize: 22, lineHeight: 26 },
  monthYear: { fontSize: 13, letterSpacing: 1.2, marginBottom: 2 },
  monthCaret: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },

  todayRow: { alignItems: 'center', marginBottom: 4 },
  todayChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  todayChipText: { fontSize: 9 },

  // Calendar grid
  calHeaderRow: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  calDayHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: 9,
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1 / 1.08,
    padding: 2,
  },
  calCellInner: {
    flex: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingTop: 2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  calDayNum: {
    fontFamily: 'Fraunces_400Regular',
    fontSize: 14,
    lineHeight: 16,
  },
  festivalDot: {
    position: 'absolute',
    bottom: 4,
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  postCalRule: { marginTop: 10, marginBottom: 12 },

  // Selected-day line
  selectedLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 14,
  },
  selectedKicker: { fontSize: 9.5 },
  selectedSamvat: { fontSize: 12 },

  // Section label (primitive wrapper)
  sectionLabel: { marginTop: 16, marginBottom: 10 },

  // Pancha Anga card (unchanged from pre-P6.4)
  card: { borderRadius: borderRadius.card, borderWidth: 1, padding: 16, marginBottom: 16 },
  limbRow: { paddingVertical: 12 },
  limbLabel: { fontSize: 11, fontFamily: 'NotoSerifDevanagari_500Medium', letterSpacing: 1, marginBottom: 4 },
  limbElement: {},
  limbSecondary: { marginTop: 6 },
  limbNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  limbNameLeft: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexShrink: 1 },
  limbValue: { fontSize: 17, fontFamily: 'NotoSerifDevanagari_700Bold' },
  limbEndTime: { fontSize: 12, fontFamily: 'NotoSerifDevanagari_400Regular' },
  limbActiveBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 8 },
  limbActiveText: { fontSize: 10, fontFamily: 'NotoSerifDevanagari_700Bold', letterSpacing: 0.8 },
  limbSunriseChip: { borderRadius: 4, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 1, marginLeft: 8 },
  limbSunriseChipText: { fontSize: 8.5, fontFamily: 'JetBrainsMono_500Medium', letterSpacing: 0.6 },
  limbProgressTrack: { height: 3, borderRadius: 2, marginTop: 8, overflow: 'hidden' },
  limbProgressFill: { height: 3, borderRadius: 2 },
  limbDivider: { height: 0.5 },

  masaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6, alignSelf: 'flex-start' },
  masaChipText: { fontSize: 11, fontFamily: 'NotoSerifDevanagari_500Medium', letterSpacing: 0.3 },

  // Sun / Moon grid (unchanged)
  sunGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  sunCard: { width: '47%', borderRadius: borderRadius.cardInner, borderWidth: 1, padding: 16, alignItems: 'center', gap: 6 },
  sunCardLabel: { fontSize: 11, fontFamily: 'NotoSerifDevanagari_500Medium', letterSpacing: 0.5 },
  sunCardTime: { fontSize: 16, fontFamily: 'JetBrainsMono_500Medium' },

  panchakaBar: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: borderRadius.cardInner, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12 },
  panchakaText: { fontSize: 12, fontFamily: 'NotoSerifDevanagari_500Medium', flex: 1 },

  instantRow: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  instantKicker: { fontSize: 9, letterSpacing: 1.2 },
  instantBody: { fontSize: 13 },

  muhuratEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: borderRadius.cardInner,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  muhuratEntryText: { flex: 1, fontSize: 13, fontFamily: 'NotoSerifDevanagari_500Medium' },

  rahuBar: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: borderRadius.cardInner, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12 },
  rahuLabel: { fontSize: 11, fontFamily: 'NotoSerifDevanagari_500Medium', letterSpacing: 1, flex: 1 },
  rahuTime: { fontSize: 13, fontFamily: 'JetBrainsMono_500Medium' },
  bhadraNote: { fontSize: 11, fontFamily: 'NotoSerifDevanagari_400Regular', marginTop: 2 },

  eclipseCard: { borderRadius: borderRadius.card, borderWidth: 1, padding: 14, marginBottom: 12, gap: 6 },
  eclipseHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  eclipseTitle: { fontSize: 14, fontFamily: 'NotoSerifDevanagari_700Bold' },
  eclipseRow: { fontSize: 12, fontFamily: 'NotoSerifDevanagari_400Regular' },
  eclipseVisibility: { fontSize: 12, fontFamily: 'NotoSerifDevanagari_500Medium', marginTop: 4 },

  durationRow: { flexDirection: 'row', alignItems: 'center', borderRadius: borderRadius.cardInner, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 12 },
  durationCell: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  durationDivider: { width: 0.5, height: 16 },
  durationText: { fontSize: 12, fontFamily: 'NotoSerifDevanagari_400Regular' },
  durationValue: { fontSize: 13, fontFamily: 'JetBrainsMono_500Medium' },

  errorContainer: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  errorIconCircle: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  errorTitle: { fontSize: 16, fontFamily: 'NotoSerifDevanagari_500Medium' },
  errorDesc: { fontSize: 13, fontFamily: 'NotoSerifDevanagari_400Regular', textAlign: 'center', lineHeight: 20, paddingHorizontal: 24 },
  retryBtn: { paddingHorizontal: 28, paddingVertical: 12, borderRadius: borderRadius.button, marginTop: 4 },
  retryText: { fontSize: 14, fontFamily: 'NotoSerifDevanagari_500Medium' },
  fallbackNote: { fontSize: 12, fontFamily: 'NotoSerifDevanagari_400Regular' },
});
