import { useState } from 'react';
import { View, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, spacing, type ColorPalette } from '@/config/theme';

type LocationChoice = 'gps' | 'default';

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function OnboardingStep3() {
  const { t } = useTranslation();
  const { isDarkMode, toggleTheme, setHasOnboarded } = useStore();
  const colors = isDarkMode ? darkColors : lightColors;

  const [locationChoice, setLocationChoice] = useState<LocationChoice>('default');

  function handleFinish() {
    setHasOnboarded();
    if (locationChoice === 'gps') {
      // Replace history with tabs first so router.back() from location-permission
      // lands on the main app, not the onboarding flow.
      router.replace('/(tabs)');
      router.push('/location-permission');
    } else {
      router.replace('/(tabs)');
    }
  }

  function handleThemeSelect(dark: boolean) {
    if (dark !== isDarkMode) toggleTheme();
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingHorizontal: spacing.screenH, borderBottomColor: colors.divider }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={[styles.headerStep, { color: colors.textMuted }]}>{t('onboarding.step3of3')}</Text>
        <View style={{ width: 20 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
        showsVerticalScrollIndicator={false}>

        {/* ── Title ─────────────────────────────────────────────────── */}
        <Text style={[styles.titleHindi, { color: colors.textPrimary }]}>{t('onboarding.preferencesHi')}</Text>
        <Text style={[styles.title, { color: colors.textSecondary }]}>{t('onboarding.preferences')}</Text>

        {/* ── Theme Section ─────────────────────────────────────────── */}
        <SectionLabel label={t('settings.appearance')} colors={colors} />
        <View style={styles.themeRow}>
          <ThemeCard
            dark
            isSelected={isDarkMode}
            onPress={() => handleThemeSelect(true)}
          />
          <ThemeCard
            dark={false}
            isSelected={!isDarkMode}
            onPress={() => handleThemeSelect(false)}
          />
        </View>

        {/* ── Location Section ──────────────────────────────────────── */}
        <SectionLabel label={t('settings.location')} colors={colors} />
        <View style={[styles.radioGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>

          <RadioRow
            label={t('onboarding.useGpsLocation')}
            sublabel={t('onboarding.gpsDesc')}
            icon="location-outline"
            selected={locationChoice === 'gps'}
            onPress={() => setLocationChoice('gps')}
            colors={colors}
          />

          <View style={[styles.radioDivider, { backgroundColor: colors.divider }]} />

          <RadioRow
            label={t('onboarding.usePuneDefault')}
            sublabel={t('onboarding.puneDesc')}
            icon="map-outline"
            selected={locationChoice === 'default'}
            onPress={() => setLocationChoice('default')}
            colors={colors}
          />

        </View>

        <View style={{ height: 16 }} />
      </ScrollView>

      {/* ── Bottom ────────────────────────────────────────────────────── */}
      <View style={[styles.bottom, { paddingHorizontal: spacing.screenH, borderTopColor: colors.divider }]}>
        <ProgressDots current={3} total={3} accent={colors.accent} />
        <TouchableOpacity
          onPress={handleFinish}
          activeOpacity={0.85}
          style={[styles.cta, { backgroundColor: colors.accent }]}>
          <Text style={styles.ctaText}>{t('onboarding.startExploring')}</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

// ─── Theme Card ───────────────────────────────────────────────────────────────

interface ThemeCardProps {
  dark: boolean;
  isSelected: boolean;
  onPress: () => void;
}

function ThemeCard({ dark, isSelected, onPress }: ThemeCardProps) {
  const { t } = useTranslation();
  const bg = dark ? '#1A1A1F' : '#FAF6F0';
  const surface = dark ? '#222228' : '#FFFFFF';
  const textPrimary = dark ? '#F0E6D3' : '#2A2218';
  const textMuted = dark ? '#6A6560' : '#9A8A7A';
  const accent = dark ? '#E8893C' : '#C06A20';
  const borderColor = isSelected ? accent : dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[
        styles.themeCard,
        { backgroundColor: bg, borderColor, borderWidth: isSelected ? 2 : 1 },
      ]}>

      {/* Mini UI preview */}
      <View style={[styles.miniCard, { backgroundColor: surface }]}>
        <View style={[styles.miniBar, { backgroundColor: accent, width: '60%' }]} />
        <View style={[styles.miniBar, { backgroundColor: textMuted + '60', width: '80%', height: 4 }]} />
        <View style={[styles.miniBar, { backgroundColor: textMuted + '40', width: '50%', height: 4 }]} />
      </View>

      <Text style={[styles.themeLabel, { color: textPrimary }]}>
        {dark ? `🌙  ${t('onboarding.dark')}` : `☀️  ${t('onboarding.light')}`}
      </Text>

      {isSelected && (
        <View style={[styles.themeCheck, { backgroundColor: accent }]}>
          <Ionicons name="checkmark" size={12} color="#FFFFFF" />
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Radio Row ────────────────────────────────────────────────────────────────

interface RadioRowProps {
  label: string;
  sublabel: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  selected: boolean;
  onPress: () => void;
  colors: ColorPalette;
}

function RadioRow({ label, sublabel, icon, selected, onPress, colors }: RadioRowProps) {
  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={styles.radioRow}>
      <View style={[styles.radioIconWrap, { backgroundColor: colors.surfaceRecessed }]}>
        <Ionicons name={icon} size={17} color={colors.accent} />
      </View>
      <View style={styles.radioText}>
        <Text style={[styles.radioLabel, { color: colors.textPrimary }]}>{label}</Text>
        <Text style={[styles.radioSublabel, { color: colors.textSecondary }]}>{sublabel}</Text>
      </View>
      <View style={[styles.radioCircle, { borderColor: selected ? colors.accent : colors.border }]}>
        {selected && <View style={[styles.radioFill, { backgroundColor: colors.accent }]} />}
      </View>
    </TouchableOpacity>
  );
}

// ─── Section Label ────────────────────────────────────────────────────────────

function SectionLabel({ label, colors }: { label: string; colors: ColorPalette }) {
  return (
    <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{label}</Text>
  );
}

// ─── Progress Dots ────────────────────────────────────────────────────────────

function ProgressDots({ current, total, accent }: { current: number; total: number; accent: string }) {
  return (
    <View style={dotsStyles.row}>
      {Array.from({ length: total }, (_item, index) => (
        <View
          key={index}
          style={[
            dotsStyles.dot,
            index + 1 === current
              ? { backgroundColor: accent, width: 20 }
              : index + 1 < current
              ? { backgroundColor: accent + '60' }
              : { backgroundColor: 'rgba(128,128,128,0.2)' },
          ]}
        />
      ))}
    </View>
  );
}

const dotsStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  dot: { height: 6, width: 6, borderRadius: 3 },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerStep: { fontSize: 13, fontFamily: 'Mukta_400Regular' },

  scroll: { paddingBottom: 16 },

  titleHindi: { fontSize: 26, fontFamily: 'Mukta_700Bold', marginBottom: 4 },
  title: { fontSize: 15, fontFamily: 'Mukta_400Regular', marginBottom: 24 },

  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Mukta_400Regular',
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 4,
    marginTop: 8,
  },

  // Theme cards
  themeRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  themeCard: {
    flex: 1,
    borderRadius: borderRadius.card,
    padding: 14,
    alignItems: 'center',
    gap: 12,
    position: 'relative',
  },
  miniCard: {
    width: '100%',
    borderRadius: 8,
    padding: 10,
    gap: 6,
  },
  miniBar: { height: 6, borderRadius: 3 },
  themeLabel: { fontSize: 14, fontFamily: 'Mukta_500Medium' },
  themeCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Radio group
  radioGroup: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  radioIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioText: { flex: 1 },
  radioLabel: { fontSize: 15, fontFamily: 'Mukta_400Regular' },
  radioSublabel: { fontSize: 12, fontFamily: 'Mukta_400Regular', marginTop: 1 },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioFill: { width: 10, height: 10, borderRadius: 5 },
  radioDivider: { height: StyleSheet.hairlineWidth, marginLeft: 60 },

  // Bottom
  bottom: {
    paddingTop: 14,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 14,
    alignItems: 'center',
  },
  cta: {
    width: '100%',
    paddingVertical: 15,
    borderRadius: borderRadius.button,
    alignItems: 'center',
  },
  ctaText: { fontSize: 16, fontFamily: 'Mukta_500Medium', color: '#FFFFFF' },
});
