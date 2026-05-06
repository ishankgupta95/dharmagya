import { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/common/Icon';

import { useStore } from '@/store/useStore';
import { borderRadius, lightColors, palette, spacing } from '@/config/theme';
import { DeitySelectionGrid } from '@/components/common/DeitySelectionGrid';

// Onboarding renders on the parchment ground — the grid component colorises its
// cells from the palette passed in, so we hand it the light palette explicitly.
const colors = lightColors;

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

      <View style={[styles.header, { paddingHorizontal: spacing.screenH, borderBottomColor: colors.divider }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[styles.backPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.back')}>
          <Icon name="chevron-left" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text variant="mono-caps" style={[styles.headerStep, { color: palette.inkQuiet }]}>
          {t('onboarding.step2of3')}
        </Text>
        <View style={[styles.backPill, { borderWidth: 0 }]} />
      </View>

      <View style={[styles.titleBlock, { paddingHorizontal: spacing.screenH }]}>
        <Text variant="display-italic" style={[styles.title, { color: colors.textPrimary }]}>
          {t('onboarding.chooseDeities')}
        </Text>
        <Text variant="body-italic" style={[styles.subtitle, { color: colors.textTertiary }]}>
          {t('onboarding.chooseDeitiesDesc')}
        </Text>
      </View>

      <DeitySelectionGrid
        value={localSelected}
        onChange={setLocalSelected}
        colors={colors}
        contentContainerStyle={{ paddingHorizontal: spacing.screenH, paddingBottom: 16 }}
      />

      {localSelected.length > 0 && (
        <Text variant="mono-caps" style={[styles.selectionCount, { color: palette.sindoor }]}>
          {t('onboarding.selectedCount', { count: localSelected.length })}
        </Text>
      )}

      <View style={[styles.bottom, { paddingHorizontal: spacing.screenH }]}>
        <TouchableOpacity
          onPress={handleContinue}
          activeOpacity={0.85}
          style={styles.cta}
          accessibilityRole="button"
          accessibilityLabel={t('common.continue')}>
          <Text variant="mono-caps" style={styles.ctaText}>{t('common.continue')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleContinue}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('common.skip')}>
          <Text variant="mono-caps" style={[styles.skipText, { color: palette.inkQuiet }]}>
            {t('common.skip')}
          </Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.parchment },

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

  titleBlock: { paddingTop: 16, paddingBottom: 12 },
  title: { fontSize: 30, lineHeight: 36, marginTop: 8 },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 4,
  },

  selectionCount: {
    fontSize: 10,
    textAlign: 'center',
    marginBottom: 8,
  },

  bottom: { gap: 14, paddingBottom: 10, paddingTop: 4, alignItems: 'center' },
  cta: {
    width: '100%',
    backgroundColor: palette.sindoor,
    paddingVertical: 16,
    borderRadius: borderRadius.button,
    alignItems: 'center',
  },
  ctaText: { fontSize: 12, color: palette.parchmentBright },
  skipText: { fontSize: 10, marginBottom: 4 },
});
