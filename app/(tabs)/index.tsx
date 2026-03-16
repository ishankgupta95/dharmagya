import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, spacing, type ColorPalette } from '@/config/theme';
import { fetchPanchangForToday } from '@/services/astrology/panchangService';
import { DeityAvatar } from '@/components/common/DeityAvatar';
import type { IPanchangDay, IAarti } from '@/types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AartiRow {
  id: string;
  titleEnglish: string;
  titleNative: string;
  content: string;
  deity: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getGreeting(): { hindi: string; english: string } {
  const h = new Date().getHours();
  if (h < 12) return { hindi: 'शुभ प्रभात', english: 'Good Morning' };
  if (h < 17) return { hindi: 'शुभ दोपहर', english: 'Good Afternoon' };
  return { hindi: 'शुभ संध्या', english: 'Good Evening' };
}

function getTodayDateString(): string {
  return new Date()
    .toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
    .toUpperCase();
}

function rowToAarti(row: AartiRow): IAarti {
  return { ...row, content: JSON.parse(row.content) as string[] };
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { isDarkMode, favoriteIds } = useStore();
  const colors = isDarkMode ? darkColors : lightColors;
  const db = useSQLiteContext();

  const [panchang, setPanchang] = useState<IPanchangDay | null>(null);
  const [panchangLoading, setPanchangLoading] = useState(true);
  const [featuredAarti, setFeaturedAarti] = useState<IAarti | null>(null);

  // ── Panchang ──────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchPanchangForToday()
      .then(setPanchang)
      .finally(() => setPanchangLoading(false));
  }, []);

  // ── Featured Aarti ────────────────────────────────────────────────────────
  useEffect(() => {
    const favAartiIds = favoriteIds.filter((id) => id.startsWith('aarti-'));
    let row: AartiRow | null = null;

    if (favAartiIds.length > 0) {
      const randomId = favAartiIds[Math.floor(Math.random() * favAartiIds.length)];
      row = db.getFirstSync<AartiRow>('SELECT * FROM aartis WHERE id = ?', [randomId]);
    }

    if (!row) {
      row = db.getFirstSync<AartiRow>('SELECT * FROM aartis ORDER BY RANDOM() LIMIT 1');
    }

    setFeaturedAarti(row ? rowToAarti(row) : null);
  }, [db, favoriteIds]);

  const greeting = getGreeting();
  const panchangGradient: readonly [string, string] = isDarkMode
    ? ['#2E2418', '#1E1E24']
    : ['#FFF8F0', '#FFF0E4'];

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
        showsVerticalScrollIndicator={false}>

        {/* ── Header ───────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={[styles.dateLabel, { color: colors.textMuted }]}>
            {getTodayDateString()}
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/settings')}
            style={[styles.settingsBtn, { backgroundColor: colors.surfaceRecessed }]}>
            <Ionicons name="settings-outline" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* ── Greeting ─────────────────────────────────────────────────── */}
        <Text style={[styles.greeting, { color: colors.textPrimary }]}>
          {greeting.hindi}
        </Text>
        <Text style={[styles.greetingEn, { color: colors.textMuted }]}>
          {greeting.english}
        </Text>

        {/* ── Panchang Card ─────────────────────────────────────────────── */}
        <LinearGradient
          colors={panchangGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.panchangCard, { borderColor: colors.borderAccent }]}>

          {/* Card header row */}
          <View style={styles.panchangCardHeader}>
            <Text style={[styles.sectionLabel, { color: colors.accent }]}>
              TODAY'S PANCHANG
            </Text>
            <View style={[styles.locationBadge, { backgroundColor: colors.surfaceRecessed }]}>
              <Ionicons name="location-outline" size={10} color={colors.textMuted} />
              <Text style={[styles.locationText, { color: colors.textMuted }]}>
                {'  Pune, MH'}
              </Text>
            </View>
          </View>

          {/* 2×2 grid */}
          {panchangLoading ? (
            <ActivityIndicator
              color={colors.accent}
              style={{ marginVertical: 20 }}
            />
          ) : panchang ? (
            <>
              <View style={styles.panchangGrid}>
                <PanchangCell label="TITHI" value={panchang.tithi} colors={colors} />
                <PanchangCell label="NAKSHATRA" value={panchang.nakshatra} colors={colors} />
                <PanchangCell label="YOGA" value={panchang.yoga} colors={colors} />
                <PanchangCell label="KARANA" value={panchang.karana} colors={colors} />
              </View>

              <View style={[styles.divider, { backgroundColor: colors.divider }]} />

              {/* Sunrise / Sunset */}
              <View style={styles.sunRow}>
                <View style={styles.sunItem}>
                  <Ionicons name="sunny-outline" size={14} color={colors.accent} />
                  <Text style={[styles.sunLabel, { color: colors.textMuted }]}> SUNRISE</Text>
                  <Text style={[styles.sunValue, { color: colors.textPrimary }]}>
                    {panchang.sunrise}
                  </Text>
                </View>
                <View style={[styles.sunSep, { backgroundColor: colors.divider }]} />
                <View style={styles.sunItem}>
                  <Ionicons name="moon-outline" size={14} color={colors.textMuted} />
                  <Text style={[styles.sunLabel, { color: colors.textMuted }]}> SUNSET</Text>
                  <Text style={[styles.sunValue, { color: colors.textPrimary }]}>
                    {panchang.sunset}
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <Text style={[styles.errorText, { color: colors.textMuted }]}>
              Could not load Panchang
            </Text>
          )}
        </LinearGradient>

        {/* ── Featured Aarti Card ───────────────────────────────────────── */}
        {featuredAarti && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push(`/aarti/${featuredAarti.id}`)}
            style={[
              styles.featuredCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}>
            <View style={styles.featuredInner}>
              <DeityAvatar deity={featuredAarti.deity} size={52} />

              <View style={styles.featuredText}>
                <Text style={[styles.featuredTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                  {featuredAarti.titleNative}
                </Text>
                <Text style={[styles.featuredTranslit, { color: colors.textTertiary }]} numberOfLines={1}>
                  {featuredAarti.titleEnglish}
                </Text>
                <Text style={[styles.featuredDeity, { color: colors.accent }]}>
                  {featuredAarti.deity}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => router.push(`/aarti/${featuredAarti.id}`)}
                style={[styles.playBtn, { borderColor: colors.accent }]}>
                <Ionicons name="play" size={14} color={colors.accent} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.featuredCardLabel, { color: colors.textMuted }]}>
              {favoriteIds.some((id) => id.startsWith('aarti-'))
                ? 'FROM YOUR FAVOURITES'
                : 'FEATURED AARTI'}
            </Text>
          </TouchableOpacity>
        )}

        {/* ── Quick Access Row ──────────────────────────────────────────── */}
        <View style={styles.quickRow}>
          <QuickCard
            emoji="🙏"
            label="Favorites"
            onPress={() => router.push('/favorites')}
            colors={colors}
          />
          <QuickCard
            emoji="📿"
            label="All Aartis"
            onPress={() => router.push('/(tabs)/library')}
            colors={colors}
          />
          <QuickCard
            emoji="🌅"
            label="Panchang"
            onPress={() => router.push('/(tabs)/panchang')}
            colors={colors}
          />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface PanchangCellProps {
  label: string;
  value: string;
  colors: ColorPalette;
}

