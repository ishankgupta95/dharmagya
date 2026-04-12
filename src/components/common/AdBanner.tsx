import { useState } from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import type { ColorPalette } from '@/config/theme';
import { getAdsModule, getBannerUnitId } from '@/config/ads';
const AdsModule = getAdsModule();

// ─── Types ───────────────────────────────────────────────────────────────────

type BannerPlacement = 'home' | 'panchangInline' | 'libraryGodsInline' | 'libraryKathasInline' | 'festivals';

interface AdBannerProps {
  colors: ColorPalette;
  /** Which placement this banner represents (for separate tracking). Defaults to 'home'. */
  placement?: BannerPlacement;
  /** If true, renders as an inline card (rounded corners, margin) instead of a sticky bottom bar. */
  inline?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AdBanner({ colors, placement = 'home', inline = false }: AdBannerProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  if (Platform.OS === 'web' || !AdsModule || failed) return null;

  const { BannerAd, BannerAdSize } = AdsModule;
  const unitId = getBannerUnitId(placement);

  if (!unitId) return null;

  return (
    <View
      style={[
        inline ? styles.inlineWrapper : styles.bottomWrapper,
        inline
          ? { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }
          : { borderTopColor: colors.divider },
      ]}>
      <BannerAd
        unitId={unitId}
        size={BannerAdSize.BANNER}
        onAdLoaded={() => setLoaded(true)}
        onAdFailedToLoad={() => setFailed(true)}
      />
      {!loaded && <View style={styles.placeholder} />}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  bottomWrapper: {
    alignItems: 'center',
    paddingVertical: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inlineWrapper: {
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  placeholder: {
    height: 50,
    width: 320,
  },
});
