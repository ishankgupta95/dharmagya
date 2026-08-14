import { useCallback, useState } from 'react';
import { MotionPressable } from '@/components/common/MotionPressable';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSQLiteContext } from 'expo-sqlite';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, spacing, borderRadius, type ColorPalette } from '@/config/theme';
import { Icon } from '@/components/common/Icon';
import { ScreenMount } from '@/components/common/ScreenMount';
import { AdBanner } from '@/components/common/AdBanner';
import {
  listJaapSessions,
  deleteJaapSession,
  getJaapStats,
  getJaapDailyMalas,
  type JaapSession,
  type JaapStats,
} from '@/services/jaapSessions';
import { useLocaleFormatters } from '@/utils/format';

const GRID_WEEKS = 12;
const GRID_DAYS = GRID_WEEKS * 7;

/** "21h" past an hour, "48m" under it — the Time-sat tile grain. */
function formatSatTime(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes >= 60) return `${Math.round(minutes / 60)}h`;
  return `${minutes}m`;
}

function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

export default function JaapHistoryScreen() {
  const { t, i18n } = useTranslation();
  const isDarkMode = useStore(s => s.isDarkMode);
  const colors = isDarkMode ? darkColors : lightColors;
  const db = useSQLiteContext();
  const { formatDateTime, formatNumber } = useLocaleFormatters();

  const [sessions, setSessions] = useState<JaapSession[]>([]);
  const [stats, setStats] = useState<JaapStats | null>(null);
  const [dailyMalas, setDailyMalas] = useState<Map<string, number>>(new Map());

  const refreshSessions = useCallback(() => {
    setSessions(listJaapSessions(db, 30));
    setStats(getJaapStats(db));
    setDailyMalas(getJaapDailyMalas(db, Date.now() - GRID_DAYS * 86_400_000));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refreshSessions();
    }, [refreshSessions]),
  );

  // 12 columns of 7 days, oldest week first, today in the last column.
  const gridCells = (() => {
    const cells: number[] = [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (GRID_DAYS - 1));
    for (let i = 0; i < GRID_DAYS; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      cells.push(dailyMalas.get(ymdLocal(d)) ?? 0);
    }
    return cells;
  })();
  const gridMax = Math.max(1, ...gridCells);

  const handleDelete = useCallback(
    (id: number) => {
      Alert.alert(t('jaap.historyDeleteConfirm'), undefined, [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('jaap.historyDeleteYes'),
          style: 'destructive',
          onPress: () => {
            deleteJaapSession(db, id);
            refreshSessions();
          },
        },
      ]);
    },
    [db, refreshSessions, t],
  );

  const grouped = groupByDate(sessions, i18n.language);

  return (
    <ScreenMount>
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
        <View style={[styles.navRow, { borderBottomColor: colors.divider }]}>
          <MotionPressable
            onPress={() => router.back()}
            style={[styles.navPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.back')}>
            <Icon name="chevron-left" size={18} color={colors.textSecondary} />
          </MotionPressable>
          <Text variant="display" style={[styles.navTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {t('jaap.historyTitle')}
          </Text>
          <View style={{ width: 36, height: 36 }} />
        </View>

        {sessions.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text variant="display" style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              {t('jaap.historyEmptyTitle')}
            </Text>
            <Text variant="body" style={[styles.emptyDesc, { color: colors.textTertiary }]}>
              {t('jaap.historyEmptyDesc')}
            </Text>
            <MotionPressable
              onPress={() => router.replace('/jaap')}
              style={[styles.emptyCta, { borderColor: colors.accent }]}
              accessibilityRole="button"
              accessibilityLabel={t('jaap.historyBeginCta')}>
              <Text variant="kicker" style={[styles.emptyCtaText, { color: colors.accentText }]}>
                {t('jaap.historyBeginCta')}  →
              </Text>
            </MotionPressable>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
            showsVerticalScrollIndicator={false}>

            {/* ── Stat tiles — a record of practice, not a fitness app ───── */}
            {stats && (
              <View style={styles.statTiles}>
                <View style={[styles.statTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                    {formatNumber(stats.totalMalas)}
                  </Text>
                  <Text variant="kicker" style={[styles.statLabel, { color: colors.textTertiary }]}>
                    {t('jaap.statMalas')}
                  </Text>
                </View>
                <View style={[styles.statTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                    {formatSatTime(stats.totalDurationMs)}
                  </Text>
                  <Text variant="kicker" style={[styles.statLabel, { color: colors.textTertiary }]}>
                    {t('jaap.statTime')}
                  </Text>
                </View>
                <View style={[styles.statTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                    {formatNumber(stats.sessionCount)}
                  </Text>
                  <Text variant="kicker" style={[styles.statLabel, { color: colors.textTertiary }]}>
                    {t('jaap.statSessions')}
                  </Text>
                </View>
              </View>
            )}

            {/* ── Density grid — consistency without axes, goals or badges ── */}
            <View style={[styles.gridCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text variant="kicker" style={[styles.gridKicker, { color: colors.textMuted }]}>
                {t('jaap.last12Weeks')}
              </Text>
              <View style={styles.grid}>
                {gridCells.map((malas, i) => {
                  const intensity = malas === 0 ? 0 : 0.3 + 0.7 * (malas / gridMax);
                  return (
                    <View
                      key={i}
                      style={[
                        styles.gridCell,
                        {
                          backgroundColor:
                            malas === 0
                              ? (isDarkMode ? 'rgba(237,232,240,0.07)' : 'rgba(34,27,36,0.06)')
                              : `rgba(216,163,26,${intensity.toFixed(2)})`,
                        },
                      ]}
                    />
                  );
                })}
              </View>
            </View>

            {grouped.map((group) => (
              <View key={group.dateKey} style={styles.dateGroup}>
                <Text variant="mono-caps" style={[styles.dateHeader, { color: colors.textTertiary }]}>
                  {group.dateLabel}
                </Text>
                {group.sessions.map((s) => (
                  <SessionRow
                    key={s.id}
                    session={s}
                    colors={colors}
                    onDelete={() => handleDelete(s.id)}
                    formatTime={(d) => formatDateTime(d)}
                    formatNumber={formatNumber}
                    t={t}
                  />
                ))}
              </View>
            ))}
            <View style={{ height: 32 }} />
          </ScrollView>
        )}

        <AdBanner colors={colors} placement="home" />
      </SafeAreaView>
    </ScreenMount>
  );
}

interface SessionRowProps {
  session: JaapSession;
  colors: ColorPalette;
  onDelete: () => void;
  formatTime: (d: Date) => string;
  formatNumber: (v: number | string) => string;
  t: (k: string, opts?: Record<string, unknown>) => string;
}

function SessionRow({ session, colors, onDelete, formatTime, formatNumber, t }: SessionRowProps) {
  const start = new Date(session.startedAt);
  const durationMs = Math.max(0, session.endedAt - session.startedAt);
  const durationLabel = formatDuration(durationMs, formatNumber, t);
  return (
    <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.rowMain}>
        <View style={styles.rowHeader}>
          <Text variant="mono-caps" style={[styles.rowTime, { color: colors.accent }]}>
            {formatTime(start)}
          </Text>
          <Text variant="mono-caps" style={[styles.rowDuration, { color: colors.textTertiary }]}>
            {durationLabel}
          </Text>
        </View>
        <Text variant="deva-bold" style={[styles.rowLabel, { color: colors.textPrimary }]} numberOfLines={2}>
          {session.mantraLabel}
        </Text>
        <View style={styles.rowMeta}>
          <Text variant="mono" style={[styles.rowMetaValue, { color: colors.textSecondary }]}>
            {formatNumber(session.totalCount)}
          </Text>
          <Text variant="body-italic" style={[styles.rowMetaSub, { color: colors.textTertiary }]}>
            {' · '}
            {t('jaap.historyMalaSummary', { count: session.malaCount })}
            {'  ·  '}
            {t('jaap.malaSize', { count: session.malaSize })}
          </Text>
        </View>
      </View>
      <MotionPressable
        onPress={onDelete}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={styles.rowDeleteBtn}
        accessibilityRole="button"
        accessibilityLabel={t('jaap.historyDeleteConfirm')}>
        <Icon name="close" size={14} color={colors.textMuted} />
      </MotionPressable>
    </View>
  );
}

interface SessionGroup {
  dateKey: string;
  dateLabel: string;
  sessions: JaapSession[];
}

function groupByDate(sessions: JaapSession[], lang: string): SessionGroup[] {
  const locale = lang === 'hi' ? 'hi-IN' : 'en-IN';
  const groups: SessionGroup[] = [];
  let current: SessionGroup | null = null;
  for (const s of sessions) {
    const d = new Date(s.startedAt);
    const dateKey = ymd(d);
    if (!current || current.dateKey !== dateKey) {
      current = {
        dateKey,
        dateLabel: d.toLocaleDateString(locale, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        }),
        sessions: [],
      };
      groups.push(current);
    }
    current.sessions.push(s);
  }
  return groups;
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

function formatDuration(
  ms: number,
  formatNumber: (v: number | string) => string,
  t: (k: string, opts?: Record<string, unknown>) => string,
): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) {
    return t('jaap.historyDurationShort', { seconds: formatNumber(seconds) });
  }
  const minutes = Math.round(seconds / 60);
  return t('jaap.historyDuration', { minutes: formatNumber(minutes) });
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.screenH,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navTitle: { flex: 1, marginHorizontal: 12, fontSize: 24, lineHeight: 30 },

  scroll: { paddingTop: 16, paddingBottom: 12 },

  // Stat tiles (frame 25 — no streaks, deliberately)
  statTiles: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statTile: {
    flex: 1,
    borderRadius: borderRadius.card,
    borderWidth: 1,
    paddingVertical: 17,
    paddingHorizontal: 16,
  },
  statValue: {
    fontFamily: 'Geist_200ExtraLight',
    fontVariant: ['tabular-nums'],
    fontSize: 34,
    lineHeight: 38,
  },
  statLabel: { fontSize: 9.5, marginTop: 8 },

  // Density grid
  gridCard: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    padding: 18,
    marginBottom: 22,
  },
  gridKicker: { fontSize: 9.5, marginBottom: 14 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  gridCell: {
    // 12 columns; sized against the card's inner width via flexBasis so the
    // grid stays square-ish across device widths.
    flexBasis: `${100 / 12 - 1.5}%`,
    flexGrow: 1,
    aspectRatio: 1,
    borderRadius: 4,
  },

  dateGroup: { marginBottom: 22 },
  dateHeader: { fontSize: 9.5, marginBottom: 10, letterSpacing: 2.4 },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: borderRadius.cardInner,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  rowMain: { flex: 1, gap: 6 },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  rowTime: { fontSize: 9.5 },
  rowDuration: { fontSize: 9.5 },
  rowLabel: { fontSize: 16 },
  rowMeta: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', marginTop: 2 },
  rowMetaValue: { fontSize: 14 },
  rowMetaSub: { fontSize: 12 },
  rowDeleteBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 6,
  },
  emptyEyebrow: { letterSpacing: 4.0, marginBottom: 4 },
  emptyTitle: { fontSize: 28, lineHeight: 36, textAlign: 'center' },
  emptyRule: { width: '50%', marginTop: 14, marginBottom: 14 },
  emptyDesc: { fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 22 },
  emptyCta: {
    paddingHorizontal: 24,
    paddingVertical: 11,
    borderRadius: borderRadius.button,
    borderWidth: 1.5,
  },
  emptyCtaText: { fontSize: 11 },
});
