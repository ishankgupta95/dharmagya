import { useState, useCallback, useEffect, useRef, useMemo, memo } from 'react';
import { router, useFocusEffect } from 'expo-router';
import {
  View,
  ScrollView,
  StyleSheet,
  InteractionManager,
} from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '@/components/common/Icon';
import { MotionPressable } from '@/components/common/MotionPressable';
import { useTranslation } from 'react-i18next';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { useStore } from '@/store/useStore';
import { useLocaleFormatters } from '@/utils/format';
import {
  darkColors,
  lightColors,
  MONO_FONT,
  palette,
  semanticColors,
  borderRadius,
  spacing,
  type ColorPalette,
} from '@/config/theme';
import { useLazyDailyPanchang } from '@/hooks/useLazyDailyPanchang';
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
import { localizeFestivalName, localizeFestivalDescription, localizePrimaryEvent } from '@/i18n/festivalNames';
import { ScreenMount } from '@/components/common/ScreenMount';
import { AdBanner } from '@/components/common/AdBanner';
import { WalkthroughSpotlight, type SpotlightRect } from '@/components/common/WalkthroughOverlay';
import { Ornament } from '@/components/common/Ornament';
import { CalendarGridSkeleton, SkeletonCrossfade } from '@/components/common/SkeletonLoader';
import { DatePickerModal } from '@/components/common/DatePickerModal';
import { QualitySlotsCard } from '@/components/panchang/QualitySlotsCard';
import { HoraCard } from '@/components/panchang/HoraCard';
import { PlanetaryPositionsCard } from '@/components/panchang/PlanetaryPositionsCard';
import { AccordionSection } from '@/components/panchang/AccordionSection';
import { CalGridDense } from '@/components/panchang/CalGridDense';
import { AUSPICIOUS_GREEN, eventDotColor } from '@/components/panchang/calendarColors';
import {
  getCalendarMonth,
  peekCalendarMonth,
  type CalendarDay,
  type CalendarMonth,
} from '@/services/astrology/calendarService';
import type { IInstantPanchang, IPanchangElement } from '@/types';
import { pmark, pAccordionResetCount } from '@/utils/perfProfile';
import { durations, easings } from '@/config/motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';

function isSameDay(a: Date, b: Date) {
  return a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear();
}

function isSameMonth(a: Date, b: Date) {
  return a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}

function ymdKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// ─── Accordion category keys (also used as i18n a11y labels) ───────────────
const CATEGORY_KEYS = {
  panchaAnga: 'panchang.panchaAnga',
  sunMoon: 'panchang.sunMoon',
  auspicious: 'panchang.auspicious',
  inauspicious: 'panchang.inauspicious',
  eclipse: 'panchang.eclipse',
  timeQuality: 'panchang.timeQuality',
  forYou: 'panchang.forYou',
  planetary: 'panchang.planetary',
} as const;

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

/**
 * Sacred Almanac entry. Auto-shapes itself by data:
 *
 *  Dynamic limbs (tithi / nakshatra / yoga / karana — multiple elements OR
 *  carry an end-time): rendered as a small italic Fraunces kicker stacked
 *  over a serif headline name with a mono right-rail end-time. Mid-day
 *  transitions chain below the primary element as smaller secondary lines
 *  with a leading hairline marker. Active element gets an accent dot and
 *  accent-colour name; the element active at sunrise (when not the primary)
 *  gets a tiny italic " · sunrise" tail. No fixed label column — the entry
 *  consumes the full card width, so long names like "Krishna Panchami" and
 *  "Purva Ashadha · 4" never truncate.
 *
 *  Static limbs (single element with no end-time — vara, anandadi, chandra
 *  rashi, surya nakshatra, masa): rendered as a tight 2-column ledger row
 *  with the kicker on the left and the value on the right, hairline-divided.
 *
 *  Auto-detection keeps the call site identical to the old API.
 */
const LimbRow = memo(function LimbRow({ label, elements, colors, isLast, isToday }: LimbRowProps) {
  const isStatic = elements.length === 1 && !elements[0].endTime;

  if (isStatic) {
    return (
      <>
        <View style={styles.staticRow}>
          <Text variant="display-italic" style={[styles.kicker, { color: colors.accent }]} numberOfLines={1}>
            {label}
          </Text>
          <Text style={[styles.staticValue, { color: colors.textPrimary }]} numberOfLines={1}>
            {elements[0].name}
          </Text>
        </View>
        {!isLast && <View style={[styles.limbDivider, { backgroundColor: colors.divider }]} />}
      </>
    );
  }

  const activeIdx = isToday ? getActiveIndex(elements) : -1;
  return (
    <>
      <View style={styles.dynamicLimb}>
        <Text variant="display-italic" style={[styles.kicker, { color: colors.accent }]} numberOfLines={1}>
          {label}
        </Text>
        {elements.map((el, i) => {
          const isPrimary = i === 0;
          const isActive = i === activeIdx;
          const padaSuffix = el.pada !== undefined ? ` · ${el.pada}` : '';
          const showSunriseTail = elements.length > 1 && el.isActiveAtSunrise && !isPrimary;
          const nameColor = isActive
            ? colors.accent
            : isPrimary
              ? colors.textPrimary
              : colors.textSecondary;
          // End-time stays muted across active/inactive — the accent dot +
          // accent name already signal "this one's active". An accent time
          // would double-shout and pull the eye away from the name.
          const timeColor = colors.textMuted;
          return (
            <View key={i} style={[
              isPrimary ? styles.primaryRow : styles.secondaryRow,
              i > 0 && { marginTop: 4 },
            ]}>
              {!isPrimary && (
                <View style={[styles.continuationMark, { backgroundColor: colors.textMuted }]} />
              )}
              {isPrimary && isActive && (
                <View style={[styles.activeDot, { backgroundColor: colors.accent }]} />
              )}
              <Text
                style={[
                  isPrimary ? styles.primaryName : styles.secondaryName,
                  { color: nameColor, flex: 1 },
                ]}
                numberOfLines={2}>
                {el.name}{padaSuffix}
                {showSunriseTail && (
                  <Text style={[styles.sunriseTail, { color: colors.textMuted }]}>
                    {'  · sunrise'}
                  </Text>
                )}
              </Text>
              {el.endTime && (
                <Text
                  style={[
                    isPrimary ? styles.primaryEndTime : styles.secondaryEndTime,
                    { color: timeColor },
                  ]}
                  numberOfLines={1}>
                  {el.endTime}
                </Text>
              )}
            </View>
          );
        })}
      </View>
      {!isLast && <View style={[styles.limbDivider, { backgroundColor: colors.divider }]} />}
    </>
  );
});

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

interface MuhuratRowProps {
  label: string;
  start: string;
  end: string;
  tone: 'good' | 'bad';
  colors: ColorPalette;
  isLast?: boolean;
}

const MuhuratRow = memo(function MuhuratRow({ label, start, end, tone, colors, isLast }: MuhuratRowProps) {
  return (
    <>
      <View style={styles.muhuratRow}>
        <View style={[styles.muhuratDot, { backgroundColor: tone === 'good' ? AUSPICIOUS_GREEN : semanticColors.error }]} />
        <Text style={[styles.muhuratLabel, { color: colors.textSecondary }]} numberOfLines={1}>{label}</Text>
        <Text style={[styles.muhuratTime, { color: colors.textPrimary }]} numberOfLines={1}>
          {start} – {end}
        </Text>
      </View>
      {!isLast && <View style={[styles.muhuratDivider, { backgroundColor: colors.divider }]} />}
    </>
  );
});

