import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { borderRadius, palette, spacing } from '@/config/theme';
import { Ornament } from '@/components/common/Ornament';
import { MandalaWatermark } from '@/components/common/MandalaWatermark';
import { ProgressDots } from './_progressDots';

export default function OnboardingStep1() {
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>

      {/* Subtle watermark mandala behind the hero — editorial tone */}
      <View style={styles.watermarkWrap} pointerEvents="none">
        <MandalaWatermark
          size={460}
          color={palette.goldLeaf}
          opacity={0.07}
          position="center"
        />
      </View>

      {/* ── Center content ──────────────────────────────────────────── */}
      <View style={styles.content}>

        {/* Double-ring plinth with ॐ — editorial take on the old Om circle */}
        <View style={styles.omPlinth}>
          <View style={styles.omGoldRing}>
            <View style={styles.omParchmentRing}>
              <Text variant="deva-bold" style={styles.omSymbol}>ॐ</Text>
            </View>
          </View>
        </View>

        <Text variant="display-italic" style={styles.appName}>
          {t('common.appName')}
        </Text>
        <Text variant="deva-bold" style={styles.appNameHindi}>
          {t('common.appNameHindi')}
        </Text>

        <Ornament variant="lotus" style={styles.ornament} />

        <Text variant="body-italic" style={styles.tagline}>
          {t('onboarding.tagline')}
        </Text>

      </View>

      {/* ── Bottom ──────────────────────────────────────────────────── */}
      <View style={styles.bottom}>
        <ProgressDots current={1} total={3} />
        <TouchableOpacity
          onPress={() => router.push('/onboarding/step2')}
          activeOpacity={0.85}
          style={styles.cta}>
          <Text variant="mono-caps" style={styles.ctaText}>
            {t('onboarding.beginJourney')}
          </Text>
        </TouchableOpacity>
        <Text variant="body-italic" style={styles.skipHint}>
          {t('onboarding.takesSeconds')}
        </Text>
      </View>

    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.parchment },
  watermarkWrap: { ...StyleSheet.absoluteFillObject },

  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.screenH,
  },

  // ॐ plinth (double ring)
  omPlinth: { marginBottom: 16 },
  omGoldRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: palette.rule,
    padding: 1.5,
  },
  omParchmentRing: {
    flex: 1,
    borderRadius: 68,
    backgroundColor: palette.parchmentBright,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: palette.parchmentBright,
  },
  omSymbol: {
    fontSize: 74,
    lineHeight: 88,
    color: palette.sindoor,
  },

  // Text block
  appName: {
    fontSize: 42,
    lineHeight: 48,
    color: palette.ink,
    marginTop: 4,
    textAlign: 'center',
  },
  appNameHindi: {
    fontSize: 22,
    lineHeight: 30,
    color: palette.inkSoft,
    marginTop: -4,
  },
  ornament: {
    width: 140,
    marginTop: 12,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 15,
    color: palette.inkQuiet,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 12,
  },

  bottom: {
    paddingHorizontal: spacing.screenH,
    paddingBottom: 8,
    gap: 16,
    alignItems: 'center',
  },
  cta: {
    width: '100%',
    backgroundColor: palette.sindoor,
    paddingVertical: 16,
    borderRadius: borderRadius.button,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 12,
    color: palette.parchmentBright,
  },
  skipHint: {
    fontSize: 12,
    color: palette.inkMuted,
    marginBottom: 8,
  },
});
