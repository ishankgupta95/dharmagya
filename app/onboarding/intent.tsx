import { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Icon, type IconName } from '@/components/common/Icon';

import { useStore, type IntentKey } from '@/store/useStore';
import { borderRadius, spacing } from '@/config/theme';
import { MotionPressable } from '@/components/common/MotionPressable';
import { onb, PrimaryCta, ProgressHeader } from '@/components/onboarding/OnboardingChrome';

const OPTIONS: { key: IntentKey; icon: IconName }[] = [
  { key: 'worship', icon: 'flame' },
  { key: 'panchang', icon: 'calendar' },
  { key: 'kundli', icon: 'compass' },
];

// Onboarding 2/5 · Intent (Diya) — multi-select, not a single choice; most
// people want two of the three. The first pick decides which card leads Today
// (P16.6 keystone: [0] = primary intent). Skippable — nothing selected falls
// back to 'worship'.
export default function OnboardingIntent() {
  const { t } = useTranslation();
  const { primaryIntent, setPrimaryIntent } = useStore();
  const [selected, setSelected] = useState<IntentKey[]>(primaryIntent ?? []);

  function toggle(key: IntentKey) {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function handleContinue() {
    setPrimaryIntent(selected.length > 0 ? selected : (['worship'] as IntentKey[]));
    router.push('/onboarding/step2');
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* Onboarding always renders on the night ground */}
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH + 4 }]}
        showsVerticalScrollIndicator={false}>
        <ProgressHeader step={2} skipTo="/onboarding/step2" />

        <Text variant="display" style={styles.title}>
          {t('onboarding.intentTitle')}
        </Text>
        <Text variant="body" style={styles.subtitle}>
          {t('onboarding.intentSubtitle')}
        </Text>

        <View style={styles.options}>
          {OPTIONS.map((opt) => {
            const isSel = selected.includes(opt.key);
            return (
              <MotionPressable
                key={opt.key}
                pressedScale={0.98}
                onPress={() => toggle(opt.key)}
                style={[
                  styles.option,
                  {
                    backgroundColor: isSel ? onb.accentSoft : onb.surface,
                    borderColor: isSel ? onb.accentBorder : onb.border,
                  },
                ]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSel }}
                accessibilityLabel={t(`onboarding.intent_${opt.key}`)}>
                <View style={[styles.optionIc, { backgroundColor: isSel ? onb.accentIconBg : 'rgba(255,255,255,0.06)' }]}>
                  <Icon name={opt.icon} size={22} color={isSel ? onb.accent : onb.textSoft} />
                </View>
                <Text variant="title" style={[styles.optionLabel, { color: isSel ? onb.text : 'rgba(237,232,240,0.85)' }]}>
                  {t(`onboarding.intent_${opt.key}`)}
                </Text>
                {isSel ? (
                  <View style={styles.checkOn}>
                    <Icon name="check" size={13} color="#171220" />
                  </View>
                ) : (
                  <View style={styles.checkOff} />
                )}
              </MotionPressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.bottom, { paddingHorizontal: spacing.screenH }]}>
        <PrimaryCta label={t('common.continue')} onPress={handleContinue} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: onb.base },

  scroll: { paddingTop: 20, paddingBottom: 16 },

  title: { fontSize: 30, lineHeight: 38, color: onb.text },
  subtitle: { fontSize: 14.5, lineHeight: 23, color: onb.textFaint, marginTop: 14, maxWidth: 300 },

  options: { gap: 11, marginTop: 30 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    paddingVertical: 18,
    paddingHorizontal: 19,
    borderRadius: borderRadius.card,
    borderWidth: 1,
  },
  optionIc: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionLabel: { flex: 1, fontSize: 16, lineHeight: 22 },
  checkOn: {
    width: 23,
    height: 23,
    borderRadius: 12,
    backgroundColor: onb.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOff: {
    width: 23,
    height: 23,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(237,232,240,0.22)',
  },

  bottom: { paddingBottom: 10, paddingTop: 8 },
});
