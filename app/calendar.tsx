import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import { router } from 'expo-router';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

import { AppText as Text } from '@/components/common/AppText';
import { Icon } from '@/components/common/Icon';
import { ScreenMount } from '@/components/common/ScreenMount';
import { Ornament } from '@/components/common/Ornament';
import { SectionLabel } from '@/components/common/SectionLabel';
import { SegmentedChip } from '@/components/common/SegmentedChip';
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
import { durations, easings } from '@/config/motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
  getCalendarMonth,
  peekCalendarMonth,
  prefetchAdjacentMonths,
  getEkadashiForYear,
  getSankrantisForYearLocal,
  getUpcomingEclipsesLocal,
  type CalendarDay,
  type CalendarMonth,
  type CalendarMonthOptions,
} from '@/services/astrology/calendarService';
import { FALLBACK_COORDS } from '@/services/astrology/panchangService';

// Phase 7 swipe thresholds — distance OR velocity commits the page change.
const SWIPE_DISTANCE_PX = 80;
const SWIPE_VELOCITY_PXS = 400;
const SWIPE_ACTIVE_OFFSET = 15;
const SWIPE_FAIL_OFFSET_Y = 12;

// ── Helpers ──────────────────────────────────────────────────────────────────

function isSameDay(a: Date, b: Date) {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function tithiInPaksha(tithiIdx: number, paksha: 'shukla' | 'krishna'): number {
  // 0..29 synodic index → 1..15 within-paksha display number.
  return paksha === 'shukla' ? tithiIdx + 1 : tithiIdx - 14;
}

type FilterMode = 'all' | 'ekadashi' | 'sankranti' | 'eclipse';

function dayMatchesFilter(d: CalendarDay, mode: FilterMode): boolean {
  switch (mode) {
    case 'all': return true;
    case 'ekadashi': return d.ekadashi;
    case 'sankranti': return d.sankranti;
    case 'eclipse': return d.eclipse !== null;
  }
}

// ── Day cell ─────────────────────────────────────────────────────────────────

interface DayCellProps {
  day: CalendarDay | null;
  inCurrentMonth: boolean;
  isToday: boolean;
  highlightForFilter: boolean;
  dimForFilter: boolean;
  colors: ColorPalette;
  isDark: boolean;
  onPress: (date: Date) => void;
}

const DayCell = memo(function DayCell({
  day,
  inCurrentMonth,
  isToday,
  highlightForFilter,
  dimForFilter,
  colors,
  isDark,
  onPress,
}: DayCellProps) {
  if (!day) {
    return <View style={styles.cell} />;
  }
  const dayNum = day.date.getDate();
  const tithiNum = tithiInPaksha(day.tithi, day.paksha);
  // Krishna paksha gets a recessed surface tint to read as the waning half;
  // shukla gets the canonical surface so the editorial parchment carries.
  const cellBg =
    !inCurrentMonth
      ? 'transparent'
      : day.paksha === 'krishna'
        ? colors.surfaceRecessed
        : colors.surface;
  const dayNumColor = !inCurrentMonth
    ? colors.textDisabled
    : day.isUserDeityFestival
      ? palette.goldLeaf
      : day.festivals.length > 0 || day.ekadashi || day.sankranti
        ? colors.accent
        : colors.textPrimary;
  const tithiColor = !inCurrentMonth ? colors.textDisabled : colors.textMuted;
  const ringStyle = isToday && inCurrentMonth ? { borderColor: colors.accent, borderWidth: 1.5 } : null;
  const filterRingStyle =
    highlightForFilter && !isToday && inCurrentMonth
      ? { borderColor: colors.emphasis, borderWidth: 1 }
      : null;

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => { /* non-critical */ });
        onPress(day.date);
      }}
      style={styles.cell}
      accessibilityRole="button"
      accessibilityLabel={day.date.toDateString()}>
      <View
        style={[
          styles.cellInner,
          {
            backgroundColor: cellBg,
            borderColor: 'transparent',
            opacity: dimForFilter && inCurrentMonth ? 0.35 : 1,
          },
          ringStyle,
          filterRingStyle,
        ]}>
        <Text style={[styles.cellTithi, { color: tithiColor }]}>{tithiNum}</Text>
        <Text style={[styles.cellDay, { color: dayNumColor }]}>{dayNum}</Text>
        <CellMarkers day={day} colors={colors} isDark={isDark} dim={!inCurrentMonth} />
      </View>
    </Pressable>
  );
});

// ── Cell markers ─────────────────────────────────────────────────────────────

