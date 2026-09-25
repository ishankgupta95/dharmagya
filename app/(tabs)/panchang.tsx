import { useState, useCallback, useEffect, useRef, useMemo, memo } from 'react';
import { router, useFocusEffect, useIsFocused } from 'expo-router';
import {
  View,
  ScrollView,
  StyleSheet,
  InteractionManager,
  PixelRatio,
  AppState,
} from 'react-native';
import { AppText as Text, FONT_SCALE } from '@/components/common/AppText';
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
import { FESTIVALS_MIN_YEAR, FESTIVALS_MAX_YEAR } from '@/data/festivals';
import type { FontSize } from '@/store/useStore';
import { useLocaleFormatters } from '@/utils/format';
import {
  darkColors,
  lightColors,
  palette,
  borderRadius,
  spacing,
  typeScale,
  ledgerLabelMinWidth,
  LEDGER_STACK_SCALE,
  type ColorPalette,
} from '@/config/theme';
import { useLazyDailyPanchang } from '@/hooks/useLazyDailyPanchang';
import { buildDayVerdict, VERDICT_REVIEW_PENDING } from '@/utils/dayVerdict';
import { computeJanmaNakshatraIndex, computeJanmaRashiIndex, fetchInstantPanchang, FALLBACK_COORDS } from '@/services/astrology/panchangService';
import { isSameDay } from '@/utils/calendar';
import { DEFAULT_BIRTH_TIMEZONE, wallclockInZoneToUtc } from '@/utils/time';
import { timezoneLabel } from '@/utils/timezoneLabel';
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
import { CalendarGridSkeleton, SkeletonCrossfade } from '@/components/common/SkeletonLoader';
import { DatePickerModal } from '@/components/common/DatePickerModal';
import { QualitySlotsCard } from '@/components/panchang/QualitySlotsCard';
import { HoraCard } from '@/components/panchang/HoraCard';
import { PlanetaryPositionsCard } from '@/components/panchang/PlanetaryPositionsCard';
import { AccordionSection } from '@/components/panchang/AccordionSection';
import { CalGridDense, cellA11yLabel, makeCellDateFormatter } from '@/components/panchang/CalGridDense';
import { eventDotColor } from '@/components/panchang/calendarColors';
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

function isSameMonth(a: Date, b: Date) {
  return a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}

function ymdKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// The month picker's bounds. Module constants rather than `new Date(...)` in
// the JSX: a fresh pair of Dates per render is a fresh pair of props for the
// modal (and the native picker under it) every time this screen renders.
const PICKER_MIN_DATE = new Date(1900, 0, 1);
const PICKER_MAX_DATE = new Date(2100, 11, 31);

// How old the "at this moment" stamp may be before a return to the live view
// (tab focus, back to today, app resume) takes a fresh one. Anything younger
// is kept, so the stamp taken at mount is not replaced — and the screen not
// re-rendered — when the tab is opened moments after it mounted.
const INSTANT_STALE_MS = 30_000;

/** `setInstantAtMs` updater: the current time if the stamp is stale, else the stamp. */
function restampIfStale(prev: number): number {
  const now = Date.now();
  return now - prev >= INSTANT_STALE_MS ? now : prev;
}

