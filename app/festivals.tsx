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
import { Icon, type IconName } from '@/components/common/Icon';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useStore, type Region } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, palette, semanticColors, spacing, type ColorPalette } from '@/config/theme';
import { Kicker } from '@/components/common/Kicker';
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

// Color string is resolved at render-time so type 'major' can pick up the
// theme-responsive accent (sindoor in light, goldLeaf in dark) for WCAG contrast.
const TYPE_ICON: Record<string, { icon: IconName; color: string | null }> = {
  major: { icon: 'star', color: null },
  minor: { icon: 'star-half', color: palette.gold },
  ekadashi: { icon: 'moon', color: '#7AA8C8' },
  smarta_ekadashi: { icon: 'moon', color: '#7AA8C8' },
  vaishnava_ekadashi: { icon: 'moon', color: '#7AA8C8' },
  pradosha: { icon: 'moon', color: '#9575CD' },
  sankranti: { icon: 'sun', color: '#E8893C' },
  eclipse: { icon: 'contrast', color: semanticColors.error },
};

/** Window used to flag upcoming items with a "Soon" badge + accent border. */
const SOON_WINDOW_DAYS = 14;

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

function collapseSankrantiVariants(list: FestivalEntry[], region: Region): FestivalEntry[] {
  const sankrantis = list.filter(f => f.type === 'sankranti');
  if (sankrantis.length <= 1) return list;

  const names = sankrantis.map(f => f.name);

  let primary: FestivalEntry | undefined;

  if (region !== 'all') {
    const regionalMatch = sankrantis.find(
      f => REGIONAL_SANKRANTI[f.name] === region,
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
  const smartaDeferred = !!smarta.deferralDate;
  if (sameClassicalName && !smartaDeferred) {
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
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={[styles.headerRow, { paddingHorizontal: spacing.screenH, borderBottomColor: colors.divider }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.back')}>
          <Icon name="chevron-left" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text variant="display-italic" style={[styles.screenTitle, { color: colors.textPrimary }]}>
          {t('festivals.title')}
        </Text>
        <View style={styles.backPill} />
      </View>

      {/* ── Year selector ──────────────────────────────────────────── */}
      <View style={[styles.yearRow, { paddingHorizontal: spacing.screenH }]}>
        <TouchableOpacity
          onPress={() => setYear(y => y - 1)}
          hitSlop={12}
          disabled={!canGoBack}
          accessibilityRole="button"
          accessibilityLabel={`${year - 1}`}
          accessibilityState={{ disabled: !canGoBack }}>
          <Icon name="chevron-left" size={20} color={canGoBack ? colors.textSecondary : colors.textMuted} />
        </TouchableOpacity>
        <Text variant="display-italic" style={[styles.yearLabel, { color: colors.textPrimary }]}>
          {year}
        </Text>
        <TouchableOpacity
          onPress={() => setYear(y => y + 1)}
          hitSlop={12}
          disabled={!canGoForward}
          accessibilityRole="button"
          accessibilityLabel={`${year + 1}`}
          accessibilityState={{ disabled: !canGoForward }}>
          <Icon name="chevron-right" size={20} color={canGoForward ? colors.textSecondary : colors.textMuted} />
        </TouchableOpacity>
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
            style={[styles.searchInput, { color: colors.textPrimary, fontFamily: 'Fraunces_400Regular_Italic' }]}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('a11y.clearSearch')}>
              <Icon name="close-circle" size={18} color={colors.textMuted} />
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
            <Kicker
              color={colors.accent}
              size={10}
              withTrailingRule
              ruleColor={colors.divider}>
              {section.title}
            </Kicker>
          </View>
        )}
        renderItem={({ item }) => {
          const t0 = item.date.getTime();
          return (
            <FestivalRow
              item={item}
              colors={colors}
              isToday={isSameDay(item.date, today)}
              isSoon={t0 >= nowStart && t0 <= soonCutoff && !isSameDay(item.date, today)}
            />
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text variant="body-italic" style={[styles.emptyText, { color: colors.textMuted }]}>
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
  isSoon,
}: {
  item: FestivalDay;
  colors: ColorPalette;
  isToday: boolean;
  isSoon: boolean;
}) {
  const { t } = useTranslation();
  const dayName = item.date.toLocaleDateString('en-IN', { weekday: 'short' });
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
          { backgroundColor: isToday ? palette.sindoor : colors.surfaceRecessed },
        ]}>
        <Text
          variant="mono-caps"
          style={[
            styles.dateDayName,
            { color: isToday ? palette.parchmentBright : colors.textMuted },
          ]}>
          {dayName}
        </Text>
        <Text
          variant="display-italic"
          style={[
            styles.dateDayNum,
            { color: isToday ? palette.parchmentBright : colors.textPrimary },
          ]}>
          {dayNum}
        </Text>
      </View>

      <View style={styles.festivalCol}>
        {isSoon && !isToday && (
          <View style={[styles.soonBadge, { borderColor: colors.accent }]}>
            <Text variant="mono-caps" style={[styles.soonBadgeText, { color: colors.accent }]}>
              {t('festivals.soonBadge')}
            </Text>
          </View>
        )}
        {item.festivals.map((f, i) => {
          const typeInfo = TYPE_ICON[f.type] ?? TYPE_ICON.minor;
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
            f.type !== 'sankranti'
          ) {
            secondary = f.description;
          }
          return (
            <View key={i} style={styles.festivalItem}>
              <View style={{ marginTop: 3 }}>
                <Icon name={typeInfo.icon} size={14} color={typeInfo.color ?? colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="body" style={[styles.festivalName, { color: colors.textPrimary }]}>
                  {primary}
                </Text>
                {secondary && (
                  <Text variant="body-italic" style={[styles.festivalSecondary, { color: colors.textMuted }]}>
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

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  screenTitle: { fontSize: 22 },

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
  festivalName: { fontSize: 14, lineHeight: 19 },
  festivalSecondary: { fontSize: 11, lineHeight: 15, marginTop: 1 },

  soonBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    borderWidth: 1,
  },
  soonBadgeText: { fontSize: 8 },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 14 },
});