interface CellMarkersProps {
  day: CalendarDay;
  colors: ColorPalette;
  isDark: boolean;
  dim: boolean;
}

const CellMarkers = memo(function CellMarkers({ day, colors, isDark, dim }: CellMarkersProps) {
  const items: { key: string; node: React.ReactNode }[] = [];
  const baseColor = dim ? colors.textDisabled : colors.textTertiary;
  const accent = dim ? colors.textDisabled : colors.accent;

  if (day.eclipse) {
    items.push({
      key: 'eclipse',
      node: (
        <View
          key="eclipse"
          style={[
            styles.markerCircle,
            { borderColor: dim ? colors.textDisabled : semanticColors.error, backgroundColor: dim ? 'transparent' : semanticColors.error + '33' },
          ]}
        />
      ),
    });
  }
  if (day.pournami) {
    items.push({
      key: 'pournami',
      node: (
        <View
          key="pournami"
          style={[styles.markerCircle, { backgroundColor: dim ? colors.textDisabled : palette.goldLeaf, borderColor: dim ? colors.textDisabled : palette.goldLeaf }]}
        />
      ),
    });
  } else if (day.amavasya) {
    items.push({
      key: 'amavasya',
      node: (
        <View
          key="amavasya"
          style={[
            styles.markerCircle,
            { borderColor: dim ? colors.textDisabled : (isDark ? colors.textTertiary : palette.ink), backgroundColor: 'transparent' },
          ]}
        />
      ),
    });
  }
  if (day.ekadashi) {
    items.push({
      key: 'ekadashi',
      node: (
        <Text key="ekadashi" style={[styles.markerLetter, { color: accent }]}>E</Text>
      ),
    });
  }
  if (day.sankranti) {
    items.push({
      key: 'sankranti',
      node: (
        <Text key="sankranti" style={[styles.markerLetter, { color: dim ? colors.textDisabled : palette.sindoorWarm }]}>☼</Text>
      ),
    });
  }
  if (day.pradosh) {
    items.push({
      key: 'pradosh',
      node: (
        <Text key="pradosh" style={[styles.markerLetter, { color: baseColor }]}>P</Text>
      ),
    });
  }
  if (day.festivals.some(f => f.type === 'major' || f.type === 'minor')) {
    items.push({
      key: 'festival',
      node: (
        <View
          key="festival"
          style={[styles.festivalDot, { backgroundColor: day.isUserDeityFestival ? palette.goldLeaf : (dim ? colors.textDisabled : colors.accent) }]}
        />
      ),
    });
  }
  if (items.length === 0) return null;
  return <View style={styles.markersRow}>{items.map(i => i.node)}</View>;
});

// ── Animated month wrapper (handles swipe pan) ───────────────────────────────

interface MonthGridProps {
  month: CalendarMonth | null;
  monthIdx: number;
  year: number;
  filterMode: FilterMode;
  today: Date;
  colors: ColorPalette;
  isDark: boolean;
  dayHeaders: string[];
  onPickDay: (date: Date) => void;
  onSwipe: (direction: 'next' | 'prev') => void;
}

