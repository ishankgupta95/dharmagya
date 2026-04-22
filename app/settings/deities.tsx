import { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Icon } from '@/components/common/Icon';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, palette, spacing } from '@/config/theme';
import { DeitySelectionGrid } from '@/components/common/DeitySelectionGrid';
import { ScreenMount } from '@/components/common/ScreenMount';

export default function ManageDeitiesScreen() {
  const { t } = useTranslation();
  const isDarkMode = useStore(s => s.isDarkMode);
  const selectedDeities = useStore(s => s.selectedDeities);
  const setSelectedDeities = useStore(s => s.setSelectedDeities);
  const colors = isDarkMode ? darkColors : lightColors;

  const [local, setLocal] = useState<string[]>(selectedDeities);

  function handleSave() {
    setSelectedDeities(local);
    router.back();
  }

  return (
    <ScreenMount>
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>

      <View style={[styles.headerRow, { paddingHorizontal: spacing.screenH, borderBottomColor: colors.divider }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.back')}>
          <Icon name="chevron-left" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text variant="display-italic" style={[styles.headerTitle, { color: colors.textPrimary }]}>
          {t('settings.manageDeitiesTitle')}
        </Text>
        <View style={styles.backPill} />
      </View>

      <View style={[styles.intro, { paddingHorizontal: spacing.screenH }]}>
        <Text variant="body-italic" style={[styles.introText, { color: colors.textTertiary }]}>
          {t('settings.manageDeitiesDesc')}
        </Text>
      </View>

      <DeitySelectionGrid
        value={local}
        onChange={setLocal}
        colors={colors}
        contentContainerStyle={{ paddingHorizontal: spacing.screenH, paddingBottom: 100 }}
      />

      <View style={[styles.footer, { paddingHorizontal: spacing.screenH, backgroundColor: colors.base, borderTopColor: colors.divider }]}>
        <Text variant="mono-caps" style={[styles.countLabel, { color: colors.textMuted }]}>
          {t('onboarding.selectedCount', { count: local.length })}
        </Text>
        <TouchableOpacity
          onPress={handleSave}
          activeOpacity={0.85}
          style={[styles.saveBtn, { backgroundColor: palette.sindoor }]}
          accessibilityRole="button"
          accessibilityLabel={t('common.save')}>
          <Text variant="mono-caps" style={styles.saveText}>{t('common.save')}</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
    </ScreenMount>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  headerRow: {
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
  headerTitle: { fontSize: 22, flex: 1, textAlign: 'center' },

  intro: { paddingTop: 14, paddingBottom: 14 },
  introText: { fontSize: 14, lineHeight: 20 },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  countLabel: { flex: 1, fontSize: 10 },
  saveBtn: {
    paddingHorizontal: 26,
    paddingVertical: 12,
    borderRadius: borderRadius.button,
  },
  saveText: { fontSize: 11, color: palette.parchmentBright },
});
