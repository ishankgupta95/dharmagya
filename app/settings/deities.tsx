import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Icon } from '@/components/common/Icon';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, controlHeight, palette, spacing } from '@/config/theme';
import { DeitySelectionGrid } from '@/components/common/DeitySelectionGrid';
import { ScreenMount } from '@/components/common/ScreenMount';
import { MotionPressable } from '@/components/common/MotionPressable';

/** Ishta-devata picker (frame 32) — portrait grid + one "N selected · Save" pill. */
export default function ManageDeitiesScreen() {
  const { t, i18n } = useTranslation();
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

      <View style={[styles.headerRow, { paddingHorizontal: spacing.screenH }]}>
        <MotionPressable
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.back')}>
          <Icon name="chevron-left" size={22} color={colors.textSecondary} />
        </MotionPressable>
        <Text
          variant={i18n.language === 'hi' ? 'deva-bold' : 'display'}
          style={[styles.headerTitle, { color: colors.textPrimary }]}
          numberOfLines={1}>
          {t('settings.manageDeitiesTitle')}
        </Text>
      </View>

      <Text variant="body-small" style={[styles.introText, { color: colors.textTertiary, paddingHorizontal: spacing.screenH }]}>
        {t('settings.manageDeitiesDesc')}
      </Text>

      <DeitySelectionGrid
        value={local}
        onChange={setLocal}
        colors={colors}
        contentContainerStyle={{ paddingHorizontal: spacing.screenH, paddingTop: 14, paddingBottom: 100 }}
      />

      <View style={[styles.footer, { paddingHorizontal: spacing.screenH }]}>
        <MotionPressable
          onPress={handleSave}
          pressedScale={0.97}
          style={styles.saveBtn}
          accessibilityRole="button"
          accessibilityLabel={t('common.save')}>
          <Text variant="button" style={styles.saveText}>
            {t('onboarding.selectedCount', { count: local.length })} · {t('common.save')}
          </Text>
        </MotionPressable>
      </View>

    </SafeAreaView>
    </ScreenMount>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    paddingTop: 6,
    paddingBottom: 12,
  },
  headerTitle: { flex: 1, fontSize: 27, lineHeight: 36 },

  introText: { fontSize: 13, lineHeight: 19, paddingBottom: 2 },

  footer: {
    paddingTop: 8,
    paddingBottom: 10,
  },
  saveBtn: {
    height: controlHeight.button,
    borderRadius: borderRadius.button,
    backgroundColor: palette.turmeric,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: palette.turmeric,
    shadowOpacity: 0.3,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  saveText: { fontSize: 15, color: palette.night },
});
