import { useState, useEffect, useRef } from 'react';
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
import { useTranslation } from 'react-i18next';
import Animated, { useSharedValue, useAnimatedScrollHandler, useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, spacing, type ColorPalette } from '@/config/theme';
import { DeityAvatar } from '@/components/common/DeityAvatar';

// ─── Types ────────────────────────────────────────────────────────────────────

interface KathaRow {
  id: string;
  titleEnglish: string;
  titleNative: string;
  deity: string;
  summary: string;
  content: string;
}

interface KathaDetail {
  id: string;
  titleEnglish: string;
  titleNative: string;
  deity: string;
  summary: string;
  paragraphs: string[];
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function KathaDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isDarkMode = useStore(s => s.isDarkMode);
  const favoriteIds = useStore(s => s.favoriteIds);
  const toggleFavorite = useStore(s => s.toggleFavorite);
  const colors = isDarkMode ? darkColors : lightColors;
  const db = useSQLiteContext();

  const [katha, setKatha] = useState<KathaDetail | null>(null);
  const scrollY = useSharedValue(0);

  const COLLAPSE_END = 100;
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => { scrollY.value = event.contentOffset.y; },
  });

  const heroAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, COLLAPSE_END * 0.6], [1, 0], Extrapolation.CLAMP),
    maxHeight: interpolate(scrollY.value, [0, COLLAPSE_END], [160, 0], Extrapolation.CLAMP),
    overflow: 'hidden' as const,
  }));
  const compactTitleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [COLLAPSE_END * 0.5, COLLAPSE_END], [0, 1], Extrapolation.CLAMP),
  }));

  useEffect(() => {
    if (!id) return;
    const row = db.getFirstSync<KathaRow>('SELECT * FROM kathas WHERE id = ?', [id]);
    if (row) {
      setKatha({ ...row, paragraphs: JSON.parse(row.content) as string[] });
    }
  }, [db, id]);

  const favoriteKey = `katha-${id ?? ''}`;
  const isFavorite = favoriteIds.includes(favoriteKey);

  if (!katha) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: '#1A2418' }]} edges={['top']}>
        <View style={[styles.root, { backgroundColor: colors.base, alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  const headerGradient: readonly [string, string] = ['#1A2418', colors.base];

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: '#1A2418' }]} edges={['top']}>

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
            <Text style={styles.compactTitleText} numberOfLines={1}>{katha.titleNative}</Text>
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
          <DeityAvatar deity={katha.deity} size={72} />
          <Text style={styles.heroTitleNative}>{katha.titleNative}</Text>
          <Text style={styles.heroTitleEn}>{katha.titleEnglish}</Text>
          <View style={styles.badgeRow}>
            <View style={styles.deityBadge}>
              <Text style={[styles.deityBadgeText, { color: colors.accent }]}>{katha.deity}</Text>
            </View>
            <View style={[styles.typeBadge, { backgroundColor: 'rgba(139,195,74,0.18)', borderColor: 'rgba(139,195,74,0.3)' }]}>
              <Text style={[styles.deityBadgeText, { color: '#8BC34A' }]}>{t('katha.badge')}</Text>
            </View>
          </View>
        </Animated.View>

      </LinearGradient>

      {/* ── Content ─────────────────────────────────────────────────── */}
      <Animated.ScrollView
        style={{ backgroundColor: colors.base }}
        contentContainerStyle={[styles.contentScroll, { paddingHorizontal: spacing.screenH }]}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}>

        {/* Summary */}
        <View style={[styles.summaryCard, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
          <Ionicons name="book-outline" size={16} color={colors.accent} />
          <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
            {katha.summary}
          </Text>
        </View>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: colors.divider }]} />

        {/* Paragraphs */}
        {katha.paragraphs.map((para, index) => {
          const isClosing = index === katha.paragraphs.length - 1 && para.startsWith('॥');
          return (
            <Paragraph
              key={index}
              text={para}
              isClosing={isClosing}
              isFirst={index === 0}
              colors={colors}
            />
          );
        })}

        <View style={{ height: 48 }} />
      </Animated.ScrollView>

    </SafeAreaView>
  );
}

// ─── Paragraph Block ─────────────────────────────────────────────────────────

interface ParagraphProps {
  text: string;
  isClosing: boolean;
  isFirst: boolean;
  colors: ColorPalette;
}

function Paragraph({ text, isClosing, isFirst, colors }: ParagraphProps) {
  if (isClosing) {
    return (
      <View style={styles.closingWrap}>
        <View style={[styles.closingLine, { backgroundColor: colors.divider }]} />
        <Text style={[styles.closingText, { color: colors.accent }]}>{text}</Text>
        <View style={[styles.closingLine, { backgroundColor: colors.divider }]} />
      </View>
    );
  }

  return (
    <View style={[styles.paraBlock, isFirst && styles.paraBlockFirst]}>
      {isFirst && <Text style={[styles.dropCap, { color: colors.accent }]}>{text.charAt(0)}</Text>}
      <Text style={[styles.paraText, { color: colors.textPrimary }]}>
        {isFirst ? text.slice(1) : text}
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
  badgeRow: { flexDirection: 'row', gap: 8 },
  deityBadge: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(232,137,60,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(232,137,60,0.3)',
  },
  typeBadge: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  deityBadgeText: { fontSize: 12, fontFamily: 'Mukta_400Regular', letterSpacing: 0.5 },

  // Content
  contentScroll: { paddingTop: 20, paddingBottom: 32 },

  // Summary card
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  summaryText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Mukta_400Regular',
    lineHeight: 22,
  },

  // Divider
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 20,
  },

  // Paragraphs
  paraBlock: {
    marginBottom: 18,
  },
  paraBlockFirst: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dropCap: {
    fontSize: 38,
    fontFamily: 'Mukta_700Bold',
    lineHeight: 42,
    marginRight: 4,
    marginTop: -4,
  },
  paraText: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Mukta_400Regular',
    lineHeight: 28,
    textAlign: 'left',
  },

  // Closing
  closingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 10,
  },
  closingLine: { flex: 1, height: StyleSheet.hairlineWidth },
  closingText: {
    fontSize: 14,
    fontFamily: 'Mukta_500Medium',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});
