import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, spacing } from '@/config/theme';

type LocationChoice = 'gps' | 'default';

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function OnboardingStep3() {
  const { isDarkMode, toggleTheme, setHasOnboarded } = useStore();
  const C = isDarkMode ? darkColors : lightColors;

  const [locationChoice, setLocationChoice] = useState<LocationChoice>('default');

  function handleFinish() {
    setHasOnboarded();
    router.replace('/(tabs)');
  }

  function handleThemeSelect(dark: boolean) {
    if (dark !== isDarkMode) toggleTheme();
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: C.base }]} edges={['top', 'bottom']}>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingHorizontal: spacing.screenH, borderBottomColor: C.divider }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={20} color={C.textSecondary} />
        </TouchableOpacity>
        <Text style={[styles.headerStep, { color: C.textMuted }]}>Step 3 of 3</Text>
        <View style={{ width: 20 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
        showsVerticalScrollIndicator={false}>

        {/* ── Title ─────────────────────────────────────────────────── */}
        <Text style={[styles.titleHindi, { color: C.textPrimary }]}>प्राथमिकताएँ</Text>
        <Text style={[styles.title, { color: C.textSecondary }]}>Set Your Preferences</Text>

        {/* ── Theme Section ─────────────────────────────────────────── */}
        <SectionLabel label="APPEARANCE" colors={C} />
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
        <SectionLabel label="LOCATION" colors={C} />
        <View style={[styles.radioGroup, { backgroundColor: C.surface, borderColor: C.border }]}>

          <RadioRow
            label="Use GPS Location"
            sublabel="Accurate sunrise & Panchang times"
            icon="location-outline"
            selected={locationChoice === 'gps'}
            onPress={() => setLocationChoice('gps')}
            colors={C}
          />

          <View style={[styles.radioDivider, { backgroundColor: C.divider }]} />

          <RadioRow
            label="Use Pune (default)"
            sublabel="No location permission needed"
            icon="map-outline"
            selected={locationChoice === 'default'}
            onPress={() => setLocationChoice('default')}
            colors={C}
          />

        </View>

        <View style={{ height: 16 }} />
      </ScrollView>

      {/* ── Bottom ────────────────────────────────────────────────────── */}
      <View style={[styles.bottom, { paddingHorizontal: spacing.screenH, borderTopColor: C.divider }]}>
        <ProgressDots current={3} total={3} accent={C.accent} />
        <TouchableOpacity
          onPress={handleFinish}
          activeOpacity={0.85}
          style={[styles.cta, { backgroundColor: C.accent }]}>
          <Text style={styles.ctaText}>Start Exploring  🙏</Text>
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
        {dark ? '🌙  Dark' : '☀️  Light'}
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
  colors: typeof darkColors;
}

function RadioRow({ label, sublabel, icon, selected, onPress, colors: C }: RadioRowProps) {
  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={styles.radioRow}>
      <View style={[styles.radioIconWrap, { backgroundColor: C.surfaceRecessed }]}>
        <Ionicons name={icon} size={17} color={C.accent} />
      </View>
      <View style={styles.radioText}>
        <Text style={[styles.radioLabel, { color: C.textPrimary }]}>{label}</Text>
        <Text style={[styles.radioSublabel, { color: C.textSecondary }]}>{sublabel}</Text>
      </View>
      <View style={[styles.radioCircle, { borderColor: selected ? C.accent : C.border }]}>
        {selected && <View style={[styles.radioFill, { backgroundColor: C.accent }]} />}
      </View>
    </TouchableOpacity>
  );
}

// ─── Section Label ────────────────────────────────────────────────────────────

function SectionLabel({ label, colors: C }: { label: string; colors: typeof darkColors }) {
  return (
    <Text style={[styles.sectionLabel, { color: C.textMuted }]}>{label}</Text>
  );
}

// ─── Progress Dots ────────────────────────────────────────────────────────────

function ProgressDots({ current, total, accent }: { current: number; total: number; accent: string }) {
  return (
    <View style={dotsStyles.row}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            dotsStyles.dot,
            i + 1 === current
              ? { backgroundColor: accent, width: 20 }
              : i + 1 < current
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
