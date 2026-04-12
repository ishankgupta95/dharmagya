import { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { useSharedValue, useAnimatedScrollHandler, useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, spacing, type ColorPalette } from '@/config/theme';
import { DeityAvatar } from '@/components/common/DeityAvatar';
import { useInterstitialOnExit } from '@/hooks/useInterstitialOnExit';
import type { IChalisaSection } from '@/types';
// ─── Types ────────────────────────────────────────────────────────────────────

interface ChalisaRow {
  id: string;
  titleEnglish: string;
  titleNative: string;
  deity: string;
  sections: string;
}

interface ChalisaDetail {
  id: string;
  titleEnglish: string;
  titleNative: string;
  deity: string;
  sections: IChalisaSection[];
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ChalisaDetailScreen() {
  useInterstitialOnExit();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isDarkMode = useStore(s => s.isDarkMode);
  const favoriteIds = useStore(s => s.favoriteIds);
  const toggleFavorite = useStore(s => s.toggleFavorite);
  const colors = isDarkMode ? darkColors : lightColors;
  const db = useSQLiteContext();

  const [chalisa, setChalisa] = useState<ChalisaDetail | null>(null);
  const scrollY = useSharedValue(0);

  const COLLAPSE_END = 100;
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => { scrollY.value = event.contentOffset.y; },
  });

  const heroAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, COLLAPSE_END * 0.6], [1, 0], Extrapolation.CLAMP),
    maxHeight: interpolate(scrollY.value, [0, COLLAPSE_END], [140, 0], Extrapolation.CLAMP),
    overflow: 'hidden' as const,
  }));
  const compactTitleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [COLLAPSE_END * 0.5, COLLAPSE_END], [0, 1], Extrapolation.CLAMP),
  }));

  useEffect(() => {
    if (!id) return;
    const row = db.getFirstSync<ChalisaRow>('SELECT * FROM chalisas WHERE id = ?', [id]);
    if (row) {
      setChalisa({ ...row, sections: JSON.parse(row.sections) as IChalisaSection[] });
    }
  }, [db, id]);

  const favoriteKey = `chalisa-${id ?? ''}`;
  const isFavorite = favoriteIds.includes(favoriteKey);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (!chalisa) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: '#2E2418' }]} edges={['top']}>
        <View style={[styles.root, { backgroundColor: colors.base, alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  const headerGradient: readonly [string, string] = ['#2E2418', colors.base];

  // Pre-compute chaupai numbers for each verse across sections
  let globalChaupaiNum = 0;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: '#2E2418' }]} edges={['top']}>

      {/* ── Gradient Header ─────────────────────────────────────────── */}
      <LinearGradient colors={headerGradient} style={styles.header}>

        {/* Nav row */}
        <View style={styles.navRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.navBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={20} color="#F0E6D3" />
          </TouchableOpacity>

          {/* Compact title (visible when hero collapsed) */}
          <Animated.View style={[styles.compactTitle, compactTitleAnimatedStyle]}>
            <Text style={styles.compactTitleText} numberOfLines={1}>{chalisa.titleNative}</Text>
          </Animated.View>

          <TouchableOpacity
            onPress={() => toggleFavorite(favoriteKey)}
            style={styles.navBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={20}
              color={isFavorite ? '#E8893C' : '#F0E6D3'}
            />
          </TouchableOpacity>
        </View>

        {/* Hero: avatar + title (collapses on scroll) */}
        <Animated.View style={[styles.hero, heroAnimatedStyle]}>
          <DeityAvatar deity={chalisa.deity} size={72} />
          <Text style={styles.heroTitleNative}>{chalisa.titleNative}</Text>
          <Text style={styles.heroTitleEn}>{chalisa.titleEnglish}</Text>
          <View style={styles.deityBadge}>
            <Text style={[styles.deityBadgeText, { color: colors.accent }]}>{chalisa.deity}</Text>
          </View>
        </Animated.View>

      </LinearGradient>

      {/* ── Sections ────────────────────────────────────────────────── */}
      <Animated.ScrollView
        style={{ backgroundColor: colors.base }}
        contentContainerStyle={[styles.contentScroll, { paddingHorizontal: spacing.screenH }]}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}>

        {chalisa.sections.map((section, sectionIndex) => {
          const isChaupai = section.type === 'chaupai';
          return (
            <View key={sectionIndex} style={styles.section}>

              {/* Section label header (only for doha) */}
              {section.type === 'doha' && (
                <View style={styles.sectionLabelRow}>
                  <View style={[styles.sectionLine, { backgroundColor: colors.divider }]} />
                  <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
                    {section.label}
                  </Text>
                  <View style={[styles.sectionLine, { backgroundColor: colors.divider }]} />
                </View>
              )}

              {/* Verses */}
              {section.verses.map((verse, verseIndex) => {
                const num = isChaupai ? ++globalChaupaiNum : null;
                return (
                  <VerseBlock
                    key={verseIndex}
                    verse={verse}
                    number={num}
                    type={section.type}
                    colors={colors}
                  />
                );
              })}

            </View>
          );
        })}

        <View style={{ height: 48 }} />
      </Animated.ScrollView>

    </SafeAreaView>
  );
}