interface SunMoonStripProps {
  sunrise: string;
  sunset: string;
  moonrise: string;
  moonset: string;
  nextSunrise: string;
  colors: ColorPalette;
  labels: { sunrise: string; sunset: string; nextSunrise: string; moonrise: string; moonset: string };
}

const SunMoonStrip = memo(function SunMoonStrip({
  sunrise, sunset, moonrise, moonset, nextSunrise, colors, labels,
}: SunMoonStripProps) {
  // Split into two equal-height rows divided by a hairline:
  //   row 1 (sun)  — sunrise / sunset / next sunrise   (3 cells)
  //   row 2 (moon) — moonrise / moonset                (2 cells)
  // The two-cell moon row gets wider cells, which gives times like "10:37 PM"
  // plenty of breathing room. Both rows share one outer card so the surface
  // still reads as a single ledger.
  const sunRow: { key: keyof SunMoonStripProps['labels']; time: string }[] = [
    { key: 'sunrise',     time: sunrise },
    { key: 'sunset',      time: sunset  },
    { key: 'nextSunrise', time: nextSunrise },
  ];
  const moonRow: { key: keyof SunMoonStripProps['labels']; time: string }[] = [
    { key: 'moonrise', time: moonrise },
    { key: 'moonset',  time: moonset  },
  ];
  const renderRow = (
    row: typeof sunRow,
    extra?: { borderTopWidth: number; borderTopColor: string },
  ) => (
    <View style={[styles.sunMoonRow, extra]}>
      {row.map((it, i) => (
        <View key={it.key} style={[styles.sunMoonCell, i > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.divider }]}>
          <Text variant="mono-caps" style={[styles.sunMoonLabel, { color: colors.textMuted }]} numberOfLines={1}>
            {labels[it.key]}
          </Text>
          <Text style={[styles.sunMoonTime, { color: colors.textPrimary }]} numberOfLines={1}>
            {it.time}
          </Text>
        </View>
      ))}
    </View>
  );
  return (
    <View style={[styles.sunMoonStrip, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
      {renderRow(sunRow)}
      {renderRow(moonRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider })}
    </View>
  );
});

interface AlmanacGroupProps {
  rows: { key: string; label: string; start?: string; end?: string }[];
  tone: 'good' | 'bad';
  colors: ColorPalette;
}

