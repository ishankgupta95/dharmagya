import { memo, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { MotionPressable } from '@/components/common/MotionPressable';
import {
  View,
  SectionList,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/common/Icon';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import { useStore, type MasaSystem, type Region } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, palette, spacing, type ColorPalette } from '@/config/theme';
import { AdBanner } from '@/components/common/AdBanner';
import { ScreenMount } from '@/components/common/ScreenMount';

import { festivalDaysForYear, isFestivalYearInTable } from '@/data/festivals';
import {
  FESTIVALS_BROWSE_MAX_YEAR,
  FESTIVALS_BROWSE_MIN_YEAR,
  getFestivalYearState,
  isFestivalYearComputable,
  requestFestivalYear,
  subscribeFestivalYears,
  type FestivalYearState,
} from '@/services/festivalYearCache';
import { festivalYearTotalDays } from '@/services/festivalYearCompute';
import { fetchUpcomingEclipses, FALLBACK_COORDS } from '@/services/astrology/panchangService';
import { localizeFestivalName, localizeFestivalDescription } from '@/i18n/festivalNames';
import { getPujaForFestivalName } from '@/config/poojas';
import { getKathaForFestivalName } from '@/config/kathas';
import { getFestivalContentForName } from '@/config/festivalContent';
import { isSameDay } from '@/utils/calendar';
import { formatDateCached } from '@/utils/format';

interface FestivalEntry {
  name: string;
  type: string;
  description?: string;
  /** Other regional names observed for the same event (e.g. Sankranti variants). */
  regionalVariants?: string[];
}

interface FestivalDay {
  date: Date;
  festivals: FestivalEntry[];
}

interface SectionData {
  title: string;
  data: FestivalDay[];
}

// Color string is resolved at render-time so type 'major' can pick up the
// theme-responsive accent (sindoor in light, goldLeaf in dark) for WCAG contrast.
const TYPE_ICON: Record<string, { icon: IconName; color: string | null }> = {
  major: { icon: 'star', color: null },
  minor: { icon: 'star-half', color: null },
  ekadashi: { icon: 'moon', color: '#7AA8C8' },
  smarta_ekadashi: { icon: 'moon', color: '#7AA8C8' },
  vaishnava_ekadashi: { icon: 'moon', color: '#7AA8C8' },
  pradosha: { icon: 'moon', color: '#9575CD' },
  sankranti: { icon: 'sun', color: '#E8893C' },
  eclipse: { icon: 'contrast', color: palette.rose },
};

/** Window used to flag upcoming items with a "Soon" badge + accent border. */
const SOON_WINDOW_DAYS = 14;

/**
 * Regional Sankranti variants → the Regions that observe them. Used only to
 * promote a user's regional name as the primary label when grouping same-day
 * Sankranti variants. Nothing gets filtered out based on this — all names
 * remain visible as "also observed as …" subtitles so users can discover other
 * traditions.
 *
 * A variant can belong to more than one Region, so these are lists. Baisakhi is
 * kept in Himachal as Biswa, Harela in the Himachali hills as Rihyali, and
 * Singh Sankranti in Uttarakhand as Ghee Sankranti / Ghyu Tyar — all three
 * curated into `CURATED_REGIONS` in `@/data/festivals`. This map is the second,
 * independent place regional scope is recorded; it drives which NAME leads,
 * where that one drives whether the festival is shown at all. Keep the two in
 * step: an addition there without one here means the festival appears, but
 * under another region's name.
 */
const REGIONAL_SANKRANTI: Record<string, Region[]> = {
  // South
  'Pongal': ['tamil-nadu'],
  'Puthandu': ['tamil-nadu'],
  'Vishu': ['kerala'],
  'Ayyappa Makara Jyothi': ['kerala'],
  // East
  'Pohela Boishakh': ['west-bengal'],
  'Raja Sankranti': ['odisha'],
  'Singh Sankranti': ['odisha', 'uttarakhand'],
  'Magh Bihu': ['assam'],
  'Bohag Bihu': ['assam'],
  'Kati Bihu': ['assam'],
  // West
  'Uttarayan': ['gujarat'],
  // North
  'Baisakhi': ['punjab', 'himachal-pradesh'],
  'Harela': ['uttarakhand', 'himachal-pradesh'],
  'Sair': ['himachal-pradesh'],
};

function collapseSankrantiVariants(list: FestivalEntry[], region: Region): FestivalEntry[] {
  const sankrantis = list.filter(f => f.type === 'sankranti');
  if (sankrantis.length <= 1) return list;

  const names = sankrantis.map(f => f.name);

  let primary: FestivalEntry | undefined;

  if (region !== 'all') {
    const regionalMatch = sankrantis.find(
      f => REGIONAL_SANKRANTI[f.name]?.includes(region),
    );
    if (regionalMatch) primary = regionalMatch;
  }
  if (!primary) {
    primary = sankrantis.find(
      f =>
        f.name !== 'Sankranti' &&
        !REGIONAL_SANKRANTI[f.name] &&
        /sankranti|uttarayana|dakshinayana/i.test(f.name),
    );
  }
  if (!primary) {
    const generic = sankrantis.find(f => f.name === 'Sankranti');
    if (generic?.description) {
      primary = {
        ...generic,
        name: `Sankranti (${generic.description})`,
      };
    }
  }
  if (!primary) primary = sankrantis[0];

  const variants = names.filter(
    n => n !== primary!.name && n !== 'Sankranti',
  );

  const merged: FestivalEntry = {
    ...primary,
    regionalVariants: variants.length > 0 ? variants : undefined,
  };

  return [...list.filter(f => f.type !== 'sankranti'), merged];
}

function collapseEkadashiPair(list: FestivalEntry[]): FestivalEntry[] {
  const smarta = list.find(f => f.type === 'smarta_ekadashi');
  const vaishnava = list.find(f => f.type === 'vaishnava_ekadashi');
  if (!smarta || !vaishnava) return list;
  const sameClassicalName =
    smarta.description && smarta.description === vaishnava.description;
  if (sameClassicalName) {
    const merged: FestivalEntry = {
      name: smarta.description!,
      type: 'ekadashi',
    };
    return [merged, ...list.filter(f =>
      f.type !== 'smarta_ekadashi' && f.type !== 'vaishnava_ekadashi'
    )];
  }
  return list;
}

/**
 * The picker's bounds: the bundled table (2020–2050) plus the small window
 * `festivalYearCache` computes on-device past each edge. Bounded on purpose —
 * every year past the table costs a full-year engine run the first time it is
 * opened, so an open-ended picker would let a few taps queue up decades of it.
 */
const MIN_YEAR = FESTIVALS_BROWSE_MIN_YEAR;
const MAX_YEAR = FESTIVALS_BROWSE_MAX_YEAR;

function clampYear(year: number): number {
  return Math.min(MAX_YEAR, Math.max(MIN_YEAR, year));
}

/**
 * How long the picker has to rest on a year outside the table before that year
 * is requested (SQLite row, else compute). Tapping through 2051 → 2055
 * therefore starts ONE compute, for the year the user stopped on, not five;
 * the service additionally runs at most one at a time. A year already computed
 * this session skips the wait; the intermediate years only ever show the
 * neutral `loading` state — no day count, no Cancel.
 */
const YEAR_SETTLE_MS = 350;

type RawFestivalRow = { date: string; festivals: FestivalEntry[] };

/**
 * The bundled table's rows for `year` (English; see `@/data/festivals`), in the
 * user's month system: since panchang-ts 5.4 Shravan Somvar, Mangala Gauri,
 * Kartik Somvar and Magha Shanivar fall on different days under amanta. Region
 * stays `'all'` — this is the browse surface (see `parseFestivalDays`) — so a
 * region-only re-dating (Nepal's solar-month Mondays) shows on the Panchang
 * calendar and in reminders, not here.
 */
function tableRows(year: number, masaSystem: MasaSystem): readonly RawFestivalRow[] {
  return festivalDaysForYear(year, 'all', masaSystem);
}

/**
 * What the screen shows about an on-device compute for the selected year:
 *
 *  - `none`      — a table year, or a finished one: just the list.
 *  - `loading`   — nothing computed yet and the engine not running for it:
 *                  the picker is settling, the request is waiting its turn, or
 *                  the SQLite row is being read. A year an earlier session
 *                  already computed passes through ONLY this on its way to
 *                  `none`, so it carries no day count and no Cancel — there may
 *                  be nothing to cancel. Shown as the list's empty state.
 *  - `computing` — the engine is running for it, or it has real progress that
 *                  the pending request will resume: day count + Cancel.
 *  - `paused`    — the user stopped it: day count + Resume.
 *  - `error`     — the engine threw: Retry.
 *
 * `stopped` wins over the service's own status while a run winds down, so
 * Cancel reads as instant even though the engine halts at the end of its
 * current day.
 */
function computeModeFor(
  computable: boolean,
  state: FestivalYearState,
  stopped: boolean,
): 'none' | 'loading' | 'computing' | 'paused' | 'error' {
  if (!computable || state.status === 'complete') return 'none';
  if (state.status === 'error') return 'error';
  if (stopped) return 'paused';
  if (state.status === 'computing' || state.daysDone > 0) return 'computing';
  return 'loading';
}

/**
 * Deliberate split from the Panchang calendar: this screen is the BROWSE
 * surface, so it lists every festival the table carries and uses `region` only
 * to promote the user's own regional name to the primary label (see
 * `collapseSankrantiVariants`). The Panchang month grid is the opposite — it is
 * the user's own almanac, so `calendarService` drops out-of-region festivals
 * there via `festivalAllowedInRegion`. Changing one without the other is what
 * made Region look like a dead setting.
 *
 * Takes rows rather than a year so that a year computed on-device (or still
 * computing — its partial rows stream through here) goes through exactly the
 * same shaping as a table year.
 */
function parseFestivalDays(yearData: readonly RawFestivalRow[] | undefined, region: Region): FestivalDay[] {
  if (!yearData) return [];
  return yearData.map(d => ({
    date: new Date(d.date + 'T00:00:00'),
    festivals: collapseSankrantiVariants(
      collapseEkadashiPair(d.festivals),
      region,
    ),
  }));
}

function festivalMatches(f: FestivalEntry, q: string, lang: string): boolean {
  if (f.name.toLowerCase().includes(q)) return true;
  if (f.description?.toLowerCase().includes(q)) return true;
  if (f.regionalVariants?.some(v => v.toLowerCase().includes(q))) return true;
  if (lang === 'hi') {
    if (localizeFestivalName(f.name, lang).toLowerCase().includes(q)) return true;
    if (f.description && localizeFestivalDescription(f.description, lang).toLowerCase().includes(q)) return true;
    if (f.regionalVariants?.some(v => localizeFestivalName(v, lang).toLowerCase().includes(q))) return true;
  }
  return false;
}

export default function FestivalsScreen() {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'hi' ? 'hi-IN' : 'en-IN';
  const isDarkMode = useStore(s => s.isDarkMode);
  const region = useStore(s => s.region);
  const masaSystem = useStore(s => s.masaSystem);
  const userLocation = useStore(s => s.userLocation);
  const colors = isDarkMode ? darkColors : lightColors;
  const db = useSQLiteContext();

  const [year, setYear] = useState(() => clampYear(new Date().getFullYear()));
  const [searchQuery, setSearchQuery] = useState('');
  // The TextInput stays on the immediate value so typing never lags, but the
  // filter reads the debounced one: the first keystroke off an empty query
  // drops `visibleDays` from identity-stable to a full rebuild of ~149 rows,
  // and without this that rebuild lands on every character. Same 300 ms window
  // as app/search.tsx.
  const [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const today = useMemo(() => new Date(), []);

  // Upcoming eclipses (next ~12 months from today). Derived, not fetched into
  // state from an effect: that shape re-rendered the whole ~149-row list once
  // more right after first paint. ~10 ms on the first call per location, then
  // served from the service's LRU.
  const upcomingEclipses = useMemo(
    () => fetchUpcomingEclipses(today, userLocation ?? FALLBACK_COORDS),
    [today, userLocation],
  );

  // ── Years outside the bundled table ────────────────────────────────────
  // Computed on-device by `festivalYearCache`, which owns the state; this
  // screen only asks for the selected year once the picker has settled, and
  // withdraws the ask (abort) when the year changes, Stop is pressed or the
  // screen unmounts. Progress, partial rows and the finished year all arrive
  // through the service's store, keyed by year, so a late result for a year the
  // user has already left can never land on the one they are looking at.
  const inTable = isFestivalYearInTable(year);
  const computable = isFestivalYearComputable(year);
  // Same getter for the server snapshot: the web build pre-renders routes
  // (`web.output: 'static'`), where a missing one throws; it is `idle` there.
  const readComputed = () => getFestivalYearState(year);
  const computed = useSyncExternalStore(subscribeFestivalYears, readComputed, readComputed);
  // Stop is remembered per year, so moving to another year needs no reset.
  const [stoppedYear, setStoppedYear] = useState<number | null>(null);
  const stopped = stoppedYear === year;
  // Retry after an engine error re-enters the effect below.
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    if (!isFestivalYearComputable(year) || stopped) return;
    if (getFestivalYearState(year).status === 'complete') return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void requestFestivalYear(db, year, controller.signal);
    }, YEAR_SETTLE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [db, year, stopped, retryNonce]);

  const computeMode = computeModeFor(computable, computed, stopped);
  const progressTotal = computed.totalDays > 0 ? computed.totalDays : festivalYearTotalDays(year);
  const progressDone = Math.min(computed.daysDone, progressTotal);
  const progressPct = Math.round((progressDone / progressTotal) * 100);

  const rawRows = useMemo(
    () => (inTable ? tableRows(year, masaSystem) : computed.days),
    [inTable, year, masaSystem, computed.days],
  );
  const festivalDays = useMemo(() => parseFestivalDays(rawRows, region), [rawRows, region]);

  const visibleDays = useMemo(() => {
    const q = debouncedQuery.toLowerCase();
    if (!q) return festivalDays;
    return festivalDays
      .map(d => ({
        date: d.date,
        festivals: d.festivals.filter(f => festivalMatches(f, q, i18n.language)),
      }))
      .filter(d => d.festivals.length > 0);
  }, [festivalDays, debouncedQuery, i18n.language]);

  const sections: SectionData[] = useMemo(() => {
    const grouped = new Map<number, FestivalDay[]>();
    for (const fd of visibleDays) {
      const m = fd.date.getMonth();
      if (!grouped.has(m)) grouped.set(m, []);
      grouped.get(m)!.push(fd);
    }
    return [...grouped.entries()]
      .sort(([a], [b]) => a - b)
      .map(([m, data]) => {
        // Build a Date in this section's month so Intl can produce a localized
        // month name — gives "जनवरी" / "February" / etc. without a static map.
        const monthDate = new Date(year, m, 1);
        const monthLabel = formatDateCached(monthDate, dateLocale, { month: 'long' });
        return { title: `${monthLabel} ${year}`, data };
      });
  }, [visibleDays, year, dateLocale]);

  const soonCutoff = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + SOON_WINDOW_DAYS);
    return d.getTime();
  }, []);
  const nowStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const canGoBack = year > MIN_YEAR;
  const canGoForward = year < MAX_YEAR;

  return (
    <ScreenMount>
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={[styles.headerRow, { paddingHorizontal: spacing.screenH }]}>
        <MotionPressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.back')}>
          <Icon name="chevron-left" size={22} color={colors.textSecondary} />
        </MotionPressable>
        <Text
          variant={i18n.language === 'hi' ? 'deva-bold' : 'display'}
          style={[styles.screenTitle, { color: colors.textPrimary }]}>
          {t('festivals.title')}
        </Text>
      </View>

      {/* ── Year selector ──────────────────────────────────────────── */}
      <View style={[styles.yearRow, { paddingHorizontal: spacing.screenH }]}>
        <MotionPressable
          onPress={() => setYear(y => clampYear(y - 1))}
          hitSlop={12}
          disabled={!canGoBack}
          accessibilityRole="button"
          accessibilityLabel={`${year - 1}`}
          accessibilityState={{ disabled: !canGoBack }}>
          <Icon name="chevron-left" size={20} color={canGoBack ? colors.textSecondary : colors.textMuted} />
        </MotionPressable>
        <Text variant="display-italic" style={[styles.yearLabel, { color: colors.textPrimary }]}>
          {year}
        </Text>
        <MotionPressable
          onPress={() => setYear(y => clampYear(y + 1))}
          hitSlop={12}
          disabled={!canGoForward}
          accessibilityRole="button"
          accessibilityLabel={`${year + 1}`}
          accessibilityState={{ disabled: !canGoForward }}>
          <Icon name="chevron-right" size={20} color={canGoForward ? colors.textSecondary : colors.textMuted} />
        </MotionPressable>
      </View>

      {/* ── Search bar ─────────────────────────────────────────────── */}
      <View style={[styles.searchBar, { paddingHorizontal: spacing.screenH }]}>
        <View style={[styles.searchInputWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Icon name="search" size={16} color={colors.textMuted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('festivals.searchPlaceholder')}
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.textPrimary, fontFamily: 'Geist_400Regular' }]}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <MotionPressable
              onPress={() => setSearchQuery('')}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('a11y.clearSearch')}>
              <Icon name="close-circle" size={18} color={colors.textMuted} />
            </MotionPressable>
          )}
        </View>
      </View>

      {/* ── On-device compute for a year past the table ───────────────── */}
      {computeMode === 'computing' && (
        <View style={{ paddingHorizontal: spacing.screenH }}>
          <View style={[styles.progressCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.progressHead}>
              <ActivityIndicator color={colors.accent} size="small" />
              {/* Not a live region: it changes every ~250 ms and would talk over
                  the user. The bar below carries the value on focus. */}
              <Text variant="body" style={[styles.progressText, { color: colors.textPrimary }]}>
                {t('muhurat.progressCalculating', { current: progressDone, total: progressTotal })}
              </Text>
            </View>
            <View
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: progressTotal, now: progressDone }}
              style={[styles.progressBar, { backgroundColor: colors.surfaceRecessed }]}>
              <View style={[styles.progressFill, { backgroundColor: colors.accent, width: `${progressPct}%` }]} />
            </View>
            <MotionPressable
              onPress={() => setStoppedYear(year)}
              hitSlop={8}
              style={styles.progressAction}
              accessibilityRole="button"
              accessibilityLabel={t('muhurat.cancelScan')}>
              <Icon name="stop-circle" size={16} color={colors.danger} />
              <Text variant="kicker-small" style={[styles.progressActionText, { color: colors.dangerText }]}>
                {t('muhurat.cancelScan')}
              </Text>
            </MotionPressable>
          </View>
        </View>
      )}
      {computeMode === 'paused' && (
        <View style={{ paddingHorizontal: spacing.screenH }}>
          <View style={[styles.progressCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text variant="body" style={[styles.progressMessage, { color: colors.textPrimary }]}>
              {t('muhurat.scanPaused', { current: progressDone, total: progressTotal })}
            </Text>
            <MotionPressable
              onPress={() => setStoppedYear(null)}
              hitSlop={8}
              style={styles.progressAction}
              accessibilityRole="button"
              accessibilityLabel={t('muhurat.resumeScan')}>
              <Icon name="play-circle" size={16} color={colors.accent} />
              <Text variant="kicker-small" style={[styles.progressActionText, { color: colors.accentText }]}>
                {t('muhurat.resumeScan')}
              </Text>
            </MotionPressable>
          </View>
        </View>
      )}
      {computeMode === 'error' && (
        <View style={{ paddingHorizontal: spacing.screenH }}>
          <View style={[styles.progressCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text variant="body" style={[styles.progressMessage, { color: colors.textPrimary }]}>
              {t('festivals.computeFailed', { year })}
            </Text>
            <MotionPressable
              onPress={() => setRetryNonce(n => n + 1)}
              hitSlop={8}
              style={styles.progressAction}
              accessibilityRole="button"
              accessibilityLabel={t('common.retry')}>
              <Icon name="refresh" size={16} color={colors.accent} />
              <Text variant="kicker-small" style={[styles.progressActionText, { color: colors.accentText }]}>
                {t('common.retry')}
              </Text>
            </MotionPressable>
          </View>
        </View>
      )}

      {(upcomingEclipses.solar || upcomingEclipses.lunar) && (
        <View style={[styles.eclipseSection, { paddingHorizontal: spacing.screenH }]}>
          <Text variant="kicker-small" style={{ color: colors.textMuted, fontSize: 9.5, marginBottom: 4 }}>
            {t('festivals.upcomingEclipses')}
          </Text>
          {(['solar', 'lunar'] as const).map(kind => {
            const e = upcomingEclipses[kind];
            if (!e) return null;
            return (
              <View
                key={kind}
                style={[
                  styles.eclipseCard,
                  { backgroundColor: colors.accentSurface, borderColor: colors.borderAccent },
                ]}>
                <Icon
                  name={e.kind === 'solar' ? 'sun' : 'moon'}
                  size={16}
                  color={colors.accent}
                />
                <View style={{ flex: 1 }}>
                  <Text variant="body" style={[styles.eclipseTitle, { color: colors.textPrimary }]}>
                    {t(e.kind === 'solar' ? 'festivals.solarEclipse' : 'festivals.lunarEclipse')}
                    {' · '}
                    {t(`festivals.eclipseSubtype.${e.subtype}`)}
                  </Text>
                  <Text variant="body-italic" style={[styles.eclipseMeta, { color: colors.textMuted }]}>
                    {formatDateCached(new Date(e.date + 'T00:00:00'), dateLocale, { day: 'numeric', month: 'long', year: 'numeric' })}
                    {' · '}
                    {e.visibleFromLocation
                      ? t('festivals.eclipseVisible')
                      : t('festivals.eclipseNotVisible')}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Virtualized: a full year is 149–166 date rows carrying 250+ festival
          entries, and every entry mounts an `<Icon>`, i.e. its own native
          react-native-svg surface. Committing all of them in one pass froze
          entry for several hundred ms. `sections` is already `{title, data}`,
          so it feeds SectionList unchanged. */}
      <SectionList
        style={{ flex: 1 }}
        sections={sections}
        keyExtractor={day => String(day.date.getTime())}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text variant="kicker-small" style={{ color: colors.accentText, fontSize: 9.5 }}>
              {section.title}
            </Text>
          </View>
        )}
        renderItem={({ item: day }) => {
          const t0 = day.date.getTime();
          const dayIsToday = isSameDay(day.date, today);
          return (
            <FestivalRow
              item={day}
              colors={colors}
              t={t}
              lang={i18n.language}
              dateLocale={dateLocale}
              isToday={dayIsToday}
              isSoon={t0 >= nowStart && t0 <= soonCutoff && !dayIsToday}
            />
          );
        }}
        contentContainerStyle={{ paddingHorizontal: spacing.screenH, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        // Headers were non-sticky under the old ScrollView; iOS defaults this
        // to true, so pin it off to keep the look identical.
        stickySectionHeadersEnabled={false}
        initialNumToRender={10}
        maxToRenderPerBatch={12}
        windowSize={7}
        // While a year is still being computed the card above already says
        // what is happening; "No festivals found" under it would be false.
        // Before any of it is computed (`loading`) there is no card, so the
        // empty state itself says the year is on its way.
        ListEmptyComponent={
          computeMode === 'none' ? (
            <View style={styles.emptyContainer}>
              <Text variant="body-italic" style={[styles.emptyText, { color: colors.textMuted }]}>
                {debouncedQuery
                  ? t('festivals.noSearchResults', { query: debouncedQuery, year })
                  : t('festivals.noFestivals', { year })}
              </Text>
            </View>
          ) : computeMode === 'loading' ? (
            <View
              style={[styles.emptyContainer, styles.loadingContainer]}
              accessible
              accessibilityLabel={t('festivals.loadingYear', { year })}
              accessibilityState={{ busy: true }}>
              <ActivityIndicator color={colors.accent} size="small" />
              <Text variant="body-italic" style={[styles.emptyText, { color: colors.textMuted }]}>
                {t('festivals.loadingYear', { year })}
              </Text>
            </View>
          ) : null
        }
        /* Every festival entry the content lib ships carries `reviewPending`,
           and the row subtitles above print that prose verbatim. The detail
           screen captions it per entry (`reader.reviewNote`); the list captions
           it once here, so the flagged text never reads as settled on a screen
           a user may never tap through from. Deliberately NOT gated on "some
           visible row has a significance subtitle" — that would mean re-running
           the content match over every row at screen level just to hide a line,
           and the wording holds for the whole list either way. Skipped only in
           the empty state, which has no prose to caption. */
        ListFooterComponent={
          sections.length > 0 ? (
            <Text variant="body-small" style={[styles.footer, { color: colors.textSecondary }]}>
              {t('festivals.footer')}
            </Text>
          ) : null
        }
      />

      <AdBanner colors={colors} placement="festivals" />
    </SafeAreaView>
    </ScreenMount>
  );
}

const FestivalRow = memo(FestivalRowImpl);

function FestivalRowImpl({
  item,
  colors,
  t,
  lang,
  dateLocale,
  isToday,
  isSoon,
}: {
  item: FestivalDay;
  colors: ColorPalette;
  /** Translator + locale passed down rather than pulled from `useTranslation`
   *  here: a year is ~149 rows, and each hook mount clones the whole i18next
   *  instance and subscribes it. Same reason `FocusReader` hands its verses a
   *  `hint` string instead of a translator. */
  t: TFunction;
  lang: string;
  dateLocale: string;
  isToday: boolean;
  isSoon: boolean;
}) {
  const dayName = formatDateCached(item.date, dateLocale, { weekday: 'short' });
  const dayNum = item.date.getDate();
  const highlighted = isToday || isSoon;

  return (
    <View
      style={[
        styles.festivalRow,
        { borderColor: colors.divider, backgroundColor: colors.surface },
        highlighted && {
          borderColor: colors.accent,
          borderWidth: isToday ? 1.5 : 1,
        },
      ]}>
      <View
        style={[
          styles.dateCol,
          { backgroundColor: isToday ? colors.accent : 'transparent' },
        ]}>
        <Text
          variant="kicker-small"
          style={[
            styles.dateDayName,
            { color: isToday ? palette.night : colors.textMuted },
          ]}>
          {dayName}
        </Text>
        <Text
          variant="display"
          style={[
            styles.dateDayNum,
            { color: isToday ? palette.night : colors.textPrimary },
          ]}>
          {dayNum}
        </Text>
      </View>

      <View style={styles.festivalCol}>
        {isSoon && !isToday && (
          <View style={[styles.soonBadge, { borderColor: colors.accent }]}>
            <Text variant="mono-caps" style={[styles.soonBadgeText, { color: colors.accentText }]}>
              {t('festivals.soonBadge')}
            </Text>
          </View>
        )}
        {item.festivals.map((f, i) => {
          const typeInfo = TYPE_ICON[f.type] ?? TYPE_ICON.minor;
          const isSubvariant =
            f.type === 'smarta_ekadashi' || f.type === 'vaishnava_ekadashi';
          const primaryRaw = isSubvariant && f.description ? f.description : f.name;
          const primary = isSubvariant && f.description
            ? localizeFestivalDescription(primaryRaw, lang)
            : localizeFestivalName(primaryRaw, lang);
          let secondary: string | undefined;
          if (isSubvariant) {
            const sectLabel = f.type === 'smarta_ekadashi'
              ? t('festivals.smartaFast')
              : t('festivals.vaishnavaFast');
            secondary = sectLabel;
          } else if (f.regionalVariants && f.regionalVariants.length > 0) {
            const localizedVariants = f.regionalVariants
              .map(v => localizeFestivalName(v, lang))
              .join(', ');
            secondary = t('festivals.alsoObservedAs', { names: localizedVariants });
          } else if (
            f.description &&
            f.description !== f.name &&
            f.type !== 'sankranti'
          ) {
            secondary = localizeFestivalDescription(f.description, lang);
          }
          const matchedPuja = getPujaForFestivalName(f.name, f.description);
          const matchedKatha = getKathaForFestivalName(f.name, f.description);
          const matchedFestival = getFestivalContentForName(f.name, f.description);
          const pujaLang: 'en' | 'hi' = lang === 'hi' ? 'hi' : 'en';
          // When the lib carries content for this observance, the name becomes a
          // link into the festival detail (significance + story + cross-links),
          // and a two-line clamp of the significance shows when no other subtitle
          // is present. It earns its place: the opaque monthly repeats (Sankashti
          // Chaturthi / Masik Shivaratri / Vinayaka Chaturthi) account for ~34 of
          // the ~63 rows that carry this line in a year, and it is the only thing
          // on screen saying what they are. Every entry the lib ships is
          // `reviewPending`, so the screen footer carries the caption for it.
          const significance = matchedFestival && !secondary
            ? matchedFestival.significance[pujaLang]
            : undefined;
          return (
            <View key={i} style={styles.festivalItem}>
              <View style={{ marginTop: 3 }}>
                <Icon name={typeInfo.icon} size={14} color={typeInfo.color ?? colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                {matchedFestival ? (
                  <MotionPressable
                    onPress={() => router.push({ pathname: '/festival/[id]', params: { id: matchedFestival.id } })}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                    style={styles.festivalNameRow}
                    accessibilityRole="button"
                    accessibilityLabel={localizeFestivalName(f.name, lang)}>
                    <Text variant="body" style={[styles.festivalName, styles.festivalNameLink, { color: colors.textPrimary }]}>
                      {primary}
                    </Text>
                    <Icon name="chevron-right" size={13} color={colors.textMuted} />
                  </MotionPressable>
                ) : (
                  <Text variant="body" style={[styles.festivalName, { color: colors.textPrimary }]}>
                    {primary}
                  </Text>
                )}
                {secondary && (
                  <Text variant="body-italic" style={[styles.festivalSecondary, { color: colors.textMuted }]}>
                    {secondary}
                  </Text>
                )}
                {significance && (
                  <Text variant="body-italic" style={[styles.festivalSecondary, { color: colors.textMuted }]} numberOfLines={2}>
                    {significance}
                  </Text>
                )}
                {matchedPuja && (
                  <MotionPressable
                    onPress={() => router.push({ pathname: '/pooja/[slug]', params: { slug: matchedPuja.slug } })}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                    style={styles.pujaCtaRow}
                    accessibilityRole="button"
                    accessibilityLabel={t('puja.openNamedPuja', { name: matchedPuja.name[pujaLang] })}>
                    <Icon name="gift" size={11} color={colors.accentText} />
                    <Text variant="mono-caps" style={[styles.pujaCtaText, { color: colors.accentText }]}>
                      {t('puja.openNamedPuja', { name: matchedPuja.name[pujaLang] })}
                    </Text>
                  </MotionPressable>
                )}
                {matchedKatha && (
                  <MotionPressable
                    onPress={() => router.push({ pathname: '/katha/[slug]', params: { slug: matchedKatha.slug } })}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                    style={styles.pujaCtaRow}
                    accessibilityRole="button"
                    accessibilityLabel={t('katha.a11yOpenKatha', { name: matchedKatha.titleEnglish })}>
                    <Icon name="text" size={11} color={colors.accentText} />
                    <Text variant="mono-caps" style={[styles.pujaCtaText, { color: colors.accentText }]}>
                      {t('katha.festivalCta')}
                    </Text>
                  </MotionPressable>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    paddingTop: 6,
    paddingBottom: 12,
  },
  backPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  screenTitle: { flex: 1, fontSize: 30, lineHeight: 40 },

  yearRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
    paddingTop: 14,
    paddingBottom: 12,
  },
  yearLabel: { fontSize: 30, lineHeight: 36 },

  searchBar: { paddingBottom: 12 },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: borderRadius.button,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },

  // Same metrics as the muhurat finder's scan card, so the app's two on-device
  // computes read as one control.
  progressCard: {
    borderRadius: borderRadius.list,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    gap: 10,
  },
  progressHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressText: { flex: 1, fontSize: 13 },
  progressMessage: { fontSize: 13 },
  progressBar: { height: 3, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  progressAction: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  progressActionText: { fontSize: 10 },

  sectionHeader: { paddingTop: 18, paddingBottom: 10 },

  festivalRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    marginBottom: 8,
    borderRadius: borderRadius.cardInner,
    borderWidth: 1,
    overflow: 'hidden',
  },

  dateCol: {
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 2,
  },
  dateDayName: { fontSize: 9 },
  dateDayNum: { fontSize: 26, lineHeight: 30 },

  festivalCol: { flex: 1, paddingVertical: 10, paddingRight: 12, gap: 6 },
  festivalItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  festivalNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  festivalName: { fontSize: 14, lineHeight: 19 },
  festivalNameLink: { flexShrink: 1 },
  festivalSecondary: { fontSize: 11, lineHeight: 15, marginTop: 1 },
  pujaCtaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
  pujaCtaText: { fontSize: 8.5, letterSpacing: 1.4, flexShrink: 1 },

  soonBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    borderWidth: 1,
  },
  soonBadgeText: { fontSize: 8 },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
  loadingContainer: { gap: 10 },
  emptyText: { fontSize: 14 },

  // Matches the muhurat screen's footer metrics so the app's two
  // provisional-content captions read as one voice.
  footer: {
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 16,
    textAlign: 'center',
    paddingHorizontal: 12,
  },

  eclipseSection: { paddingTop: 4, paddingBottom: 12, gap: 8 },
  eclipseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: borderRadius.cardInner,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
  },
  eclipseTitle: { fontSize: 13, lineHeight: 18 },
  eclipseMeta: { fontSize: 11, marginTop: 2 },
});
