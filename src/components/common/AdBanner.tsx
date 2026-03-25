import { useState } from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import type { ColorPalette } from '@/config/theme';

// Replace these with your real AdMob unit IDs before production release.
const PROD_ANDROID_UNIT_ID = 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX';
const PROD_IOS_UNIT_ID     = 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX';

// Lazy require so the module crash in Expo Go (missing native binary) is caught
// gracefully instead of taking down the whole screen.
let AdsModule: typeof import('react-native-google-mobile-ads') | null = null;
try {
  AdsModule = require('react-native-google-mobile-ads');
} catch {
  // Native module not available (Expo Go). Ads will be silently hidden.
}

function getAdUnitId() {
  if (!AdsModule) return '';
  if (__DEV__) return AdsModule.TestIds.BANNER;
  return Platform.select({ android: PROD_ANDROID_UNIT_ID, ios: PROD_IOS_UNIT_ID })
    ?? AdsModule.TestIds.BANNER;
}

interface AdBannerProps {
  colors: ColorPalette;
}

export function AdBanner({ colors }: AdBannerProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  if (Platform.OS === 'web' || !AdsModule || failed) return null;

  const { BannerAd, BannerAdSize } = AdsModule;

  return (
    <View style={[styles.wrapper, { borderTopColor: colors.divider }]}>
      <BannerAd
        unitId={getAdUnitId()}
        size={BannerAdSize.BANNER}
        onAdLoaded={() => setLoaded(true)}
        onAdFailedToLoad={() => setFailed(true)}
      />
      {!loaded && <View style={styles.placeholder} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    paddingVertical: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  placeholder: {
    height: 50,
    width: 320,
  },
});