const AlmanacGroup = memo(function AlmanacGroup({ rows, tone, colors }: AlmanacGroupProps) {
  const visible = rows.filter(r => r.start && r.end);
  if (visible.length === 0) return null;
  return (
    <View style={[styles.almanacTable, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
      {visible.map((r, i) => (
        <MuhuratRow
          key={r.key}
          label={r.label}
          start={r.start!}
          end={r.end!}
          tone={tone}
          colors={colors}
          isLast={i === visible.length - 1}
        />
      ))}
    </View>
  );
});

interface FlagStripItem { key: string; label: string; tone: 'gold' | 'green' | 'sindoor' | 'error' }

interface FlagStripProps {
  items: FlagStripItem[];
  colors: ColorPalette;
}

const FlagStrip = memo(function FlagStrip({ items, colors }: FlagStripProps) {
  if (items.length === 0) return null;
  const toneToColor = (tone: FlagStripItem['tone']): string => {
    switch (tone) {
      case 'gold':    return palette.goldLeaf;
      case 'green':   return AUSPICIOUS_GREEN;
      case 'sindoor': return palette.sindoorWarm;
      case 'error':   return semanticColors.error;
    }
  };
  return (
    <View style={styles.flagStrip}>
      {items.map(it => {
        const c = toneToColor(it.tone);
        return (
          <View key={it.key} style={[styles.flag, { backgroundColor: c + '1A', borderColor: c + '55' }]}>
            <View style={[styles.flagDot, { backgroundColor: c }]} />
            <Text style={[styles.flagText, { color: c }]} numberOfLines={1}>{it.label}</Text>
          </View>
        );
      })}
    </View>
  );
});

// ─── Calendar view toggle ──────────────────────────────────────────────────
// Editorial-style segmented control that lives directly above the calendar
// grid. Both states are always visible — current state is communicated by an
// accent-colour label/icon plus a hairline gold underline rule beneath the
// selected option. Outer hairline rules + a centre divider frame the pair as
// a deliberate editorial stop between the month strip and the grid (replaces
// the old action-labelled chip in the header, which was cramped + cropped +
// confusing because it advertised the destination, not the current state).
interface CalendarViewToggleProps {
  layout: 'compact' | 'dense';
  onSelect: (next: 'compact' | 'dense') => void;
  a11yHint: string;
  defaultLabel: string;
  detailedLabel: string;
  colors: ColorPalette;
}

const CalendarViewToggle = memo(function CalendarViewToggle({
  layout, onSelect, a11yHint, defaultLabel, detailedLabel, colors,
}: CalendarViewToggleProps) {
  const renderOption = (
    key: 'compact' | 'dense',
    iconName: 'apps' | 'text',
    label: string,
  ) => {
    const isSelected = layout === key;
    const tone = isSelected ? colors.accent : colors.textTertiary;
    return (
      <MotionPressable
        onPress={() => onSelect(key)}
        accessibilityRole="button"
        accessibilityLabel={`${label} · ${a11yHint}`}
        accessibilityState={{ selected: isSelected }}
        style={styles.viewToggleOption}>
        <View style={styles.viewToggleLabelRow}>
          <Icon name={iconName} size={13} color={tone} />
          <Text variant="mono-caps" style={[styles.viewToggleText, { color: tone }]}>
            {label}
          </Text>
        </View>
        {/* Always reserve underline space so layout doesn't jump on switch.
            Color flips between gold and transparent. */}
        <View
          style={[
            styles.viewToggleUnderline,
            { backgroundColor: isSelected ? palette.gold : 'transparent' },
          ]}
        />
      </MotionPressable>
    );
  };

  return (
    <View style={styles.viewToggleRow}>
      <View style={[styles.viewToggleOuterRule, { backgroundColor: colors.divider }]} />
      {renderOption('compact', 'apps', defaultLabel)}
      <View style={[styles.viewToggleCenterDivider, { backgroundColor: colors.divider }]} />
      {renderOption('dense', 'text', detailedLabel)}
      <View style={[styles.viewToggleOuterRule, { backgroundColor: colors.divider }]} />
    </View>
  );
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PanchangScreen() {
  pmark('panchangScreen:render');
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
  const panchangLayout = useStore(s => s.panchangLayout);
  const setPanchangLayout = useStore(s => s.setPanchangLayout);
  const panchangCategoriesOpen = useStore(s => s.panchangCategoriesOpen);
  const togglePanchangCategory = useStore(s => s.togglePanchangCategory);
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
  const hasBirthData = userBirthDate !== null;

  // Lazy daily panchang — does NOT fire on day-tap. Each accordion's
  // onFirstOpen calls request(), which starts the daily compute and keeps it
  // synced with date / location / option changes for the rest of the session.
  const { panchang, loading, error, request, retry } = useLazyDailyPanchang(
    selectedDate, userLocation, panchangLang, region, janmaNakshatra, janmaRashi, ayanamsa,
  );

  useEffect(() => {
    pAccordionResetCount();
    pmark('panchangScreen:firstEffect');
  }, []);

  const firstRealDataMarkedRef = useRef(false);
  useEffect(() => {
    if (panchang && !firstRealDataMarkedRef.current) {
      firstRealDataMarkedRef.current = true;
      pmark('panchangScreen:firstPaint:realData');
    }
  }, [panchang]);

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

  // Calendar cells + per-day event category for the visible month.
  const calYear = calMonth.getFullYear();
  const calMonthIdx = calMonth.getMonth();
  const calLat = userLocation?.lat ?? 25.3176;
  const calLon = userLocation?.lon ?? 83.0103;
  // Peek the cache synchronously; on miss the screen paints first, then a
  // `useEffect` runs the ~80–120ms build off the render path (P11.1).
  const cachedMonth = useMemo(
    () => peekCalendarMonth(calYear, calMonthIdx, { lat: calLat, lon: calLon }, {
      region,
      ayanamsa,
      selectedDeities: [],
      masaSystem,
    }),
    [calYear, calMonthIdx, calLat, calLon, region, ayanamsa, masaSystem],
  );
  const [computedMonth, setComputedMonth] = useState<CalendarMonth | null>(null);
  useEffect(() => {
    if (cachedMonth) return;
    let cancelled = false;
    const handle = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      const built = getCalendarMonth(calYear, calMonthIdx, { lat: calLat, lon: calLon }, {
        region,
        ayanamsa,
        selectedDeities: [],
        masaSystem,
      });
      if (!cancelled) setComputedMonth(built);
    });
    return () => { cancelled = true; handle.cancel(); };
  }, [cachedMonth, calYear, calMonthIdx, calLat, calLon, region, ayanamsa, masaSystem]);
  const monthData = cachedMonth ?? computedMonth;

  const cells: (Date | null)[] = useMemo(
    () => monthData ? monthData.cells.map(c => c.date) : [],
    [monthData],
  );
  const cellLookup = useMemo(() => {
    const m = new Map<string, CalendarDay>();
    if (!monthData) return m;
    for (const c of monthData.cells) {
      m.set(ymdKey(c.date), c);
    }
    return m;
  }, [monthData]);

  // Selected-day cell — the source for the synchronous glance section.
  // When the selected date crosses into a different month we may not have a
  // cell for it (cells.length covers only the visible month + overflow rows).
  // In that rare case the glance falls back gracefully.
  const selectedCell = cellLookup.get(ymdKey(selectedDate));

  // Walkthrough ref & measurement — now points at the Pancha Anga *accordion
  // header*, since the card itself lives inside the (collapsed-by-default)
  // accordion body.
  const panchaAngaRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef(0);
  const [panchaAngaRect, setPanchaAngaRect] = useState<SpotlightRect | null>(null);

  const measurePanchaAnga = useCallback(() => {
    const target = panchaAngaRef.current;
    const scroller = scrollRef.current;
    if (!target) return;

    const captureSpotlight = () => {
      target.measureInWindow((x, y, width, height) => {
        if (width > 0) {
          setPanchaAngaRect({ x, y, width, height: Math.min(height, 320) });
        }
      });
    };

    if (!scroller) {
      captureSpotlight();
      return;
    }

    target.measureInWindow((tx, ty) => {
      const desiredScreenY = 100;
      const delta = ty - desiredScreenY;
      const targetScroll = Math.max(0, scrollOffsetRef.current + delta);
      const needsScroll = Math.abs(targetScroll - scrollOffsetRef.current) > 4;
      if (needsScroll) {
        scroller.scrollTo({ y: targetScroll, animated: true });
        setTimeout(captureSpotlight, 380);
      } else {
        captureSpotlight();
      }
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      pmark('panchangScreen:focused');
      if (walkthroughStep === 2) {
        const timer = setTimeout(measurePanchaAnga, 350);
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
    Haptics.selectionAsync().catch(() => { /* non-critical */ });
    setSelectedDate(d);
    if (!isSameMonth(d, calMonth)) {
      setCalMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  }, [calMonth]);

  const handlePickFromModal = useCallback((d: Date) => {
    setSelectedDate(d);
    setCalMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  }, []);

  // ── Date-change crossfade + horizontal swipe gesture (P11.6) ──────────────
  // Date changes (tap, swipe, picker) trigger a 140ms fade-out, the underlying
  // useLazyDailyPanchang re-fetches during that window, then a 220ms fade-in
  // with a 4px upward translate. The swipe gesture lives on the same wrapper:
  // |dx| > 80 OR |v| > 400 commits the day change, otherwise spring-back.
  // `activeOffsetX` lets vertical scroll win; the inner ScrollView's pan stays
  // dominant for any motion that's more vertical than horizontal.
  const { dur } = useReducedMotion();
  const transitionProgress = useSharedValue(1);
  const swipeX = useSharedValue(0);
  const prevDateKeyRef = useRef(ymdKey(selectedDate));

  useEffect(() => {
    const key = ymdKey(selectedDate);
    if (prevDateKeyRef.current === key) return;
    prevDateKeyRef.current = key;
    transitionProgress.value = withSequence(
      withTiming(0, { duration: dur(140), easing: easings.standard }),
      withTiming(1, { duration: dur(durations.base), easing: easings.standard }),
    );
  }, [selectedDate, dur, transitionProgress]);

  const goToDay = useCallback((deltaDays: number) => {
    Haptics.selectionAsync().catch(() => { /* non-critical */ });
    setSelectedDate(prev => {
      const next = new Date(prev);
      next.setDate(next.getDate() + deltaDays);
      // Roll the calendar month if we crossed a boundary.
      setCalMonth(m =>
        isSameMonth(next, m) ? m : new Date(next.getFullYear(), next.getMonth(), 1),
      );
      return next;
    });
  }, []);

  const swipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-15, 15])
        .failOffsetY([-15, 15])
        .onUpdate(e => {
          swipeX.value = e.translationX;
        })
        .onEnd(e => {
          'worklet';
          const committed =
            Math.abs(e.translationX) > 80 || Math.abs(e.velocityX) > 400;
          if (committed) {
            // Negative dx → swipe left → next day; positive dx → previous day.
            const delta = e.translationX < 0 ? 1 : -1;
            runOnJS(goToDay)(delta);
          }
          swipeX.value = withSpring(0, { damping: 18, stiffness: 200 });
        }),
    [swipeX, goToDay],
  );

  const contentAnimStyle = useAnimatedStyle(() => ({
    opacity: transitionProgress.value,
    transform: [
      { translateX: swipeX.value },
      { translateY: (1 - transitionProgress.value) * 4 },
    ],
  }));

  const handleSelectLayout = useCallback((next: 'compact' | 'dense') => {
    if (next === panchangLayout) return;
    Haptics.selectionAsync().catch(() => { /* non-critical */ });
    setPanchangLayout(next);
  }, [panchangLayout, setPanchangLayout]);

  const monthNames = t('panchang.monthNames', { returnObjects: true }) as string[];
  const dayHeaders = t('panchang.dayHeaders', { returnObjects: true }) as string[];

  const selectedGregorian = selectedDate.toLocaleDateString(
    panchangLang === 'hi' ? 'hi-IN' : 'en-IN',
    { weekday: 'short', day: 'numeric', month: 'short' },
  );

  // ── Glance data (sync — sourced from cellLookup, no daily compute) ──────
  const glanceFestivals: FlagStripItem[] = useMemo(() => {
    if (!selectedCell) return [];
    // Always show the festival name. Append `description` only when it adds
    // information on *this* day — i.e. when it isn't a shared metadata string
    // across multiple festivals (lunar month for majors on Diwali day, rashi
    // for the Sankranti triple, etc.). A description that's unique on the day
    // (e.g. Ekadashi day with one row and desc="Saphala Ekadashi", or a
    // pradosha with desc="Shani Pradosha") still surfaces.
    const descCounts = new Map<string, number>();
    selectedCell.festivals.forEach(f => {
      if (!f.description) return;
      descCounts.set(f.description, (descCounts.get(f.description) ?? 0) + 1);
    });
    const seen = new Set<string>();
    const out: FlagStripItem[] = [];
    selectedCell.festivals.forEach((f, i) => {
      const showDesc = !!f.description && (descCounts.get(f.description) ?? 0) === 1;
      const name = localizeFestivalName(f.name, panchangLang);
      const label = showDesc
        ? `${name} · ${localizeFestivalDescription(f.description!, panchangLang)}`
        : name;
      if (seen.has(label)) return;
      seen.add(label);
      out.push({ key: `fest-${i}`, label, tone: 'gold' as const });
    });
    return out;
  }, [selectedCell, panchangLang]);

  const glanceLine = useMemo(() => {
    if (!selectedCell) return '';
    const parts: string[] = [];
    if (selectedCell.tithiName) {
      const pakshaTag = selectedCell.paksha === 'shukla' ? 'S' : 'K';
      parts.push(`${localizeTithi(selectedCell.tithiName, panchangLang)} ${pakshaTag}`);
    }
    if (selectedCell.nakshatra) {
      parts.push(localizeNakshatra(selectedCell.nakshatra, panchangLang));
    }
    if (selectedCell.yoga) {
      parts.push(localizeYoga(selectedCell.yoga, panchangLang));
    }
    return parts.join(' · ');
  }, [selectedCell, panchangLang]);

  // Pancha Anga is the canonical "what is this day?" view, so it defaults
  // to open when the user hasn't yet interacted with it. An explicit collapse
  // by the user is still honoured (the persisted `false` overrides this
  // default). Other categories default to closed — lazy until requested.
  const isCategoryOpen = useCallback(
    (key: string) => {
      const stored = panchangCategoriesOpen[key];
      if (stored !== undefined) return stored;
      return key === CATEGORY_KEYS.panchaAnga;
    },
    [panchangCategoriesOpen],
  );
  const onAnyAccordionFirstOpen = useCallback(() => {
    request();
  }, [request]);

  // Show body content for an open accordion: real content if panchang loaded,
  // a slim placeholder otherwise. We never show a heavy skeleton here — once
  // an accordion is open the user has committed to seeing the content, and
  // the daily compute is fast (~5ms) so the placeholder appears for one frame.
  const renderPlaceholder = (key: string) => (
    <View style={[styles.placeholder, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
      <Text style={[styles.placeholderText, { color: colors.textMuted }]}>
        {error ? t('panchang.calculationFailed') : (loading ? '…' : t('panchang.tapToReveal'))}
      </Text>
      {error && (
        <MotionPressable onPress={retry} hitSlop={8} style={[styles.placeholderRetry, { borderColor: colors.accent }]}
          accessibilityRole="button" accessibilityLabel={t('common.retry')}>
          <Text style={[styles.placeholderRetryText, { color: colors.accent }]}>{t('common.retry')}</Text>
        </MotionPressable>
      )}
    </View>
  );

  return (
    <ScreenMount>
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top']}>

      {/* ── Editorial Header ──────────────────────────────────────────────── */}
      {/* Left slot is intentionally empty — the calendar-view toggle now
          lives directly above the grid it controls. The empty 90pt View
          balances the right-side location pill so the centred title stays
          centred. */}
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
        ref={scrollRef}
        onScroll={(e) => {
          scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={32}
        contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
        showsVerticalScrollIndicator={false}>

        {/* ── Month strip ──────────────────────────────────────────────────── */}
        <View style={styles.monthStrip}>
          <MotionPressable
            onPress={goPrevMonth}
            hitSlop={12}
            style={styles.monthBtn}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.previousMonth')}>
            <Icon name="chevron-left" size={18} color={colors.textTertiary} />
          </MotionPressable>
          <MotionPressable
            onPress={() => setPickerOpen(true)}
                hitSlop={6}
            style={[
              styles.monthLabelRow,
              { backgroundColor: colors.surface, borderColor: colors.borderAccent },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.openDatePicker')}>
            <Text variant="display-italic" style={[styles.monthName, { color: colors.textPrimary }]}>
              {monthNames[calMonthIdx]}
            </Text>
            <Text variant="mono" style={[styles.monthYear, { color: colors.textTertiary }]}>
              {calYear}
            </Text>
            <View style={[styles.monthDialDivider, { backgroundColor: colors.border }]} />
            <Icon name="caret-down" size={12} color={colors.accent} />
          </MotionPressable>
          <MotionPressable
            onPress={goNextMonth}
            hitSlop={12}
            style={styles.monthBtn}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.nextMonth')}>
            <Icon name="chevron-right" size={18} color={colors.textTertiary} />
          </MotionPressable>
        </View>

        {!isViewingToday && (
          <View style={styles.todayRow}>
            <MotionPressable
              onPress={goToday}
                    style={[styles.todayChip, { borderColor: colors.accent }]}
              accessibilityRole="button"
              accessibilityLabel={t('a11y.today')}>
              <Icon name="return-back" size={12} color={colors.accent} />
              <Text variant="mono-caps" style={[styles.todayChipText, { color: colors.accent }]}>
                {t('panchang.todayChip')}
              </Text>
            </MotionPressable>
          </View>
        )}

        {/* ── Calendar view toggle ──────────────────────────────────────────── */}
        <CalendarViewToggle
          layout={panchangLayout}
          onSelect={handleSelectLayout}
          a11yHint={t('panchang.layoutToggleHint')}
          defaultLabel={t('panchang.layoutCompact')}
          detailedLabel={t('panchang.layoutDense')}
          colors={colors}
        />

        {/* ── Calendar grid (compact OR dense) ─────────────────────────────── */}
        {/* On cold cache `peekCalendarMonth` returns null and the grid sits
            empty until `getCalendarMonth` runs after-interactions (~80–120ms
            on a Pixel 3a). Crossfade a same-shape skeleton until monthData
            lands so the calendar slot keeps its dimensions and the user sees
            shimmer placeholders instead of an empty void. */}
        <SkeletonCrossfade
          ready={monthData !== null}
          skeleton={
            <CalendarGridSkeleton
              layout={panchangLayout}
              colors={colors}
              isDarkMode={isDarkMode}
            />
          }>
          {panchangLayout === 'dense' ? (
            // Dense grid breaks out of the screen's 24pt horizontal padding so
            // the 6 week-columns + weekday rail get an extra ~32pt total —
            // each cell goes from ~50pt to ~58pt wide. Compact grid keeps the
            // parent padding (smaller, breathable on tighter cells).
            <View style={styles.denseGridWrap}>
              <CalGridDense
                cells={cells}
                cellLookup={cellLookup}
                selectedDate={selectedDate}
                today={today}
                calMonthIdx={calMonthIdx}
                isDarkMode={isDarkMode}
                colors={colors}
                dayHeaders={dayHeaders}
                panchangLang={panchangLang}
                digits={digits}
                onPickDay={handlePickDay}
              />
            </View>
          ) : (
            <>
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
              <View style={styles.calGrid}>
                {cells.map((cellDate, idx) => {
                  if (!cellDate) return <View key={`blank-${idx}`} style={styles.calCell} />;
                  const inCurrentMonth = cellDate.getMonth() === calMonthIdx;
                  const isTodayCell = isSameDay(cellDate, today);
                  const isSelected = isSameDay(cellDate, selectedDate);
                  const dayInfo = cellLookup.get(ymdKey(cellDate));
                  const dotColor = inCurrentMonth ? eventDotColor(dayInfo, isDarkMode, colors) : null;
                  const isMajorEvent = dotColor !== null && dayInfo?.eventCategory === 'festival';

                  const baseNumColor = isSelected
                    ? palette.parchmentBright
                    : !inCurrentMonth
                      ? colors.textDisabled
                      : isMajorEvent
                        ? colors.accent
                        : colors.textPrimary;

                  return (
                    <MotionPressable
                      key={idx}
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
                          {digits(String(cellDate.getDate()))}
                        </Text>
                        {dotColor && !isSelected && (
                          <View style={[styles.festivalDot, { backgroundColor: dotColor }]} />
                        )}
                      </View>
                    </MotionPressable>
                  );
                })}
              </View>
            </>
          )}
        </SkeletonCrossfade>

        <Ornament variant="double-rule" style={styles.postCalRule} />

        {/* ── Date-dependent content (fades on date change, swipe-able) ──── */}
        <GestureDetector gesture={swipeGesture}>
        <Animated.View style={contentAnimStyle}>

        {/* ── Selected-day line ────────────────────────────────────────────── */}
        <View style={styles.selectedLine}>
          <Text variant="mono-caps" style={[styles.selectedKicker, { color: colors.accent }]}>
            {isViewingToday ? t('panchang.todayChip') : selectedGregorian}
          </Text>
          {monthData && monthData.vikramSamvat > 0 && showVikramSamvat && (
            <Text variant="body-italic" style={[styles.selectedSamvat, { color: colors.textTertiary }]}>
              {t('panchang.vsSamvat', { year: digits(String(monthData.vikramSamvat)) })}
            </Text>
          )}
        </View>

        {/* ── Glance — festivals + tithi/nakshatra/yoga (no daily fetch) ──── */}
        {selectedCell && selectedCell.eventCategory !== 'plain' && selectedCell.primaryEventName && (
          <Text variant="display-italic" style={[styles.glanceEvent, {
            color: eventDotColor(selectedCell, isDarkMode, colors) ?? colors.textPrimary,
          }]} numberOfLines={2}>
            {localizePrimaryEvent(selectedCell.primaryEventName, panchangLang)}
          </Text>
        )}

        <FlagStrip colors={colors} items={glanceFestivals} />

        {glanceLine.length > 0 && (
          <View style={[styles.glanceTithiRow, { borderColor: colors.divider }]}>
            <Text variant="mono-caps" style={[styles.glanceKicker, { color: colors.accent }]}>
              {t('panchang.glanceTitle')}
            </Text>
            <Text variant="body-italic" style={[styles.glanceTithiText, { color: colors.textSecondary }]} numberOfLines={2}>
              {glanceLine}
            </Text>
          </View>
        )}

        {/* AT THIS MOMENT — only on today */}
        {isViewingToday && instant && (
          <View style={[styles.instantRow, { borderColor: colors.divider }]}>
            <Text variant="mono-caps" style={[styles.instantKicker, { color: colors.accent }]}>
              {t('panchang.atThisMoment')}
            </Text>
            <Text variant="body-italic" style={[styles.instantBody, { color: colors.textSecondary }]} numberOfLines={1}>
              {`${localizeTithi(instant.tithi, panchangLang)} · ${localizeNakshatra(instant.nakshatra, panchangLang)} · ${localizeYoga(instant.yoga, panchangLang)}`}
            </Text>
          </View>
        )}

        {/* ── Muhurat finder entry ── */}
        <MotionPressable
          pressedScale={0.97}
          onPress={() => router.push('/muhurat')}
          style={[styles.muhuratEntry, { backgroundColor: colors.surface, borderColor: colors.borderAccent }]}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.openMuhuratFinder')}>
          <Icon name="calendar" size={16} color={colors.accent} />
          <Text style={[styles.muhuratEntryText, { color: colors.accent }]}>
            {t('panchang.findAuspiciousDate')}
          </Text>
          <Icon name="chevron-right" size={14} color={colors.accent} />
        </MotionPressable>

        {/* ── Inline Ad ── */}
        <AdBanner colors={colors} placement="panchangInline" inline />

        {/* ── Categorised drill-ins ──────────────────────────────────────── */}
        {/* Each accordion's onFirstOpen fires the lazy daily-panchang compute.
            Open state persists in Zustand so users who always look at the same
            categories don't have to re-expand them daily. */}

        {/* Pancha Anga — five limbs + masa + extensions + day flags */}
        <View ref={panchaAngaRef}>
          <AccordionSection
            storageKey={CATEGORY_KEYS.panchaAnga}
            title={t('panchang.panchaAngaSection')}
            open={isCategoryOpen(CATEGORY_KEYS.panchaAnga)}
            onToggle={() => togglePanchangCategory(CATEGORY_KEYS.panchaAnga)}
            onFirstOpen={onAnyAccordionFirstOpen}
            colors={colors}>
            {panchang ? (
              <>
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <LimbRow label={t('panchang.tithiLunarDay')} elements={panchang.tithis} colors={colors} isToday={isViewingToday} />
                  <LimbRow label={t('panchang.nakshatraLunarMansion')} elements={panchang.nakshatras} colors={colors} isToday={isViewingToday} />
                  <LimbRow label={t('panchang.yogaSunMoon')} elements={panchang.yogas} colors={colors} isToday={isViewingToday} />
                  <LimbRow label={t('panchang.karanaLbl')} elements={panchang.karanas} colors={colors} isToday={isViewingToday} />
                  <LimbRow
                    label={t('panchang.varaDayOfWeek')}
                    elements={[{ name: panchang.vara ?? selectedDate.toLocaleDateString(panchangLang === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'long' }) }]}
                    colors={colors}
                  />
                  {panchang.anandadiYoga && (
                    <LimbRow label={t('panchang.anandadiYoga')} elements={[{ name: panchang.anandadiYoga.name }]} colors={colors} />
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
                      <View style={styles.staticRow}>
                        <Text variant="display-italic" style={[styles.kicker, { color: colors.accent }]} numberOfLines={1}>
                          {t('panchang.chandraMasa')}
                        </Text>
                        <Text style={[styles.staticValue, { color: colors.textPrimary, marginRight: 8 }]} numberOfLines={1}>
                          {localizeChandraMasa(
                            (masaSystem === 'purnimanta' ? panchang.hinduMonthPurnimanta : panchang.hinduMonthAmanta) ?? '',
                            panchangLang,
                          )}
                        </Text>
                        <MotionPressable
                          onPress={() => setMasaSystem(masaSystem === 'purnimanta' ? 'amanta' : 'purnimanta')}
                                            style={[styles.masaChip, { backgroundColor: colors.accent + '18', borderColor: colors.accent + '40' }]}
                          accessibilityRole="button"
                          accessibilityLabel={masaSystem === 'purnimanta' ? t('panchang.amanta') : t('panchang.purnimanta')}>
                          <Text style={[styles.masaChipText, { color: colors.accent }]} numberOfLines={1}>
                            {masaSystem === 'purnimanta' ? t('panchang.purnimanta') : t('panchang.amanta')}
                          </Text>
                          <Icon name="swap-horizontal" size={11} color={colors.accent} />
                        </MotionPressable>
                      </View>
                    </>
                  )}
                  {panchang.masa && (
                    <LimbRow label={t('panchang.masaSolarMonth')} elements={[{ name: panchang.masa }]} colors={colors} isLast />
                  )}
                </View>
                {/* Day-status flags — special yogas / panchaka / ganda mula / adhika */}
                <FlagStrip
                  colors={colors}
                  items={[
                    ...(panchang.isAdhikaMasa ? [{ key: 'adhika', label: t('panchang.adhikaMasa'), tone: 'gold' as const }] : []),
                    ...panchang.specialYogas.map((y, i) => ({
                      key: `yoga-${i}`, label: localizeYoga(y.name, panchangLang), tone: 'green' as const,
                    })),
                    ...(panchang.panchaka ? [{ key: 'panchaka', label: t('panchang.panchaka'), tone: 'sindoor' as const }] : []),
                    ...(panchang.gandaMula
                      ? [{
                          key: 'ganda',
                          label: t(
                            panchang.gandaMula.severity === 'severe' ? 'panchang.gandaMulaSevere' : 'panchang.gandaMulaMild',
                            { nakshatra: panchang.gandaMula.nakshatraName },
                          ),
                          tone: panchang.gandaMula.severity === 'severe' ? ('error' as const) : ('sindoor' as const),
                        }]
                      : []),
                  ]}
                />
              </>
            ) : (
              renderPlaceholder(CATEGORY_KEYS.panchaAnga)
            )}
          </AccordionSection>
        </View>

        {/* Sun & Moon */}
        <AccordionSection
          storageKey={CATEGORY_KEYS.sunMoon}
          title={t('panchang.sunMoonSection')}
          open={isCategoryOpen(CATEGORY_KEYS.sunMoon)}
          onToggle={() => togglePanchangCategory(CATEGORY_KEYS.sunMoon)}
          onFirstOpen={onAnyAccordionFirstOpen}
          colors={colors}>
          {panchang ? (
            <>
              <SunMoonStrip
                colors={colors}
                sunrise={panchang.sunrise}
                sunset={panchang.sunset}
                nextSunrise={panchang.nextSunrise ?? '—'}
                moonrise={panchang.moonrise ?? '—'}
                moonset={panchang.moonset ?? '—'}
                labels={{
                  sunrise: t('home.sunrise'),
                  sunset: t('home.sunset'),
                  nextSunrise: t('panchang.nextSunrise'),
                  moonrise: t('panchang.moonrise'),
                  moonset: t('panchang.moonset'),
                }}
              />
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
            </>
          ) : (
            renderPlaceholder(CATEGORY_KEYS.sunMoon)
          )}
        </AccordionSection>

        {/* Auspicious times */}
        <AccordionSection
          storageKey={CATEGORY_KEYS.auspicious}
          title={t('panchang.auspiciousTimes')}
          open={isCategoryOpen(CATEGORY_KEYS.auspicious)}
          onToggle={() => togglePanchangCategory(CATEGORY_KEYS.auspicious)}
          onFirstOpen={onAnyAccordionFirstOpen}
          accentColor={AUSPICIOUS_GREEN}
          colors={colors}>
          {panchang ? (
            <AlmanacGroup
              tone="good"
              colors={colors}
              rows={[
                { key: 'brahma',   label: t('panchang.brahmaMuhurta'),   start: panchang.brahmaMuhurtaStart,   end: panchang.brahmaMuhurtaEnd },
                { key: 'pratah',   label: t('panchang.pratahSandhya'),   start: panchang.pratahSandhyaStart,   end: panchang.pratahSandhyaEnd },
                { key: 'abhijit',  label: t('panchang.abhijitMuhurta'),  start: panchang.abhijitMuhurtaStart,  end: panchang.abhijitMuhurtaEnd },
                { key: 'madhya',   label: t('panchang.madhyahna'),       start: panchang.madhyahnaStart,       end: panchang.madhyahnaEnd },
                { key: 'vijaya',   label: t('panchang.vijayaMuhurta'),   start: panchang.vijayaMuhurtaStart,   end: panchang.vijayaMuhurtaEnd },
                { key: 'godhuli',  label: t('panchang.godhuliMuhurta'),  start: panchang.godhuliMuhurtaStart,  end: panchang.godhuliMuhurtaEnd },
                { key: 'sayahna',  label: t('panchang.sayahnaSandhya'),  start: panchang.sayahnaSandhyaStart,  end: panchang.sayahnaSandhyaEnd },
                { key: 'amrit',    label: t('panchang.amritKala'),       start: panchang.amritKalaStart,       end: panchang.amritKalaEnd },
                { key: 'nishita',  label: t('panchang.nishitaMuhurta'),  start: panchang.nishitaMuhurtaStart,  end: panchang.nishitaMuhurtaEnd },
              ]}
            />
          ) : (
            renderPlaceholder(CATEGORY_KEYS.auspicious)
          )}
        </AccordionSection>

        {/* Inauspicious times */}
        <AccordionSection
          storageKey={CATEGORY_KEYS.inauspicious}
          title={t('panchang.inauspiciousTimes')}
          open={isCategoryOpen(CATEGORY_KEYS.inauspicious)}
          onToggle={() => togglePanchangCategory(CATEGORY_KEYS.inauspicious)}
          onFirstOpen={onAnyAccordionFirstOpen}
          accentColor={semanticColors.error}
          colors={colors}>
          {panchang ? (
            <AlmanacGroup
              tone="bad"
              colors={colors}
              rows={[
                { key: 'rahu',    label: t('panchang.rahuKalam'),   start: panchang.rahuKalamStart,    end: panchang.rahuKalamEnd },
                { key: 'yama',    label: t('panchang.yamaganda'),   start: panchang.yamagandaStart,    end: panchang.yamagandaEnd },
                { key: 'gulika',  label: t('panchang.gulikaKalam'), start: panchang.gulikaKalamStart,  end: panchang.gulikaKalamEnd },
                ...panchang.durMuhurta.map((dm, i) => ({
                  key: `dur-${i}`, label: t('panchang.durMuhurta'), start: dm.start, end: dm.end,
                })),
                { key: 'varjyam', label: t('panchang.varjyam'),     start: panchang.varjyamStart,      end: panchang.varjyamEnd },
                ...(panchang.bhadra
                  ? [{ key: 'bhadra', label: t('panchang.bhadra'), start: panchang.bhadra.start, end: panchang.bhadra.end }]
                  : []),
              ]}
            />
          ) : (
            renderPlaceholder(CATEGORY_KEYS.inauspicious)
          )}
        </AccordionSection>

        {/* Eclipse — only when present (read sync from cell snapshot) */}
        {selectedCell?.eclipse && (
          <AccordionSection
            storageKey={CATEGORY_KEYS.eclipse}
            title={t('panchang.eclipseSection')}
            open={isCategoryOpen(CATEGORY_KEYS.eclipse)}
            onToggle={() => togglePanchangCategory(CATEGORY_KEYS.eclipse)}
            onFirstOpen={onAnyAccordionFirstOpen}
            accentColor={semanticColors.error}
            colors={colors}>
            {panchang?.eclipse ? (
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
            ) : (
              renderPlaceholder(CATEGORY_KEYS.eclipse)
            )}
          </AccordionSection>
        )}

        {/* Time quality — Choghadiya / Gowri / Do Ghati / Hora */}
        <AccordionSection
          storageKey={CATEGORY_KEYS.timeQuality}
          title={t('panchang.timeQuality')}
          open={isCategoryOpen(CATEGORY_KEYS.timeQuality)}
          onToggle={() => togglePanchangCategory(CATEGORY_KEYS.timeQuality)}
          onFirstOpen={onAnyAccordionFirstOpen}
          colors={colors}>
          {panchang ? (
            <>
              <QualitySlotsCard label={t('panchang.choghadiya')} slots={panchang.choghadiya} colors={colors} />
              <QualitySlotsCard label={t('panchang.gowriPanchangam')} slots={panchang.gowriPanchangam} colors={colors} />
              <QualitySlotsCard label={t('panchang.doGhatiMuhurta')} slots={panchang.doGhatiMuhurta} colors={colors} />
              <HoraCard slots={panchang.hora} colors={colors} />
            </>
          ) : (
            renderPlaceholder(CATEGORY_KEYS.timeQuality)
          )}
        </AccordionSection>

        {/* For You — only when birth data is set; tarabala/chandra balam keyed off it */}
        {hasBirthData && (
          <AccordionSection
            storageKey={CATEGORY_KEYS.forYou}
            title={t('panchang.forYouSection')}
            open={isCategoryOpen(CATEGORY_KEYS.forYou)}
            onToggle={() => togglePanchangCategory(CATEGORY_KEYS.forYou)}
            onFirstOpen={onAnyAccordionFirstOpen}
            accentColor={colors.accent}
            colors={colors}>
            {panchang ? (
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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
                    isLast={!panchang.anandadiYoga}
                  />
                )}
                {panchang.anandadiYoga && (
                  <LimbRow
                    label={t('panchang.anandadiYoga')}
                    elements={[{ name: panchang.anandadiYoga.name }]}
                    colors={colors}
                    isLast
                  />
                )}
              </View>
            ) : (
              renderPlaceholder(CATEGORY_KEYS.forYou)
            )}
          </AccordionSection>
        )}

        {/* Planetary positions */}
        <AccordionSection
          storageKey={CATEGORY_KEYS.planetary}
          title={t('panchang.planetaryPositions')}
          open={isCategoryOpen(CATEGORY_KEYS.planetary)}
          onToggle={() => togglePanchangCategory(CATEGORY_KEYS.planetary)}
          onFirstOpen={onAnyAccordionFirstOpen}
          colors={colors}>
          {panchang?.planetaryPositions && panchang.planetaryPositions.length > 0 ? (
            <PlanetaryPositionsCard positions={panchang.planetaryPositions} colors={colors} />
          ) : (
            renderPlaceholder(CATEGORY_KEYS.planetary)
          )}
        </AccordionSection>

        </Animated.View>
        </GestureDetector>

      </ScrollView>

      {/* ── Walkthrough Step 2: Spotlight Pancha Anga accordion header ── */}
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

      <DatePickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        value={selectedDate}
        onPick={handlePickFromModal}
        minDate={new Date(1900, 0, 1)}
        maxDate={new Date(2100, 11, 31)}
        minYear={1900}
        maxYear={2100}
        colors={colors}
        mode="month"
        title={t('panchang.datePickerTitle', { defaultValue: 'Jump to month' })}
      />

    </SafeAreaView>
    </ScreenMount>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingBottom: 32, paddingTop: 2 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  headerSide: { width: 90 },
  headerSideRight: { alignItems: 'flex-end' },
  headerCenter: { flex: 1, alignItems: 'center', gap: 2 },
  headerTitle: { fontSize: 18, lineHeight: 24 },
  locPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: 104,
  },
  locText: { fontSize: 8.5 },

  // Editorial segmented toggle — sits directly above the calendar grid.
  // Outer hairline rules + a centre divider frame the two options as a
  // chapter-selector-style stop. Selected option gets a 1pt gold underline.
  viewToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 8,
  },
  viewToggleOuterRule: {
    width: 24,
    height: StyleSheet.hairlineWidth,
  },
  viewToggleOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  viewToggleLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  viewToggleText: {
    fontSize: 11,
    letterSpacing: 1.0,
  },
  viewToggleUnderline: {
    height: 1,
    width: 36,
    marginTop: 5,
  },
  viewToggleCenterDivider: {
    width: StyleSheet.hairlineWidth,
    height: 14,
  },

  monthStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    paddingBottom: 4,
  },
  monthBtn: { padding: 6 },
  monthLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingLeft: 14,
    paddingRight: 11,
    paddingVertical: 6,
    borderRadius: borderRadius.chip,
    borderWidth: 1,
  },
  monthName: { fontSize: 19, lineHeight: 22 },
  monthYear: { fontSize: 11, letterSpacing: 1.3, marginBottom: 2 },
  monthDialDivider: {
    width: StyleSheet.hairlineWidth,
    height: 14,
    marginLeft: 1,
  },

  todayRow: { alignItems: 'center', marginBottom: 2 },
  todayChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  todayChipText: { fontSize: 8.5 },

  // Negative side margin pulls the dense grid out of the screen's 24pt
  // horizontal padding, leaving ~8pt of effective inset on each edge. Keeps
  // the grid centred while giving each cell ~16% more width to breathe in.
  denseGridWrap: { marginHorizontal: -16 },

  // Compact grid (existing)
  calHeaderRow: { flexDirection: 'row', paddingVertical: 6 },
  calDayHeader: { flex: 1, textAlign: 'center', fontSize: 8.5 },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: `${100 / 7}%`, aspectRatio: 1 / 1.05, padding: 1.5 },
  calCellInner: {
    flex: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingTop: 1,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  calDayNum: { fontFamily: 'Fraunces_400Regular', fontSize: 13.5, lineHeight: 15 },
  festivalDot: {
    position: 'absolute',
    bottom: 3,
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
  },
  postCalRule: { marginTop: 6, marginBottom: 10 },

  // Selected-day line
  selectedLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  selectedKicker: { fontSize: 9 },
  selectedSamvat: { fontSize: 11.5 },

  glanceEvent: {
    fontSize: 22,
    lineHeight: 28,
    marginBottom: 8,
  },
  glanceTithiRow: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  glanceKicker: { fontSize: 8.5, letterSpacing: 1.1 },
  glanceTithiText: { fontSize: 13, flex: 1, lineHeight: 18 },

  // ─── Pancha Anga card (Sacred Almanac entry layout) ──────────────────────
  // Outer card hosts a vertical sequence of limb entries. Padding is generous
  // horizontally so the long-form serif names breathe; vertical padding stays
  // tight so the section stays scan-able as a printed almanac page.
  card: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
    marginBottom: 8,
  },

  // Shared italic Fraunces kicker — the section-label treatment in the new
  // layout. Lowercase ("tithi", "nakshatra"); editorial italics carry the
  // weight that mono-caps used to. Sized as a real section heading so the
  // eye lands on the label first, then the value below.
  kicker: {
    fontSize: 13.5,
    lineHeight: 17,
    letterSpacing: 0.15,
  },

  // Dynamic limb (tithi / nakshatra / yoga / karana) — kicker + stack of
  // element rows. The top-of-block kicker is followed by a 4pt gap before
  // the primary element so the eye reads "kicker introduces the headline".
  dynamicLimb: {
    paddingVertical: 12,
    gap: 4,
  },

  // Primary (top-of-block) element — serif headline with optional accent dot
  // and a mono right-rail end-time. Sized to read as canonical body content,
  // not a hero — the kicker is the accent, not the primary name.
  primaryRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  primaryName: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: 'NotoSerifDevanagari_500Medium',
    letterSpacing: 0.1,
  },
  primaryEndTime: {
    fontSize: 12.5,
    lineHeight: 15,
    fontFamily: MONO_FONT,
    fontWeight: '500',
    letterSpacing: 0.2,
  },

  // Secondary (mid-day-transition) element — only ~10% smaller than primary
  // so the eye reads it as "continuation, not demotion". Indented + leading
  // continuation mark to signal sequence.
  secondaryRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    paddingLeft: 12,
  },
  secondaryName: {
    fontSize: 14,
    lineHeight: 19,
    fontFamily: 'NotoSerifDevanagari_400Regular',
    letterSpacing: 0.05,
  },
  secondaryEndTime: {
    fontSize: 11.5,
    lineHeight: 14,
    fontFamily: MONO_FONT,
    letterSpacing: 0.2,
  },

  // 4×4 dot before active primary name. Same visual weight as the muhurat-
  // row dots so the language is consistent across the screen.
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
  },
  // Hairline tick before each secondary element — smaller than activeDot so
  // it reads as "continuation", not "highlight".
  continuationMark: {
    width: 6,
    height: StyleSheet.hairlineWidth,
    alignSelf: 'center',
    opacity: 0.7,
  },

  // " · sunrise" tail on the at-sunrise element when not the primary. Italic
  // Fraunces, tiny, muted — never the visual focus, just an asterisk-style
  // canonicalisation marker for almanac purists.
  sunriseTail: {
    fontSize: 10.5,
    fontFamily: 'Fraunces_300Light',
    fontStyle: 'italic',
    letterSpacing: 0.2,
  },

  // Static limb (vara / anandadi / chandra rashi / surya nakshatra / masa /
  // chandra masa with toggle) — tight 2-column ledger row. Kicker left, value
  // right-flowing. Significantly shorter vertical rhythm than dynamic limbs
  // so the bottom of the card reads as a concise "static attributes" block.
  staticRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingVertical: 9,
    gap: 12,
  },
  // Static value — matches primary dynamic name (16pt). Both are canonical
  // values for the day (vara/anandadi/etc. are one-true-value; primary
  // dynamic is "active at sunrise / now"); they deserve equal visual weight.
  staticValue: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    fontFamily: 'NotoSerifDevanagari_500Medium',
    letterSpacing: 0.05,
    textAlign: 'right',
  },

  // Hairline divider between consecutive limb entries — same opacity as the
  // muhurat-table dividers so the two surfaces feel like sibling ledgers.
  limbDivider: { height: StyleSheet.hairlineWidth, opacity: 0.55 },

  masaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  masaChipText: { fontSize: 10, fontFamily: 'NotoSerifDevanagari_500Medium', letterSpacing: 0.3 },

  // Sun-Moon ledger — outer card stacks two rows. Sun row (3 cells) on top,
  // Moon row (2 wider cells) below, separated by a hairline. Each row keeps
  // its hairline-divided cells inline.
  sunMoonStrip: {
    borderRadius: borderRadius.cardInner,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 8,
  },
  sunMoonRow: {
    flexDirection: 'row',
  },
  sunMoonCell: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    gap: 3,
  },
  sunMoonLabel: { fontSize: 7.5, letterSpacing: 0.8 },
  sunMoonTime: { fontSize: 11.5, fontFamily: MONO_FONT, fontWeight: '500' },

  flagStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  flag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: '100%',
  },
  flagDot: { width: 5, height: 5, borderRadius: 3 },
  flagText: { fontSize: 11, fontFamily: 'NotoSerifDevanagari_500Medium' },

  almanacTable: {
    borderRadius: borderRadius.cardInner,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  muhuratRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
  },
  muhuratDot: { width: 4, height: 4, borderRadius: 2 },
  muhuratLabel: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'NotoSerifDevanagari_500Medium',
    letterSpacing: 0.2,
  },
  muhuratTime: {
    fontSize: 11.5,
    fontFamily: MONO_FONT,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  muhuratDivider: { height: StyleSheet.hairlineWidth, opacity: 0.5 },

  instantRow: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  instantKicker: { fontSize: 8.5, letterSpacing: 1.1 },
  instantBody: { fontSize: 12, flex: 1 },

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

  eclipseCard: { borderRadius: borderRadius.card, borderWidth: 1, padding: 14, marginBottom: 8, gap: 6 },
  eclipseHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  eclipseTitle: { fontSize: 14, fontFamily: 'NotoSerifDevanagari_700Bold' },
  eclipseRow: { fontSize: 12, fontFamily: 'NotoSerifDevanagari_400Regular' },
  eclipseVisibility: { fontSize: 12, fontFamily: 'NotoSerifDevanagari_500Medium', marginTop: 4 },

  durationRow: { flexDirection: 'row', alignItems: 'center', borderRadius: borderRadius.cardInner, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 8 },
  durationCell: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  durationDivider: { width: 0.5, height: 16 },
  durationText: { fontSize: 12, fontFamily: 'NotoSerifDevanagari_400Regular' },
  durationValue: { fontSize: 13, fontFamily: MONO_FONT, fontWeight: '500' },

  // Accordion body placeholder when daily compute hasn't completed yet.
  placeholder: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: borderRadius.cardInner,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  placeholderText: {
    fontSize: 12,
    fontFamily: 'NotoSerifDevanagari_400Regular',
    fontStyle: 'italic',
    flex: 1,
  },
  placeholderRetry: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  placeholderRetryText: {
    fontSize: 11,
    fontFamily: 'NotoSerifDevanagari_500Medium',
    letterSpacing: 0.4,
  },
});
