import { useCallback, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
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
import { Kicker } from '@/components/common/Kicker';
import { Ornament } from '@/components/common/Ornament';
import { ScreenMount } from '@/components/common/ScreenMount';
import { AdBanner } from '@/components/common/AdBanner';
import {
  listJaapSessions,
  deleteJaapSession,
  type JaapSession,
} from '@/services/jaapSessions';
import { useLocaleFormatters } from '@/utils/format';

export default function JaapHistoryScreen() {
  const { t, i18n } = useTranslation();
  const isDarkMode = useStore(s => s.isDarkMode);
  const colors = isDarkMode ? darkColors : lightColors;
  const db = useSQLiteContext();
  const { formatDateTime, formatNumber } = useLocaleFormatters();

  const [sessions, setSessions] = useState<JaapSession[]>([]);

  const refreshSessions = useCallback(() => {
    setSessions(listJaapSessions(db, 30));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refreshSessions();
    }, [refreshSessions]),
  );

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
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.navPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.back')}>
            <Icon name="chevron-left" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text variant="body-italic" style={[styles.navTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {t('jaap.historyTitle')}
          </Text>
          <View style={{ width: 36, height: 36 }} />
        </View>

        {sessions.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Kicker color={colors.accent} size={11} style={styles.emptyEyebrow}>
              {t('jaap.titleEyebrow')}
            </Kicker>
            <Text variant="display-italic" style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              {t('jaap.historyEmptyTitle')}
            </Text>
            <Ornament variant="diamond" tone={isDarkMode ? 'dark' : 'light'} style={styles.emptyRule} />
            <Text variant="body-italic" style={[styles.emptyDesc, { color: colors.textTertiary }]}>
              {t('jaap.historyEmptyDesc')}
            </Text>
            <TouchableOpacity
              onPress={() => router.replace('/jaap')}
              style={[styles.emptyCta, { borderColor: colors.accent }]}
              accessibilityRole="button"
              accessibilityLabel={t('jaap.historyBeginCta')}>
              <Text variant="mono-caps" style={[styles.emptyCtaText, { color: colors.accent }]}>
                {t('jaap.historyBeginCta')}  →
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
            showsVerticalScrollIndicator={false}>
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
      <TouchableOpacity
        onPress={onDelete}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={styles.rowDeleteBtn}
        accessibilityRole="button"
        accessibilityLabel={t('jaap.historyDeleteConfirm')}>
        <Icon name="close" size={14} color={colors.textMuted} />
      </TouchableOpacity>
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
  navTitle: { flex: 1, textAlign: 'center', marginHorizontal: 12, fontSize: 15 },

  scroll: { paddingTop: 16, paddingBottom: 12 },

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