// ─── Verse Block ──────────────────────────────────────────────────────────────

interface VerseBlockProps {
  verse: string;
  number: number | null;
  type: 'doha' | 'chaupai';
  colors: ColorPalette;
}

function VerseBlock({ verse, number, type, colors }: VerseBlockProps) {
  const isChaupai = type === 'chaupai';
  return (
    <View style={[styles.verseBlock, isChaupai && styles.verseBlockChaupai]}>
      {isChaupai && number !== null && (
        <Text style={[styles.verseNumber, { color: colors.accent }]}>{number}</Text>
      )}
      <Text
        style={[
          styles.verseText,
          { color: colors.textPrimary },
          !isChaupai && styles.verseTextDoha,
        ]}>
        {verse}
      </Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: { paddingBottom: 12 },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.screenH,
    paddingTop: 12,
    paddingBottom: 8,
  },
  navBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactTitle: { flex: 1, alignItems: 'center', marginHorizontal: 8 },
  compactTitleText: {
    fontSize: 16,
    fontFamily: 'Mukta_700Bold',
    color: '#F0E6D3',
    textAlign: 'center',
  },
  hero: { alignItems: 'center', paddingTop: 8, paddingBottom: 4, gap: 10 },
  heroTitleNative: {
    fontSize: 22,
    fontFamily: 'Mukta_700Bold',
    color: '#F0E6D3',
    textAlign: 'center',
    paddingHorizontal: spacing.screenH,
  },
  heroTitleEn: {
    fontSize: 13,
    fontFamily: 'Mukta_400Regular',
    color: '#C8B89A',
    textAlign: 'center',
    paddingHorizontal: spacing.screenH,
  },
  deityBadge: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(232,137,60,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(232,137,60,0.3)',
  },
  deityBadgeText: { fontSize: 12, fontFamily: 'Mukta_400Regular', letterSpacing: 0.5 },

  // Content
  contentScroll: { paddingTop: 24, paddingBottom: 32 },

  // Section
  section: { marginBottom: 8 },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
    gap: 10,
  },
  sectionLine: { flex: 1, height: StyleSheet.hairlineWidth },
  sectionLabel: { fontSize: 13, fontFamily: 'Mukta_400Regular', letterSpacing: 0.5 },

  // Verse blocks
  verseBlock: { marginBottom: 20, alignItems: 'center' },
  verseBlockChaupai: { marginBottom: 24 },
  verseNumber: {
    fontSize: 11,
    fontFamily: 'Mukta_500Medium',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  verseText: {
    fontSize: 17,
    fontFamily: 'Mukta_400Regular',
    textAlign: 'center',
    lineHeight: 30,
  },
  verseTextDoha: {
    fontFamily: 'Mukta_500Medium',
    fontSize: 16,
    fontStyle: 'italic',
  },
});
