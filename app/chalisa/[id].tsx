import { useMemo, useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Icon } from '@/components/common/Icon';
import { useTranslation } from 'react-i18next';
import Animated, { useSharedValue, useAnimatedScrollHandler, useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, palette, spacing, type ColorPalette } from '@/config/theme';
import { Kicker } from '@/components/common/Kicker';
import { Ornament } from '@/components/common/Ornament';
import { SectionLabel } from '@/components/common/SectionLabel';
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

  const COLLAPSE_END = 140;
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => { scrollY.value = event.contentOffset.y; },
  });

  const heroAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, COLLAPSE_END * 0.6], [1, 0], Extrapolation.CLAMP),
    maxHeight: interpolate(scrollY.value, [0, COLLAPSE_END], [230, 0], Extrapolation.CLAMP),
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
          <Text variant="body-italic" style={[styles.notFoundText, { color: colors.textMuted }]}>
            {t('chalisa.notFound')}
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.notFoundBtn, { borderColor: colors.accent }]}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.back')}>
            <Text variant="mono-caps" style={[styles.notFoundBtnText, { color: colors.accent }]}>
              {t('common.back') ?? 'Back'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const sections = chalisaSections(chalisa, lang);
  const compactTitle = titleFor(chalisa, lang);
  const deityDisplay = t(`deities.${chalisa.deity}.displayName`);
  const kickerText = `${t('reader.chalisaLabel')} · ${deityDisplay}`;

  // Numbered globally across all chaupai sections.
  let globalChaupaiNum = 0;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <View style={[styles.navRow, { borderBottomColor: colors.divider }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.navPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.back')}>
          <Icon name="chevron-left" size={18} color={colors.textSecondary} />
        </TouchableOpacity>

        <Animated.View style={[styles.compactTitle, compactTitleAnimatedStyle]} pointerEvents="none">
          <Text variant="body-italic" style={[styles.compactTitleText, { color: colors.textPrimary }]} numberOfLines={1}>
            {compactTitle}
          </Text>
        </Animated.View>

        <TouchableOpacity
          onPress={() => toggleFavorite(favoriteKey)}
          style={[styles.navPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t(isFavorite ? 'a11y.removeFavorite' : 'a11y.addFavorite')}
          accessibilityState={{ selected: isFavorite }}>
          <Icon
            name={isFavorite ? 'heart' : 'heart-outline'}
            size={16}
            color={isFavorite ? colors.accent : colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      <Animated.ScrollView
        style={{ backgroundColor: colors.base }}
        contentContainerStyle={[styles.bodyScroll, { paddingHorizontal: spacing.screenH }]}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}>

        {/* ── Editorial title block ─────────────────────────────────────────── */}
        <Animated.View style={[styles.heroBlock, heroAnimatedStyle]}>
          <Kicker color={colors.accent} size={10}>{kickerText}</Kicker>
          <Text variant="deva-bold" style={[styles.heroDeva, { color: colors.textPrimary }]}>
            {chalisa.titleHindi.trim()}
          </Text>
          <Text variant="body-italic" style={[styles.heroTranslit, { color: colors.textTertiary }]}>
            {chalisa.titleEnglish.trim()}
          </Text>
          <Ornament variant="lotus" style={styles.heroRule} />
        </Animated.View>

        {/* ── Lang toggle ───────────────────────────────────────────────────── */}
        <LangToggle lang={lang} onChange={setLang} colors={colors} t={t} />

        {/* ── Sections ──────────────────────────────────────────────────────── */}
        {sections.map((section, sectionIndex) => {
          const isChaupai = section.type === 'chaupai';
          return (
            <View key={`${lang}-${sectionIndex}`} style={styles.section}>

              <View style={styles.sectionHeader}>
                <SectionLabel>{section.label}</SectionLabel>
              </View>

              {section.verses.map((verse, verseIndex) => {
                const num = isChaupai ? ++globalChaupaiNum : null;
                return (
                  <VerseBlock
                    key={verseIndex}
                    verse={verse}
                    number={num}
                    type={section.type}
                    lang={lang}
                    colors={colors}
                    t={t}
                  />
                );
              })}

              {sectionIndex < sections.length - 1 && (
                <Ornament
                  variant="diamond"
                  style={styles.sectionBreak}
                  ruleColor={colors.divider}
                />
              )}
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
    <View style={styles.langToggleBar}>
      <View style={[styles.langToggle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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
      style={[styles.langChip, active && { backgroundColor: palette.ink }]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}>
      <Text
        variant="mono-caps"
        style={[styles.langChipText, { color: active ? palette.parchmentBright : colors.textTertiary }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

interface VerseBlockProps {
  verse: string;
  number: number | null;
  type: 'doha' | 'soratha' | 'chaupai';
  lang: ContentLang;
  colors: ColorPalette;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

function VerseBlock({ verse, number, type, lang, colors, t }: VerseBlockProps) {
  const isChaupai = type === 'chaupai';
  const lines = verse.split('\n').filter(l => l.trim().length > 0);

  if (!isChaupai) {
    // Doha / Soratha — centered italic couplet, sindoor-deep for emphasis.
    return (
      <View style={styles.dohaBlock}>
        {lines.map((line, idx) => (
          <Text
            key={idx}
            variant={lang === 'hi' ? 'deva-bold' : 'body-italic'}
            style={[
              styles.dohaText,
              { color: colors.emphasis },
              lang !== 'hi' && styles.dohaTextLatin,
            ]}>
            {line}
          </Text>
        ))}
      </View>
    );
  }

  // Chaupai — numbered verse, Devanāgarī 18.5px or italic body for Latin.
  return (
    <View style={styles.chaupaiBlock}>
      {number !== null && (
        <Kicker
          color={palette.gold}
          size={9}
          withTrailingRule
          ruleColor={colors.divider}
          wrapperStyle={styles.verseKickerRow}>
          {t('reader.verseLabel', { num: String(number) })}
        </Kicker>
      )}
      {lines.map((line, idx) => (
        <Text
          key={idx}
          variant={lang === 'hi' ? 'deva' : 'body-italic'}
          style={[
            lang === 'hi' ? styles.chaupaiDeva : styles.chaupaiTranslit,
            { color: lang === 'hi' ? colors.textPrimary : colors.textSecondary },
          ]}>
          {line}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Header
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.screenH,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactTitle: { flex: 1, alignItems: 'center', marginHorizontal: 12 },
  compactTitleText: {
    fontSize: 15,
    textAlign: 'center',
  },

  bodyScroll: { paddingTop: 20, paddingBottom: 32 },

  // Editorial title block
  heroBlock: {
    alignItems: 'center',
    marginBottom: 18,
  },
  heroDeva: {
    fontSize: 30,
    lineHeight: 38,
    textAlign: 'center',
    marginTop: 10,
  },
  heroTranslit: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 6,
  },
  heroRule: {
    marginTop: 16,
    width: '60%',
  },

  // Lang toggle
  langToggleBar: {
    alignItems: 'center',
    paddingBottom: 22,
  },
  langToggle: {
    flexDirection: 'row',
    borderRadius: 20,
    borderWidth: 1,
    padding: 3,
    gap: 2,
  },
  langChip: {
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 17,
    minWidth: 96,
    alignItems: 'center',
  },
  langChipText: { fontSize: 9.5 },

  // Sections
  section: { marginBottom: 8 },
  sectionHeader: { marginBottom: 14, marginTop: 6 },
  sectionBreak: { marginTop: 14, marginBottom: 4 },

  // Doha / Soratha
  dohaBlock: {
    alignItems: 'center',
    marginBottom: 22,
    paddingHorizontal: 8,
  },
  dohaText: {
    fontSize: 18,
    lineHeight: 28,
    textAlign: 'center',
  },
  dohaTextLatin: {
    fontSize: 16,
    lineHeight: 25,
  },

  // Chaupai
  chaupaiBlock: {
    marginBottom: 22,
  },
  verseKickerRow: {
    marginBottom: 8,
  },
  chaupaiDeva: {
    fontSize: 18.5,
    lineHeight: 29,
    textAlign: 'left',
  },
  chaupaiTranslit: {
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'left',
  },

  // Not-found
  notFoundWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, paddingHorizontal: 40 },
  notFoundText: { fontSize: 15, textAlign: 'center' },
  notFoundBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5 },
  notFoundBtnText: { fontSize: 10 },
});
