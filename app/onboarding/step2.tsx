import { useState } from 'react';
import { View, TouchableOpacity, FlatList, StyleSheet, Dimensions, ListRenderItemInfo } from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useStore } from '@/store/useStore';
import { darkColors, borderRadius, spacing } from '@/config/theme';
import { ALL_DEITIES, type DeityMeta } from '@/config/deities';

const colors = darkColors;

const SCREEN_WIDTH = Dimensions.get('window').width;
const NUM_COLUMNS = 3;
const CARD_GAP = 10;
const CARD_WIDTH = (SCREEN_WIDTH - spacing.screenH * 2 - CARD_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function OnboardingStep2() {
  const { t } = useTranslation();
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

  const renderDeity = ({ item }: ListRenderItemInfo<DeityMeta>) => {
    const isSelected = localSelected.includes(item.name);
    return (
      <DeityCard
        deity={item}
        isSelected={isSelected}
        onPress={() => toggleDeity(item.name)}
      />
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingHorizontal: spacing.screenH }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerStep}>{t('onboarding.step2of3')}</Text>
        <View style={{ width: 20 }} />
      </View>

      {/* ── Title ─────────────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: spacing.screenH }}>
        <Text style={styles.titleHindi}>{t('onboarding.chooseDeitiesHi')}</Text>
        <Text style={styles.title}>{t('onboarding.chooseDeities')}</Text>
        <Text style={styles.subtitle}>
          {t('onboarding.chooseDeitiesDesc')}
        </Text>
      </View>

      {/* ── Deity Grid ────────────────────────────────────────────── */}
      <FlatList
        data={ALL_DEITIES}
        keyExtractor={(item) => item.id}
        renderItem={renderDeity}
        numColumns={NUM_COLUMNS}
        contentContainerStyle={[styles.gridContent, { paddingHorizontal: spacing.screenH }]}
        columnWrapperStyle={styles.gridRow}
        showsVerticalScrollIndicator={false}
      />

      {localSelected.length > 0 && (
        <Text style={styles.selectionCount}>
          {t('onboarding.selectedCount', { count: localSelected.length })}
        </Text>
      )}

      {/* ── Bottom ────────────────────────────────────────────────────── */}
      <View style={[styles.bottom, { paddingHorizontal: spacing.screenH }]}>
        <ProgressDots current={2} total={3} />
        <TouchableOpacity
          onPress={handleContinue}
          activeOpacity={0.85}
          style={styles.cta}>
          <Text style={styles.ctaText}>{t('common.continue')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleContinue}>
          <Text style={styles.skipText}>{t('common.skip')}</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

// ─── Deity Card ───────────────────────────────────────────────────────────────

interface DeityCardProps {
  deity: DeityMeta;
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
        { borderColor: isSelected ? deity.color : colors.border, width: CARD_WIDTH },
        isSelected && { backgroundColor: deity.color + '12' },
      ]}>

      {/* Avatar circle */}
      <LinearGradient
        colors={[deity.color + '50', deity.color + '20']}
        style={styles.cardAvatar}>
        <Text style={[styles.cardInitial, { color: deity.color }]}>{deity.initial}</Text>
      </LinearGradient>

      <Text style={[styles.cardNameHindi, { color: colors.textPrimary }]} numberOfLines={1}>
        {deity.nameHindi}
      </Text>

      {/* Selection checkmark */}
      {isSelected && (
        <View style={[styles.checkCircle, { backgroundColor: deity.color }]}>
          <Ionicons name="checkmark" size={10} color="#FFFFFF" />
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

  titleHindi: { fontSize: 26, fontFamily: 'Mukta_700Bold', color: colors.textPrimary, marginBottom: 4 },
  title: { fontSize: 15, fontFamily: 'Mukta_400Regular', color: colors.textSecondary, marginBottom: 8 },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Mukta_400Regular',
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: 16,
  },

  gridContent: { paddingBottom: 8 },
  gridRow: { gap: CARD_GAP, marginBottom: CARD_GAP },

  card: {
    borderRadius: borderRadius.card,
    borderWidth: 1.5,
    backgroundColor: colors.surface,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 6,
    gap: 4,
    position: 'relative',
  },
  cardAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInitial: { fontSize: 20, fontFamily: 'Mukta_700Bold' },
  cardNameHindi: { fontSize: 13, fontFamily: 'Mukta_500Medium' },

  checkCircle: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },

  selectionCount: {
    fontSize: 12,
    fontFamily: 'Mukta_400Regular',
    color: colors.accent,
    textAlign: 'center',
    marginBottom: 8,
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
