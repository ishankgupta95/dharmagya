import { useEffect, useMemo, useState } from 'react';
import {
  View,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  InteractionManager,
} from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { getDailyPanchang } from 'panchang-ts';

import { useStore, type CachedFestivalDay } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, spacing, type ColorPalette } from '@/config/theme';
import { FALLBACK_COORDS } from '@/services/astrology/panchangService';

interface FestivalDay {
  date: Date;
  festivals: Array<{ name: string; type: string }>;
}

function makeCacheKey(year: number, lat: number, lon: number): string {
  return `${year}:${lat.toFixed(2)}:${lon.toFixed(2)}`;
}

interface SectionData {
  title: string;
  data: FestivalDay[];
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const TYPE_ICON: Record<string, { icon: string; color: string }> = {
  major: { icon: 'star', color: '#F9A825' },
  minor: { icon: 'star-half', color: '#9E9E9E' },
  ekadashi: { icon: 'moon', color: '#7AA8C8' },
  pradosha: { icon: 'moon-outline', color: '#9575CD' },
  sankranti: { icon: 'sunny', color: '#E8893C' },
};

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function isSameDay(a: Date, b: Date) {
  return a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear();
}

export default function FestivalsScreen() {
  const { isDarkMode, userLocation, festivalCache, setFestivalCache } = useStore();
  const colors = isDarkMode ? darkColors : lightColors;

  const [year, setYear] = useState(() => new Date().getFullYear());
  const [festivalDays, setFestivalDays] = useState<FestivalDay[]>([]);
  const [loading, setLoading] = useState(true);

  const lat = userLocation?.lat ?? FALLBACK_COORDS.lat;
  const lon = userLocation?.lon ?? FALLBACK_COORDS.lon;

  useEffect(() => {
    let cancelled = false;
    const cacheKey = makeCacheKey(year, lat, lon);

    // ── Check cache first ──
    if (festivalCache?.key === cacheKey) {
      setFestivalDays(
        festivalCache.days.map(d => ({ date: new Date(d.dateISO), festivals: d.festivals })),
      );
      setLoading(false);
      return;
    }

    setLoading(true);

    const handle = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      const timezone = -new Date().getTimezoneOffset();
      const geo = { latitude: lat, longitude: lon };
      const results: FestivalDay[] = [];

      for (let m = 0; m < 12; m++) {
        const days = daysInMonth(year, m);
        for (let d = 1; d <= days; d++) {
          const date = new Date(year, m, d);
          try {
            const r = getDailyPanchang(date, geo, { timezone, computeEndTimes: false });
            if (r.festivals.length > 0) {
              results.push({ date, festivals: r.festivals.map(f => ({ name: f.name, type: f.type })) });
            }
          } catch {
            // skip problematic dates
          }
        }
      }

      if (!cancelled) {
        setFestivalDays(results);
        setLoading(false);

        // Persist to cache
        setFestivalCache({
          key: cacheKey,
          days: results.map(r => ({
            dateISO: r.date.toISOString().slice(0, 10),
            festivals: r.festivals,
          })),
        });
      }
    });

    return () => {
      cancelled = true;
      handle.cancel();
    };
  }, [year, lat, lon, festivalCache?.key]);

  const sections: SectionData[] = useMemo(() => {
    const grouped = new Map<number, FestivalDay[]>();
    for (const fd of festivalDays) {
      const m = fd.date.getMonth();
      if (!grouped.has(m)) grouped.set(m, []);
      grouped.get(m)!.push(fd);
    }
    return [...grouped.entries()]
      .sort(([a], [b]) => a - b)
      .map(([m, data]) => ({ title: `${MONTH_NAMES[m]} ${year}`, data }));
  }, [festivalDays, year]);

  const today = new Date();

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { paddingHorizontal: spacing.screenH }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>Festivals & Vrats</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Year selector */}
      <View style={[styles.yearRow, { paddingHorizontal: spacing.screenH }]}>
        <TouchableOpacity onPress={() => setYear(y => y - 1)} hitSlop={12}>
          <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={[styles.yearLabel, { color: colors.textPrimary }]}>{year}</Text>
        <TouchableOpacity onPress={() => setYear(y => y + 1)} hitSlop={12}>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Computing festivals for {year}...</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, index) => `${item.date.getTime()}-${index}`}
          contentContainerStyle={{ paddingHorizontal: spacing.screenH, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled
          renderSectionHeader={({ section }) => (
            <View style={[styles.sectionHeader, { backgroundColor: colors.base }]}>
              <Text style={[styles.sectionTitle, { color: colors.accent }]}>{section.title}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <FestivalRow item={item} colors={colors} isToday={isSameDay(item.date, today)} />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No festivals found for {year}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function FestivalRow({ item, colors, isToday }: { item: FestivalDay; colors: ColorPalette; isToday: boolean }) {
  const dayName = item.date.toLocaleDateString('en-IN', { weekday: 'short' });
  const dayNum = item.date.getDate();

  return (
    <View style={[styles.festivalRow, { borderColor: colors.divider }, isToday && { borderColor: colors.accent, borderWidth: 1.5 }]}>
      {/* Date column */}
      <View style={[styles.dateCol, { backgroundColor: isToday ? colors.accent : colors.surfaceRecessed }]}>
        <Text style={[styles.dateDayName, { color: isToday ? colors.base : colors.textMuted }]}>{dayName}</Text>
        <Text style={[styles.dateDayNum, { color: isToday ? colors.base : colors.textPrimary }]}>{dayNum}</Text>
      </View>

      {/* Festival names */}
      <View style={styles.festivalCol}>
        {item.festivals.map((f, i) => {
          const typeInfo = TYPE_ICON[f.type] ?? TYPE_ICON.minor;
          return (
            <View key={i} style={styles.festivalItem}>
              <Ionicons name={typeInfo.icon as any} size={14} color={typeInfo.color} />
              <Text style={[styles.festivalName, { color: colors.textPrimary }]}>{f.name}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  screenTitle: { fontSize: 18, fontFamily: 'Mukta_500Medium' },

  yearRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 24, paddingBottom: 12 },
  yearLabel: { fontSize: 20, fontFamily: 'Mukta_700Bold' },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 14, fontFamily: 'Mukta_400Regular' },

  sectionHeader: { paddingTop: 16, paddingBottom: 8 },
  sectionTitle: { fontSize: 12, fontFamily: 'Mukta_500Medium', letterSpacing: 1 },

  festivalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
    borderRadius: borderRadius.cardInner,
    borderWidth: 0.5,
    overflow: 'hidden',
  },

  dateCol: {
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  dateDayName: { fontSize: 10, fontFamily: 'Mukta_400Regular', letterSpacing: 0.5 },
  dateDayNum: { fontSize: 20, fontFamily: 'Mukta_700Bold', lineHeight: 24 },

  festivalCol: { flex: 1, paddingVertical: 10, paddingRight: 12, gap: 4 },
  festivalItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  festivalName: { fontSize: 14, fontFamily: 'Mukta_500Medium' },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 14, fontFamily: 'Mukta_400Regular' },
});
