import { useState, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, spacing, type ColorPalette } from '@/config/theme';
import { DeityAvatar } from '@/components/common/DeityAvatar';
import type { IAarti } from '@/types';
// ─── DB Row Type ──────────────────────────────────────────────────────────────

interface AartiRow {
  id: string;
  titleEnglish: string;
  titleNative: string;
  content: string;
  deity: string;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AartiDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isDarkMode, favoriteIds, toggleFavorite } = useStore();
  const colors = isDarkMode ? darkColors : lightColors;
  const db = useSQLiteContext();

  const [aarti, setAarti] = useState<IAarti | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  // Hero collapse animations (collapse over 0–100px of scroll)
  const COLLAPSE_END = 100;
  const heroOpacity = scrollY.interpolate({
    inputRange: [0, COLLAPSE_END * 0.6],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const heroHeight = scrollY.interpolate({
    inputRange: [0, COLLAPSE_END],
    outputRange: [140, 0],
    extrapolate: 'clamp',
  });
  const compactTitleOpacity = scrollY.interpolate({
    inputRange: [COLLAPSE_END * 0.5, COLLAPSE_END],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    if (!id) return;
    const row = db.getFirstSync<AartiRow>('SELECT * FROM aartis WHERE id = ?', [id]);
    if (row) {
      setAarti({ ...row, content: JSON.parse(row.content) as string[] });
    }
  }, [db, id]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const favoriteKey = `aarti-${id ?? ''}`;
  const isFavorite = favoriteIds.includes(favoriteKey);

  function handleReadAlong() {
    setToastVisible(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), 2500);
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (!aarti) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: '#2E2418' }]} edges={['top']}>
        <View style={[styles.root, { backgroundColor: colors.base, alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  const headerGradient: readonly [string, string] = ['#2E2418', colors.base];

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
          <Animated.View style={[styles.compactTitle, { opacity: compactTitleOpacity }]}>
            <Text style={styles.compactTitleText} numberOfLines={1}>{aarti.titleNative}</Text>
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
        <Animated.View style={[styles.hero, { opacity: heroOpacity, maxHeight: heroHeight, overflow: 'hidden' }]}>
          <DeityAvatar deity={aarti.deity} size={72} />
          <Text style={styles.heroTitleNative}>{aarti.titleNative}</Text>
          <Text style={styles.heroTitleEn}>{aarti.titleEnglish}</Text>
          <View style={styles.deityBadge}>
            <Text style={[styles.deityBadgeText, { color: colors.accent }]}>{aarti.deity}</Text>
          </View>
        </Animated.View>

      </LinearGradient>

      {/* ── Verses ──────────────────────────────────────────────────── */}
      <Animated.ScrollView
        style={{ backgroundColor: colors.base }}
        contentContainerStyle={[styles.verseScroll, { paddingHorizontal: spacing.screenH }]}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}>
        {aarti.content.map((verse, index) => (
          <Text key={index} style={[styles.verse, { color: colors.textPrimary }]}>
            {verse}
          </Text>
        ))}
        <View style={{ height: 100 }} />
      </Animated.ScrollView>

      {/* ── Bottom CTA ──────────────────────────────────────────────── */}
      <View style={[styles.bottomBar, { backgroundColor: colors.base, borderTopColor: colors.border }]}>
        <TouchableOpacity
          onPress={handleReadAlong}
          activeOpacity={0.85}
          style={[styles.readAlongBtn, { backgroundColor: colors.accent }]}>
          <Ionicons name="book-outline" size={18} color="#FFFFFF" />
          <Text style={styles.readAlongText}>Read Along Mode</Text>
        </TouchableOpacity>
      </View>

      {/* ── Toast ───────────────────────────────────────────────────── */}
      {toastVisible && <ComingSoonToast colors={colors} />}

    </SafeAreaView>
  );
}

// ─── Coming Soon Toast ────────────────────────────────────────────────────────

interface ToastProps {
  colors: ColorPalette;
}

function ComingSoonToast({ colors }: ToastProps) {
  return (
    <View
      style={[styles.toast, { backgroundColor: colors.surface, borderColor: colors.border }]}
      pointerEvents="none">
      <Text style={styles.toastEmoji}>✨</Text>
      <Text style={[styles.toastText, { color: colors.textPrimary }]}>Coming Soon!</Text>
      <Text style={[styles.toastSub, { color: colors.textSecondary }]}>
        Read Along Mode is on the way
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

  // Verses
  verseScroll: { paddingTop: 24, paddingBottom: 32 },
  verse: {
    fontSize: 17,
    fontFamily: 'Mukta_400Regular',
    textAlign: 'center',
    lineHeight: 30,
    marginBottom: 24,
  },

  // Bottom CTA
  bottomBar: {
    paddingHorizontal: spacing.screenH,
    paddingTop: 12,
    paddingBottom: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  readAlongBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  readAlongText: {
    fontSize: 15,
    fontFamily: 'Mukta_500Medium',
    color: '#FFFFFF',
  },

  // Toast
  toast: {
    position: 'absolute',
    bottom: 100,
    left: spacing.screenH,
    right: spacing.screenH,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  toastEmoji: { fontSize: 24 },
  toastText: { fontSize: 16, fontFamily: 'Mukta_700Bold' },
  toastSub: { fontSize: 13, fontFamily: 'Mukta_400Regular' },
});
