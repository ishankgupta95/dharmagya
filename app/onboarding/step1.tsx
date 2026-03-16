import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { darkColors, borderRadius, spacing } from '@/config/theme';

const C = darkColors;

export default function OnboardingStep1() {
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>

      {/* ── Decorative gradient backdrop ────────────────────────────── */}
      <LinearGradient
        colors={['#2E2418', C.base]}
        style={styles.backdrop}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        pointerEvents="none"
      />

      {/* ── Center content ──────────────────────────────────────────── */}
      <View style={styles.content}>

        {/* Om symbol circle */}
        <LinearGradient
          colors={[C.accent + '40', C.accent + '10']}
          style={styles.omCircle}>
          <Text style={styles.omSymbol}>ॐ</Text>
        </LinearGradient>

        <Text style={styles.appName}>dharmSetu</Text>
        <Text style={styles.appNameHindi}>धर्म सेतु</Text>
        <Text style={styles.tagline}>Your daily bridge to the divine</Text>

      </View>

      {/* ── Bottom ──────────────────────────────────────────────────── */}
      <View style={styles.bottom}>
        <ProgressDots current={1} total={3} />
        <TouchableOpacity
          onPress={() => router.push('/onboarding/step2')}
          activeOpacity={0.85}
          style={styles.cta}>
          <Text style={styles.ctaText}>Begin Journey  →</Text>
        </TouchableOpacity>
        <Text style={styles.skipHint}>Takes just 30 seconds</Text>
      </View>

    </SafeAreaView>
  );
}

// ─── Progress Dots ────────────────────────────────────────────────────────────

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <View style={dots.row}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            dots.dot,
            i + 1 === current
              ? { backgroundColor: C.accent, width: 20 }
              : i + 1 < current
              ? { backgroundColor: C.accent + '60' }
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
  root: { flex: 1, backgroundColor: C.base },
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
    color: C.accent,
    fontFamily: 'Mukta_700Bold',
  },

  appName: {
    fontSize: 36,
    fontFamily: 'Mukta_700Bold',
    color: C.textPrimary,
    letterSpacing: 0.5,
  },
  appNameHindi: {
    fontSize: 18,
    fontFamily: 'Mukta_400Regular',
    color: C.textSecondary,
    marginTop: -6,
  },
  tagline: {
    fontSize: 14,
    fontFamily: 'Mukta_400Regular',
    color: C.textMuted,
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
    backgroundColor: C.accent,
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
    color: C.textMuted,
    marginBottom: 8,
  },
});
