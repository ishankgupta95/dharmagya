import { useEffect, useMemo, useState } from 'react';
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
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, spacing, type ColorPalette } from '@/config/theme';
import {
  ALL_OCCASIONS,
  findAuspiciousDays,
  type MuhuratMatch,
  type Occasion,
} from '@/services/astrology/muhurat';

const SCAN_DAYS = 90;
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function OccasionDetailScreen() {
  const { t } = useTranslation();
  const { occasion: raw } = useLocalSearchParams<{ occasion: string }>();
  const isDarkMode = useStore(s => s.isDarkMode);
  const userLocation = useStore(s => s.userLocation);
  const colors = isDarkMode ? darkColors : lightColors;

  const occasion: Occasion | null = ALL_OCCASIONS.includes(raw as Occasion) ? (raw as Occasion) : null;

  const [matches, setMatches] = useState<MuhuratMatch[] | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!occasion) return;
    setMatches(null);
    setError(null);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + SCAN_DAYS);

    findAuspiciousDays(occasion, start, end, userLocation)
      .then(res => setMatches(res))
      .catch(() => setError('scan-failed'));
  }, [occasion, userLocation]);

  if (!occasion) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top']}>
        <Text style={{ color: colors.textPrimary, padding: 24 }}>{t('muhurat.notFound')}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top']}>
      <View style={[styles.headerRow, { paddingHorizontal: spacing.screenH, borderBottomColor: colors.divider }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {t(`muhurat.occasion.${occasion}.name`)}
        </Text>
        <View style={styles.backBtn} />
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

        {matches === null && !error && (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.accent} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              {t('muhurat.computing')}
            </Text>
          </View>
        )}

        {error && (
          <View style={[styles.errorBox, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
            <Text style={[styles.errorText, { color: colors.textPrimary }]}>{t('muhurat.scanFailed')}</Text>
          </View>
        )}

        {matches !== null && matches.length === 0 && (
          <View style={[styles.errorBox, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
            <Ionicons name="information-circle-outline" size={22} color={colors.textMuted} />
            <Text style={[styles.errorText, { color: colors.textPrimary }]}>{t('muhurat.noMatches')}</Text>
            <Text style={[styles.errorSub, { color: colors.textMuted }]}>{t('muhurat.noMatchesDesc')}</Text>
          </View>
        )}

        {matches && matches.length > 0 && (
          <>
            <Text style={[styles.countLabel, { color: colors.accent }]}>
              {t('muhurat.resultsCount', { count: matches.length })}
            </Text>
            {matches.map((m, i) => (
              <DayRow
                key={m.date.toISOString()}
                match={m}
                colors={colors}
                expanded={expandedIdx === i}
                onToggle={() => setExpandedIdx(expandedIdx === i ? null : i)}
              />
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function DayRow({
  match,
  colors,
  expanded,
  onToggle,
}: {
  match: MuhuratMatch;
  colors: ColorPalette;
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
      style={[styles.dayRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.dayRowHead}>
        <View style={[styles.dateCol, { backgroundColor: colors.borderAccent }]}>
          <Text style={[styles.dateWeek, { color: colors.accent }]}>{weekday}</Text>
          <Text style={[styles.dateNum, { color: colors.accent }]}>{dayNum}</Text>
          <Text style={[styles.dateMonth, { color: colors.accent }]}>{month.slice(0, 3)} {year}</Text>
        </View>
        <View style={styles.dayInfo}>
          <Text style={[styles.dayTithi, { color: colors.textPrimary }]} numberOfLines={1}>
            {match.tithi}
          </Text>
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
            <Ionicons name="warning-outline" size={12} color={colors.error} />
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

  loadingBox: { alignItems: 'center', gap: 12, paddingVertical: 40 },
  loadingText: { fontSize: 13, fontFamily: 'Mukta_400Regular' },

  errorBox: {
    alignItems: 'center',
    gap: 8,
    padding: 20,
    borderRadius: borderRadius.cardInner,
    borderWidth: 1,
  },
  errorText: { fontSize: 14, fontFamily: 'Mukta_500Medium' },
  errorSub: { fontSize: 12, fontFamily: 'Mukta_400Regular', textAlign: 'center' },

  dayRow: {
    borderRadius: borderRadius.cardInner,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
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
  dayTithi: { fontSize: 14, fontFamily: 'Mukta_500Medium', marginBottom: 2 },
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
