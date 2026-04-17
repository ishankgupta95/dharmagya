import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import Animated, { useSharedValue, useAnimatedScrollHandler, useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, spacing, type ColorPalette } from '@/config/theme';
import { DeityAvatar } from '@/components/common/DeityAvatar';
import { useInterstitialOnExit } from '@/hooks/useInterstitialOnExit';
import { resolveLanguage } from '@/i18n';
import { getAartiForDeity, aartiVerses, titleFor, type ContentLang } from '@/services/content';

export default function AartiDetailScreen() {
  useInterstitialOnExit();
  const { t } = useTranslation();
  // The route file is `[id].tsx` for backwards compat; the value is now a deity slug.
  const { id: deitySlug } = useLocalSearchParams<{ id: string }>();
  const isDarkMode = useStore(s => s.isDarkMode);
  const favoriteIds = useStore(s => s.favoriteIds);
  const toggleFavorite = useStore(s => s.toggleFavorite);
  const appLanguage = useStore(s => s.language);
  const colors = isDarkMode ? darkColors : lightColors;

  const aarti = useMemo(() => (deitySlug ? getAartiForDeity(deitySlug) : undefined), [deitySlug]);

  const [lang, setLang] = useState<ContentLang>(() => resolveLanguage(appLanguage));

  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const favoriteKey = `aarti-${deitySlug ?? ''}`;
  const isFavorite = favoriteIds.includes(favoriteKey);

  function handleReadAlong() {
    setToastVisible(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), 2500);
  }

  if (!aarti) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
        <View style={styles.notFoundWrap}>
          <Text style={[styles.notFoundText, { color: colors.textMuted }]}>
            {t('aarti.notFound')}
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.notFoundBtn, { borderColor: colors.accent }]}>
            <Text style={[styles.notFoundBtnText, { color: colors.accent }]}>
              {t('common.back') ?? 'Back'}
            </Text>
          </TouchableOpacity>
        </View>
        {!aarti && deitySlug == null && <ActivityIndicator color={colors.accent} />}
      </SafeAreaView>
    );
  }

  const headerGradient: readonly [string, string] = ['#2E2418', colors.base];
  const verses = aartiVerses(aarti, lang);
  const compactTitle = titleFor(aarti, lang);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: '#2E2418' }]} edges={['top', 'bottom']}>

      <LinearGradient colors={headerGradient} style={styles.header}>

        <View style={styles.navRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.navBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={20} color="#F0E6D3" />
          </TouchableOpacity>

          <Animated.View style={[styles.compactTitle, compactTitleAnimatedStyle]}>
            <Text style={styles.compactTitleText} numberOfLines={1}>{compactTitle}</Text>
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

        <Animated.View style={[styles.hero, heroAnimatedStyle]}>
          <DeityAvatar deity={aarti.deity} size={72} />
          <Text style={styles.heroTitleNative}>{aarti.titleHindi}</Text>
          <Text style={styles.heroTitleEn}>{aarti.titleEnglish}</Text>
          <View style={styles.deityBadge}>
            <Text style={[styles.deityBadgeText, { color: colors.accent }]}>
              {t(`deities.${aarti.deity}.displayName`)}
            </Text>
          </View>
        </Animated.View>

      </LinearGradient>

      <LangToggle lang={lang} onChange={setLang} colors={colors} t={t} />

      <Animated.ScrollView
        style={{ backgroundColor: colors.base }}
        contentContainerStyle={[styles.verseScroll, { paddingHorizontal: spacing.screenH }]}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}>
        {verses.map((verse, index) => (
          <Text key={`${lang}-${index}`} style={[styles.verse, { color: colors.textPrimary }]}>
            {verse}
          </Text>
        ))}
        <View style={{ height: 100 }} />
      </Animated.ScrollView>

      <View style={[styles.bottomBar, { backgroundColor: colors.base, borderTopColor: colors.border }]}>
        <TouchableOpacity
          onPress={handleReadAlong}
          activeOpacity={0.85}
          style={[styles.readAlongBtn, { backgroundColor: colors.accent }]}>
          <Ionicons name="book-outline" size={18} color="#FFFFFF" />
          <Text style={styles.readAlongText}>{t('aarti.readAlongMode')}</Text>
        </TouchableOpacity>
      </View>

      {toastVisible && <ComingSoonToast colors={colors} />}

    </SafeAreaView>
  );
}

interface LangToggleProps {
  lang: ContentLang;
  onChange: (next: ContentLang) => void;
  colors: ColorPalette;
  t: (key: string) => string;
}

function LangToggle({ lang, onChange, colors, t }: LangToggleProps) {
  return (
    <View style={[styles.langToggleBar, { backgroundColor: colors.base, borderBottomColor: colors.border }]}>
      <View style={[styles.langToggle, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
        <LangChip
          label={t('langToggle.english')}
          active={lang === 'en'}
          onPress={() => onChange('en')}
          colors={colors}
        />
        <LangChip
          label={t('langToggle.hindi')}
          active={lang === 'hi'}
          onPress={() => onChange('hi')}
          colors={colors}
        />
      </View>
    </View>
  );
}

interface LangChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
  colors: ColorPalette;
}

function LangChip({ label, active, onPress, colors }: LangChipProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[
        styles.langChip,
        active && { backgroundColor: colors.accent },
      ]}>
      <Text
        style={[
          styles.langChipText,
          { color: active ? '#FFFFFF' : colors.textSecondary },
        ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

interface ToastProps {
  colors: ColorPalette;
}

function ComingSoonToast({ colors }: ToastProps) {
  const { t } = useTranslation();
  return (
    <View
      style={[styles.toast, { backgroundColor: colors.surface, borderColor: colors.border }]}
      pointerEvents="none">
      <Text style={styles.toastEmoji}>✨</Text>
      <Text style={[styles.toastText, { color: colors.textPrimary }]}>{t('aarti.comingSoon')}</Text>
      <Text style={[styles.toastSub, { color: colors.textSecondary }]}>
        {t('aarti.comingSoonDesc')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

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

  // Lang toggle
  langToggleBar: {
    paddingHorizontal: spacing.screenH,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  langToggle: {
    flexDirection: 'row',
    borderRadius: 20,
    borderWidth: 1,
    padding: 3,
    gap: 2,
  },
  langChip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 17,
    minWidth: 88,
    alignItems: 'center',
  },
  langChipText: { fontSize: 13, fontFamily: 'Mukta_500Medium' },

  verseScroll: { paddingTop: 24, paddingBottom: 32 },
  verse: {
    fontSize: 17,
    fontFamily: 'Mukta_400Regular',
    textAlign: 'center',
    lineHeight: 30,
    marginBottom: 24,
  },

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

  notFoundWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, paddingHorizontal: 40 },
  notFoundText: { fontSize: 15, fontFamily: 'Mukta_400Regular', textAlign: 'center' },
  notFoundBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5 },
  notFoundBtnText: { fontSize: 14, fontFamily: 'Mukta_500Medium' },
});
