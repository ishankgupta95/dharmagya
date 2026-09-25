import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  SectionList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '@/components/common/Icon';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { MuhurtaFactor } from 'panchang-ts';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, palette, spacing, type ColorPalette } from '@/config/theme';
import { AdBanner } from '@/components/common/AdBanner';
import { ScreenMount } from '@/components/common/ScreenMount';
import { MotionPressable } from '@/components/common/MotionPressable';
import { SegmentedChip } from '@/components/common/SegmentedChip';
import { useInterstitialOnExit } from '@/hooks/useInterstitialOnExit';
import {
  ALL_OCCASIONS,
  scanAuspiciousDays,
  validateCandidates,
  type MuhuratMatch,
  type Occasion,
} from '@/services/astrology/muhurat';
import {
  readMuhuratCache,
  writeMuhuratCache,
  clearMuhuratCache,
} from '@/services/astrology/muhuratCache';
import muhuratCandidatesData from '@/data/static/muhurat-candidates.json';
import {
  localizeTithi,
  localizeNakshatra,
  localizeYoga,
  localizeVara,
  localizeChoghadiya,
} from '@/i18n/panchangNames';
import { formatDateCached, useLocaleFormatters } from '@/utils/format';

const SCAN_DAYS = 365;
const PERSIST_EVERY = 15; // flush partial scan to SQLite every N days
const UPCOMING_WINDOW_DAYS = 14; // matches within this window get the "Soon" badge

// Streamed matches reach React state in batches, not one setState per match.
// Every published array is a new identity, which re-runs visibleMatches →
// bestKey → monthSections and the whole card pass; the scanner yields every 5
// candidates, so during a first scan that interleaved with compute. A burst
// costs one render per UI_FLUSH_EVERY_MATCHES; a match that arrives inside
// the interval after the last flush is held and a one-shot timer publishes
// it UI_FLUSH_INTERVAL_MS later, so a slow trickle never waits on the next
// match (or scan end, which on the full-scan path can be seconds away).
const UI_FLUSH_EVERY_MATCHES = 10;
const UI_FLUSH_INTERVAL_MS = 250;

const WINDOW_OPTIONS = [3, 6, 12] as const;
type WindowMonths = (typeof WINDOW_OPTIONS)[number];

interface MuhuratCandidatesFile {
  version: number;
  generatedAt: string; // YYYY-MM-DD
  lookaheadDays: number;
  references: string[];
  candidates: Record<string, string[]>;
}

const CANDIDATES: MuhuratCandidatesFile = muhuratCandidatesData;

// The candidate fast path is only sound while the bundled JSON still covers the
// whole scan window — i.e. while its age has not eaten into `SCAN_DAYS` of its
// own lookahead. Derived rather than hardcoded because the previous constant
// (540) was computed against zero instead of against SCAN_DAYS, so for ages
// 366–540 days the path ran against a list that stopped short of the target end
// and then cached the shortfall as a completed scan. Past this age the full
// on-device scan takes over: slower first open, correct results.
const CANDIDATES_STALE_AFTER_DAYS = Math.max(0, CANDIDATES.lookaheadDays - SCAN_DAYS);

/** Last date the generator actually evaluated (inclusive). */
function candidatesCoverageEnd(): Date | null {
  const generated = parseYmd(CANDIDATES.generatedAt);
  if (!generated) return null;
  const end = new Date(generated);
  end.setDate(end.getDate() + CANDIDATES.lookaheadDays - 1);
  return end;
}

type Status = 'loading' | 'scanning' | 'complete' | 'cancelled' | 'error';

interface MonthSection {
  key: string;
  label: string;
  data: MuhuratMatch[];
}

