import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { darkColors, borderRadius, spacing } from '@/config/theme';

const colors = darkColors;

export default function OnboardingStep1() {
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>

      {/* ── Decorative gradient backdrop ────────────────────────────── */}
      <LinearGradient
        colors={['#2E2418', colors.base]}
        style={styles.backdrop}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        pointerEvents="none"
      />

      {/* ── Center content ──────────────────────────────────────────── */}
      <View style={styles.content}>

        {/* Om symbol circle */}
        <LinearGradient
          colors={[colors.accent + '40', colors.accent + '10']}
          style={styles.omCircle}>
          <Text style={styles.omSymbol}>ॐ</Text>
        </LinearGradient>

        <Text style={styles.appName}>{t('common.appName')}</Text>
        <Text style={styles.appNameHindi}>{t('common.appNameHindi')}</Text>
        <Text style={styles.tagline}>{t('onboarding.tagline')}</Text>

      </View>

      {/* ── Bottom ──────────────────────────────────────────────────── */}
      <View style={styles.bottom}>
        <ProgressDots current={1} total={3} />
        <TouchableOpacity
          onPress={() => router.push('/onboarding/step2')}
          activeOpacity={0.85}
          style={styles.cta}>
          <Text style={styles.ctaText}>{t('onboarding.beginJourney')}</Text>
        </TouchableOpacity>
        <Text style={styles.skipHint}>{t('onboarding.takesSeconds')}</Text>
      </View>

    </SafeAreaView>
  );
}

// ─── Progress Dots ────────────────────────────────────────────────────────────

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <View style={dots.row}>
      {Array.from({ length: total }, (_item, index) => (
        <View
          key={index}
          style={[
            dots.dot,
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

const dots = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  dot: { height: 6, width: 6, borderRadius: 3 },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.base },
  backdrop: { ...StyleSheet.absoluteFillObject },

  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.screenH,
  },

  omCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  omSymbol: {
    fontSize: 56,
    color: colors.accent,
    fontFamily: 'Mukta_700Bold',
  },

  appName: {
    fontSize: 36,
    fontFamily: 'Mukta_700Bold',
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  appNameHindi: {
    fontSize: 18,
    fontFamily: 'Mukta_400Regular',
    color: colors.textSecondary,
    marginTop: -6,
  },
  tagline: {
    fontSize: 14,
    fontFamily: 'Mukta_400Regular',
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 22,
  },

  bottom: {
    paddingHorizontal: spacing.screenH,
    paddingBottom: 8,
    gap: 16,
    alignItems: 'center',
  },
  cta: {
    width: '100%',
    backgroundColor: colors.accent,
    paddingVertical: 15,
    borderRadius: borderRadius.button,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 16,
    fontFamily: 'Mukta_500Medium',
    color: '#FFFFFF',
  },
  skipHint: {
    fontSize: 12,
    fontFamily: 'Mukta_400Regular',
    color: colors.textMuted,
    marginBottom: 8,
  },
});
