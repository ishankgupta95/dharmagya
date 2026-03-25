import { useState } from 'react';
import { View, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useStore } from '@/store/useStore';
import { darkColors, deityColors, borderRadius, spacing } from '@/config/theme';

const colors = darkColors;

// ─── Deity data ───────────────────────────────────────────────────────────────

interface DeityInfo {
  name: string;
  nameHindi: string;
  initial: string;
  color: string;
}

const DEITIES: DeityInfo[] = [
  { name: 'Ganesh',  nameHindi: 'गणेश',   initial: 'ग',  color: deityColors.Ganesh },
  { name: 'Shiva',   nameHindi: 'शिव',     initial: 'श',  color: deityColors.Shiva },
  { name: 'Lakshmi', nameHindi: 'लक्ष्मी', initial: 'ल',  color: deityColors.Lakshmi },
  { name: 'Vishnu',  nameHindi: 'विष्णु',  initial: 'वि', color: deityColors.Vishnu },
  { name: 'Hanuman', nameHindi: 'हनुमान',  initial: 'ह',  color: deityColors.Hanuman },
];

// Layout: rows of 2, last row centered
const ROWS: DeityInfo[][] = [
  [DEITIES[0], DEITIES[1]],
  [DEITIES[2], DEITIES[3]],
  [DEITIES[4]],
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function OnboardingStep2() {
  const { selectedDeities, setSelectedDeities } = useStore();
  const [localSelected, setLocalSelected] = useState<string[]>(selectedDeities);

  function toggleDeity(name: string) {
    setLocalSelected((prev) =>
      prev.includes(name) ? prev.filter((deity) => deity !== name) : [...prev, name]
    );
  }

  function handleContinue() {
    setSelectedDeities(localSelected);
    router.push('/onboarding/step3');
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingHorizontal: spacing.screenH }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerStep}>Step 2 of 3</Text>
        <View style={{ width: 20 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
        showsVerticalScrollIndicator={false}>

        {/* ── Title ─────────────────────────────────────────────────── */}
        <Text style={styles.titleHindi}>अपने देवता चुनें</Text>
        <Text style={styles.title}>Choose Your Deities</Text>
        <Text style={styles.subtitle}>
          We'll highlight aartis and chalisas for the deities you love. You can change this anytime.
        </Text>

        {/* ── Deity Grid ────────────────────────────────────────────── */}
        <View style={styles.grid}>
          {ROWS.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.gridRow}>
              {row.map((deity) => {
                const isSelected = localSelected.includes(deity.name);
                return (
                  <DeityCard
                    key={deity.name}
                    deity={deity}
                    isSelected={isSelected}
                    onPress={() => toggleDeity(deity.name)}
                  />
                );
              })}
            </View>
          ))}
        </View>

        {localSelected.length > 0 && (
          <Text style={styles.selectionCount}>
            {localSelected.length} selected
          </Text>
        )}

      </ScrollView>

      {/* ── Bottom ────────────────────────────────────────────────────── */}
      <View style={[styles.bottom, { paddingHorizontal: spacing.screenH }]}>
        <ProgressDots current={2} total={3} />
        <TouchableOpacity
          onPress={handleContinue}
          activeOpacity={0.85}
          style={styles.cta}>
          <Text style={styles.ctaText}>Continue  →</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleContinue}>
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

// ─── Deity Card ───────────────────────────────────────────────────────────────

interface DeityCardProps {
  deity: DeityInfo;
  isSelected: boolean;
  onPress: () => void;
}

function DeityCard({ deity, isSelected, onPress }: DeityCardProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[
        styles.card,
        { borderColor: isSelected ? deity.color : colors.border },
        isSelected && { backgroundColor: deity.color + '12' },
      ]}>

      {/* Avatar circle */}
      <LinearGradient
        colors={[deity.color + '50', deity.color + '20']}
        style={styles.cardAvatar}>
        <Text style={[styles.cardInitial, { color: deity.color }]}>{deity.initial}</Text>
      </LinearGradient>

      <Text style={[styles.cardNameHindi, { color: colors.textPrimary }]}>{deity.nameHindi}</Text>
      <Text style={[styles.cardName, { color: colors.textSecondary }]}>{deity.name}</Text>

      {/* Selection checkmark */}
      {isSelected && (
        <View style={[styles.checkCircle, { backgroundColor: deity.color }]}>
          <Ionicons name="checkmark" size={12} color="#FFFFFF" />
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Progress Dots ────────────────────────────────────────────────────────────

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <View style={dotsStyles.row}>
      {Array.from({ length: total }, (_item, index) => (
        <View
          key={index}
          style={[
            dotsStyles.dot,
            index + 1 === current
              ? { backgroundColor: colors.accent, width: 20 }
              : index + 1 < current
              ? { backgroundColor: colors.accent + '60' }
              : { backgroundColor: 'rgba(255,255,255,0.15)' },
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

const CARD_GAP = 12;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.base },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerStep: { fontSize: 13, fontFamily: 'Mukta_400Regular', color: colors.textMuted },

  scroll: { paddingBottom: 16 },

  titleHindi: { fontSize: 26, fontFamily: 'Mukta_700Bold', color: colors.textPrimary, marginBottom: 4 },
  title: { fontSize: 15, fontFamily: 'Mukta_400Regular', color: colors.textSecondary, marginBottom: 8 },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Mukta_400Regular',
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: 28,
  },

  grid: { gap: CARD_GAP },
  gridRow: { flexDirection: 'row', gap: CARD_GAP, justifyContent: 'center' },

  // Each card takes ~48% width (2 per row with gap)
  card: {
    width: '48%',
    borderRadius: borderRadius.card,
    borderWidth: 1.5,
    backgroundColor: colors.surface,
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 12,
    gap: 8,
    position: 'relative',
  },
  cardAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInitial: { fontSize: 26, fontFamily: 'Mukta_700Bold' },
  cardNameHindi: { fontSize: 17, fontFamily: 'Mukta_500Medium' },
  cardName: { fontSize: 12, fontFamily: 'Mukta_400Regular' },

  checkCircle: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },

  selectionCount: {
    fontSize: 12,
    fontFamily: 'Mukta_400Regular',
    color: colors.accent,
    textAlign: 'center',
    marginTop: 16,
  },

  bottom: { gap: 14, paddingBottom: 8, alignItems: 'center' },
  cta: {
    width: '100%',
    backgroundColor: colors.accent,
    paddingVertical: 15,
    borderRadius: borderRadius.button,
    alignItems: 'center',
  },
  ctaText: { fontSize: 16, fontFamily: 'Mukta_500Medium', color: '#FFFFFF' },
  skipText: { fontSize: 13, fontFamily: 'Mukta_400Regular', color: colors.textMuted, marginBottom: 8 },
});