function PanchangCell({ label, value, colors }: PanchangCellProps) {
  return (
    <View style={styles.panchangCell}>
      <Text style={[styles.panchangLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.panchangValue, { color: colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

interface QuickCardProps {
  emoji: string;
  label: string;
  onPress: () => void;
  colors: ColorPalette;
}

function QuickCard({ emoji, label, onPress, colors }: QuickCardProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.quickCard,
        { backgroundColor: colors.surfaceRecessed, borderColor: colors.border },
      ]}>
      <Text style={styles.quickEmoji}>{emoji}</Text>
      <Text style={[styles.quickLabel, { color: colors.textSecondary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingBottom: 32, paddingTop: 12 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  dateLabel: { fontSize: 13, fontFamily: 'Mukta_400Regular', letterSpacing: 0.5 },
  settingsBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },

  // Greeting
  greeting: { fontSize: 26, fontFamily: 'Mukta_500Medium', marginBottom: 2 },
  greetingEn: { fontSize: 13, fontFamily: 'Mukta_400Regular', marginBottom: 20 },

  // Panchang card
  panchangCard: {
    borderRadius: borderRadius.card,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  panchangCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionLabel: { fontSize: 11, fontFamily: 'Mukta_400Regular', letterSpacing: 1 },
  locationBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: borderRadius.chip },
  locationText: { fontSize: 11, fontFamily: 'Mukta_400Regular' },

  panchangGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 14 },
  panchangCell: { width: '50%', paddingVertical: 6 },
  panchangLabel: { fontSize: 11, fontFamily: 'Mukta_400Regular', letterSpacing: 0.5, marginBottom: 2 },
  panchangValue: { fontSize: 15, fontFamily: 'Mukta_500Medium' },

  divider: { height: 0.5, marginVertical: 12 },

  sunRow: { flexDirection: 'row', alignItems: 'center' },
  sunItem: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  sunLabel: { fontSize: 11, fontFamily: 'Mukta_400Regular', letterSpacing: 0.5 },
  sunValue: { fontSize: 13, fontFamily: 'Mukta_500Medium', marginLeft: 4 },
  sunSep: { width: 0.5, height: 20, marginHorizontal: 12 },

  errorText: { fontSize: 13, fontFamily: 'Mukta_400Regular', textAlign: 'center', paddingVertical: 16 },

  // Featured aarti
  featuredCard: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  featuredInner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featuredText: { flex: 1 },
  featuredTitle: { fontSize: 16, fontFamily: 'Mukta_700Bold', marginBottom: 2 },
  featuredTranslit: { fontSize: 13, fontFamily: 'Mukta_400Regular', marginBottom: 2 },
  featuredDeity: { fontSize: 11, fontFamily: 'Mukta_400Regular', letterSpacing: 0.5 },
  featuredCardLabel: { fontSize: 11, fontFamily: 'Mukta_400Regular', letterSpacing: 1, marginTop: 12 },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Quick access
  quickRow: { flexDirection: 'row', gap: spacing.gridGap },
  quickCard: {
    flex: 1,
    borderRadius: borderRadius.iconContainer,
    borderWidth: 1,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 6,
  },
  quickEmoji: { fontSize: 22 },
  quickLabel: { fontSize: 12, fontFamily: 'Mukta_400Regular' },
});
