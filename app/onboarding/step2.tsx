import { View, ScrollView, StyleSheet } from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useStore, type MasaSystem } from '@/store/useStore';
import { borderRadius, spacing } from '@/config/theme';
import { MotionPressable } from '@/components/common/MotionPressable';
import { LANGUAGE_OPTIONS } from '@/i18n';
import { onb, PrimaryCta, ProgressHeader } from '@/components/onboarding/OnboardingChrome';

// Onboarding 3/5 · Language & tradition (Diya) — purnimanta vs amanta is asked
// here rather than buried in settings: it silently changes festival dates, so
// getting it wrong on day one is expensive.
export default function OnboardingStep2() {
  const { t } = useTranslation();
  const { language, setLanguage, masaSystem, setMasaSystem } = useStore();

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* Onboarding always renders on the night ground */}
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH + 4 }]}
        showsVerticalScrollIndicator={false}>
        <ProgressHeader step={3} />

        <Text variant="display" style={styles.title}>
          {t('onboarding.langTitle')}
        </Text>

        {/* ── Show text in ─────────────────────────────────────────────── */}
        <Text variant="kicker" style={styles.sectionKicker}>
          {t('onboarding.showTextIn')}
        </Text>
        <View style={styles.segment}>
          {LANGUAGE_OPTIONS.map((opt) => {
            const isSel = language === opt.key;
            return (
              <MotionPressable
                key={opt.key}
                onPress={() => setLanguage(opt.key)}
                style={[styles.segmentCell, isSel && styles.segmentCellOn]}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSel }}
                accessibilityLabel={opt.label}>
                <Text
                  variant={isSel ? 'button' : 'body'}
                  style={[styles.segmentText, { color: isSel ? '#171220' : 'rgba(237,232,240,0.6)' }]}>
                  {opt.nativeLabel}
                </Text>
              </MotionPressable>
            );
          })}
        </View>

        {/* ── Calendar system ──────────────────────────────────────────── */}
        <Text variant="kicker" style={[styles.sectionKicker, styles.sectionKickerGap]}>
          {t('onboarding.calendarSystem')}
        </Text>
        <View style={styles.radioCard}>
          <MasaRow
            value="purnimanta"
            label={t('panchang.purnimanta')}
            desc={t('onboarding.purnimantaDesc')}
            selected={masaSystem === 'purnimanta'}
            onPress={setMasaSystem}
          />
          <View style={styles.radioDivider} />
          <MasaRow
            value="amanta"
            label={t('panchang.amanta')}
            desc={t('onboarding.amantaDesc')}
            selected={masaSystem === 'amanta'}
            onPress={setMasaSystem}
          />
        </View>
        <Text variant="body" style={styles.note}>
          {t('onboarding.masaNote')}
        </Text>
      </ScrollView>

      <View style={[styles.bottom, { paddingHorizontal: spacing.screenH }]}>
        <PrimaryCta label={t('common.continue')} onPress={() => router.push('/onboarding/step3')} />
      </View>
    </SafeAreaView>
  );
}

interface MasaRowProps {
  value: MasaSystem;
  label: string;
  desc: string;
  selected: boolean;
  onPress: (value: MasaSystem) => void;
}

function MasaRow({ value, label, desc, selected, onPress }: MasaRowProps) {
  return (
    <MotionPressable
      onPress={() => onPress(value)}
      style={styles.radioRow}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}>
      <View style={[styles.radioCircle, { borderColor: selected ? onb.accent : 'rgba(237,232,240,0.25)' }]}>
        {selected && <View style={styles.radioFill} />}
      </View>
      <View style={styles.radioText}>
        <Text variant="title" style={[styles.radioLabel, { color: selected ? onb.text : 'rgba(237,232,240,0.85)' }]}>
          {label}
        </Text>
        <Text variant="body-small" style={styles.radioDesc}>{desc}</Text>
      </View>
    </MotionPressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: onb.base },

  scroll: { paddingTop: 20, paddingBottom: 16 },

  title: { fontSize: 30, lineHeight: 38, color: onb.text },

  sectionKicker: { fontSize: 9.5, color: 'rgba(237,232,240,0.35)', marginTop: 32, marginBottom: 12 },
  sectionKickerGap: { marginTop: 30 },

  // Language segmented control
  segment: {
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 3,
    flexDirection: 'row',
    gap: 3,
  },
  segmentCell: {
    flex: 1,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentCellOn: {
    backgroundColor: 'rgba(237,232,240,0.92)',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  segmentText: { fontSize: 14 },

  // Masa radio card
  radioCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: onb.border,
    borderRadius: borderRadius.list,
    overflow: 'hidden',
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioFill: { width: 11, height: 11, borderRadius: 6, backgroundColor: onb.accent },
  radioText: { flex: 1 },
  radioLabel: { fontSize: 16, lineHeight: 22 },
  radioDesc: { fontSize: 12.5, lineHeight: 18, color: onb.textFaint, marginTop: 2 },
  radioDivider: { height: StyleSheet.hairlineWidth, backgroundColor: onb.divider, marginLeft: 54 },

  note: { fontSize: 13, lineHeight: 21, color: 'rgba(237,232,240,0.35)', marginTop: 14 },

  bottom: { paddingBottom: 10, paddingTop: 8 },
});
