import { useMemo, useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
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
import {
  getChalisaForDeity,
  chalisaSections,
  titleFor,
  type ContentLang,
} from '@/services/content';

export default function ChalisaDetailScreen() {
  useInterstitialOnExit();
  const { t } = useTranslation();
  const { id: deitySlug } = useLocalSearchParams<{ id: string }>();
  const isDarkMode = useStore(s => s.isDarkMode);
  const favoriteIds = useStore(s => s.favoriteIds);
  const toggleFavorite = useStore(s => s.toggleFavorite);
  const appLanguage = useStore(s => s.language);
  const colors = isDarkMode ? darkColors : lightColors;

  const chalisa = useMemo(() => (deitySlug ? getChalisaForDeity(deitySlug) : undefined), [deitySlug]);

  const [lang, setLang] = useState<ContentLang>(() => resolveLanguage(appLanguage));

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

  const favoriteKey = `chalisa-${deitySlug ?? ''}`;
  const isFavorite = favoriteIds.includes(favoriteKey);

  if (!chalisa) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
        <View style={styles.notFoundWrap}>
          <Text style={[styles.notFoundText, { color: colors.textMuted }]}>
            {t('chalisa.notFound')}
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.notFoundBtn, { borderColor: colors.accent }]}>
            <Text style={[styles.notFoundBtnText, { color: colors.accent }]}>{t('common.back') ?? 'Back'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const headerGradient: readonly [string, string] = ['#2E2418', colors.base];
  const sections = chalisaSections(chalisa, lang);
  const compactTitle = titleFor(chalisa, lang);

  // Numbered globally across all chaupai sections.
  let globalChaupaiNum = 0;

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
          <DeityAvatar deity={chalisa.deity} size={72} />
          <Text style={styles.heroTitleNative}>{chalisa.titleHindi}</Text>
          <Text style={styles.heroTitleEn}>{chalisa.titleEnglish}</Text>
          <View style={styles.deityBadge}>
            <Text style={[styles.deityBadgeText, { color: colors.accent }]}>
              {t(`deities.${chalisa.deity}.displayName`)}
            </Text>
          </View>
        </Animated.View>

      </LinearGradient>

      <LangToggle lang={lang} onChange={setLang} colors={colors} t={t} />

      <Animated.ScrollView
        style={{ backgroundColor: colors.base }}
        contentContainerStyle={[styles.contentScroll, { paddingHorizontal: spacing.screenH }]}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}>

        {sections.map((section, sectionIndex) => {
          const isChaupai = section.type === 'chaupai';
          return (
            <View key={`${lang}-${sectionIndex}`} style={styles.section}>

              {!isChaupai && (
                <View style={styles.sectionLabelRow}>
                  <View style={[styles.sectionLine, { backgroundColor: colors.divider }]} />
                  <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
                    {section.label}
                  </Text>
                  <View style={[styles.sectionLine, { backgroundColor: colors.divider }]} />
                </View>
              )}

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
        <LangChip label={t('langToggle.english')} active={lang === 'en'} onPress={() => onChange('en')} colors={colors} />
        <LangChip label={t('langToggle.hindi')} active={lang === 'hi'} onPress={() => onChange('hi')} colors={colors} />
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
      style={[styles.langChip, active && { backgroundColor: colors.accent }]}>
      <Text style={[styles.langChipText, { color: active ? '#FFFFFF' : colors.textSecondary }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

interface VerseBlockProps {
  verse: string;
  number: number | null;
  type: 'doha' | 'soratha' | 'chaupai';
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

  contentScroll: { paddingTop: 24, paddingBottom: 32 },

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

  notFoundWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, paddingHorizontal: 40 },
  notFoundText: { fontSize: 15, fontFamily: 'Mukta_400Regular', textAlign: 'center' },
  notFoundBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5 },
  notFoundBtnText: { fontSize: 14, fontFamily: 'Mukta_500Medium' },
});