function MonthGrid({
  month,
  monthIdx,
  year,
  filterMode,
  today,
  colors,
  isDark,
  dayHeaders,
  onPickDay,
  onSwipe,
}: MonthGridProps) {
  const { width: screenWidth } = useWindowDimensions();
  const { dur } = useReducedMotion();
  const tx = useSharedValue(0);

  // Skeleton placeholder when the data hasn't resolved yet.
  const cells: (CalendarDay | null)[] = useMemo(() => {
    if (month) return month.cells;
    return Array.from({ length: 42 }, () => null);
  }, [month]);

  const commitNext = useCallback(() => {
    onSwipe('next');
  }, [onSwipe]);
  const commitPrev = useCallback(() => {
    onSwipe('prev');
  }, [onSwipe]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        // Steal the gesture only after a clear horizontal commit. Vertical
        // tolerance below this fails the pan so the parent ScrollView keeps
        // smooth vertical scroll under the user's finger.
        .activeOffsetX([-SWIPE_ACTIVE_OFFSET, SWIPE_ACTIVE_OFFSET])
        .failOffsetY([-SWIPE_FAIL_OFFSET_Y, SWIPE_FAIL_OFFSET_Y])
        .onChange((e) => {
          'worklet';
          tx.value = e.translationX;
        })
        .onEnd((e) => {
          'worklet';
          const dx = e.translationX;
          const vx = e.velocityX;
          const goNext = dx < -SWIPE_DISTANCE_PX || vx < -SWIPE_VELOCITY_PXS;
          const goPrev = dx > SWIPE_DISTANCE_PX || vx > SWIPE_VELOCITY_PXS;
          if (goNext) {
            tx.value = withTiming(
              -screenWidth,
              { duration: dur(durations.fast), easing: easings.standard },
              (done) => {
                if (done) {
                  tx.value = 0;
                  runOnJS(commitNext)();
                }
              },
            );
          } else if (goPrev) {
            tx.value = withTiming(
              screenWidth,
              { duration: dur(durations.fast), easing: easings.standard },
              (done) => {
                if (done) {
                  tx.value = 0;
                  runOnJS(commitPrev)();
                }
              },
            );
          } else {
            tx.value = withTiming(0, { duration: dur(durations.base), easing: easings.standard });
          }
        }),
    [tx, screenWidth, dur, commitNext, commitPrev],
  );

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={animStyle} accessible accessibilityRole="adjustable">
        <View style={styles.weekHeader}>
          {dayHeaders.map((d, i) => (
            <Text
              key={i}
              variant="mono-caps"
              style={[styles.weekHeaderLabel, { color: colors.textMuted }]}>
              {d}
            </Text>
          ))}
        </View>
        <View style={styles.grid}>
          {cells.map((day, idx) => {
            const cellDate = day?.date ?? null;
            const inCurrentMonth = cellDate ? cellDate.getMonth() === monthIdx && cellDate.getFullYear() === year : false;
            const isToday = cellDate ? isSameDay(cellDate, today) : false;
            const matches = day ? dayMatchesFilter(day, filterMode) : true;
            const highlightForFilter = filterMode !== 'all' && matches;
            const dimForFilter = filterMode !== 'all' && !matches;
            return (
              <DayCell
                key={idx}
                day={day}
                inCurrentMonth={inCurrentMonth}
                isToday={isToday}
                highlightForFilter={highlightForFilter}
                dimForFilter={dimForFilter}
                colors={colors}
                isDark={isDark}
                onPress={onPickDay}
              />
            );
          })}
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

// ── Drilldown panel ──────────────────────────────────────────────────────────

interface DrilldownProps {
  filterMode: FilterMode;
  year: number;
  today: Date;
  colors: ColorPalette;
  onPickDay: (date: Date) => void;
}

function DrilldownPanel({ filterMode, year, today, colors, onPickDay }: DrilldownProps) {
  const { t } = useTranslation();
  const { digits } = useLocaleFormatters();

  const list = useMemo(() => {
    if (filterMode === 'ekadashi') {
      return getEkadashiForYear(year).map(e => ({
        date: e.date,
        title: e.name,
        subtitle: e.description,
      }));
    }
    if (filterMode === 'sankranti') {
      return getSankrantisForYearLocal(year).map(s => ({
        date: s.date,
        title: s.name,
        subtitle: s.description,
      }));
    }
    if (filterMode === 'eclipse') {
      return getUpcomingEclipsesLocal(today, 2).map(e => ({
        date: e.date,
        title: e.name,
        subtitle: e.description,
      }));
    }
    return [];
  }, [filterMode, year, today]);

  if (filterMode === 'all') return null;

  const heading =
    filterMode === 'ekadashi'
      ? t('calendar.drilldownEkadashiTitle', { year: digits(String(year)) })
      : filterMode === 'sankranti'
        ? t('calendar.drilldownSankrantiTitle', { year: digits(String(year)) })
        : t('calendar.drilldownEclipseTitle');

  return (
    <View style={styles.drilldownWrap}>
      <SectionLabel style={styles.drilldownLabel}>{heading}</SectionLabel>
      {list.length === 0 ? (
        <Text style={[styles.drilldownEmpty, { color: colors.textMuted }]}>
          {t('calendar.drilldownEmpty')}
        </Text>
      ) : (
        list.map((item, i) => {
          const isPast = item.date.getTime() < today.setHours(0, 0, 0, 0);
          const isUpcomingSoon =
            !isPast &&
            item.date.getTime() - today.getTime() < 14 * 24 * 60 * 60 * 1000;
          return (
            <Pressable
              key={`${item.date.toISOString()}-${i}`}
              onPress={() => {
                Haptics.selectionAsync().catch(() => { /* non-critical */ });
                onPickDay(item.date);
              }}
              style={[
                styles.drilldownRow,
                { backgroundColor: colors.surface, borderColor: colors.border, opacity: isPast ? 0.55 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${item.title} · ${item.date.toDateString()}`}>
              <View style={styles.drilldownDateBlock}>
                <Text variant="mono-caps" style={[styles.drilldownDow, { color: colors.textTertiary }]}>
                  {item.date.toLocaleDateString('en-IN', { weekday: 'short' })}
                </Text>
                <Text style={[styles.drilldownDay, { color: colors.textPrimary }]}>
                  {item.date.getDate()}
                </Text>
                <Text variant="mono-caps" style={[styles.drilldownMon, { color: colors.textMuted }]}>
                  {item.date.toLocaleDateString('en-IN', { month: 'short' })}
                </Text>
              </View>
              <View style={styles.drilldownBody}>
                <Text style={[styles.drilldownTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                  {item.title}
                </Text>
                {item.subtitle && (
                  <Text style={[styles.drilldownSubtitle, { color: colors.textTertiary }]} numberOfLines={2}>
                    {item.subtitle}
                  </Text>
                )}
              </View>
              {isUpcomingSoon && (
                <View style={[styles.soonBadge, { borderColor: colors.accent }]}>
                  <Text variant="mono-caps" style={[styles.soonText, { color: colors.accent }]}>
                    {t('festivals.soonBadge')}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })
      )}
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function CalendarScreen() {
  const { t } = useTranslation();
  const isDarkMode = useStore(s => s.isDarkMode);
  const userLocation = useStore(s => s.userLocation);
  const region = useStore(s => s.region);
  const ayanamsa = useStore(s => s.ayanamsa);
  const selectedDeities = useStore(s => s.selectedDeities);
  const setPendingPanchangDate = useStore(s => s.setPendingPanchangDate);
  const colors = isDarkMode ? darkColors : lightColors;

  const today = useMemo(() => new Date(), []);
  const [calMonth, setCalMonth] = useState<Date>(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  const calYear = calMonth.getFullYear();
  const calMonthIdx = calMonth.getMonth();
  const coords = userLocation ?? FALLBACK_COORDS;

  const monthOptions = useMemo<CalendarMonthOptions>(
    () => ({ region, ayanamsa, selectedDeities }),
    [region, ayanamsa, selectedDeities],
  );

  // Render synchronously when warm, then patch from the resolved promise.
  const [monthData, setMonthData] = useState<CalendarMonth | null>(() =>
    peekCalendarMonth(calYear, calMonthIdx, coords, monthOptions),
  );

  // Stash a ref to the latest in-flight request key — late-resolving promises
  // for a previous month must not overwrite the current month's data.
  const requestSeq = useRef(0);

  useEffect(() => {
    const seq = ++requestSeq.current;
    const cached = peekCalendarMonth(calYear, calMonthIdx, coords, monthOptions);
    if (cached) {
      setMonthData(cached);
    } else {
      setMonthData(null);
    }
    void getCalendarMonth(calYear, calMonthIdx, coords, monthOptions).then(m => {
      if (requestSeq.current === seq) setMonthData(m);
    });
    // Prefetch ±1 month so the next swipe is instant.
    prefetchAdjacentMonths(calYear, calMonthIdx, coords, monthOptions);
  }, [calYear, calMonthIdx, coords, monthOptions]);

  const goPrev = useCallback(() => {
    setCalMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  }, []);
  const goNext = useCallback(() => {
    setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  }, []);
  const handleSwipe = useCallback(
    (dir: 'next' | 'prev') => {
      if (dir === 'next') goNext();
      else goPrev();
    },
    [goNext, goPrev],
  );
  const goToday = useCallback(() => {
    Haptics.selectionAsync().catch(() => { /* non-critical */ });
    const now = new Date();
    setCalMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  }, []);

  const handlePickDay = useCallback(
    (date: Date) => {
      setPendingPanchangDate(ymd(date));
      router.back();
    },
    [setPendingPanchangDate],
  );

  const handleClose = useCallback(() => {
    router.back();
  }, []);

  const monthNames = t('panchang.monthNames', { returnObjects: true }) as string[];
  const dayHeaders = t('panchang.dayHeaders', { returnObjects: true }) as string[];

  const showingTodayMonth =
    today.getFullYear() === calYear && today.getMonth() === calMonthIdx;

  return (
    <ScreenMount>
      <SafeAreaView
        style={[styles.root, { backgroundColor: colors.base }]}
        edges={['top', 'bottom']}>

        {/* ── Header bar ────────────────────────────────────────────────── */}
        <View style={[styles.header, { paddingHorizontal: spacing.screenH }]}>
          <TouchableOpacity
            onPress={handleClose}
            hitSlop={12}
            style={styles.headerSide}
            accessibilityRole="button"
            accessibilityLabel={t('calendar.a11yClose')}>
            <Icon name="chevron-left" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text variant="display-italic" style={[styles.headerTitle, { color: colors.textPrimary }]}>
              {t('calendar.title')}
            </Text>
          </View>
          <View style={styles.headerSide}>
            {!showingTodayMonth && (
              <TouchableOpacity
                onPress={goToday}
                hitSlop={8}
                style={[styles.todayChip, { borderColor: colors.accent }]}
                accessibilityRole="button"
                accessibilityLabel={t('a11y.today')}>
                <Icon name="return-back" size={11} color={colors.accent} />
                <Text variant="mono-caps" style={[styles.todayChipText, { color: colors.accent }]}>
                  {t('panchang.todayChip')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
          showsVerticalScrollIndicator={false}>

          {/* ── Month strip ─────────────────────────────────────────────── */}
          <View style={styles.monthStrip}>
            <TouchableOpacity onPress={goPrev} hitSlop={12} style={styles.monthBtn} accessibilityRole="button" accessibilityLabel={t('a11y.previousMonth')}>
              <Icon name="chevron-left" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
            <View style={styles.monthLabelRow}>
              <Text variant="display-italic" style={[styles.monthName, { color: colors.textPrimary }]}>
                {monthNames[calMonthIdx]}
              </Text>
              <Text variant="mono" style={[styles.monthYear, { color: colors.textTertiary }]}>
                {calYear}
              </Text>
            </View>
            <TouchableOpacity onPress={goNext} hitSlop={12} style={styles.monthBtn} accessibilityRole="button" accessibilityLabel={t('a11y.nextMonth')}>
              <Icon name="chevron-right" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>

          {/* ── Filter chips ────────────────────────────────────────────── */}
          <FilterChips mode={filterMode} setMode={setFilterMode} colors={colors} />

          {/* ── Animated month grid ─────────────────────────────────────── */}
          <MonthGrid
            month={monthData}
            monthIdx={calMonthIdx}
            year={calYear}
            filterMode={filterMode}
            today={today}
            colors={colors}
            isDark={isDarkMode}
            dayHeaders={dayHeaders}
            onPickDay={handlePickDay}
            onSwipe={handleSwipe}
          />

          <Ornament variant="double-rule" style={styles.divider} />

          {/* ── Legend ──────────────────────────────────────────────────── */}
          <LegendStrip colors={colors} isDark={isDarkMode} />

          {/* ── Drilldown (P9.3) ────────────────────────────────────────── */}
          <DrilldownPanel
            filterMode={filterMode}
            year={calYear}
            today={today}
            colors={colors}
            onPickDay={handlePickDay}
          />

        </ScrollView>
      </SafeAreaView>
    </ScreenMount>
  );
}

// ── Filter chips ─────────────────────────────────────────────────────────────

interface FilterChipsProps {
  mode: FilterMode;
  setMode: (m: FilterMode) => void;
  colors: ColorPalette;
}

function FilterChips({ mode, setMode, colors }: FilterChipsProps) {
  const { t } = useTranslation();
  const items: { key: FilterMode; label: string }[] = [
    { key: 'all', label: t('calendar.filterAll') },
    { key: 'ekadashi', label: t('calendar.filterEkadashi') },
    { key: 'sankranti', label: t('calendar.filterSankranti') },
    { key: 'eclipse', label: t('calendar.filterEclipse') },
  ];
  return (
    <View style={styles.chipsRow}>
      {items.map(it => (
        <SegmentedChip
          key={it.key}
          active={mode === it.key}
          onPress={() => setMode(it.key)}
          inactiveBg={'transparent'}
          activeBg={colors.accent + '18'}
          inactiveBorder={colors.border}
          activeBorder={colors.accent + '88'}
          accessibilityLabel={it.label}
          style={styles.chip}>
          <Text variant="mono-caps" style={[styles.chipText, { color: mode === it.key ? colors.accent : colors.textTertiary }]}>
            {it.label}
          </Text>
        </SegmentedChip>
      ))}
    </View>
  );
}

// ── Legend ───────────────────────────────────────────────────────────────────

interface LegendStripProps {
  colors: ColorPalette;
  isDark: boolean;
}

function LegendStrip({ colors, isDark }: LegendStripProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.legendWrap}>
      <SectionLabel style={styles.legendLabel}>{t('calendar.legendTitle')}</SectionLabel>
      <View style={styles.legendRow}>
        <LegendItem
          label={t('calendar.legendEkadashi')}
          glyph={<Text style={[styles.markerLetter, { color: colors.accent }]}>E</Text>}
          color={colors.textTertiary}
        />
        <LegendItem
          label={t('calendar.legendSankranti')}
          glyph={<Text style={[styles.markerLetter, { color: palette.sindoorWarm }]}>☼</Text>}
          color={colors.textTertiary}
        />
        <LegendItem
          label={t('calendar.legendPournami')}
          glyph={<View style={[styles.markerCircle, { backgroundColor: palette.goldLeaf, borderColor: palette.goldLeaf }]} />}
          color={colors.textTertiary}
        />
      </View>
      <View style={styles.legendRow}>
        <LegendItem
          label={t('calendar.legendAmavasya')}
          glyph={<View style={[styles.markerCircle, { borderColor: isDark ? colors.textTertiary : palette.ink }]} />}
          color={colors.textTertiary}
        />
        <LegendItem
          label={t('calendar.legendPradosh')}
          glyph={<Text style={[styles.markerLetter, { color: colors.textTertiary }]}>P</Text>}
          color={colors.textTertiary}
        />
        <LegendItem
          label={t('calendar.legendEclipse')}
          glyph={<View style={[styles.markerCircle, { borderColor: semanticColors.error, backgroundColor: semanticColors.error + '33' }]} />}
          color={colors.textTertiary}
        />
      </View>
    </View>
  );
}

interface LegendItemProps {
  label: string;
  glyph: React.ReactNode;
  color: string;
}

function LegendItem({ label, glyph, color }: LegendItemProps) {
  return (
    <View style={styles.legendItem}>
      <View style={styles.legendGlyph}>{glyph}</View>
      <Text style={[styles.legendText, { color }]}>{label}</Text>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingBottom: 80, paddingTop: 4 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  headerSide: { width: 80, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 22, lineHeight: 28 },

  todayChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  todayChipText: { fontSize: 9 },

  monthStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 6,
  },
  monthBtn: { padding: 8 },
  monthLabelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    paddingHorizontal: 4,
  },
  monthName: { fontSize: 28, lineHeight: 32 },
  monthYear: { fontSize: 14, letterSpacing: 1.2 },

  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
    marginBottom: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.chip,
    borderWidth: 1,
  },
  chipText: { fontSize: 9 },

  weekHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  weekHeaderLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 9,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1 / 1.18,
    padding: 2,
  },
  cellInner: {
    flex: 1,
    borderRadius: 10,
    paddingTop: 4,
    paddingHorizontal: 3,
    paddingBottom: 3,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },
  cellTithi: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 8,
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  cellDay: {
    fontFamily: 'Fraunces_400Regular',
    fontSize: 16,
    lineHeight: 18,
  },

  markersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 'auto',
    paddingBottom: 1,
    minHeight: 8,
  },
  markerCircle: {
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1,
  },
  markerLetter: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 9,
    lineHeight: 10,
  },
  festivalDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },

  divider: { marginTop: 18, marginBottom: 14 },

  legendWrap: { marginBottom: 12 },
  legendLabel: { marginBottom: 8 },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 100,
  },
  legendGlyph: {
    width: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendText: {
    fontFamily: 'NotoSerifDevanagari_400Regular',
    fontSize: 11,
  },

  drilldownWrap: { marginTop: 8 },
  drilldownLabel: { marginBottom: 8 },
  drilldownEmpty: {
    fontFamily: 'NotoSerifDevanagari_400Regular',
    fontSize: 13,
    paddingVertical: 12,
  },
  drilldownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: borderRadius.cardInner,
    borderWidth: 1,
    marginBottom: 8,
  },
  drilldownDateBlock: {
    width: 44,
    alignItems: 'center',
  },
  drilldownDow: { fontSize: 8 },
  drilldownDay: {
    fontFamily: 'Fraunces_400Regular',
    fontSize: 22,
    lineHeight: 24,
  },
  drilldownMon: { fontSize: 8 },
  drilldownBody: { flex: 1, gap: 2 },
  drilldownTitle: {
    fontFamily: 'NotoSerifDevanagari_500Medium',
    fontSize: 14,
  },
  drilldownSubtitle: {
    fontFamily: 'NotoSerifDevanagari_400Regular',
    fontSize: 12,
    lineHeight: 16,
  },
  soonBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  soonText: { fontSize: 8 },

});
