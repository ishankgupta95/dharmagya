import { View, StyleSheet } from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Svg, { Defs, RadialGradient as SvgRadialGradient, Rect, Stop } from 'react-native-svg';

import { palette, spacing } from '@/config/theme';
import { onb, PrimaryCta } from '@/components/onboarding/OnboardingChrome';

// Onboarding 1/5 · Welcome (Diya) — one glow, one mark, one promise. The
// offline and no-account lines land here because they're the two objections
// people arrive with.
export default function OnboardingStep1() {
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* Onboarding always renders on the night ground */}
      <StatusBar style="light" />
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <SvgRadialGradient id="welcomeGlow" cx="50%" cy="38%" rx="80%" ry="40%">
            <Stop offset="0" stopColor={palette.turmeric} stopOpacity={0.22} />
            <Stop offset="1" stopColor={palette.turmeric} stopOpacity={0} />
          </SvgRadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#welcomeGlow)" />
      </Svg>

      {/* ── Center: the mark ──────────────────────────────────────────── */}
      <View style={styles.content}>
        <View style={styles.omRing}>
          <Text variant="deva" style={styles.omGlyph}>ॐ</Text>
        </View>
        <Text variant="deva-bold" style={styles.appNameHindi}>
          {t('common.appNameHindi')}
        </Text>
        <Text variant="display" style={styles.appName}>
          {t('common.appName').toUpperCase()}
        </Text>
        <Text variant="body" style={styles.body}>
          {t('onboarding.welcomeBody')}
        </Text>
      </View>

      {/* ── Bottom: Begin + the promise ───────────────────────────────── */}
      <View style={styles.bottom}>
        <PrimaryCta label={t('onboarding.begin')} onPress={() => router.push('/onboarding/intent')} />
        <Text variant="body-small" style={styles.promise}>
          {t('onboarding.welcomePromise')}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: onb.base },

  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    marginTop: -30,
  },
  omRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    borderColor: 'rgba(216,163,26,0.35)',
    backgroundColor: 'rgba(216,163,26,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  omGlyph: { fontSize: 44, lineHeight: 64, color: onb.accent },
  appNameHindi: {
    fontSize: 46,
    lineHeight: 66,
    color: onb.text,
    marginTop: 26,
    textAlign: 'center',
  },
  appName: {
    fontSize: 21,
    lineHeight: 28,
    letterSpacing: 3,
    color: onb.textSoft,
    marginTop: 8,
    textAlign: 'center',
  },
  body: {
    fontSize: 16,
    lineHeight: 27,
    color: onb.textSoft,
    textAlign: 'center',
    marginTop: 26,
    maxWidth: 300,
  },

  bottom: {
    paddingHorizontal: spacing.screenH,
    paddingBottom: 10,
    gap: 16,
  },
  promise: {
    fontSize: 12.5,
    lineHeight: 20,
    color: onb.textGhost,
    textAlign: 'center',
  },
});