export default function MuhuratFinderScreen() {
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams<{ occasion?: string }>();
  const isDarkMode = useStore(s => s.isDarkMode);
  const userLocation = useStore(s => s.userLocation);
  const ayanamsa = useStore(s => s.ayanamsa);
  const colors = isDarkMode ? darkColors : lightColors;
  const db = useSQLiteContext();
  const lang = i18n.language;
  const isHi = lang === 'hi';
  // Hoisted out of the card: ~250 rows in one commit each opened their own
  // store subscriptions for the same two preferences.
  const { formatNumber } = useLocaleFormatters();

  const [occasion, setOccasion] = useState<Occasion>(() =>
    ALL_OCCASIONS.includes(params.occasion as Occasion)
      ? (params.occasion as Occasion)
      : ALL_OCCASIONS[0],
  );

  useInterstitialOnExit();

  const [matches, setMatches] = useState<MuhuratMatch[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [scannedCount, setScannedCount] = useState(0);
  const [totalDays, setTotalDays] = useState(SCAN_DAYS);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [windowMonths, setWindowMonths] = useState<WindowMonths>(12);
  const [rangeOpen, setRangeOpen] = useState(false);
  // Resume and Refresh re-enter the scan effect instead of calling a scan
  // function directly. The effect owns the abort controller and the unmount
  // flush, and keeping it the single entry point is what lets its dependency
  // list be the honest one (see the comment on the effect below).
  const [scanNonce, setScanNonce] = useState(0);
  const scanModeRef = useRef<'auto' | 'refresh'>('auto');

  const upcomingCutoff = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + UPCOMING_WINDOW_DAYS);
    return d.getTime();
  }, []);

  // The scan always covers the full 365-day window (and its cache is keyed to
  // it); the range control only narrows what is *shown*.
  const windowCutoff = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setMonth(d.getMonth() + windowMonths);
    return d.getTime();
  }, [windowMonths]);

  const visibleMatches = useMemo(
    () => matches.filter(m => m.date.getTime() <= windowCutoff),
    [matches, windowCutoff],
  );

  // The single best-scoring visible date gets the highlighted card.
  const bestKey = useMemo(() => {
    let best: MuhuratMatch | null = null;
    for (const m of visibleMatches) {
      if (!best || m.score > best.score) best = m;
    }
    return best ? best.date.toISOString() : null;
  }, [visibleMatches]);

  const dateLocale = isHi ? 'hi-IN' : 'en-IN';

  const rangeLabel = useMemo(() => {
    const from = new Date();
    const to = new Date();
    to.setMonth(to.getMonth() + windowMonths);
    const opts = { month: 'short', year: 'numeric' } as const;
    return `${formatDateCached(from, dateLocale, opts)} – ${formatDateCached(to, dateLocale, opts)}`;
  }, [windowMonths, dateLocale]);

  const monthSections = useMemo<MonthSection[]>(() => {
    const groups = new Map<string, MuhuratMatch[]>();
    for (const m of visibleMatches) {
      const key = `${m.date.getFullYear()}-${m.date.getMonth()}`;
      const arr = groups.get(key);
      if (arr) arr.push(m);
      else groups.set(key, [m]);
    }
    return Array.from(groups.entries()).map(([key, items]) => ({
      key,
      label: formatDateCached(items[0].date, dateLocale, { month: 'long', year: 'numeric' }),
      data: items,
    }));
  }, [visibleMatches, dateLocale]);

  const matchesRef = useRef<MuhuratMatch[]>([]);
  const scannedThroughRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);
  // What the last completed cache write actually contained. The unmount write
  // re-stringifies a 240–345 KB payload while the back transition is running,
  // so it is skipped when neither the match count nor the scanned-through day
  // has moved since that write.
  const lastPersistedRef = useRef<{ count: number; through: string | null }>({
    count: -1,
    through: null,
  });

  // `db` is not a scan input: SQLiteProvider hands out one connection for the
  // app's life, and a new identity for it must never abort a scan in flight.
  // It is read through a ref so the scan effect can list its real dependencies.
  // The effect used to omit `db` behind a suppressed exhaustive-deps lint
  // instead, and a react-hooks suppression anywhere in a component makes React
  // Compiler skip that component wholesale — so the comment cost this screen
  // every auto-memo on it. Do not reintroduce one here.
  const dbRef = useRef(db);
  useEffect(() => {
    dbRef.current = db;
  }, [db]);

  // Coords are rebuilt from primitives inside the effect so the scan keys off
  // values rather than object identity: the store hands back a fresh
  // `userLocation` object on rehydrate, and restarting a 365-day scan for that
  // is exactly what the old `?.lat / ?.lon` dependency list avoided. `timezone`
  // is part of the tuple because `PanchangCoords` carries it and the scan reads
  // it for the day boundary — dropping it would silently move every window.
  const lat = userLocation?.lat ?? null;
  const lon = userLocation?.lon ?? null;
  const timezone = userLocation?.timezone;

  useEffect(() => {
    const database = dbRef.current;
    const coords = lat != null && lon != null ? { lat, lon, timezone } : null;
    // One-shot: a Refresh must not leak into the next occasion switch, which
    // would silently wipe that occasion's cache.
    const mode = scanModeRef.current;
    scanModeRef.current = 'auto';

    const myRun = ++runIdRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    // Reset — with in-place occasion switching, a stale value from the
    // previous occasion must never be persisted as this occasion's progress.
    scannedThroughRef.current = null;
    lastPersistedRef.current = { count: -1, through: null };

    // Matches accumulate in the ref and reach state in batches; see
    // UI_FLUSH_EVERY_MATCHES. A held match arms a one-shot timer so it is
    // published within UI_FLUSH_INTERVAL_MS even if no further match arrives.
    // The timer is scoped to this run: every flush disarms it, the run guard
    // makes a late fire a no-op, and the cleanup below clears it so nothing
    // fires after unmount or once a later run has taken over.
    let pending = 0;
    let lastFlushAt = Date.now();
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    const clearFlushTimer = () => {
      if (flushTimer != null) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
    };
    const flushMatches = () => {
      clearFlushTimer();
      pending = 0;
      lastFlushAt = Date.now();
      setMatches([...matchesRef.current]);
    };
    const noteMatch = (m: MuhuratMatch) => {
      matchesRef.current.push(m);
      pending += 1;
      if (pending >= UI_FLUSH_EVERY_MATCHES || Date.now() - lastFlushAt >= UI_FLUSH_INTERVAL_MS) {
        flushMatches();
      } else if (flushTimer == null) {
        flushTimer = setTimeout(() => {
          flushTimer = null;
          if (runIdRef.current !== myRun) return;
          flushMatches();
        }, UI_FLUSH_INTERVAL_MS);
      }
    };

    // `writeMuhuratCache` reads the array synchronously and only the SQL is
    // async, so passing the live ref is safe even while matches keep arriving.
    const persist = (through: string | null) => {
      const count = matchesRef.current.length;
      return writeMuhuratCache(database, occasion, coords, ayanamsa, matchesRef.current, through)
        .then(() => {
          lastPersistedRef.current = { count, through };
        })
        .catch(() => {});
    };

    void (async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const targetEnd = new Date(today);
      targetEnd.setDate(targetEnd.getDate() + SCAN_DAYS - 1);

      let existing: MuhuratMatch[] = [];
      let scanFrom = new Date(today);
      let cachedThrough: Date | null = null;

      if (mode === 'refresh') {
        await clearMuhuratCache(database, occasion, coords, ayanamsa);
      } else {
        const cached = await readMuhuratCache(database, occasion, coords, ayanamsa);
        if (cached) {
          existing = cached.matches.filter(m => m.date.getTime() >= today.getTime());
          if (cached.scannedThrough) {
            const parsed = parseYmd(cached.scannedThrough);
            if (parsed) {
              cachedThrough = parsed;
              const next = new Date(parsed);
              next.setDate(next.getDate() + 1);
              if (next.getTime() > scanFrom.getTime()) scanFrom = next;
            }
          }
        }
      }
      // The cache touch is async now, so this run may already be superseded.
      if (runIdRef.current !== myRun) return;

      if (scanFrom.getTime() > targetEnd.getTime()) {
        // The ref gets its own copy: `noteMatch` pushes into it in place, and
        // sharing the array with state would mutate a rendered value.
        matchesRef.current = [...existing];
        setMatches(existing);
        setScannedCount(SCAN_DAYS);
        setTotalDays(SCAN_DAYS);
        setStatus('complete');
        return;
      }

      // Treat the cache as authoritative as long as it has visible matches
      // covering today onward — render those instantly and top up the trailing
      // days silently in the background. This makes repeat opens feel instant
      // on low-end phones, where a 365-day rescan was the most visible perf
      // cost. When the cache covers a forward window but found no matches yet,
      // we still show the scan UI so the user understands work is in progress.
      // Refresh mode always re-shows live progress since the user explicitly
      // asked to recompute.
      const hasUsefulCache =
        mode === 'auto' &&
        existing.length > 0 &&
        cachedThrough != null &&
        cachedThrough.getTime() >= today.getTime();

      // ── First-open fast path: validate bundled candidate dates ───────────
      // When the SQLite cache has nothing, instead of scanning all SCAN_DAYS
      // at the user's location (~365 panchang calls on a low-end phone), we
      // validate only the dates from the bundled candidate JSON (~50 calls).
      // The candidate set is the union of dates that pass the rule at any of
      // 5 reference longitudes spanning India, so it covers the user's actual
      // location subject to the per-location validation pass. See
      // scripts/generate-muhurat-candidates.js.
      const candidatesAreFresh = isCandidatesFresh(today, targetEnd);
      // Gate on `cachedThrough == null` so we don't re-validate candidates for
      // a user who already scanned their location in full and found zero
      // matches (rare — restrictive rules in edge-of-India locations). For that
      // case the existing scanFrom-from-scannedThrough logic below produces the
      // right result (early return if cache covers the target, otherwise
      // resume). The bundled list is generated under Lahiri (see
      // scripts/generate-muhurat-candidates.js), so it is not a superset of the
      // passing days for any other ayanamsa — a Raman user must take the full
      // scan rather than a filtered Lahiri list.
      const useCandidatePath =
        mode === 'auto' &&
        existing.length === 0 &&
        cachedThrough == null &&
        ayanamsa === 'lahiri' &&
        candidatesAreFresh;

      if (useCandidatePath) {
        const candidatesForOccasion = CANDIDATES.candidates[occasion] ?? [];
        const candidates = candidatesForOccasion.filter(s => {
          const d = parseYmd(s);
          return d != null && d.getTime() >= today.getTime() && d.getTime() <= targetEnd.getTime();
        });

        matchesRef.current = [];
        setMatches([]);
        setScannedCount(0);
        setTotalDays(candidates.length);
        setStatus(candidates.length === 0 ? 'complete' : 'scanning');

        try {
          await validateCandidates({
            occasion,
            candidates,
            coords,
            ayanamsa,
            signal: controller.signal,
            onMatch: (m) => {
              if (runIdRef.current !== myRun) return;
              noteMatch(m);
            },
            onProgress: (p) => {
              if (runIdRef.current !== myRun) return;
              scannedThroughRef.current = p.day;
              setScannedCount(p.scannedCount);
            },
          });
          if (runIdRef.current !== myRun) return;
          flushMatches();
          if (controller.signal.aborted) {
            // `validateCandidates` resolves (not rejects) on abort, so this
            // branch is the user-cancel path. It covered only a prefix of the
            // list, so persist the last candidate actually evaluated. Stamping
            // targetEnd here claimed a complete 365-day scan, and every later
            // open — Resume included — short-circuited to a truncated list
            // that could never be filled in again.
            await persist(scannedThroughRef.current);
            setStatus('cancelled');
            return;
          }
          // A completed candidate pass covers the full target window by
          // construction: candidates are filtered to [today, targetEnd] and
          // `isCandidatesFresh` refuses the path unless the generator's
          // coverage reaches targetEnd. Persist scanned_through = targetEnd so
          // subsequent opens hit the instant-cache path.
          const targetEndYmd = ymdLocal(targetEnd);
          await persist(targetEndYmd);
          scannedThroughRef.current = targetEndYmd;
          setStatus('complete');
        } catch {
          if (runIdRef.current !== myRun) return;
          flushMatches();
          // Don't persist a partial candidate scan as if it covered the full
          // window — that would mask the failure on next open. Persist what
          // we have but leave scanned_through untouched.
          if (matchesRef.current.length > 0) await persist(null);
          setStatus('error');
        }
        return;
      }

      matchesRef.current = [...existing];
      setMatches(existing);
      setScannedCount(0);
      const days = Math.round((targetEnd.getTime() - scanFrom.getTime()) / 86_400_000) + 1;
      setTotalDays(days);
      setStatus(hasUsefulCache ? 'complete' : 'scanning');

      try {
        await scanAuspiciousDays({
          occasion,
          startDate: scanFrom,
          endDate: targetEnd,
          coords,
          ayanamsa,
          signal: controller.signal,
          onMatch: (m) => {
            if (runIdRef.current !== myRun) return;
            noteMatch(m);
          },
          onProgress: (p) => {
            if (runIdRef.current !== myRun) return;
            scannedThroughRef.current = p.day;
            if (!hasUsefulCache) setScannedCount(p.scannedCount);
            if (p.scannedCount % PERSIST_EVERY === 0) void persist(p.day);
          },
        });
        if (runIdRef.current !== myRun) return;
        flushMatches();
        await persist(scannedThroughRef.current);
        if (hasUsefulCache) return; // already 'complete' — silent extension done
        // Deliberately not a ternary: React Compiler cannot yet handle a value
        // block (conditional, logical, optional chaining) inside a try, and it
        // skips the *whole* component when it hits one. Verified — collapsing
        // this back into `setStatus(aborted ? … : …)` un-memoizes this screen.
        if (controller.signal.aborted) {
          setStatus('cancelled');
        } else {
          setStatus('complete');
        }
      } catch {
        if (runIdRef.current !== myRun) return;
        flushMatches();
        await persist(scannedThroughRef.current);
        if (hasUsefulCache) return; // a silent top-up failure isn't worth a banner
        setStatus('error');
      }
    })().catch(() => {
      // Only reachable if the cache read/clear itself threw — the scan paths
      // handle their own failures above.
      if (runIdRef.current !== myRun) return;
      setStatus('error');
    });

    return () => {
      controller.abort();
      runIdRef.current += 1;
      clearFlushTimer();
      const through = scannedThroughRef.current;
      const last = lastPersistedRef.current;
      // Skip the write when nothing has moved since the last flush. The gate is
      // on the scanned-through day as well as the match count: the mid-scan
      // flush exists to persist resume progress, and days scanned with no
      // matches still have to be recorded.
      if (through && (through !== last.through || matchesRef.current.length !== last.count)) {
        void writeMuhuratCache(
          database,
          occasion,
          coords,
          ayanamsa,
          matchesRef.current,
          through,
        ).catch(() => {});
      }
    };
  }, [occasion, lat, lon, timezone, ayanamsa, scanNonce]);

  function handleCancel() {
    abortRef.current?.abort();
  }

  function handleResume() {
    scanModeRef.current = 'auto';
    setScanNonce(n => n + 1);
  }

  function handleRefresh() {
    scanModeRef.current = 'refresh';
    setScanNonce(n => n + 1);
  }

  // Functional update so the row stays `memo`-able: reading `expandedKey` here
  // would mean a fresh closure per card on every pass.
  function handleToggle(key: string) {
    setExpandedKey(prev => (prev === key ? null : key));
  }

  const progressPct = totalDays > 0 ? Math.min(100, Math.round((scannedCount / totalDays) * 100)) : 0;

  return (
    <ScreenMount>
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
      {/* ── Header: back · display title ─────────────────────────────────── */}
      <View style={[styles.headerRow, { paddingHorizontal: spacing.screenH }]}>
        <MotionPressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.back')}>
          <Icon name="chevron-left" size={22} color={colors.textSecondary} />
        </MotionPressable>
        <Text
          variant={isHi ? 'deva-bold' : 'display'}
          style={[styles.headerTitle, { color: colors.textPrimary }]}
          numberOfLines={1}>
          {t('muhurat.title')}
        </Text>
        {status === 'complete' && (
          <MotionPressable
            onPress={handleRefresh}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('common.retry')}>
            <Icon name="refresh" size={18} color={colors.textTertiary} />
          </MotionPressable>
        )}
      </View>

      <SectionList
        sections={monthSections}
        keyExtractor={item => item.date.toISOString()}
        contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
        showsVerticalScrollIndicator={false}
        // In-window candidate counts run to 173–250 per occasion at the default
        // 12-month range, and every card carries a pressable, ~20 views and a
        // gradient on the best one. Mounting that list up front cost seconds
        // before first paint even on the instant cache-hit path.
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={7}
        // Month headers scroll away with their block, as they did as plain rows
        // inside the old ScrollView.
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <View style={styles.monthHeader}>
            <Text variant="kicker-small" style={[styles.monthHeaderLabel, { color: colors.accentText }]}>
              {section.label}
            </Text>
            <Text variant="mono" style={[styles.monthHeaderCount, { color: colors.textMuted }]}>
              {section.data.length}
            </Text>
          </View>
        )}
        renderItem={({ item }) => {
          const key = item.date.toISOString();
          return (
            <DayCard
              match={item}
              matchKey={key}
              colors={colors}
              isDark={isDarkMode}
              isUpcoming={item.date.getTime() <= upcomingCutoff}
              isBest={key === bestKey}
              expanded={expandedKey === key}
              t={t}
              lang={lang}
              formatNumber={formatNumber}
              onToggle={handleToggle}
            />
          );
        }}
        ListHeaderComponent={
          <>
            {/* ── Occasion chips ───────────────────────────────────────────── */}
            <View style={styles.chipWrap}>
              {ALL_OCCASIONS.map(occ => {
                const active = occ === occasion;
                return (
                  <SegmentedChip
                    key={occ}
                    active={active}
                    // Collapsing here rather than in the scan effect: a
                    // synchronous setState in an effect body is a cascading
                    // render (and stops React Compiler compiling this screen),
                    // and the occasion chips are the only way the match list
                    // can change under an open card while mounted. Resume and
                    // Refresh keep the open card, as they always did — and so
                    // does re-tapping the occasion already selected, which
                    // leaves the list untouched.
                    onPress={() => { if (active) return; setOccasion(occ); setExpandedKey(null); }}
                    inactiveBg={colors.surface}
                    activeBg={colors.accent}
                    inactiveBorder={colors.border}
                    activeBorder={colors.accent}
                    style={styles.chip}
                    accessibilityLabel={t(`muhurat.occasion.${occ}.name`)}>
                    <Text
                      variant={isHi ? 'deva' : 'title'}
                      style={[
                        styles.chipText,
                        { color: active ? palette.night : colors.textSecondary },
                      ]}>
                      {t(`muhurat.occasion.${occ}.chip`)}
                    </Text>
                  </SegmentedChip>
                );
              })}
            </View>

            <Text variant="body-small" style={[styles.occasionDesc, { color: colors.textTertiary }]}>
              {t(`muhurat.occasion.${occasion}.desc`)}
            </Text>

            {/* ── Range row — narrows the displayed window, never the scan ──── */}
            <MotionPressable
              onPress={() => setRangeOpen(o => !o)}
              style={[styles.rangeRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel={t('muhurat.changeRange')}
              accessibilityState={{ expanded: rangeOpen }}>
              <Icon name="calendar" size={17} color={colors.textMuted} />
              <Text variant="body" style={[styles.rangeText, { color: colors.textSecondary }]}>
                {rangeLabel}
              </Text>
              <Text variant="title" style={[styles.rangeChange, { color: colors.accentText }]}>
                {t('muhurat.changeRange')}
              </Text>
            </MotionPressable>

            {rangeOpen && (
              <View style={styles.windowRow}>
                {WINDOW_OPTIONS.map(mo => {
                  const active = windowMonths === mo;
                  return (
                    <SegmentedChip
                      key={mo}
                      active={active}
                      onPress={() => { setWindowMonths(mo); setRangeOpen(false); }}
                      inactiveBg={colors.surface}
                      activeBg={colors.accent}
                      inactiveBorder={colors.border}
                      activeBorder={colors.accent}
                      style={styles.windowChip}
                      accessibilityLabel={t(`muhurat.window${mo}`)}>
                      <Text
                        variant="title"
                        style={[
                          styles.windowChipText,
                          { color: active ? palette.night : colors.textSecondary },
                        ]}>
                        {t(`muhurat.window${mo}`)}
                      </Text>
                    </SegmentedChip>
                  );
                })}
              </View>
            )}

            {/* ── Progress banner (scanning / cancelled / error) ───────────── */}
            {status === 'scanning' && (
              <View style={[styles.progressCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.progressHead}>
                  <ActivityIndicator color={colors.accent} size="small" />
                  <Text variant="body" style={[styles.progressText, { color: colors.textPrimary }]}>
                    {t('muhurat.progressCalculating', { current: scannedCount, total: totalDays })}
                  </Text>
                </View>
                <View style={[styles.progressBar, { backgroundColor: colors.surfaceRecessed }]}>
                  <View style={[styles.progressFill, { backgroundColor: colors.accent, width: `${progressPct}%` }]} />
                </View>
                <MotionPressable
                  onPress={handleCancel}
                  style={styles.progressAction}
                  accessibilityRole="button"
                  accessibilityLabel={t('muhurat.cancelScan')}>
                  <Icon name="stop-circle" size={16} color={colors.danger} />
                  <Text variant="kicker-small" style={[styles.progressActionText, { color: colors.dangerText }]}>
                    {t('muhurat.cancelScan')}
                  </Text>
                </MotionPressable>
              </View>
            )}

            {status === 'cancelled' && (
              <View style={[styles.progressCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text variant="body" style={[styles.progressText, { color: colors.textPrimary }]}>
                  {t('muhurat.scanPaused', { current: scannedCount, total: totalDays })}
                </Text>
                <MotionPressable
                  onPress={handleResume}
                  style={styles.progressAction}
                  accessibilityRole="button"
                  accessibilityLabel={t('muhurat.resumeScan')}>
                  <Icon name="play-circle" size={16} color={colors.accent} />
                  <Text variant="kicker-small" style={[styles.progressActionText, { color: colors.accentText }]}>
                    {t('muhurat.resumeScan')}
                  </Text>
                </MotionPressable>
              </View>
            )}

            {status === 'error' && (
              <View style={[styles.errorBox, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
                <Text variant="body" style={[styles.errorText, { color: colors.textPrimary }]}>
                  {t('muhurat.scanFailed')}
                </Text>
                <MotionPressable
                  onPress={handleResume}
                  style={styles.progressAction}
                  accessibilityRole="button"
                  accessibilityLabel={t('muhurat.retryScan')}>
                  <Icon name="refresh" size={16} color={colors.accent} />
                  <Text variant="kicker-small" style={[styles.progressActionText, { color: colors.accentText }]}>
                    {t('muhurat.retryScan')}
                  </Text>
                </MotionPressable>
              </View>
            )}

            {/* ── Results ──────────────────────────────────────────────────── */}
            {status === 'complete' && visibleMatches.length === 0 && (
              <View style={[styles.errorBox, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
                <Icon name="info-circle" size={22} color={colors.textMuted} />
                <Text variant="body" style={[styles.errorText, { color: colors.textPrimary }]}>{t('muhurat.noMatches')}</Text>
                <Text variant="body-small" style={[styles.errorSub, { color: colors.textMuted }]}>{t('muhurat.noMatchesDesc')}</Text>
              </View>
            )}

            {visibleMatches.length > 0 && (
              <Text variant="kicker-small" style={[styles.countLabel, { color: colors.textMuted }]}>
                {t('muhurat.resultsCount', { count: visibleMatches.length })}
              </Text>
            )}
          </>
        }
        ListFooterComponent={
          <>
            <View style={styles.adWrap}>
              <AdBanner colors={colors} placement="muhuratInline" inline />
            </View>

            <Text variant="body-small" style={[styles.footer, { color: colors.textSecondary }]}>
              {t('muhurat.footer')}
            </Text>

            <View style={{ height: 40 }} />
          </>
        }
      />
    </SafeAreaView>
    </ScreenMount>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isCandidatesFresh(today: Date, targetEnd: Date): boolean {
  const generated = parseYmd(CANDIDATES.generatedAt);
  if (!generated) return false;
  const ageDays = Math.round((today.getTime() - generated.getTime()) / 86_400_000);
  if (ageDays > CANDIDATES_STALE_AFTER_DAYS) return false;
  // Belt and braces on top of the derived age gate: never take the fast path
  // when the generator's own coverage stops short of the window we are about
  // to record as scanned.
  const coverageEnd = candidatesCoverageEnd();
  return coverageEnd != null && coverageEnd.getTime() >= targetEnd.getTime();
}

function parseYmd(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setHours(0, 0, 0, 0);
  return d;
}

// Quality reads as five ticks (frame 03) — never a star rating or a percent.
// The 0–100 rule score collapses to 1–5 filled ticks; the same bands still
// drive the "Highly auspicious / …" caption in the expanded detail.
function tickCount(score: number): number {
  return Math.max(1, Math.min(5, Math.round(score / 20)));
}

function bandKey(score: number): 'excellent' | 'good' | 'mild' | 'marginal' {
  if (score >= 90) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'mild';
  return 'marginal';
}

// "1:04 PM" (or a bare "13:04") → minutes since midnight; null on anything
// unparseable. The meridiem is optional so this keeps working if these slot
// strings are ever routed through `formatTime()` and the 24-hour preference.
// Dropping it was not harmless: Abhijit is centred on *solar* noon, so west of
// the zone meridian it reads "12:21 PM – 1:04 PM" and the parsed end (64) fell
// below the parsed start (741), silently swallowing the duration line for
// every user more than ~30 minutes west of 82.5°E.
function parseHm(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(s.trim());
  if (!m) return null;
  let h = Number(m[1]);
  const meridiem = m[3]?.toUpperCase();
  if (meridiem === 'PM' && h !== 12) h += 12;
  if (meridiem === 'AM' && h === 12) h = 0;
  return h * 60 + Number(m[2]);
}

// ─── Day card ─────────────────────────────────────────────────────────────────

interface DayCardProps {
  match: MuhuratMatch;
  /** `match.date.toISOString()` — the row's list key, handed back on toggle. */
  matchKey: string;
  colors: ColorPalette;
  isDark: boolean;
  isUpcoming: boolean;
  isBest: boolean;
  expanded: boolean;
  /** `t`, `lang` and `formatNumber` come down as props so a 250-row commit does
   *  not mount 250 `useTranslation` subscriptions (each one clones the
   *  40-property i18next instance) and 250 store selectors. `lang` rather than
   *  an isHi flag because `getBestSlots` and `factorSentence` take the code. */
  t: TFunction;
  lang: string;
  formatNumber: (value: number | string) => string;
  onToggle: (key: string) => void;
}

const DayCard = memo(function DayCard({
  match,
  matchKey,
  colors,
  isDark,
  isUpcoming,
  isBest,
  expanded,
  t,
  lang,
  formatNumber,
  onToggle,
}: DayCardProps) {
  const isHi = lang === 'hi';
  const dateLocale = isHi ? 'hi-IN' : 'en-IN';
  const weekday = formatDateCached(match.date, dateLocale, { weekday: 'long' });
  const dayNum = match.date.getDate();
  const monthShort = formatDateCached(match.date, dateLocale, { month: 'short' });

  const bestSlots = useMemo(() => getBestSlots(match, t, lang), [match, t, lang]);
  const primarySlot = bestSlots[0] ?? null;
  const durationLabel = useMemo(() => {
    if (!primarySlot) return null;
    const a = parseHm(primarySlot.start);
    const b = parseHm(primarySlot.end);
    if (a == null || b == null || b <= a) return null;
    const mins = b - a;
    return t('muhurat.durationHM', {
      h: formatNumber(Math.floor(mins / 60)),
      m: formatNumber(mins % 60),
    });
  }, [primarySlot, t, formatNumber]);

  // A code we have no string for yet (a library upgrade that adds a factor
  // before we add its copy) falls back to the library's English diagnostic —
  // `factors` and `reasons` are pushed in lockstep, so the indices line up.
  // Better a stray English line than a blank bullet.
  const reasonLines = useMemo(
    () =>
      match.factors
        .map((f, i) => {
          const { key, name } = factorSentence(match, f, lang);
          return t(key, { name, defaultValue: '' }) || match.reasons[i] || '';
        })
        .filter(line => line.length > 0),
    [match, t, lang],
  );

  const filled = tickCount(match.score);
  const scoreLabel = formatNumber(Math.round(match.score));
  const emptyTick = isDark ? 'rgba(237,232,240,0.14)' : 'rgba(34,27,36,0.10)';

  // Accessibility: only the *collapsed head* is the pressable. A Pressable is
  // an accessibility element, so its label replaces the child <Text> nodes
  // rather than adding to them — with the expanded detail nested inside it,
  // every best-slot window, every score reason and the Rahu Kaal warning was
  // unreachable to a screen reader, and so was the head's own primary window.
  // The head therefore carries no label (its own text speaks: date, weekday,
  // badges, window, tithi · nakshatra, and the tick row's score) and the
  // detail is an ordinary sibling below it.
  return (
    <View
      style={[
        styles.dayCard,
        {
          backgroundColor: colors.surface,
          borderColor: isBest ? colors.borderAccent : colors.border,
        },
      ]}>
      {isBest && (
        <LinearGradient
          colors={
            isDark
              ? ['rgba(216,163,26,0.13)', 'rgba(255,255,255,0.03)']
              : [colors.surfaceAccent, '#FFFFFF']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 0.7, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}

      <MotionPressable
        onPress={() => onToggle(matchKey)}
        style={styles.dayCardHead}
        accessibilityRole="button"
        accessibilityHint={t('muhurat.a11yDayHint')}
        accessibilityState={{ expanded }}>
        <View style={styles.dateCol}>
          <Text variant="display" style={[styles.dateNum, { color: colors.textPrimary }]}>
            {formatNumber(dayNum)}
          </Text>
          <Text variant="kicker-small" style={[styles.dateMonth, { color: colors.textMuted }]}>
            {monthShort}
          </Text>
        </View>

        <View style={styles.dayInfo}>
          <View style={styles.dayTitleRow}>
            <Text variant="title" style={[styles.dayWeekday, { color: colors.textPrimary }]} numberOfLines={1}>
              {weekday}
            </Text>
            {isBest && (
              <View style={[styles.bestBadge, { backgroundColor: isDark ? 'rgba(216,163,26,0.20)' : colors.surfaceAccent }]}>
                <Text variant="kicker-small" style={[styles.badgeText, { color: colors.accentText }]}>
                  {t('muhurat.bestBadge')}
                </Text>
              </View>
            )}
            {isUpcoming && (
              <View style={[styles.soonBadge, { borderColor: colors.borderAccent }]}>
                <Text variant="kicker-small" style={[styles.badgeText, { color: colors.accentText }]}>
                  {t('muhurat.upcomingBadge')}
                </Text>
              </View>
            )}
          </View>

          {primarySlot && (
            <Text variant="mono" style={[styles.dayTime, { color: colors.textPrimary }]} numberOfLines={1}>
              {primarySlot.start} – {primarySlot.end}
              {durationLabel != null && (
                <Text variant="mono" style={{ color: colors.textMuted }}>{'  '}· {durationLabel}</Text>
              )}
            </Text>
          )}

          <Text
            variant={isHi ? 'deva' : 'body'}
            style={[styles.dayMeta, { color: colors.textTertiary }]}
            numberOfLines={1}>
            {localizeTithi(match.tithi, lang)} · {localizeNakshatra(match.nakshatra, lang)}
          </Text>

          {/*
            The five ticks are the only place the score appears on the
            collapsed head, and they are plain Views. Labelling the row (with
            no `accessible` prop, so it stays non-focusable) folds "Score 78
            out of 100" into the head's spoken description instead of adding a
            focus stop of its own.
          */}
          <View
            style={styles.tickRow}
            accessibilityLabel={t('muhurat.scoreAccessibility', { score: scoreLabel })}>
            {[0, 1, 2, 3, 4].map(i => (
              <View
                key={i}
                style={[
                  styles.tick,
                  {
                    backgroundColor: i < filled ? colors.accent : emptyTick,
                    opacity: i < filled && !isBest ? 0.6 : 1,
                  },
                ]}
              />
            ))}
          </View>
        </View>
      </MotionPressable>

      {expanded && (
        <View style={[styles.detail, { borderTopColor: colors.divider }]}>
          <Text variant="kicker-small" style={[styles.detailHeading, { color: colors.textMuted }]}>
            {t('muhurat.whyThisDay')}
          </Text>
          <View
            style={[
              styles.scoreReasonsBlock,
              { backgroundColor: colors.accentSurface, borderColor: colors.borderAccent },
            ]}>
            <Text variant="title" style={[styles.scoreBandLabel, { color: colors.accentText }]}>
              {t(`muhurat.scoreBand.${bandKey(match.score)}`)}
              <Text variant="mono" style={{ color: colors.textMuted }}>
                {'  '}· {scoreLabel} {t('muhurat.scoreOutOf')}
              </Text>
            </Text>
            {reasonLines.map((line, i) => (
              <Text
                key={i}
                variant={isHi ? 'deva' : 'body-small'}
                style={[
                  styles.scoreReasonItem,
                  isHi && styles.scoreReasonItemDeva,
                  { color: colors.textSecondary },
                ]}>
                • {line}
              </Text>
            ))}
          </View>

          <Text variant="kicker-small" style={[styles.detailHeading, styles.detailHeadingTop, { color: colors.textMuted }]}>
            {t('muhurat.bestSlots')}
          </Text>
          {bestSlots.length === 0 ? (
            <Text variant="body-small" style={[styles.detailText, { color: colors.textMuted }]}>
              {t('muhurat.noSlots')}
            </Text>
          ) : (
            <View style={[styles.slotsBlock, { backgroundColor: colors.surfaceRecessed }]}>
              {bestSlots.map((s, i) => (
                <View key={i} style={styles.slotRow}>
                  <Text variant="body" style={[styles.slotName, { color: colors.textSecondary }]}>{s.label}</Text>
                  <Text variant="mono" style={[styles.slotTime, { color: colors.textPrimary }]}>
                    {s.start} – {s.end}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.rahuRow}>
            <Icon name="warning" size={12} color={colors.danger} />
            <Text variant="mono" style={[styles.rahuText, { color: colors.textMuted }]}>
              {t('muhurat.avoidRahu', {
                start: match.windows.rahuKalamStart ?? '—',
                end: match.windows.rahuKalamEnd ?? '—',
              })}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
});

// ─── Slot selection ───────────────────────────────────────────────────────────

interface DisplaySlot {
  label: string;
  start: string;
  end: string;
}

function getBestSlots(
  match: MuhuratMatch,
  t: TFunction,
  lang: string,
): DisplaySlot[] {
  const out: DisplaySlot[] = [];
  const p = match.windows;
  if (p.abhijitMuhurtaStart && p.abhijitMuhurtaEnd) {
    out.push({ label: titleCase(t('panchang.abhijitMuhurta')), start: p.abhijitMuhurtaStart, end: p.abhijitMuhurtaEnd });
  }
  if (p.brahmaMuhurtaStart && p.brahmaMuhurtaEnd) {
    out.push({ label: titleCase(t('panchang.brahmaMuhurta')), start: p.brahmaMuhurtaStart, end: p.brahmaMuhurtaEnd });
  }
  for (const s of p.auspiciousChoghadiya) {
    out.push({
      label: `${titleCase(t('panchang.choghadiya'))} · ${localizeChoghadiya(s.name, lang)}`,
      start: s.start,
      end: s.end,
    });
  }
  return out;
}

// i18n keys for panchang labels are stored uppercase for the panchang screen's
// kicker style; the muhurat slot rows use sentence case, so we reverse the
// ASCII upper here. Devanagari is unchanged (no case in the script).
function titleCase(s: string): string {
  return s.replace(/\b[A-Z]+\b/g, w => w[0] + w.slice(1).toLowerCase());
}

// ─── Score factors ────────────────────────────────────────────────────────────

/**
 * Map one scoring factor to the i18n key that describes it and the anga name
 * that key interpolates.
 *
 * `scoreMuhurta` also returns `reasons`, but those are English developer
 * diagnostics the library documents as unstable ("auspicious nakshatra (3)",
 * "sarvartha_siddhi bonus") — rendering them put English bullets, snake_case
 * identifiers and bare zero-based indices under a translated heading.
 * `factors` is the structured form of the same list, so we key the sentence
 * off `factor.code`.
 *
 * The name comes off the match rather than off `factor.index`: the score and
 * the match's panchang are computed at the same coordinates and the same
 * offset, so `panchang.tithis[0]` / `nakshatras[0]` / `yogas[0]` / `vara` are
 * the very elements the engine read at sunrise. Using their names keeps this
 * screen free of an index→name table that would silently drift when the
 * library renumbers anything. Axes with nothing to name (a vara×tithi yoga, a
 * special yoga, Bhadra) return an empty name and their key takes no argument.
 */
function factorSentence(
  match: MuhuratMatch,
  factor: MuhurtaFactor,
  lang: string,
): { key: string; name: string } {
  let name = '';
  if (factor.axis === 'tithi') name = localizeTithi(match.tithi, lang);
  else if (factor.axis === 'nakshatra') name = localizeNakshatra(match.nakshatra, lang);
  else if (factor.axis === 'yoga') name = localizeYoga(match.yoga, lang);
  // `localizeVara` only maps into Devanagari; in English it passes the engine's
  // Sanskrit weekday straight through ("Budhawara") onto a card whose own
  // header already reads "Wednesday". Take the weekday off the date instead —
  // Intl gives both languages their own name.
  else if (factor.axis === 'vara') {
    name = lang === 'hi'
      ? localizeVara(match.vara, lang)
      : formatDateCached(match.date, 'en-IN', { weekday: 'long' });
  }
  return { key: `muhurat.factor.${factor.code}`, name };
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingTop: 6,
    paddingBottom: 14,
  },
  backBtn: {},
  headerTitle: { fontSize: 27, lineHeight: 34, flex: 1 },

  scroll: { paddingTop: 2, paddingBottom: 32 },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: borderRadius.chip,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, lineHeight: 18 },

  occasionDesc: { fontSize: 12.5, lineHeight: 17, marginTop: 10 },

  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 12,
  },
  rangeText: { flex: 1, fontSize: 14 },
  rangeChange: { fontSize: 13 },

  windowRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  windowChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: borderRadius.chip,
    borderWidth: 1,
    alignItems: 'center',
  },
  windowChipText: { fontSize: 13, lineHeight: 18 },

  // The month block's own 6px bottom margin went away with the wrapper View
  // (sections have no wrapper), so its share of the gap moved onto the header
  // itself: 6 + 6 → 12. `countLabel` sheds the same 6 so the first header still
  // sits 16 below the count line.
  countLabel: { fontSize: 9.5, marginTop: 16, marginBottom: 4 },

  progressCard: {
    borderRadius: borderRadius.list,
    borderWidth: 1,
    padding: 14,
    marginTop: 14,
    gap: 10,
  },
  progressHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressText: { flex: 1, fontSize: 13 },
  progressBar: { height: 3, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  progressAction: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  progressActionText: { fontSize: 10 },

  errorBox: {
    alignItems: 'center',
    gap: 8,
    padding: 20,
    borderRadius: borderRadius.list,
    borderWidth: 1,
    marginTop: 14,
  },
  errorText: { fontSize: 14 },
  errorSub: { fontSize: 12, textAlign: 'center' },

  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginTop: 12,
    marginBottom: 10,
  },
  monthHeaderLabel: { fontSize: 9.5 },
  monthHeaderCount: { fontSize: 11 },

  dayCard: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
  },
  dayCardHead: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 19, paddingVertical: 17, gap: 14 },
  dateCol: { alignItems: 'center', minWidth: 40 },
  dateNum: { fontSize: 30, lineHeight: 32 },
  dateMonth: { fontSize: 10, marginTop: 4 },

  dayInfo: { flex: 1 },
  dayTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dayWeekday: { fontSize: 15, lineHeight: 20, flexShrink: 1 },
  bestBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 5,
  },
  soonBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  badgeText: { fontSize: 9.5 },
  dayTime: { fontSize: 13.5, marginTop: 7 },
  dayMeta: { fontSize: 13, lineHeight: 19, marginTop: 5 },

  tickRow: { flexDirection: 'row', gap: 4, marginTop: 11 },
  tick: { flex: 1, height: 4, borderRadius: 2 },

  detail: { paddingHorizontal: 19, paddingTop: 12, paddingBottom: 14, borderTopWidth: StyleSheet.hairlineWidth },
  detailHeading: { fontSize: 9.5, marginBottom: 8 },
  detailHeadingTop: { marginTop: 14 },
  detailText: { fontSize: 12, marginBottom: 4 },
  scoreReasonsBlock: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
  },
  scoreBandLabel: { fontSize: 13.5, lineHeight: 18, marginBottom: 4 },
  scoreReasonItem: { fontSize: 12.5, lineHeight: 18 },
  // These bullets wrap, and Devanagari matras clip at the Latin 12.5/18
  // setting; the extra leading matches the other multi-line deva blocks.
  scoreReasonItemDeva: { lineHeight: 20 },
  slotsBlock: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  slotRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 5 },
  slotName: { flex: 1, fontSize: 13, lineHeight: 18 },
  slotTime: { fontSize: 12.5, lineHeight: 17 },

  rahuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  rahuText: { fontSize: 10.5, lineHeight: 14 },

  adWrap: { marginTop: 18 },
  footer: {
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 16,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
});