// ─── Accordion category keys (also used as i18n a11y labels) ───────────────
const CATEGORY_KEYS = {
  fullAlmanac: 'panchang.fullAlmanac',
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

/**
 * Which element of a limb is running right now.
 *
 * Compares instants, not wall clocks. The library tiles each limb across
 * [sunrise, nextSunrise], so an anga's end time routinely lands after midnight
 * — "3:04 AM" parses to 184 minutes, which is below the current minute-of-day
 * for the whole waking day, so a minutes-since-midnight comparison fell
 * straight through to the last element and the "active now" dot silently
 * vanished from the tithi / nakshatra / yoga rows on ~1 day in 5.
 */
function getActiveIndex(elements: IPanchangElement[]): number {
  if (elements.length <= 1) return 0;
  const nowMs = Date.now();
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (el.endTimeMs === undefined) return i;
    if (nowMs < el.endTimeMs) return i;
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
// Diya frame 02: the five limbs as one ledger. The label is an inline uppercase
// kicker column; the active element gets an accent dot; continuation rows are
// indented past the label column rather than boxed. Past a 1.3× font scale the
// row stops being a row: the label moves onto its own line above the value
// (frame 40) so nothing clips.
const fontSizeSelector = (s: { fontSize: FontSize }) => s.fontSize;

/**
 * Whether the ledger rows stack. Text in this app is scaled by BOTH the OS
 * font scale (via `allowFontScaling`) and the app's own font-size setting (via
 * `AppText`), while the layout constants — the 70dp label column, the 12dp gap
 * — are scaled by neither. So the trigger has to be the product: reading only
 * `PixelRatio.getFontScale()` meant the app's own "Large" setting (exactly
 * 1.3×, the designed threshold) enlarged every ledger string by 30% and never
 * stacked, clipping the values it was built to protect. Computed per render
 * rather than at module load so an OS font-scale change also takes effect —
 * the activity is recreated but the JS context and its module constants are not.
 */
function useLedgerStacked(): boolean {
  const fontSize = useStore(fontSizeSelector);
  return PixelRatio.getFontScale() * FONT_SCALE[fontSize] >= LEDGER_STACK_SCALE;
}

const LimbRow = memo(function LimbRow({ label, elements, colors, isLast, isToday }: LimbRowProps) {
  const stacked = useLedgerStacked();
  const isStatic = elements.length === 1 && !elements[0].endTime;

  if (isStatic) {
    // Static rows stack too. They were returning above the stacking branch
    // entirely, so vara / anandadi / chandra rashi / surya nakshatra / masa
    // stayed a single clipped line at every font scale — and those carry the
    // longest labels ("SURYA NAKSHATRA") against the longest values.
    return (
      <>
        <View style={stacked ? styles.staticRowStacked : styles.staticRow}>
          <Text
            variant="kicker"
            style={[styles.kicker, stacked && styles.kickerStacked, { color: colors.textMuted }]}
            numberOfLines={1}>
            {label}
          </Text>
          <Text
            style={[
              styles.staticValue,
              stacked && styles.staticValueStacked,
              { color: colors.textPrimary },
            ]}
            numberOfLines={stacked ? 2 : 1}>
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
        {stacked && (
          <Text variant="kicker" style={[styles.kicker, styles.kickerStacked, { color: colors.textMuted }]}>
            {label}
          </Text>
        )}
        {elements.map((el, i) => {
          const isPrimary = i === 0;
          const isActive = i === activeIdx;
          const padaSuffix = el.pada !== undefined ? ` · ${el.pada}` : '';
          const showSunriseTail = elements.length > 1 && el.isActiveAtSunrise && !isPrimary;
          const nameColor = isPrimary ? colors.textPrimary : colors.textSecondary;
          return (
            <View key={i} style={[styles.limbLine, i > 0 && styles.limbLineNext]}>
              {stacked ? null : isPrimary ? (
                <Text variant="kicker" style={[styles.kicker, { color: colors.textMuted }]} numberOfLines={1}>
                  {label}
                </Text>
              ) : (
                <View style={styles.limbIndent} />
              )}
              {isPrimary && (
                <View style={[styles.activeDot, { backgroundColor: isActive ? colors.accent : 'transparent' }]} />
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
                    { color: colors.textMuted },
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
        <View style={[styles.muhuratDot, { backgroundColor: tone === 'good' ? colors.success : colors.danger }]} />
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
  /** Short zone name ("IST") when the times are not on the phone's clock. */
  zoneLabel?: string | null;
  zoneA11yLabel?: string;
}

const SunMoonStrip = memo(function SunMoonStrip({
  sunrise, sunset, moonrise, moonset, nextSunrise, colors, labels, zoneLabel, zoneA11yLabel,
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
          {it.key === 'sunrise' && zoneLabel ? (
            // The zone rides beside the sunrise time and wraps under it when
            // the cell is too narrow (small phone, large text), so the time
            // itself is never the thing that gets clipped.
            <View style={styles.sunMoonTimeRow}>
              <Text style={[styles.sunMoonTime, styles.sunMoonTimeShrink, { color: colors.textPrimary }]} numberOfLines={1}>
                {it.time}
              </Text>
              <Text
                variant="kicker"
                style={[styles.zoneTag, { color: colors.textSecondary }]}
                numberOfLines={1}
                accessibilityLabel={zoneA11yLabel}>
                {zoneLabel}
              </Text>
            </View>
          ) : (
            <Text style={[styles.sunMoonTime, { color: colors.textPrimary }]} numberOfLines={1}>
              {it.time}
            </Text>
          )}
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

interface FlagStripItem { key: string; label: string; tone: 'accent' | 'success' | 'danger' }

interface FlagStripProps {
  items: FlagStripItem[];
  colors: ColorPalette;
}

const FlagStrip = memo(function FlagStrip({ items, colors }: FlagStripProps) {
  if (items.length === 0) return null;
  // A flag needs three colours, not one. The earlier version derived the chip
  // fill, the dot and the label from a single theme-invariant hex, which meant
  // the label was accent-on-accent-tint: 1.95:1 at 11px on the light ground.
  // Fill comes off the theme's `*Surface` container; the label AND the dot both
  // come off the matching `*Text` ink, so both schemes clear AA (worst case
  // 4.60:1) and the dot clears the 3:1 non-text floor. The fill tokens are the
  // wrong value for the dot — `colors.accent` on the near-white light accent
  // container is only 2.17:1. The old 'gold' and 'sindoor' tones are folded
  // into one 'accent': both aliased to #D8A31A and were already
  // indistinguishable on screen.
  const toneToStyle = (tone: FlagStripItem['tone']): { fill: string; ink: string } => {
    switch (tone) {
      case 'accent':  return { fill: colors.accentSurface,  ink: colors.accentText };
      case 'success': return { fill: colors.successSurface, ink: colors.successText };
      case 'danger':  return { fill: colors.dangerSurface,  ink: colors.dangerText };
    }
  };
  return (
    <View style={styles.flagStrip}>
      {items.map(it => {
        const s = toneToStyle(it.tone);
        // Edge keeps the old 33% alpha but is derived from the ink rather than
        // the fill: the light containers are near-white, so a fill-derived
        // hairline would vanish into the page.
        return (
          <View key={it.key} style={[styles.flag, { backgroundColor: s.fill, borderColor: s.ink + '55' }]}>
            <View style={[styles.flagDot, { backgroundColor: s.ink }]} />
            <Text style={[styles.flagText, { color: s.ink }]} numberOfLines={1}>{it.label}</Text>
          </View>
        );
      })}
    </View>
  );
});

// ─── Calendar view toggle ──────────────────────────────────────────────────
// Editorial-style segmented control that lives directly above the calendar
// grid. Both states are always visible — current state is communicated by an
// accent-colour label/icon plus a hairline accent underline rule beneath the
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
    // `accentText`, not `accent`, for the same reason as the underline below:
    // the accent FILL token is turmeric in both schemes, which is 2.09:1 as
    // 13px words on the rice ground. `accentText` is #7A5900 on light (5.90:1)
    // and turmeric on dark (8.02:1), so label, icon and underline all clear AA
    // in both schemes and read as one selected state.
    const tone = isSelected ? colors.accentText : colors.textTertiary;
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
            Color flips between the accent ink and transparent. It was a
            theme-invariant `palette.gold`, which is #7A5900 in both schemes —
            5.90:1 on rice but only 2.85:1 on the night ground, so the one cue
            for "which view am I on?" all but vanished in dark mode.
            `colors.accentText` is the same #7A5900 on light (nothing changes
            there) and turmeric on dark, where it reads 8.02:1. The `accent`
            fill token is the wrong choice for this hairline: it is turmeric in
            BOTH schemes, which would have traded the dark-mode failure for a
            2.09:1 light-mode one. */}
        <View
          style={[
            styles.viewToggleUnderline,
            { backgroundColor: isSelected ? colors.accentText : 'transparent' },
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

  // NativeTabs has no lazy/freeze gate (see `app/(tabs)/_layout.tsx`), so every
  // tab screen mounts on cold start and this screen's mount work — the daily
  // compute, the instant snapshot, the ~80–120ms 42-cell month build and two
  // intervals — used to run behind Home's first paint, landing right where the
  // user's first tap does. Everything expensive below is gated on this latch.
  //
  // One-way by design: once the tab HAS been opened it behaves exactly as it
  // did before, so switching away and back tears nothing down and resets no
  // state. `useIsFocused` reads the live focus state synchronously on the
  // first render (useSyncExternalStore), so a user who lands straight on this
  // tab pays no extra frame.
  const isFocused = useIsFocused();
  const [hasBeenFocused, setHasBeenFocused] = useState(isFocused);
  if (isFocused && !hasBeenFocused) setHasBeenFocused(true);

  // `today` is state, not a mount-time constant. The screen is a NativeTabs
  // trigger and stays mounted for the whole session, so a frozen value meant
  // that after midnight the "TODAY" kicker, the calendar's today ring and the
  // `isViewingToday` gate all still pointed at yesterday — with the live "at
  // this moment" line (computed from the real now) printed underneath
  // yesterday's ledger, and the jump-back chip hidden because the screen
  // believed it was already on today.
  const [today, setToday] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [calMonth, setCalMonth] = useState<Date>(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  // P16.3 — "Good & avoid times" shows Choghadiya by default; the other three
  // systems (Gowri / Do Ghati / Hora) sit behind this inline reveal.
  const [showAllSystems, setShowAllSystems] = useState(false);

  const panchangLang = resolveLanguage(language);
  const birthMoment = useMemo<Date | null>(() => {
    if (!userBirthDate) return null;
    const tz = userBirthPlace?.timezone ?? DEFAULT_BIRTH_TIMEZONE;
    // `??` on a local hoisted out of the try: a nullish coalescing *inside* a
    // try block is a React Compiler bailout, and it costs nothing here since
    // the fallback cannot throw. Only wallclockInZoneToUtc needs guarding.
    const bt = userBirthTime ?? '12:00';
    try {
      return wallclockInZoneToUtc(userBirthDate, bt, tz);
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

  // Fires on the tab's first focus, not on cold start — `firstEffect` is the
  // marker for "this screen started doing work", and under NativeTabs that is
  // now the moment the user opens it.
  useEffect(() => {
    if (!hasBeenFocused) return;
    pAccordionResetCount();
    pmark('panchangScreen:firstEffect');
  }, [hasBeenFocused]);

  // Latest-value channel for `roll` below, which is installed once and must not
  // tear down its timer + AppState listener on every date tap. Written in an
  // effect, never during render: `roll` only ever fires from a timer or an
  // AppState transition — i.e. after a commit — so it always sees the values
  // the last commit published.
  const todayRef = useRef(today);
  const selectedDateRef = useRef(selectedDate);
  useEffect(() => {
    todayRef.current = today;
    selectedDateRef.current = selectedDate;
  }, [today, selectedDate]);

  // Advance `today` across midnight. Only `today` moves on its own: if the
  // user is parked on a date they chose, leave them there and let
  // `isViewingToday` flip to false — that is the correct cascade (the
  // jump-back chip reappears, the kicker stops claiming "Today", the live
  // moment line tears down). `selectedDate` follows only when it was still
  // tracking the old today.
  useEffect(() => {
    if (!hasBeenFocused) return;
    const roll = () => {
      const now = new Date();
      const prev = todayRef.current;
      if (isSameDay(prev, now)) return;
      todayRef.current = now;
      setToday(now);
      if (isSameDay(selectedDateRef.current, prev)) {
        setSelectedDate(now);
        setCalMonth(m => (isSameMonth(now, m) ? m : new Date(now.getFullYear(), now.getMonth(), 1)));
      }
    };
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') roll();
    });
    const id = setInterval(roll, 5 * 60 * 1000);
    // The tab can sit mounted-but-unfocused across a midnight — or across a
    // background/resume whose 'active' event this listener was not installed
    // for — so `today` is caught up once as the gate opens instead of waiting
    // up to five minutes for the first tick. Deferred to a timer rather than
    // called inline: a synchronous setState in an effect body is the cascading
    // render `react-hooks/set-state-in-effect` exists to stop.
    const catchUp = setTimeout(roll, 0);
    return () => { sub.remove(); clearInterval(id); clearTimeout(catchUp); };
  }, [hasBeenFocused]);

  const firstRealDataMarkedRef = useRef(false);
  useEffect(() => {
    if (panchang && !firstRealDataMarkedRef.current) {
      firstRealDataMarkedRef.current = true;
      pmark('panchangScreen:firstPaint:realData');
    }
  }, [panchang]);

  // P16.3: the day's plain verdict needs the daily compute (Rahu Kalam /
  // Abhijit windows), so request it once the tab is first opened instead of
  // waiting for an accordion open. Runs after that first paint (effect), so
  // paint isn't blocked; the compute is cached for the rest of the session and
  // auto-syncs on date change.
  useEffect(() => {
    if (!hasBeenFocused) return;
    request();
  }, [request, hasBeenFocused]);

  // ── Instant snapshot — only relevant when viewing today ─────────────────
  // Derived during render, not written from an effect. The effect shape
  // (compute → setInstant → the whole screen renders again) cost a second
  // full render on first focus, on every return to today and on every input
  // change, plus a no-op commit on every tap away from today for its
  // `setInstant(null)` branch. The only state left is the moment the snapshot
  // describes — state rather than a clock read inside the memo, so the memo
  // has a real, reactive dependency to recompute on. The ~3 ms compute now
  // sits on the first focused render: cheaper than the render it replaces,
  // and `hasBeenFocused` keeps it off cold start.
  const isViewingToday = isSameDay(selectedDate, today);
  // Lazy mount-time stamp: free on cold start, and already current for a deep
  // link that lands straight on this tab.
  const [instantAtMs, setInstantAtMs] = useState(() => Date.now());

  // The moment line is live while the tab is on screen AND showing today.
  // Every time it goes live — the tab's first focus, a return from another
  // tab, a return to today from another date — the stamp is re-taken here,
  // during render, if it is stale. NativeTabs mounts this screen at cold start,
  // so on first focus the stamp is the LAUNCH moment; re-stamping from an
  // effect (as this used to, via a zero-delay timer) committed that launch-time
  // tithi / nakshatra / yoga first, recomputed it a frame later, and ran
  // `fetchInstantPanchang` twice. As a render-time adjustment the fresh stamp
  // lands in the same commit that turns the line on: one compute, no stale
  // frame, no extra commit. On first focus the discarded pass computes nothing
  // (`hasBeenFocused` is still false in it, so the memo below returns null).
  // The initial value is the live state at mount, so a deep link that lands
  // here at cold start sees no transition and pays no extra pass; and the
  // staleness guard keeps a stamp that is only moments old.
  const momentLive = isFocused && isViewingToday;
  const [seenMomentLive, setSeenMomentLive] = useState(momentLive);
  if (momentLive !== seenMomentLive) {
    setSeenMomentLive(momentLive);
    if (momentLive) setInstantAtMs(restampIfStale);
  }

  const instant = useMemo<IInstantPanchang | null>(() => {
    if (!hasBeenFocused || !isViewingToday) return null;
    const coords = userLocation ?? FALLBACK_COORDS;
    return fetchInstantPanchang(new Date(instantAtMs), coords, panchangLang, ayanamsa);
  }, [hasBeenFocused, isViewingToday, instantAtMs, userLocation, panchangLang, ayanamsa]);

  // While live: a five-minute tick, and a guarded re-stamp when the app comes
  // back to the foreground (focus does not change on resume, so the render-time
  // re-stamp above cannot see it). Keyed on `momentLive`, not on the one-way
  // `hasBeenFocused`: the tab never unmounts, and an unkeyed tick re-rendered
  // this whole screen every five minutes from behind whatever tab the user was
  // actually on. Nothing is lost by stopping it — the next return re-stamps.
  useEffect(() => {
    if (!momentLive) return;
    const id = setInterval(() => setInstantAtMs(Date.now()), 5 * 60 * 1000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setInstantAtMs(restampIfStale);
    });
    return () => { clearInterval(id); sub.remove(); };
  }, [momentLive]);

  // A14: the zone the day's times are rendered in. Same resolution as
  // `useLazyDailyPanchang`: a stored place carries its own zone (none for a GPS
  // fix: device clock), and no place at all means FALLBACK_COORDS, i.e. Ujjain
  // on IST. Printed for the fallback always, and for a chosen place whose
  // offset is not the phone's; null otherwise (see `timezoneLabel`).
  const zoneLabel = useMemo(
    () => timezoneLabel(userLocation, FALLBACK_COORDS, selectedDate),
    [userLocation, selectedDate],
  );
  const zoneA11yLabel = zoneLabel ? t('a11y.timesInZone', { zone: zoneLabel }) : undefined;

  // Calendar cells + per-day event category for the visible month.
  const calYear = calMonth.getFullYear();
  const calMonthIdx = calMonth.getMonth();
  const calLat = userLocation?.lat ?? FALLBACK_COORDS.lat;
  const calLon = userLocation?.lon ?? FALLBACK_COORDS.lon;
  // Peek the cache synchronously (a Map lookup); on miss the screen paints
  // first, then a `useEffect` runs the ~80–120ms build off the render path
  // (P11.1) — and only once the tab has been opened, so a cold start that
  // never leaves Home never pays for it.
  const cachedMonth = useMemo(
    () => peekCalendarMonth(calYear, calMonthIdx, { lat: calLat, lon: calLon }, {
      region,
      ayanamsa,
      selectedDeities: [],
      masaSystem,
    }),
    [calYear, calMonthIdx, calLat, calLon, region, ayanamsa, masaSystem],
  );
  // The deferred build lands asynchronously, so `computedMonth` can still be
  // holding the PREVIOUS month (or the previous location / ayanamsa) at the
  // moment the inputs change — `cachedMonth` goes null in the same commit as
  // the month flips. Stamp each build with the inputs it was made for and only
  // accept it when they still match; otherwise the grid rendered last month's
  // 42 cells, live and tappable, under this month's header.
  const monthIdentity = `${calYear}|${calMonthIdx}|${calLat}|${calLon}|${region}|${ayanamsa}|${masaSystem}`;
  const [computedMonth, setComputedMonth] = useState<{ id: string; data: CalendarMonth } | null>(null);
  useEffect(() => {
    if (!hasBeenFocused || cachedMonth) return;
    let cancelled = false;
    const handle = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      const built = getCalendarMonth(calYear, calMonthIdx, { lat: calLat, lon: calLon }, {
        region,
        ayanamsa,
        selectedDeities: [],
        masaSystem,
      });
      if (!cancelled) setComputedMonth({ id: monthIdentity, data: built });
    });
    return () => { cancelled = true; handle.cancel(); };
  }, [hasBeenFocused, cachedMonth, monthIdentity, calYear, calMonthIdx, calLat, calLon, region, ayanamsa, masaSystem]);
  const monthData = cachedMonth ?? (computedMonth?.id === monthIdentity ? computedMonth.data : null);

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
    // Refresh `today` as well — otherwise, post-midnight, this lands on the
    // right day but leaves `isViewingToday` false, so the kicker prints a date
    // instead of "TODAY" and the live moment line stays suppressed.
    setToday(now);
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

  // Built inline, NOT wrapped in useMemo: a dep array holding the shared value
  // `swipeX` (which the gesture callbacks mutate) trips the React Compiler's
  // immutability check and makes it bail out of memoizing this whole screen —
  // 529 memo slots for the rest of the tree against one rebuilt gesture object.
  // The compiler will NOT cache this binding either (it refuses to hoist a value
  // whose closures mutate a shared value), so a fresh Gesture.Pan() is built on
  // every render. That is safe: RNGH's GestureDetector explicitly supports an
  // unmemoized gesture — needsToReattach() stays false (same handler name, same
  // thread), so it takes the updateHandlers() path and swaps the config on the
  // existing native handler rather than dropping and re-attaching it.
  const swipeGesture = Gesture.Pan()
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
    });

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
  // `returnObjects` deep-copies, so this is a new array on every render — and
  // it is a prop of the `memo`'d dense grid, whose shallow compare it would
  // otherwise fail every time. `t` is the honest dependency and it is stable
  // per language: react-i18next hands it out through a cached
  // `useSyncExternalStore` snapshot that is rebuilt only when the language, the
  // keyPrefix or the store revision changes.
  const dayHeaders = useMemo(
    () => t('panchang.dayHeaders', { returnObjects: true }) as string[],
    [t],
  );

  // Built once per language and reused across all 42 compact cells — see
  // `makeCellDateFormatter`. The dense grid keeps its own, since it is memo'd
  // and re-renders independently.
  const cellDateFmt = useMemo(() => makeCellDateFormatter(panchangLang), [panchangLang]);

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
      out.push({ key: `fest-${i}`, label, tone: 'accent' as const });
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

  // P16.3 — supporting tithi/nakshatra line, MERGED: on "today" it shows the
  // current (instant) values, on other days the day's values. Replaces the
  // duplicate "AT A GLANCE" + "AT THIS MOMENT" rows.
  const momentLine = useMemo(() => {
    if (isViewingToday && instant) {
      return `${localizeTithi(instant.tithi, panchangLang)} · ${localizeNakshatra(instant.nakshatra, panchangLang)} · ${localizeYoga(instant.yoga, panchangLang)}`;
    }
    return glanceLine;
  }, [isViewingToday, instant, glanceLine, panchangLang]);

  // P16.3 — plain "today's verdict". Shared with the Home Panchang hero via
  // buildDayVerdict (see that helper for the content-gate posture). Eclipse is
  // read from `panchang`, never from the calendar cell: the cell buckets an
  // eclipse by its device-local peak date while the daily compute attributes it
  // to the Hindu (sunrise-to-sunrise) day, so a pre-dawn peak lands a day apart
  // (4 of the 18 eclipses between 2026 and 2031 at IST). Home passes the same
  // source, so the two surfaces cannot disagree about which day owns it.
  const verdict = useMemo(
    () => buildDayVerdict(panchang, !!panchang?.eclipse, t),
    [panchang, t],
  );

  // Pancha Anga is the canonical "what is this day?" view, so it defaults
  // to open when the user hasn't yet interacted with it. An explicit collapse
  // by the user is still honoured (the persisted `false` overrides this
  // default). Other categories default to closed — lazy until requested.
  const isCategoryOpen = useCallback(
    (key: string) => {
      const stored = panchangCategoriesOpen[key];
      if (stored !== undefined) return stored;
      // P16.3: default everything closed — the plain verdict up top is the
      // primary read; the detailed ledger lives behind the "Full almanac"
      // reveal, which itself defaults closed.
      return false;
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
        <Text variant="display" style={[styles.headerTitle, { color: colors.textPrimary }]}>
          {t('panchang.headerTitle')}
        </Text>
        {/* Tappable — see the matching note on the Home pill. */}
        <MotionPressable
          onPress={() => router.push('/location-permission')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[styles.locPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.changeLocation', {
            location: locationName ?? (userLocation ? t('common.gpsLabel') : t('common.locationDefault')),
          })}>
          <Icon name="location" size={10} color={colors.accent} />
          <Text variant="kicker" style={[styles.locText, { color: colors.textTertiary }]} numberOfLines={1}>
            {locationName ?? (userLocation ? t('common.gpsLabel') : t('common.locationDefault'))}
          </Text>
        </MotionPressable>
      </View>

      <ScrollView
        ref={scrollRef}
        // iOS: react-native-screens only applies the tab-bar content inset to the
        // first ScrollView in the tab screen's first-descendant chain, and here the
        // header row comes first, so React Native's iOS default (Never) stuck.
        // Without this the end of the scroll content sits permanently under
        // the floating tab bar and cannot be tapped (Android ignores the prop).
        contentInsetAdjustmentBehavior="automatic"
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
            <Text variant="display" style={[styles.monthName, { color: colors.textPrimary }]}>
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
                        // accent-as-WORDS: `colors.accent` is the fill token and
                        // is 2.09:1 on the light ground, so festival day numbers
                        // rendered fainter than ordinary ones. The dense grid
                        // already uses `accentText` for the same job.
                        ? colors.accentText
                        : colors.textPrimary;

                  // The compact cell draws only a day number and a coloured
                  // dot, so the label is the *only* place the tithi and the
                  // festival name can reach a screen reader — the dot has no
                  // text equivalent at all. A Pressable is accessible by
                  // default, so this label replaces the child <Text>; the old
                  // `toDateString()` was English-only and said nothing else.
                  const cellEventLabel = inCurrentMonth && dayInfo && dayInfo.eventCategory !== 'plain'
                    ? localizePrimaryEvent(dayInfo.primaryEventName, panchangLang)
                    : '';
                  const cellTithiLabel = inCurrentMonth && dayInfo?.tithiName
                    ? localizeTithi(
                        `${dayInfo.paksha === 'shukla' ? 'Shukla' : 'Krishna'} ${dayInfo.tithiName}`,
                        panchangLang,
                      )
                    : '';
                  const a11yLabel = cellA11yLabel(
                    cellDateFmt, cellDate, cellTithiLabel, cellEventLabel,
                  );

                  return (
                    <MotionPressable
                      key={idx}
                      onPress={() => handlePickDay(cellDate)}
                      style={styles.calCell}
                      accessibilityRole="button"
                      accessibilityLabel={a11yLabel}
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

        {/* The grid keeps computing tithi / nakshatra for any year the picker
            reaches (1900–2100), but festival names only exist for the years
            the bundled table covers — outside that range Holi, Diwali, every
            Ekadashi and every Sankranti are simply absent from a grid that
            otherwise looks complete. State the coverage rather than let the
            absence read as "no festivals". */}
        {(calYear < FESTIVALS_MIN_YEAR || calYear > FESTIVALS_MAX_YEAR) && (
          <Text variant="body-italic" style={[styles.festivalRangeNote, { color: colors.textTertiary }]}>
            {t('panchang.festivalDataRange', {
              from: digits(String(FESTIVALS_MIN_YEAR)),
              to: digits(String(FESTIVALS_MAX_YEAR)),
              defaultValue: 'Festival dates are available for {{from}}–{{to}}.',
            })}
          </Text>
        )}

        <View style={[styles.postCalRule, { height: StyleSheet.hairlineWidth, backgroundColor: colors.divider }]} />

        {/* ── Date-dependent content (fades on date change, swipe-able) ──── */}
        <GestureDetector gesture={swipeGesture}>
        <Animated.View style={contentAnimStyle}>

        {/* ── Selected-day line ────────────────────────────────────────────── */}
        <View style={styles.selectedLine}>
          <Text variant="mono-caps" style={[styles.selectedKicker, { color: colors.accentText }]}>
            {isViewingToday ? t('panchang.todayChip') : selectedGregorian}
          </Text>
          {/* The Samvat belongs to the SELECTED DAY, not to the month. It rolls
              at Chaitra Shukla Pratipada, so `CalendarMonth.vikramSamvat` —
              sampled once from the 15th — is a year out for every day on the
              far side of that boundary (43 days across the shipped range), and
              it also changed under an unchanged date when the month arrows
              were used to browse. */}
          {panchang && panchang.vikramSamvat > 0 && showVikramSamvat && (
            <Text variant="body-italic" style={[styles.selectedSamvat, { color: colors.textTertiary }]}>
              {t('panchang.vsSamvat', { year: digits(String(panchang.vikramSamvat)) })}
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

        {/* ── Today's verdict + glance (merges AT A GLANCE / AT THIS MOMENT) ──
            Plain-language read of the day up top; the detailed ledger lives
            behind the "Full almanac" reveal below. Verdict copy is conservative
            and provisional — see VERDICT_REVIEW_PENDING. */}
        {(verdict || momentLine.length > 0) && (
          <View style={[styles.verdictCard, { backgroundColor: colors.surface, borderColor: colors.borderAccent }]}>
            {/* The verdict's best / avoid windows are the only times this tab
                shows before anything is expanded, so the zone they are in is
                stated here too, not only beside sunrise inside Sun & Moon.
                Only a timed verdict gets it — the eclipse caution has none. */}
            <View style={styles.verdictHead}>
              <Text variant="mono-caps" style={[styles.glanceKicker, { color: colors.accent }]}>
                {t('panchang.glanceTitle')}
              </Text>
              {!!zoneLabel && !!verdict && !verdict.caution && (
                <Text
                  variant="kicker"
                  style={[styles.zoneTag, { color: colors.textSecondary }]}
                  numberOfLines={1}
                  accessibilityLabel={zoneA11yLabel}>
                  {zoneLabel}
                </Text>
              )}
            </View>
            {verdict && (
              <Text
                variant="body"
                style={[
                  styles.verdictText,
                  { color: verdict.caution ? colors.dangerText : colors.textPrimary },
                ]}>
                {verdict.text}
              </Text>
            )}
            {verdict && VERDICT_REVIEW_PENDING && (
              <Text
                variant="body-italic"
                style={[styles.verdictProvisional, { color: colors.textSecondary }]}>
                {t('panchang.verdictProvisional')}
              </Text>
            )}
            {momentLine.length > 0 && (
              <Text
                variant="body-italic"
                style={[styles.verdictGlance, { color: colors.textSecondary }]}
                numberOfLines={2}>
                {momentLine}
              </Text>
            )}
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

        {/* ── Full almanac — the detailed 8-section ledger behind one reveal
            (P16.3). Default closed; the verdict above is the primary read. The
            walkthrough spotlight rides on this wrapper so it points at the
            reveal rather than a now-hidden inner accordion. ── */}
        <View ref={panchaAngaRef} style={styles.fullAlmanacWrap}>
        <AccordionSection
          storageKey={CATEGORY_KEYS.fullAlmanac}
          title={t('panchang.fullAlmanac')}
          open={isCategoryOpen(CATEGORY_KEYS.fullAlmanac)}
          onToggle={() => togglePanchangCategory(CATEGORY_KEYS.fullAlmanac)}
          onFirstOpen={onAnyAccordionFirstOpen}
          colors={colors}>

        {/* Pancha Anga — five limbs + masa + extensions + day flags */}
        <View>
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
                        <Text variant="kicker" style={[styles.kicker, { color: colors.textMuted }]} numberOfLines={1}>
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
                    ...(panchang.isAdhikaMasa ? [{ key: 'adhika', label: t('panchang.adhikaMasa'), tone: 'accent' as const }] : []),
                    ...panchang.specialYogas.map((y, i) => ({
                      key: `yoga-${i}`, label: localizeYoga(y.name, panchangLang), tone: 'success' as const,
                    })),
                    ...(panchang.panchaka ? [{ key: 'panchaka', label: t('panchang.panchaka'), tone: 'accent' as const }] : []),
                    ...(panchang.gandaMula
                      ? [{
                          key: 'ganda',
                          label: t(
                            panchang.gandaMula.severity === 'severe' ? 'panchang.gandaMulaSevere' : 'panchang.gandaMulaMild',
                            { nakshatra: panchang.gandaMula.nakshatraName },
                          ),
                          tone: panchang.gandaMula.severity === 'severe' ? ('danger' as const) : ('accent' as const),
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
                zoneLabel={zoneLabel}
                zoneA11yLabel={zoneA11yLabel}
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
          accentColor={colors.successText}
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
                ...panchang.amritKala.map((ak, i) => ({
                  key: `amrit-${i}`, label: t('panchang.amritKala'), start: ak.start, end: ak.end,
                })),
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
          accentColor={colors.dangerText}
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
                ...panchang.varjyam.map((vj, i) => ({
                  key: `varjyam-${i}`, label: t('panchang.varjyam'), start: vj.start, end: vj.end,
                })),
                ...(panchang.bhadra
                  ? [{ key: 'bhadra', label: t('panchang.bhadra'), start: panchang.bhadra.start, end: panchang.bhadra.end }]
                  : []),
              ]}
            />
          ) : (
            renderPlaceholder(CATEGORY_KEYS.inauspicious)
          )}
        </AccordionSection>

        {/* Eclipse — gated on the daily compute, not the calendar cell. The
            cell buckets an eclipse by its device-local peak date while the
            compute attributes it to the Hindu (sunrise-to-sunrise) day, so a
            pre-dawn peak sits one civil day earlier; gating on one and reading
            the other left the card a permanent "tap to reveal" dead-end on the
            civil date and absent on the Hindu day. One source, no placeholder
            branch: the compute is requested on mount (see the P16.3 effect
            above), so `panchang` is resolved by the time this can be true. */}
        {panchang?.eclipse && (
          <AccordionSection
            storageKey={CATEGORY_KEYS.eclipse}
            title={t('panchang.eclipseSection')}
            open={isCategoryOpen(CATEGORY_KEYS.eclipse)}
            onToggle={() => togglePanchangCategory(CATEGORY_KEYS.eclipse)}
            onFirstOpen={onAnyAccordionFirstOpen}
            accentColor={colors.dangerText}
            colors={colors}>
            <View style={[styles.eclipseCard, { backgroundColor: colors.dangerSurface, borderColor: colors.danger + '66' }]}>
              <View style={styles.eclipseHeader}>
                <Icon
                  name={panchang.eclipse.kind === 'solar' ? 'sun' : 'moon'}
                  size={18}
                  color={colors.danger}
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
              {/* `obscuration` is the umbral disc-area fraction, so a penumbral
                  lunar eclipse reads exactly 0 — printing "Coverage: 0%" beside
                  a real eclipse reads as a bug, not as a fact. Peak always
                  prints; coverage joins it only when the umbra actually bites.
                  And only for a peak that is actually seen: since panchang-ts
                  5.4 a solar eclipse peaking below the horizon is labelled by
                  its deepest VISIBLE phase (an annular reads "Partial"), while
                  `obscuration` stays the unseen peak's 83%. */}
              <Text style={[styles.eclipseRow, { color: colors.textSecondary }]}>
                {t('panchang.eclipsePeak', { time: panchang.eclipse.peak })}
                {panchang.eclipse.obscuration > 0 &&
                  (panchang.eclipse.kind === 'lunar' || panchang.eclipse.peakVisible) && (
                  <>
                    {'  ·  '}
                    {t('panchang.eclipseObscuration', { value: Math.round(panchang.eclipse.obscuration * 100) })}
                  </>
                )}
              </Text>
              {/* Both sutak instants are null when no sutak applies (penumbral
                  lunar). i18next stringifies null to '', so interpolating them
                  would print the empty range "Sutak:  – " — say the thing
                  instead. The truthiness check also absorbs the '' that older
                  cached rows carry from the pre-v5 `?? ''` coercion. */}
              <Text style={[styles.eclipseRow, { color: colors.textSecondary }]}>
                {panchang.eclipse.sutakStart && panchang.eclipse.sutakEnd
                  ? t('panchang.eclipseSutak', { start: panchang.eclipse.sutakStart, end: panchang.eclipse.sutakEnd })
                  : t('panchang.eclipseNoSutak')}
              </Text>
              {/* Both branches are the same factual row, so the negative one is
                  quiet-but-legible (`textSecondary`, matching the rows above)
                  rather than muted — at 12px on the danger container muted was
                  2.55:1, under even the large-text floor. Green carries the
                  affirmative signal; grey is the plain statement. */}
              <Text style={[styles.eclipseVisibility, { color: panchang.eclipse.visibleFromLocation ? colors.successText : colors.textSecondary }]}>
                {panchang.eclipse.visibleFromLocation ? t('panchang.eclipseVisible') : t('panchang.eclipseNotVisible')}
              </Text>
            </View>
          </AccordionSection>
        )}

        {/* Time quality — Choghadiya / Gowri / Do Ghati / Hora */}
        <AccordionSection
          storageKey={CATEGORY_KEYS.timeQuality}
          title={t('panchang.goodAvoidTimes')}
          open={isCategoryOpen(CATEGORY_KEYS.timeQuality)}
          onToggle={() => togglePanchangCategory(CATEGORY_KEYS.timeQuality)}
          onFirstOpen={onAnyAccordionFirstOpen}
          colors={colors}>
          {panchang ? (
            <>
              {/* Choghadiya is the most widely-read good/avoid system; the other
                  three are equivalent traditions, folded behind one tap (P16.3). */}
              <QualitySlotsCard label={t('panchang.choghadiya')} slots={panchang.choghadiya} colors={colors} />
              {showAllSystems && (
                <>
                  <QualitySlotsCard label={t('panchang.gowriPanchangam')} slots={panchang.gowriPanchangam} colors={colors} />
                  <QualitySlotsCard label={t('panchang.doGhatiMuhurta')} slots={panchang.doGhatiMuhurta} colors={colors} />
                  <HoraCard slots={panchang.hora} colors={colors} />
                </>
              )}
              <MotionPressable
                onPress={() => setShowAllSystems((o) => !o)}
                hitSlop={8}
                style={styles.showSystemsBtn}
                accessibilityRole="button"
                accessibilityLabel={showAllSystems ? t('panchang.hideOtherSystems') : t('panchang.showAllSystems')}>
                <Text variant="mono-caps" style={[styles.showSystemsText, { color: colors.accent }]}>
                  {showAllSystems ? t('panchang.hideOtherSystems') : t('panchang.showAllSystems')}
                </Text>
                <Icon name={showAllSystems ? 'chevron-up' : 'chevron-down'} size={12} color={colors.accent} />
              </MotionPressable>
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

        </AccordionSection>
        </View>

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
          totalSteps={3}
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
        minDate={PICKER_MIN_DATE}
        maxDate={PICKER_MAX_DATE}
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

  // Diya frame 02 — left-aligned light display title, location pill right.
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    paddingBottom: 10,
    gap: 12,
  },
  headerTitle: { fontSize: 30, lineHeight: 36, flexShrink: 1 },
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
  calDayNum: { fontFamily: 'Geist_400Regular', fontSize: 13.5, lineHeight: 15 },
  festivalDot: {
    position: 'absolute',
    bottom: 3,
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
  },
  postCalRule: { marginTop: 6, marginBottom: 10 },
  festivalRangeNote: { fontSize: 12, lineHeight: 17, marginTop: 10 },

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
  glanceKicker: { fontSize: 8.5, letterSpacing: 1.1, flexShrink: 1 },
  glanceTithiText: { fontSize: 13, flex: 1, lineHeight: 18 },

  // ─── Today's verdict card + Full almanac reveal (P16.3) ──────────────────
  verdictCard: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderRadius: borderRadius.card,
    borderWidth: 1,
    gap: 6,
  },
  verdictHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  verdictText: { fontSize: 15, lineHeight: 21 },
  verdictProvisional: { fontSize: 11, lineHeight: 15 },
  verdictGlance: { fontSize: 12.5, lineHeight: 18 },
  fullAlmanacWrap: { marginTop: 4 },
  showSystemsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 4,
  },
  showSystemsText: { fontSize: 9, letterSpacing: 1 },

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

  // Ledger label — inline uppercase kicker column (frame 02: 9.5px, wide
  // tracking, muted). minWidth so long localised labels push the row wider
  // instead of clipping.
  kicker: {
    fontSize: 9.5,
    lineHeight: 14,
    minWidth: ledgerLabelMinWidth,
  },
  // Frame 40 — past 1.3× the label sits on its own line above the value.
  kickerStacked: { minWidth: 0, paddingTop: 10 },
  // Static ledger row, stacked: label above value, both left-aligned. A
  // right-aligned full-width value under a left-aligned label reads as a bug.
  staticRowStacked: { paddingVertical: 6 },
  staticValueStacked: { flex: 0, textAlign: 'left' },

  // Dynamic limb (tithi / nakshatra / yoga / karana) — one line per element.
  dynamicLimb: {
    paddingVertical: 3,
  },
  limbLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 10,
  },
  limbLineNext: {
    paddingTop: 0,
  },
  // Continuation rows are indented past the label column, not boxed.
  limbIndent: { width: ledgerLabelMinWidth + 17 },
  primaryName: {
    fontSize: 17,
    lineHeight: 24,
    fontFamily: 'NotoSerifDevanagari_500Medium',
    letterSpacing: 0.1,
  },
  primaryEndTime: {
    fontSize: 13,
    lineHeight: 16,
    fontFamily: 'Geist_400Regular',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.2,
  },

  secondaryName: {
    fontSize: 15,
    lineHeight: 21,
    fontFamily: 'NotoSerifDevanagari_500Medium',
    letterSpacing: 0.05,
  },
  secondaryEndTime: {
    fontSize: 12.5,
    lineHeight: 15,
    fontFamily: 'Geist_400Regular',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.2,
  },

  // 6×6 accent dot marking the active element (frame 02). Transparent when
  // inactive so names stay column-aligned.
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // " · sunrise" tail on the at-sunrise element when not the primary — a
  // quiet canonicalisation marker, never the visual focus.
  sunriseTail: {
    fontSize: 10.5,
    fontFamily: 'Geist_400Regular',
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
  sunMoonTime: { fontSize: 12.5, ...typeScale.figuresMedium },
  // Sunrise time + zone tag. Wraps rather than shrinking the time: the tag
  // drops under the time when the cell cannot hold both on one line.
  sunMoonTimeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'baseline',
    columnGap: 4,
  },
  sunMoonTimeShrink: { flexShrink: 1 },
  // Zone tag ("IST") beside a time — small, secondary ink, never accent: it
  // qualifies the value, it is not a value itself.
  zoneTag: { fontSize: 9, letterSpacing: 0.8 },

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
    fontSize: 12.5,
    ...typeScale.figuresMedium,
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
  eclipseTitle: { fontSize: 14, fontFamily: 'NotoSerifDevanagari_600SemiBold' },
  eclipseRow: { fontSize: 12, fontFamily: 'NotoSerifDevanagari_500Medium' },
  eclipseVisibility: { fontSize: 12, fontFamily: 'NotoSerifDevanagari_500Medium', marginTop: 4 },

  durationRow: { flexDirection: 'row', alignItems: 'center', borderRadius: borderRadius.cardInner, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 8 },
  durationCell: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  durationDivider: { width: 0.5, height: 16 },
  durationText: { fontSize: 12, fontFamily: 'NotoSerifDevanagari_500Medium' },
  durationValue: { fontSize: 13, fontFamily: 'Geist_500Medium', fontVariant: ['tabular-nums'] },

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
    fontFamily: 'NotoSerifDevanagari_500Medium',
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
