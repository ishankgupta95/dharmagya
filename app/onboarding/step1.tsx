import { Image, View, TouchableOpacity, StyleSheet } from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { borderRadius, palette, spacing } from '@/config/theme';
import { Ornament } from '@/components/common/Ornament';
import { MandalaWatermark } from '@/components/common/MandalaWatermark';

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

        <Image
          source={require('../../assets/images/dharmagya_logo.png')}
          style={styles.appIcon}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />

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
        <TouchableOpacity
          onPress={() => router.push('/onboarding/step2')}
          activeOpacity={0.85}
          style={styles.cta}
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.beginJourney')}>
          <Text variant="mono-caps" style={styles.ctaText}>
            {t('onboarding.beginJourney')}
          </Text>
        </TouchableOpacity>
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

  appIcon: {
    width: 180,
    height: 180,
    marginBottom: 8,
  },

  // English on top, Devanagari directly below. Hindi gets a generous
  // lineHeight (~1.6×) so the shirorekha (top bar of letters like ध / र्म /
  // ज्ञ) clears the line box — Noto Serif Devanagari clips above the cap line
  // when lineHeight is tight.
  appName: {
    fontSize: 42,
    lineHeight: 50,
    color: palette.ink,
    marginTop: 4,
    textAlign: 'center',
  },
  appNameHindi: {
    fontSize: 28,
    lineHeight: 46,
    color: palette.inkSoft,
    textAlign: 'center',
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
});
