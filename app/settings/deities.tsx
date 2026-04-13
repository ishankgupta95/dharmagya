import { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, spacing } from '@/config/theme';
import { DeitySelectionGrid } from '@/components/common/DeitySelectionGrid';

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
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top']}>

      <View style={[styles.headerRow, { paddingHorizontal: spacing.screenH, borderBottomColor: colors.divider }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          {t('settings.manageDeitiesTitle')}
        </Text>
        <View style={styles.backBtn} />
      </View>

      <View style={[styles.intro, { paddingHorizontal: spacing.screenH }]}>
        <Text style={[styles.introText, { color: colors.textSecondary }]}>
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
        <Text style={[styles.countLabel, { color: colors.textMuted }]}>
          {t('onboarding.selectedCount', { count: local.length })}
        </Text>
        <TouchableOpacity
          onPress={handleSave}
          activeOpacity={0.85}
          style={[styles.saveBtn, { backgroundColor: colors.accent }]}>
          <Text style={styles.saveText}>{t('common.save')}</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 38, height: 38, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontFamily: 'Mukta_500Medium' },

  intro: { paddingTop: 12, paddingBottom: 12 },
  introText: { fontSize: 13, fontFamily: 'Mukta_400Regular', lineHeight: 19 },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  countLabel: { flex: 1, fontSize: 12, fontFamily: 'Mukta_400Regular' },
  saveBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: borderRadius.button,
  },
  saveText: { fontSize: 15, fontFamily: 'Mukta_500Medium', color: '#FFFFFF' },
});
