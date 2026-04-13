import { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useStore } from '@/store/useStore';
import { darkColors, borderRadius, spacing } from '@/config/theme';
import { DeitySelectionGrid } from '@/components/common/DeitySelectionGrid';

const colors = darkColors;

export default function OnboardingStep2() {
  const { t } = useTranslation();
  const { selectedDeities, setSelectedDeities } = useStore();
  const [localSelected, setLocalSelected] = useState<string[]>(selectedDeities);

  function handleContinue() {
    setSelectedDeities(localSelected);
    router.push('/onboarding/step3');
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>

      <View style={[styles.header, { paddingHorizontal: spacing.screenH }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerStep}>{t('onboarding.step2of3')}</Text>
        <View style={{ width: 20 }} />
      </View>

      <View style={{ paddingHorizontal: spacing.screenH }}>
        <Text style={styles.titleHindi}>{t('onboarding.chooseDeitiesHi')}</Text>
        <Text style={styles.title}>{t('onboarding.chooseDeities')}</Text>
        <Text style={styles.subtitle}>
          {t('onboarding.chooseDeitiesDesc')}
        </Text>
      </View>

      <DeitySelectionGrid
        value={localSelected}
        onChange={setLocalSelected}
        colors={colors}
        contentContainerStyle={{ paddingHorizontal: spacing.screenH }}
      />

      {localSelected.length > 0 && (
        <Text style={styles.selectionCount}>
          {t('onboarding.selectedCount', { count: localSelected.length })}
        </Text>
      )}

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
