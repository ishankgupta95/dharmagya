import { useMemo, useState } from 'react';
import {
  View,
  SectionList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useStore, type Region } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, spacing, type ColorPalette } from '@/config/theme';
import { AdBanner } from '@/components/common/AdBanner';

import festivalsData from '@/data/static/festivals.json';

interface FestivalEntry {
  name: string;
  type: string;
  description?: string;
  deferralDate?: string;
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

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const TYPE_ICON: Record<string, { icon: string; color: string }> = {
  major: { icon: 'star', color: '#F9A825' },
  minor: { icon: 'star-half', color: '#9E9E9E' },
  ekadashi: { icon: 'moon', color: '#7AA8C8' },
  smarta_ekadashi: { icon: 'moon', color: '#7AA8C8' },
  vaishnava_ekadashi: { icon: 'moon', color: '#7AA8C8' },
  pradosha: { icon: 'moon-outline', color: '#9575CD' },
  sankranti: { icon: 'sunny', color: '#E8893C' },
  eclipse: { icon: 'contrast', color: '#E24B4A' },
};

/**
 * Regional Sankranti variants → the Region they belong to. Used only to promote
 * a user's regional name as the primary label when grouping same-day Sankranti
 * variants. Nothing gets filtered out based on this — all names remain visible
 * as "also observed as …" subtitles so users can discover other traditions.
 */
const REGIONAL_SANKRANTI: Record<string, Region> = {
  // South
  'Pongal': 'tamil-nadu',
  'Puthandu': 'tamil-nadu',
  'Vishu': 'kerala',
  'Ayyappa Makara Jyothi': 'kerala',
  // East
  'Pohela Boishakh': 'west-bengal',
  'Raja Sankranti': 'odisha',
  'Singh Sankranti': 'odisha',
  'Magh Bihu': 'assam',
  'Bohag Bihu': 'assam',
  'Kati Bihu': 'assam',
  // West
  'Uttarayan': 'gujarat',
  // North
  'Baisakhi': 'punjab',
  'Harela': 'uttarakhand',
  'Sair': 'himachal-pradesh',
};

/**
 * Collapse same-day Sankranti entries into a single row with regional names as
 * a subtitle. Picks a primary name using this priority:
 *   1. User's region-specific variant (e.g. "Pongal" for region='tamil')
 *   2. A compound pan-Indian name like "Makar Sankranti" / "Dakshinayana"
 *   3. The generic "Sankranti" fused with its description rashi
 *      (e.g. "Sankranti (Mesha)")
 *   4. First entry as-is (fallback)
 */
function collapseSankrantiVariants(list: FestivalEntry[], region: Region): FestivalEntry[] {
  const sankrantis = list.filter(f => f.type === 'sankranti');
  if (sankrantis.length <= 1) return list;

  const names = sankrantis.map(f => f.name);

  let primary: FestivalEntry | undefined;

  // 1. Try user's regional preference.
  if (region !== 'all') {
    const regionalMatch = sankrantis.find(
      f => REGIONAL_SANKRANTI[f.name] === region,
    );
    if (regionalMatch) primary = regionalMatch;
  }
  // 2. Compound pan-Indian (e.g. "Makar Sankranti", "Dakshinayana"). Exclude
  //    regional compounds like "Singh Sankranti" via the regional map.
  if (!primary) {
    primary = sankrantis.find(
      f =>
        f.name !== 'Sankranti' &&
        !REGIONAL_SANKRANTI[f.name] &&
        /sankranti|uttarayana|dakshinayana/i.test(f.name),
    );
  }
  // 3. Generic "Sankranti" + rashi.
  if (!primary) {
    const generic = sankrantis.find(f => f.name === 'Sankranti');
    if (generic?.description) {
      primary = {
        ...generic,
        name: `Sankranti (${generic.description})`,
      };
    }
  }
  // 4. Fallback.
  if (!primary) primary = sankrantis[0];

  // Collect regional variants (everything except the chosen primary and the
  // generic "Sankranti" umbrella, which is implicit).
  const variants = names.filter(
    n => n !== primary!.name && n !== 'Sankranti',
  );

  const merged: FestivalEntry = {
    ...primary,
    regionalVariants: variants.length > 0 ? variants : undefined,
  };

  return [...list.filter(f => f.type !== 'sankranti'), merged];
}

/**
 * Collapse same-day Ekadashi sub-variants. When smarta and vaishnava share the
 * same description (no Dashami-viddha split), show one combined entry using
 * the classical name from description. When they split, show both.
 */
function collapseEkadashiPair(list: FestivalEntry[]): FestivalEntry[] {
  const smarta = list.find(f => f.type === 'smarta_ekadashi');
  const vaishnava = list.find(f => f.type === 'vaishnava_ekadashi');
  if (!smarta || !vaishnava) return list;
  const sameClassicalName =
    smarta.description && smarta.description === vaishnava.description;
  const smartaDeferred = !!smarta.deferralDate;
  if (sameClassicalName && !smartaDeferred) {
    // Merge into a single canonical Ekadashi row
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

const MIN_YEAR = 2016;
const MAX_YEAR = 2036;

function isSameDay(a: Date, b: Date) {
  return a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear();
}

function parseFestivalDays(year: number, region: Region): FestivalDay[] {
  const yearData = (festivalsData as Record<string, { date: string; festivals: FestivalEntry[] }[]>)[String(year)];
  if (!yearData) return [];
  return yearData.map(d => ({
    date: new Date(d.date + 'T00:00:00'),
    festivals: collapseSankrantiVariants(
      collapseEkadashiPair(d.festivals),
      region,
    ),
  }));
}

/** True when the festival's name, description, or any regional variant matches
 *  the query (case-insensitive substring). */
function festivalMatches(f: FestivalEntry, q: string): boolean {
  if (f.name.toLowerCase().includes(q)) return true;
  if (f.description?.toLowerCase().includes(q)) return true;
  if (f.regionalVariants?.some(v => v.toLowerCase().includes(q))) return true;
  return false;
}

export default function FestivalsScreen() {
  const { t } = useTranslation();
  const isDarkMode = useStore(s => s.isDarkMode);
  const region = useStore(s => s.region);
  const colors = isDarkMode ? darkColors : lightColors;

  const [year, setYear] = useState(() => new Date().getFullYear());
  const [searchQuery, setSearchQuery] = useState('');

  const festivalDays = useMemo(() => parseFestivalDays(year, region), [year, region]);

  /** Festivals filtered by search query. When a day has at least one match,
   *  its festival list is trimmed to only matching entries so the row shows
   *  just the relevant hit instead of the full day. */
  const visibleDays = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return festivalDays;
    return festivalDays
      .map(d => ({
        date: d.date,
        festivals: d.festivals.filter(f => festivalMatches(f, q)),
      }))
      .filter(d => d.festivals.length > 0);
  }, [festivalDays, searchQuery]);

  const sections: SectionData[] = useMemo(() => {
    const grouped = new Map<number, FestivalDay[]>();
    for (const fd of visibleDays) {
      const m = fd.date.getMonth();
      if (!grouped.has(m)) grouped.set(m, []);
      grouped.get(m)!.push(fd);
    }
    return [...grouped.entries()]
      .sort(([a], [b]) => a - b)
      .map(([m, data]) => ({ title: `${MONTH_NAMES[m]} ${year}`, data }));
  }, [visibleDays, year]);

  const today = new Date();
  const canGoBack = year > MIN_YEAR;
  const canGoForward = year < MAX_YEAR;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { paddingHorizontal: spacing.screenH }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>{t('festivals.title')}</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Year selector */}
      <View style={[styles.yearRow, { paddingHorizontal: spacing.screenH }]}>
        <TouchableOpacity
          onPress={() => setYear(y => y - 1)}
          hitSlop={12}
          disabled={!canGoBack}
        >
          <Ionicons name="chevron-back" size={20} color={canGoBack ? colors.textSecondary : colors.textMuted} />
        </TouchableOpacity>
        <Text style={[styles.yearLabel, { color: colors.textPrimary }]}>{year}</Text>
        <TouchableOpacity
          onPress={() => setYear(y => y + 1)}
          hitSlop={12}
          disabled={!canGoForward}
        >
          <Ionicons name="chevron-forward" size={20} color={canGoForward ? colors.textSecondary : colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={[styles.searchBar, { paddingHorizontal: spacing.screenH }]}>
        <View style={[styles.searchInputWrap, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('festivals.searchPlaceholder')}
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.textPrimary }]}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={10}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item, index) => `${item.date.getTime()}-${index}`}
        contentContainerStyle={{ paddingHorizontal: spacing.screenH, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={5}
        renderSectionHeader={({ section }) => (
          <View style={[styles.sectionHeader, { backgroundColor: colors.base }]}>
            <Text style={[styles.sectionTitle, { color: colors.accent }]}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <FestivalRow
            item={item}
            colors={colors}
            isToday={isSameDay(item.date, today)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              {searchQuery.trim()
                ? t('festivals.noSearchResults', { query: searchQuery.trim(), year })
                : t('festivals.noFestivals', { year })}
            </Text>
          </View>
        }
      />

      <AdBanner colors={colors} placement="festivals" />
    </SafeAreaView>
  );
}

function FestivalRow({
  item,
  colors,
  isToday,
}: {
  item: FestivalDay;
  colors: ColorPalette;
  isToday: boolean;
}) {
  const dayName = item.date.toLocaleDateString('en-IN', { weekday: 'short' });
  const dayNum = item.date.getDate();

  return (
    <View style={[styles.festivalRow, { borderColor: colors.divider }, isToday && { borderColor: colors.accent, borderWidth: 1.5 }]}>
      <View style={[styles.dateCol, { backgroundColor: isToday ? colors.accent : colors.surfaceRecessed }]}>
        <Text style={[styles.dateDayName, { color: isToday ? colors.base : colors.textMuted }]}>{dayName}</Text>
        <Text style={[styles.dateDayNum, { color: isToday ? colors.base : colors.textPrimary }]}>{dayNum}</Text>
      </View>

      <View style={styles.festivalCol}>
        {item.festivals.map((f, i) => {
          const typeInfo = TYPE_ICON[f.type] ?? TYPE_ICON.minor;
          // Description-vs-name rule:
          //   - Smarta/Vaishnava Ekadashi sub-variants (Dashami-viddha split):
          //       name = "Smarta Ekadashi" (sect label), description = classical name.
          //       Show description as primary, sect + deferral as secondary.
          //   - Merged generic Ekadashi (from collapseEkadashiPair):
          //       name is already the classical name; description absent.
          //   - Everything else (sankranti, major, minor, pradosha, eclipse):
          //       name is the specific festival ("Pongal", "Diwali"); description
          //       carries metadata (rashi, paksha) — keep as secondary note.
          const isSubvariant =
            f.type === 'smarta_ekadashi' || f.type === 'vaishnava_ekadashi';
          const primary = isSubvariant && f.description ? f.description : f.name;
          let secondary: string | undefined;
          if (isSubvariant) {
            const sect = f.type === 'smarta_ekadashi' ? 'Smarta fast' : 'Vaishnava fast';
            secondary = f.deferralDate ? `${sect} · deferred to ${f.deferralDate}` : sect;
          } else if (f.regionalVariants && f.regionalVariants.length > 0) {
            secondary = `Also: ${f.regionalVariants.join(', ')}`;
          } else if (
            f.description &&
            f.description !== f.name &&
            // Sankranti description is just the rashi name (e.g. "Makara") — redundant
            // and repeats across every regional variant for the day.
            f.type !== 'sankranti'
          ) {
            secondary = f.description;
          }
          return (
            <View key={i} style={styles.festivalItem}>
              <Ionicons name={typeInfo.icon as any} size={14} color={typeInfo.color} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.festivalName, { color: colors.textPrimary }]}>{primary}</Text>
                {secondary && (
                  <Text style={[styles.festivalSecondary, { color: colors.textMuted }]}>
                    {secondary}
                  </Text>
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

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  screenTitle: { fontSize: 18, fontFamily: 'Mukta_500Medium' },

  yearRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 24, paddingBottom: 12 },
  yearLabel: { fontSize: 20, fontFamily: 'Mukta_700Bold' },

  searchBar: { paddingBottom: 12 },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: borderRadius.cardInner,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Mukta_400Regular',
    padding: 0,
  },

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
  festivalItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  festivalName: { fontSize: 14, fontFamily: 'Mukta_500Medium' },
  festivalSecondary: { fontSize: 11, fontFamily: 'Mukta_400Regular', marginTop: 1 },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 14, fontFamily: 'Mukta_400Regular' },
});
