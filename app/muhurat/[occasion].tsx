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
import { Icon } from '@/components/common/Icon';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, palette, spacing, semanticColors, type ColorPalette } from '@/config/theme';
import { Kicker } from '@/components/common/Kicker';
import { NightCard, usePlinthColors } from '@/components/common/NightCard';
import { ScreenMount } from '@/components/common/ScreenMount';
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

const SCAN_DAYS = 365;
const PERSIST_EVERY = 15; // flush partial scan to SQLite every N days
const UPCOMING_WINDOW_DAYS = 14; // matches within this window get the "upcoming" highlight

// If the bundled candidate JSON was generated more than this many days ago,
// fall back to the full on-device scan so we don't ship stale dates after a
// missed release. 18 months gives ~6 months of buffer past the JSON's own
// 24-month lookahead window.
const CANDIDATES_STALE_AFTER_DAYS = 540;

interface MuhuratCandidatesFile {
  version: number;
  generatedAt: string; // YYYY-MM-DD
  lookaheadDays: number;
  references: string[];
  candidates: Record<string, string[]>;
}

const CANDIDATES: MuhuratCandidatesFile = muhuratCandidatesData;

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

  const upcomingCutoff = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + UPCOMING_WINDOW_DAYS);
    return d.getTime();
  }, []);

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

  const matchesRef = useRef<MuhuratMatch[]>([]);
  const scannedThroughRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);

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
    if (!occasion) return;
    startScan('auto');
    return () => {
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
        <Text variant="body-italic" style={{ color: colors.textPrimary, padding: 24 }}>{t('muhurat.notFound')}</Text>
      </SafeAreaView>
    );
  }

  const progressPct = totalDays > 0 ? Math.min(100, Math.round((scannedCount / totalDays) * 100)) : 0;

  return (
    <ScreenMount>
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
      <View style={[styles.headerRow, { paddingHorizontal: spacing.screenH, borderBottomColor: colors.divider }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={12}
          style={[styles.backPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.back')}>
          <Icon name="chevron-left" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text variant="display-italic" style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {t(`muhurat.occasion.${occasion}.name`)}
        </Text>
        {status === 'complete' ? (
          <TouchableOpacity
            onPress={handleRefresh}
            hitSlop={12}
            style={[styles.backPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel={t('common.retry')}>
            <Icon name="refresh" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        ) : (
          <View style={[styles.backPill, { borderWidth: 0 }]} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
        showsVerticalScrollIndicator={false}>

        <Text variant="body-italic" style={[styles.subtitle, { color: colors.textTertiary }]}>
          {t(`muhurat.occasion.${occasion}.desc`)}
        </Text>

        <Text variant="mono-caps" style={[styles.rangeLabel, { color: colors.textMuted }]}>
          {t('muhurat.scanRange', { days: SCAN_DAYS })}
        </Text>

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
            <TouchableOpacity
              onPress={handleCancel}
              style={styles.progressAction}
              accessibilityRole="button"
              accessibilityLabel={t('muhurat.cancelScan')}>
              <Icon name="stop-circle" size={16} color={semanticColors.error} />
              <Text variant="mono-caps" style={[styles.progressActionText, { color: semanticColors.error }]}>
                {t('muhurat.cancelScan')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {status === 'cancelled' && (
          <View style={[styles.progressCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text variant="body" style={[styles.progressText, { color: colors.textPrimary }]}>
              {t('muhurat.scanPaused', { current: scannedCount, total: totalDays })}
            </Text>
            <TouchableOpacity
              onPress={handleResume}
              style={styles.progressAction}
              accessibilityRole="button"
              accessibilityLabel={t('muhurat.resumeScan')}>
              <Icon name="play-circle" size={16} color={colors.accent} />
              <Text variant="mono-caps" style={[styles.progressActionText, { color: colors.accent }]}>
                {t('muhurat.resumeScan')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {status === 'error' && (
          <View style={[styles.errorBox, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
            <Text variant="body" style={[styles.errorText, { color: colors.textPrimary }]}>
              {t('muhurat.scanFailed')}
            </Text>
            <TouchableOpacity
              onPress={handleResume}
              style={styles.progressAction}
              accessibilityRole="button"
              accessibilityLabel={t('muhurat.retryScan')}>
              <Icon name="refresh" size={16} color={colors.accent} />
              <Text variant="mono-caps" style={[styles.progressActionText, { color: colors.accent }]}>
                {t('muhurat.retryScan')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Results ──────────────────────────────────────────────────── */}
        {status === 'complete' && matches.length === 0 && (
          <View style={[styles.errorBox, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
            <Icon name="info-circle" size={22} color={colors.textMuted} />
            <Text variant="body" style={[styles.errorText, { color: colors.textPrimary }]}>{t('muhurat.noMatches')}</Text>
            <Text variant="body-italic" style={[styles.errorSub, { color: colors.textMuted }]}>{t('muhurat.noMatchesDesc')}</Text>
          </View>
        )}

        {matches.length > 0 && (
          <>
            <Text variant="mono-caps" style={[styles.countLabel, { color: colors.accent }]}>
              {t('muhurat.resultsCount', { count: matches.length })}
            </Text>
            {monthGroups.map(group => (
              <View key={group.key} style={styles.monthBlock}>
                <View style={styles.monthHeader}>
                  <Kicker
                    color={colors.accent}
                    size={10}
                    withTrailingRule
                    ruleColor={colors.divider}>
                    {group.label}
                  </Kicker>
                  <Text variant="mono" style={[styles.monthHeaderCount, { color: colors.textMuted }]}>
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

        <Text variant="body-italic" style={[styles.disclaimer, { color: colors.textMuted }]}>
          {t('muhurat.disclaimer')}
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
  const { t, i18n } = useTranslation();
  const plinth = usePlinthColors();
  const dateLocale = i18n.language === 'hi' ? 'hi-IN' : 'en-IN';
  const weekday = match.date.toLocaleDateString(dateLocale, { weekday: 'short' });
  const dayNum = match.date.getDate();
  const month = match.date.toLocaleDateString(dateLocale, { month: 'long' });
  const year = match.date.getFullYear();

  const bestSlots = useMemo(() => getBestSlots(match, t, i18n.language), [match, t, i18n.language]);

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
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${weekday} ${dayNum} ${month} ${year}`}
      accessibilityState={{ expanded }}>
      <View style={styles.dayRowHead}>
        <View
          style={[
            styles.dateCol,
            { backgroundColor: isUpcoming ? palette.sindoor : colors.surfaceRecessed },
          ]}>
          <Text
            variant="mono-caps"
            style={[styles.dateWeek, { color: isUpcoming ? palette.parchmentBright : colors.textMuted }]}>
            {weekday}
          </Text>
          <Text
            variant="display-italic"
            style={[styles.dateNum, { color: isUpcoming ? palette.parchmentBright : colors.textPrimary }]}>
            {dayNum}
          </Text>
          <Text
            variant="mono-caps"
            style={[styles.dateMonth, { color: isUpcoming ? palette.parchmentBright : colors.textMuted }]}>
            {month.slice(0, 3)} {year}
          </Text>
        </View>
        <View style={styles.dayInfo}>
          <View style={styles.dayTitleRow}>
            <Text variant="body" style={[styles.dayTithi, { color: colors.textPrimary }]} numberOfLines={1}>
              {localizeTithi(match.tithi, i18n.language)}
            </Text>
            {isUpcoming && (
              <View style={[styles.upcomingBadge, { borderColor: colors.accent }]}>
                <Text variant="mono-caps" style={[styles.upcomingBadgeText, { color: colors.accent }]}>
                  {t('muhurat.upcomingBadge')}
                </Text>
              </View>
            )}
          </View>
          <Text variant="body-italic" style={[styles.dayMeta, { color: colors.textTertiary }]} numberOfLines={1}>
            {localizeNakshatra(match.nakshatra, i18n.language)} · {localizeYoga(match.yoga, i18n.language)} · {localizeVara(match.vara, i18n.language)}
          </Text>
        </View>
        <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
      </View>

      {expanded && (
        <View style={[styles.detail, { borderTopColor: colors.divider }]}>
          <Kicker color={palette.gold} size={9} style={styles.detailHeading}>
            {t('muhurat.bestSlots')}
          </Kicker>
          {bestSlots.length === 0 ? (
            <Text variant="body-italic" style={[styles.detailText, { color: colors.textMuted }]}>
              {t('muhurat.noSlots')}
            </Text>
          ) : (
            <NightCard padding={12} showMandala={false} bracketInset={6} style={styles.slotsPlinth}>
              {bestSlots.map((s, i) => (
                <View key={i} style={styles.slotRow}>
                  <Text variant="body-italic" style={[styles.slotName, { color: plinth.text }]}>{s.label}</Text>
                  <Text variant="mono" style={[styles.slotTime, { color: plinth.accent }]}>
                    {s.start} – {s.end}
                  </Text>
                </View>
              ))}
            </NightCard>
          )}

          <View style={styles.rahuRow}>
            <Icon name="warning" size={12} color={semanticColors.error} />
            <Text variant="mono" style={[styles.rahuText, { color: colors.textMuted }]}>
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
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  backPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 20, flex: 1, textAlign: 'center' },

  scroll: { paddingTop: 14, paddingBottom: 32 },
  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: 10, textAlign: 'center' },
  rangeLabel: { fontSize: 9, marginBottom: 16, textAlign: 'center' },
  countLabel: { fontSize: 10, marginBottom: 14 },

  progressCard: {
    borderRadius: borderRadius.cardInner,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
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
    borderRadius: borderRadius.cardInner,
    borderWidth: 1,
    marginBottom: 16,
  },
  errorText: { fontSize: 14 },
  errorSub: { fontSize: 12, textAlign: 'center' },

  monthBlock: { marginBottom: 8 },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 2,
    marginTop: 6,
    marginBottom: 10,
  },
  monthHeaderCount: { fontSize: 10 },

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
    borderRadius: 3,
    borderWidth: 1,
  },
  upcomingBadgeText: { fontSize: 8 },
  dayRowHead: { flexDirection: 'row', alignItems: 'center', padding: 10, gap: 12 },
  dateCol: {
    width: 62,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 8,
    gap: 1,
  },
  dateWeek: { fontSize: 8 },
  dateNum: { fontSize: 22, lineHeight: 26 },
  dateMonth: { fontSize: 7 },
  dayInfo: { flex: 1 },
  dayTithi: { flexShrink: 1, fontSize: 14, lineHeight: 19 },
  dayMeta: { fontSize: 12, lineHeight: 16 },

  detail: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12, borderTopWidth: StyleSheet.hairlineWidth },
  detailHeading: { marginBottom: 10 },
  detailText: { fontSize: 12, marginBottom: 4 },
  slotsPlinth: { marginTop: 2 },
  slotRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  slotName: { flex: 1, fontSize: 13, lineHeight: 18 },
  slotTime: { fontSize: 12, lineHeight: 16 },

  rahuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'transparent',
  },
  rahuText: { fontSize: 10, lineHeight: 14 },

  disclaimer: {
    fontSize: 11,
    marginTop: 20,
    lineHeight: 16,
    textAlign: 'center',
  },
});
