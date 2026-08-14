import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  ScrollView,
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
  localizeChoghadiya,
} from '@/i18n/panchangNames';
import { useLocaleFormatters } from '@/utils/format';

const SCAN_DAYS = 365;
const PERSIST_EVERY = 15; // flush partial scan to SQLite every N days
const UPCOMING_WINDOW_DAYS = 14; // matches within this window get the "Soon" badge

// If the bundled candidate JSON was generated more than this many days ago,
// fall back to the full on-device scan so we don't ship stale dates after a
// missed release. 18 months gives ~6 months of buffer past the JSON's own
// 24-month lookahead window.
const CANDIDATES_STALE_AFTER_DAYS = 540;

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

type Status = 'loading' | 'scanning' | 'complete' | 'cancelled' | 'error';

export default function MuhuratFinderScreen() {
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams<{ occasion?: string }>();
  const isDarkMode = useStore(s => s.isDarkMode);
  const userLocation = useStore(s => s.userLocation);
  const colors = isDarkMode ? darkColors : lightColors;
  const db = useSQLiteContext();
  const isHi = i18n.language === 'hi';

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
    return `${from.toLocaleDateString(dateLocale, opts)} – ${to.toLocaleDateString(dateLocale, opts)}`;
  }, [windowMonths, dateLocale]);

  const monthGroups = useMemo(() => {
    const groups = new Map<string, MuhuratMatch[]>();
    for (const m of visibleMatches) {
      const key = `${m.date.getFullYear()}-${m.date.getMonth()}`;
      const arr = groups.get(key);
      if (arr) arr.push(m);
      else groups.set(key, [m]);
    }
    return Array.from(groups.entries()).map(([key, items]) => ({
      key,
      label: items[0].date.toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' }),
      items,
    }));
  }, [visibleMatches, dateLocale]);

  const matchesRef = useRef<MuhuratMatch[]>([]);
  const scannedThroughRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);

  function startScan(mode: 'auto' | 'refresh') {
    const myRun = ++runIdRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    // Reset — with in-place occasion switching, a stale value from the
    // previous occasion must never be persisted as this occasion's progress.
    scannedThroughRef.current = null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetEnd = new Date(today);
    targetEnd.setDate(targetEnd.getDate() + SCAN_DAYS - 1);

    let existing: MuhuratMatch[] = [];
    let scanFrom = new Date(today);
    let cachedThrough: Date | null = null;

    if (mode === 'refresh') {
      clearMuhuratCache(db, occasion, userLocation);
    } else {
      const cached = readMuhuratCache(db, occasion, userLocation);
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

    if (scanFrom.getTime() > targetEnd.getTime()) {
      setMatches(existing);
      matchesRef.current = existing;
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

    // ── First-open fast path: validate bundled candidate dates ─────────────
    // When the SQLite cache has nothing, instead of scanning all SCAN_DAYS
    // at the user's location (~365 panchang calls on a low-end phone), we
    // validate only the dates from the bundled candidate JSON (~50 calls).
    // The candidate set is the union of dates that pass the rule at any of
    // 5 reference longitudes spanning India, so it covers the user's actual
    // location subject to the per-location validation pass. See
    // scripts/generate-muhurat-candidates.js.
    const candidatesAreFresh = isCandidatesFresh(today);
    // Gate on `cachedThrough == null` so we don't re-validate candidates for a
    // user who already scanned their location in full and found zero matches
    // (rare — restrictive rules in edge-of-India locations). For that case the
    // existing scanFrom-from-scannedThrough logic below produces the right
    // result (early return if cache covers the target, otherwise resume).
    const useCandidatePath =
      mode === 'auto' &&
      existing.length === 0 &&
      cachedThrough == null &&
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

      validateCandidates({
        occasion,
        candidates,
        coords: userLocation,
        signal: controller.signal,
        onMatch: (m) => {
          if (runIdRef.current !== myRun) return;
          matchesRef.current = [...matchesRef.current, m];
          setMatches(matchesRef.current);
        },
        onProgress: (p) => {
          if (runIdRef.current !== myRun) return;
          scannedThroughRef.current = p.day;
          setScannedCount(p.scannedCount);
        },
      })
        .then(() => {
          if (runIdRef.current !== myRun) return;
          // The candidate path covers the full target window by construction
          // (candidates are filtered to [today, targetEnd]). Persist with
          // scanned_through = targetEnd so subsequent opens hit the
          // instant-cache path.
          const targetEndYmd = ymdLocal(targetEnd);
          writeMuhuratCache(db, occasion, userLocation, matchesRef.current, targetEndYmd);
          scannedThroughRef.current = targetEndYmd;
          if (controller.signal.aborted) {
            setStatus('cancelled');
          } else {
            setStatus('complete');
          }
        })
        .catch(() => {
          if (runIdRef.current !== myRun) return;
          // Don't persist a partial candidate scan as if it covered the full
          // window — that would mask the failure on next open. Persist what
          // we have but leave scanned_through untouched.
          if (matchesRef.current.length > 0) {
            writeMuhuratCache(db, occasion, userLocation, matchesRef.current, null);
          }
          setStatus('error');
        });
      return;
    }

    matchesRef.current = existing;
    setMatches(existing);
    setScannedCount(0);
    const days = Math.round((targetEnd.getTime() - scanFrom.getTime()) / 86_400_000) + 1;
    setTotalDays(days);
    setStatus(hasUsefulCache ? 'complete' : 'scanning');

    scanAuspiciousDays({
      occasion,
      startDate: scanFrom,
      endDate: targetEnd,
      coords: userLocation,
      signal: controller.signal,
      onMatch: (m) => {
        if (runIdRef.current !== myRun) return;
        matchesRef.current = [...matchesRef.current, m];
        setMatches(matchesRef.current);
      },
      onProgress: (p) => {
        if (runIdRef.current !== myRun) return;
        scannedThroughRef.current = p.day;
        if (!hasUsefulCache) setScannedCount(p.scannedCount);
        if (p.scannedCount % PERSIST_EVERY === 0) {
          writeMuhuratCache(db, occasion, userLocation, matchesRef.current, p.day);
        }
      },
    })
      .then(() => {
        if (runIdRef.current !== myRun) return;
        writeMuhuratCache(db, occasion, userLocation, matchesRef.current, scannedThroughRef.current);
        if (hasUsefulCache) return; // already 'complete' — silent extension done
        if (controller.signal.aborted) {
          setStatus('cancelled');
        } else {
          setStatus('complete');
        }
      })
      .catch(() => {
        if (runIdRef.current !== myRun) return;
        writeMuhuratCache(db, occasion, userLocation, matchesRef.current, scannedThroughRef.current);
        if (hasUsefulCache) return; // a silent top-up failure isn't worth a banner
        setStatus('error');
      });
  }

  useEffect(() => {
    setExpandedKey(null);
    startScan('auto');
    return () => {
      abortRef.current?.abort();
      runIdRef.current += 1;
      if (scannedThroughRef.current) {
        writeMuhuratCache(db, occasion, userLocation, matchesRef.current, scannedThroughRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [occasion, userLocation?.lat, userLocation?.lon]);

  function handleCancel() {
    abortRef.current?.abort();
  }

  function handleResume() {
    startScan('auto');
  }

  function handleRefresh() {
    startScan('refresh');
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

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
        showsVerticalScrollIndicator={false}>

        {/* ── Occasion chips ───────────────────────────────────────────── */}
        <View style={styles.chipWrap}>
          {ALL_OCCASIONS.map(occ => {
            const active = occ === occasion;
            return (
              <SegmentedChip
                key={occ}
                active={active}
                onPress={() => setOccasion(occ)}
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
              <Text variant="kicker-small" style={[styles.progressActionText, { color: colors.danger }]}>
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
          <>
            <Text variant="kicker-small" style={[styles.countLabel, { color: colors.textMuted }]}>
              {t('muhurat.resultsCount', { count: visibleMatches.length })}
            </Text>
            {monthGroups.map(group => (
              <View key={group.key} style={styles.monthBlock}>
                <View style={styles.monthHeader}>
                  <Text variant="kicker-small" style={[styles.monthHeaderLabel, { color: colors.accentText }]}>
                    {group.label}
                  </Text>
                  <Text variant="mono" style={[styles.monthHeaderCount, { color: colors.textMuted }]}>
                    {group.items.length}
                  </Text>
                </View>
                {group.items.map(m => {
                  const key = m.date.toISOString();
                  return (
                    <DayCard
                      key={key}
                      match={m}
                      colors={colors}
                      isDark={isDarkMode}
                      isUpcoming={m.date.getTime() <= upcomingCutoff}
                      isBest={key === bestKey}
                      expanded={expandedKey === key}
                      onToggle={() => setExpandedKey(expandedKey === key ? null : key)}
                    />
                  );
                })}
              </View>
            ))}
          </>
        )}

        <View style={styles.adWrap}>
          <AdBanner colors={colors} placement="muhuratInline" inline />
        </View>

        <Text variant="body-small" style={[styles.footer, { color: colors.textMuted }]}>
          {t('muhurat.footer')}
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
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

function isCandidatesFresh(today: Date): boolean {
  const generated = parseYmd(CANDIDATES.generatedAt);
  if (!generated) return false;
  const ageDays = Math.round((today.getTime() - generated.getTime()) / 86_400_000);
  return ageDays <= CANDIDATES_STALE_AFTER_DAYS;
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

// "06:14" → minutes since midnight; null on anything unparseable.
function parseHm(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(s.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

// ─── Day card ─────────────────────────────────────────────────────────────────

function DayCard({
  match,
  colors,
  isDark,
  isUpcoming,
  isBest,
  expanded,
  onToggle,
}: {
  match: MuhuratMatch;
  colors: ColorPalette;
  isDark: boolean;
  isUpcoming: boolean;
  isBest: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { formatNumber } = useLocaleFormatters();
  const isHi = i18n.language === 'hi';
  const dateLocale = isHi ? 'hi-IN' : 'en-IN';
  const weekday = match.date.toLocaleDateString(dateLocale, { weekday: 'long' });
  const dayNum = match.date.getDate();
  const monthShort = match.date.toLocaleDateString(dateLocale, { month: 'short' });
  const year = match.date.getFullYear();

  const bestSlots = useMemo(() => getBestSlots(match, t, i18n.language), [match, t, i18n.language]);
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

  const filled = tickCount(match.score);
  const scoreLabel = formatNumber(Math.round(match.score));
  const emptyTick = isDark ? 'rgba(237,232,240,0.14)' : 'rgba(34,27,36,0.10)';

  return (
    <MotionPressable
      onPress={onToggle}
      style={[
        styles.dayCard,
        {
          backgroundColor: colors.surface,
          borderColor: isBest ? colors.borderAccent : colors.border,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${weekday} ${dayNum} ${monthShort} ${year} · ${t('muhurat.scoreAccessibility', { score: scoreLabel })}`}
      accessibilityState={{ expanded }}>
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

      <View style={styles.dayCardHead}>
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
            {localizeTithi(match.tithi, i18n.language)} · {localizeNakshatra(match.nakshatra, i18n.language)}
          </Text>

          <View style={styles.tickRow}>
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
      </View>

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
            {match.reasons.map((r, i) => (
              <Text
                key={i}
                variant="body-small"
                style={[styles.scoreReasonItem, { color: colors.textSecondary }]}>
                • {r}
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
                start: match.panchang.rahuKalamStart ?? '—',
                end: match.panchang.rahuKalamEnd ?? '—',
              })}
            </Text>
          </View>
        </View>
      )}
    </MotionPressable>
  );
}

// ─── Slot selection ───────────────────────────────────────────────────────────

interface DisplaySlot {
  label: string;
  start: string;
  end: string;
}

function getBestSlots(
  match: MuhuratMatch,
  t: (key: string) => string,
  lang: string,
): DisplaySlot[] {
  const out: DisplaySlot[] = [];
  const p = match.panchang;
  if (p.abhijitMuhurtaStart && p.abhijitMuhurtaEnd) {
    out.push({ label: titleCase(t('panchang.abhijitMuhurta')), start: p.abhijitMuhurtaStart, end: p.abhijitMuhurtaEnd });
  }
  if (p.brahmaMuhurtaStart && p.brahmaMuhurtaEnd) {
    out.push({ label: titleCase(t('panchang.brahmaMuhurta')), start: p.brahmaMuhurtaStart, end: p.brahmaMuhurtaEnd });
  }
  const auspiciousChoghadiya = p.choghadiya?.day?.filter(s => s.quality === 'auspicious') ?? [];
  for (const s of auspiciousChoghadiya.slice(0, 3)) {
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

  countLabel: { fontSize: 9.5, marginTop: 16, marginBottom: 10 },

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

  monthBlock: { marginBottom: 6 },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginTop: 6,
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
