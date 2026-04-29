import { useState } from 'react';
import { View, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Icon, type IconName } from '@/components/common/Icon';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, palette, spacing, type ColorPalette } from '@/config/theme';
import { SectionLabel } from '@/components/common/SectionLabel';
import { ProgressDots } from './_progressDots';

type LocationChoice = 'gps' | 'default';

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function OnboardingStep3() {
  const { t } = useTranslation();
  const { isDarkMode, setThemeMode, setHasOnboarded } = useStore();
  const colors = isDarkMode ? darkColors : lightColors;

  const [locationChoice, setLocationChoice] = useState<LocationChoice>('default');

  function handleFinish() {
    setHasOnboarded();
    // Dismiss all onboarding screens from the stack before navigating,
    // so the user can't swipe back into the onboarding flow.
    router.dismissAll();
    if (locationChoice === 'gps') {
      router.replace('/(tabs)');
      router.push('/location-permission');
    } else {
      router.replace('/(tabs)');
    }
  }

  function handleThemeSelect(dark: boolean) {
    setThemeMode(dark ? 'dark' : 'light');
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingHorizontal: spacing.screenH, borderBottomColor: colors.divider }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[styles.backPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.back')}>
          <Icon name="chevron-left" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text variant="mono-caps" style={[styles.headerStep, { color: colors.textMuted }]}>
          {t('onboarding.step3of3')}
        </Text>
        <View style={styles.backPill} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
        showsVerticalScrollIndicator={false}>

        {/* ── Title ─────────────────────────────────────────────────── */}
        <Text variant="display-italic" style={[styles.title, { color: colors.textPrimary }]}>
          {t('onboarding.preferences')}
        </Text>

        {/* ── Theme Section ─────────────────────────────────────────── */}
        <SectionLabel style={styles.sectionLabelSpacing}>
          {t('settings.appearance')}
        </SectionLabel>
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
        <SectionLabel style={styles.sectionLabelSpacing}>
          {t('settings.location')}
        </SectionLabel>
        <View style={[styles.radioGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>

          <RadioRow
            label={t('onboarding.useGpsLocation')}
            sublabel={t('onboarding.gpsDesc')}
            icon="location"
            selected={locationChoice === 'gps'}
            onPress={() => setLocationChoice('gps')}
            colors={colors}
          />

          <View style={[styles.radioDivider, { backgroundColor: colors.divider }]} />

          <RadioRow
            label={t('onboarding.usePuneDefault')}
            sublabel={t('onboarding.puneDesc')}
            icon="map"
            selected={locationChoice === 'default'}
            onPress={() => setLocationChoice('default')}
            colors={colors}
          />

        </View>

        <View style={{ height: 16 }} />
      </ScrollView>

      {/* ── Bottom ────────────────────────────────────────────────────── */}
      <View style={[styles.bottom, { paddingHorizontal: spacing.screenH, borderTopColor: colors.divider }]}>
        <ProgressDots current={3} total={3} />
        <TouchableOpacity
          onPress={handleFinish}
          activeOpacity={0.85}
          style={[styles.cta, { backgroundColor: palette.sindoor }]}
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.startExploring')}>
          <Text variant="mono-caps" style={styles.ctaText}>
            {t('onboarding.startExploring')}
          </Text>
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
  // Preview chrome colours match the P6 editorial palette — parchment vs.
  // night-plinth so the preview reads as what the user is about to choose.
  const bg = dark ? palette.nightPlinth : palette.parchment;
  const surface = dark ? palette.nightPlinthDeep : palette.parchmentBright;
  const textPrimary = dark ? palette.boneWhite : palette.ink;
  const textMuted = dark ? 'rgba(243,229,200,0.45)' : palette.inkMuted;
  const accent = dark ? palette.goldLeaf : palette.sindoor;
  const borderColor = isSelected ? palette.sindoor : dark ? 'rgba(243,229,200,0.12)' : palette.paperEdge;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[
        styles.themeCard,
        { backgroundColor: bg, borderColor, borderWidth: isSelected ? 2 : 1 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={dark ? t('onboarding.dark') : t('onboarding.light')}
      accessibilityState={{ selected: isSelected }}>

      {/* Mini UI preview */}
      <View style={[styles.miniCard, { backgroundColor: surface }]}>
        <View style={[styles.miniBar, { backgroundColor: accent, width: '60%' }]} />
        <View style={[styles.miniBar, { backgroundColor: textMuted, opacity: 0.6, width: '80%', height: 4 }]} />
        <View style={[styles.miniBar, { backgroundColor: textMuted, opacity: 0.4, width: '50%', height: 4 }]} />
      </View>

      <Text variant="display-italic" style={[styles.themeLabel, { color: textPrimary }]}>
        {dark ? t('onboarding.dark') : t('onboarding.light')}
      </Text>

      {isSelected && (
        <View style={[styles.themeCheck, { backgroundColor: palette.sindoor }]}>
          <Icon name="check" size={12} color={palette.parchmentBright} />
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Radio Row ────────────────────────────────────────────────────────────────

interface RadioRowProps {
  label: string;
  sublabel: string;
  icon: IconName;
  selected: boolean;
  onPress: () => void;
  colors: ColorPalette;
}

function RadioRow({ label, sublabel, icon, selected, onPress, colors }: RadioRowProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={styles.radioRow}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}>
      <View style={[styles.radioIconWrap, { backgroundColor: colors.surfaceRecessed }]}>
        <Icon name={icon} size={16} color={palette.sindoor} />
      </View>
      <View style={styles.radioText}>
        <Text variant="body" style={[styles.radioLabel, { color: colors.textPrimary }]}>{label}</Text>
        <Text variant="body-italic" style={[styles.radioSublabel, { color: colors.textTertiary }]}>{sublabel}</Text>
      </View>
      <View style={[styles.radioCircle, { borderColor: selected ? palette.sindoor : colors.border }]}>
        {selected && <View style={[styles.radioFill, { backgroundColor: palette.sindoor }]} />}
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
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
  headerStep: { fontSize: 10 },

  scroll: { paddingTop: 16, paddingBottom: 16 },

  title: { fontSize: 30, lineHeight: 36, marginTop: 8, marginBottom: 4 },

  sectionLabelSpacing: { marginTop: 24, marginBottom: 12, marginLeft: 2 },

  // Theme cards
  themeRow: { flexDirection: 'row', gap: 12 },
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
  themeLabel: { fontSize: 18, lineHeight: 22 },
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
  radioLabel: { fontSize: 15, lineHeight: 20 },
  radioSublabel: { fontSize: 12, lineHeight: 16, marginTop: 2 },
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
    paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 14,
    alignItems: 'center',
  },
  cta: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: borderRadius.button,
    alignItems: 'center',
  },
  ctaText: { fontSize: 12, color: palette.parchmentBright },
});
