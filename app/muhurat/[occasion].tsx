import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, spacing, semanticColors, type ColorPalette } from '@/config/theme';
import {
  ALL_OCCASIONS,
  scanAuspiciousDays,
  type MuhuratMatch,
  type Occasion,
} from '@/services/astrology/muhurat';
import {
  readMuhuratCache,
  writeMuhuratCache,
  clearMuhuratCache,
} from '@/services/astrology/muhuratCache';

const SCAN_DAYS = 365;
const PERSIST_EVERY = 15; // flush partial scan to SQLite every N days
const UPCOMING_WINDOW_DAYS = 14; // matches within this window get the "upcoming" highlight
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

type Status = 'loading' | 'scanning' | 'complete' | 'cancelled' | 'error';

export default function OccasionDetailScreen() {
  const { t, i18n } = useTranslation();
  const { occasion: raw } = useLocalSearchParams<{ occasion: string }>();
  const isDarkMode = useStore(s => s.isDarkMode);
  const userLocation = useStore(s => s.userLocation);
  const colors = isDarkMode ? darkColors : lightColors;
  const db = useSQLiteContext();

  const occasion: Occasion | null = ALL_OCCASIONS.includes(raw as Occasion) ? (raw as Occasion) : null;

  const [matches, setMatches] = useState<MuhuratMatch[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [scannedCount, setScannedCount] = useState(0);
  const [totalDays, setTotalDays] = useState(SCAN_DAYS);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  // Threshold for the "upcoming" highlight — matches dated on/before this
  // cutoff get an accent border + badge. Computed once per mount; stable
  // even as midnight ticks past because the difference is visually tiny.
  const upcomingCutoff = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + UPCOMING_WINDOW_DAYS);
    return d.getTime();
  }, []);

  // Group matches by (year, month) for sectioned rendering. Scan order is
  // chronological so groups come out in order without re-sorting.
  const monthGroups = useMemo(() => {
    const groups = new Map<string, MuhuratMatch[]>();
    for (const m of matches) {
      const key = `${m.date.getFullYear()}-${m.date.getMonth()}`;
      const arr = groups.get(key);
      if (arr) arr.push(m);
      else groups.set(key, [m]);
    }
    const locale = i18n.language === 'hi' ? 'hi-IN' : 'en-IN';
    return Array.from(groups.entries()).map(([key, items]) => ({
      key,
      label: items[0].date.toLocaleDateString(locale, { month: 'long', year: 'numeric' }),
      items,
    }));
  }, [matches, i18n.language]);

  // Keep the latest matches + scannedThrough in refs so the unmount cleanup
  // can persist them without stale-closure issues. `abortRef` is the active
  // scan's AbortController; `runIdRef` lets us ignore late callbacks from a
  // previous scan after Refresh is tapped.
  const matchesRef = useRef<MuhuratMatch[]>([]);
  const scannedThroughRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);

  // ── Scan driver ────────────────────────────────────────────────────────────
  // mode 'auto': read cache and scan forward from scannedThrough (or today).
  // mode 'refresh': wipe cache, scan full 365 from today.
  function startScan(mode: 'auto' | 'refresh') {
    if (!occasion) return;
    const myRun = ++runIdRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetEnd = new Date(today);
    targetEnd.setDate(targetEnd.getDate() + SCAN_DAYS - 1);

    let existing: MuhuratMatch[] = [];
    let scanFrom = new Date(today);

    if (mode === 'refresh') {
      clearMuhuratCache(db, occasion, userLocation);
    } else {
      const cached = readMuhuratCache(db, occasion, userLocation);
      if (cached) {
        existing = cached.matches.filter(m => m.date.getTime() >= today.getTime());
        if (cached.scannedThrough) {
          const parsed = parseYmd(cached.scannedThrough);
          if (parsed) {
            const next = new Date(parsed);
            next.setDate(next.getDate() + 1);
            if (next.getTime() > scanFrom.getTime()) scanFrom = next;
          }
        }
      }
    }

    // Nothing left to scan: we're already complete.
    if (scanFrom.getTime() > targetEnd.getTime()) {
      setMatches(existing);
      matchesRef.current = existing;
      setScannedCount(SCAN_DAYS);
      setTotalDays(SCAN_DAYS);
      setStatus('complete');
      return;
    }

    // Show whatever we have from cache immediately; the scan will append.
    matchesRef.current = existing;
    setMatches(existing);
    setScannedCount(0);
    const days = Math.round((targetEnd.getTime() - scanFrom.getTime()) / 86_400_000) + 1;
    setTotalDays(days);
    setStatus('scanning');

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
        setScannedCount(p.scannedCount);
        // Flush partial scan to cache every N days so a cancel or crash
        // doesn't lose work.
        if (p.scannedCount % PERSIST_EVERY === 0) {
          writeMuhuratCache(db, occasion, userLocation, matchesRef.current, p.day);
        }
      },
    })
      .then(() => {
        if (runIdRef.current !== myRun) return;
        writeMuhuratCache(db, occasion, userLocation, matchesRef.current, scannedThroughRef.current);
        if (controller.signal.aborted) {
          setStatus('cancelled');
        } else {
          setStatus('complete');
        }
      })
      .catch(() => {
        if (runIdRef.current !== myRun) return;
        // Persist partial progress so Resume still works.
        writeMuhuratCache(db, occasion, userLocation, matchesRef.current, scannedThroughRef.current);
        setStatus('error');
      });
  }

  useEffect(() => {
    if (!occasion) return;
    startScan('auto');
    return () => {
      // Persist on unmount so back-navigation mid-scan doesn't waste work.
      // Bumping runIdRef invalidates any in-flight scan callbacks so they
      // can't setState after we've been torn down.
      abortRef.current?.abort();
      runIdRef.current += 1;
      if (occasion && scannedThroughRef.current) {
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

  if (!occasion) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
        <Text style={{ color: colors.textPrimary, padding: 24 }}>{t('muhurat.notFound')}</Text>
      </SafeAreaView>
    );
  }

  const progressPct = totalDays > 0 ? Math.min(100, Math.round((scannedCount / totalDays) * 100)) : 0;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
      <View style={[styles.headerRow, { paddingHorizontal: spacing.screenH, borderBottomColor: colors.divider }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {t(`muhurat.occasion.${occasion}.name`)}
        </Text>
        {status === 'complete' ? (
          <TouchableOpacity onPress={handleRefresh} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="refresh-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtn} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
        showsVerticalScrollIndicator={false}>

        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t(`muhurat.occasion.${occasion}.desc`)}
        </Text>

        <Text style={[styles.rangeLabel, { color: colors.textMuted }]}>
          {t('muhurat.scanRange', { days: SCAN_DAYS })}
        </Text>

        {/* ── Progress banner (scanning / cancelled / error) ───────────── */}
        {status === 'scanning' && (
          <View style={[styles.progressCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.progressHead}>
              <ActivityIndicator color={colors.accent} size="small" />
              <Text style={[styles.progressText, { color: colors.textPrimary }]}>
                {t('muhurat.progressCalculating', { current: scannedCount, total: totalDays })}
              </Text>
            </View>
            <View style={[styles.progressBar, { backgroundColor: colors.surfaceRecessed }]}>
              <View style={[styles.progressFill, { backgroundColor: colors.accent, width: `${progressPct}%` }]} />
            </View>
            <TouchableOpacity onPress={handleCancel} style={styles.progressAction}>
              <Ionicons name="stop-circle-outline" size={16} color={semanticColors.error} />
              <Text style={[styles.progressActionText, { color: semanticColors.error }]}>
                {t('muhurat.cancelScan')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {status === 'cancelled' && (
          <View style={[styles.progressCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.progressText, { color: colors.textPrimary }]}>
              {t('muhurat.scanPaused', { current: scannedCount, total: totalDays })}
            </Text>
            <TouchableOpacity onPress={handleResume} style={styles.progressAction}>
              <Ionicons name="play-circle-outline" size={16} color={colors.accent} />
              <Text style={[styles.progressActionText, { color: colors.accent }]}>
                {t('muhurat.resumeScan')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {status === 'error' && (
          <View style={[styles.errorBox, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
            <Text style={[styles.errorText, { color: colors.textPrimary }]}>{t('muhurat.scanFailed')}</Text>
            <TouchableOpacity onPress={handleResume} style={styles.progressAction}>
              <Ionicons name="refresh-outline" size={16} color={colors.accent} />
              <Text style={[styles.progressActionText, { color: colors.accent }]}>
                {t('muhurat.retryScan')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Results ──────────────────────────────────────────────────── */}
        {status === 'complete' && matches.length === 0 && (
          <View style={[styles.errorBox, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
            <Ionicons name="information-circle-outline" size={22} color={colors.textMuted} />
            <Text style={[styles.errorText, { color: colors.textPrimary }]}>{t('muhurat.noMatches')}</Text>
            <Text style={[styles.errorSub, { color: colors.textMuted }]}>{t('muhurat.noMatchesDesc')}</Text>
          </View>
        )}

        {matches.length > 0 && (
          <>
            <Text style={[styles.countLabel, { color: colors.accent }]}>
              {t('muhurat.resultsCount', { count: matches.length })}
            </Text>
            {monthGroups.map(group => (
              <View key={group.key} style={styles.monthBlock}>
                <View style={styles.monthHeader}>
                  <Text style={[styles.monthHeaderLabel, { color: colors.textPrimary }]}>
                    {group.label}
                  </Text>
                  <Text style={[styles.monthHeaderCount, { color: colors.textMuted }]}>
                    {group.items.length}
                  </Text>
                </View>
                {group.items.map(m => {
                  const key = m.date.toISOString();
                  return (
                    <DayRow
                      key={key}
                      match={m}
                      colors={colors}
                      isUpcoming={m.date.getTime() <= upcomingCutoff}
                      expanded={expandedKey === key}
                      onToggle={() => setExpandedKey(expandedKey === key ? null : key)}
                    />
                  );
                })}
              </View>
            ))}
          </>
        )}

        <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
          {t('muhurat.disclaimer')}
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseYmd(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setHours(0, 0, 0, 0);
  return d;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DayRow({
  match,
  colors,
  isUpcoming,
  expanded,
  onToggle,
}: {
  match: MuhuratMatch;
  colors: ColorPalette;
  isUpcoming: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const weekday = match.date.toLocaleDateString('en-IN', { weekday: 'short' });
  const dayNum = match.date.getDate();
  const month = MONTH_NAMES[match.date.getMonth()];
  const year = match.date.getFullYear();

  const bestSlots = useMemo(() => getBestSlots(match), [match]);

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onToggle}
      style={[
        styles.dayRow,
        {
          backgroundColor: colors.surface,
          borderColor: isUpcoming ? colors.accent : colors.border,
          borderWidth: isUpcoming ? 1.5 : 1,
        },
      ]}>
      <View style={styles.dayRowHead}>
        <View style={[styles.dateCol, { backgroundColor: colors.borderAccent }]}>
          <Text style={[styles.dateWeek, { color: colors.accent }]}>{weekday}</Text>
          <Text style={[styles.dateNum, { color: colors.accent }]}>{dayNum}</Text>
          <Text style={[styles.dateMonth, { color: colors.accent }]}>{month.slice(0, 3)} {year}</Text>
        </View>
        <View style={styles.dayInfo}>
          <View style={styles.dayTitleRow}>
            <Text style={[styles.dayTithi, { color: colors.textPrimary }]} numberOfLines={1}>
              {match.tithi}
            </Text>
            {isUpcoming && (
              <View style={[styles.upcomingBadge, { backgroundColor: colors.accent }]}>
                <Text style={[styles.upcomingBadgeText, { color: colors.base }]}>
                  {t('muhurat.upcomingBadge')}
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.dayMeta, { color: colors.textMuted }]} numberOfLines={1}>
            {match.nakshatra} · {match.yoga} · {match.vara}
          </Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
      </View>

      {expanded && (
        <View style={[styles.detail, { borderTopColor: colors.divider }]}>
          <Text style={[styles.detailHeading, { color: colors.accent }]}>{t('muhurat.bestSlots')}</Text>
          {bestSlots.length === 0 ? (
            <Text style={[styles.detailText, { color: colors.textMuted }]}>{t('muhurat.noSlots')}</Text>
          ) : (
            bestSlots.map((s, i) => (
              <View key={i} style={styles.slotRow}>
                <Text style={[styles.slotName, { color: colors.textPrimary }]}>{s.label}</Text>
                <Text style={[styles.slotTime, { color: colors.textSecondary }]}>
                  {s.start} – {s.end}
                </Text>
              </View>
            ))
          )}

          <View style={styles.rahuRow}>
            <Ionicons name="warning-outline" size={12} color={semanticColors.error} />
            <Text style={[styles.rahuText, { color: colors.textMuted }]}>
              {t('muhurat.avoidRahu', {
                start: match.panchang.rahuKalamStart ?? '—',
                end: match.panchang.rahuKalamEnd ?? '—',
              })}
            </Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Slot selection ───────────────────────────────────────────────────────────

interface DisplaySlot {
  label: string;
  start: string;
  end: string;
}

function getBestSlots(match: MuhuratMatch): DisplaySlot[] {
  const out: DisplaySlot[] = [];
  const p = match.panchang;
  if (p.abhijitMuhurtaStart && p.abhijitMuhurtaEnd) {
    out.push({ label: 'Abhijit Muhurta', start: p.abhijitMuhurtaStart, end: p.abhijitMuhurtaEnd });
  }
  if (p.brahmaMuhurtaStart && p.brahmaMuhurtaEnd) {
    out.push({ label: 'Brahma Muhurta', start: p.brahmaMuhurtaStart, end: p.brahmaMuhurtaEnd });
  }
  // Top 3 auspicious choghadiya slots (day period) by arrival order.
  const auspiciousChoghadiya = p.choghadiya?.day?.filter(s => s.quality === 'auspicious') ?? [];
  for (const s of auspiciousChoghadiya.slice(0, 3)) {
    out.push({ label: `Choghadiya · ${s.name}`, start: s.start, end: s.end });
  }
  return out;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 38, height: 38, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontFamily: 'Mukta_500Medium', flex: 1, textAlign: 'center' },

  scroll: { paddingTop: 14, paddingBottom: 32 },
  subtitle: { fontSize: 13, fontFamily: 'Mukta_400Regular', lineHeight: 19, marginBottom: 6 },
  rangeLabel: { fontSize: 11, fontFamily: 'Mukta_400Regular', letterSpacing: 0.5, marginBottom: 16 },
  countLabel: { fontSize: 11, fontFamily: 'Mukta_500Medium', letterSpacing: 1, marginBottom: 12 },

  progressCard: {
    borderRadius: borderRadius.cardInner,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  progressHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressText: { flex: 1, fontSize: 13, fontFamily: 'Mukta_500Medium' },
  progressBar: { height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  progressAction: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  progressActionText: { fontSize: 13, fontFamily: 'Mukta_500Medium' },

  errorBox: {
    alignItems: 'center',
    gap: 8,
    padding: 20,
    borderRadius: borderRadius.cardInner,
    borderWidth: 1,
    marginBottom: 16,
  },
  errorText: { fontSize: 14, fontFamily: 'Mukta_500Medium' },
  errorSub: { fontSize: 12, fontFamily: 'Mukta_400Regular', textAlign: 'center' },

  monthBlock: { marginBottom: 8 },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 4,
    marginBottom: 8,
  },
  monthHeaderLabel: { fontSize: 14, fontFamily: 'Mukta_500Medium', letterSpacing: 0.5 },
  monthHeaderCount: { fontSize: 12, fontFamily: 'Mukta_400Regular' },

  dayRow: {
    borderRadius: borderRadius.cardInner,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
  },
  dayTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  upcomingBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  upcomingBadgeText: {
    fontSize: 9,
    fontFamily: 'Mukta_500Medium',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  dayRowHead: { flexDirection: 'row', alignItems: 'center', padding: 10, gap: 12 },
  dateCol: {
    width: 60,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 6,
  },
  dateWeek: { fontSize: 10, fontFamily: 'Mukta_400Regular', letterSpacing: 0.5 },
  dateNum: { fontSize: 22, fontFamily: 'Mukta_700Bold', lineHeight: 26 },
  dateMonth: { fontSize: 9, fontFamily: 'Mukta_400Regular' },
  dayInfo: { flex: 1 },
  dayTithi: { flexShrink: 1, fontSize: 14, fontFamily: 'Mukta_500Medium' },
  dayMeta: { fontSize: 11, fontFamily: 'Mukta_400Regular' },

  detail: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12, borderTopWidth: StyleSheet.hairlineWidth },
  detailHeading: { fontSize: 11, fontFamily: 'Mukta_500Medium', letterSpacing: 1, marginBottom: 6 },
  detailText: { fontSize: 12, fontFamily: 'Mukta_400Regular', marginBottom: 4 },
  slotRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  slotName: { fontSize: 13, fontFamily: 'Mukta_400Regular' },
  slotTime: { fontSize: 13, fontFamily: 'Mukta_500Medium' },

  rahuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'transparent',
  },
  rahuText: { fontSize: 11, fontFamily: 'Mukta_400Regular' },

  disclaimer: {
    fontSize: 11,
    fontFamily: 'Mukta_400Regular',
    marginTop: 20,
    lineHeight: 16,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
