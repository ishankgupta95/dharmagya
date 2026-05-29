import { useState } from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import type { ColorPalette } from '@/config/theme';
import { getAdsModule, getBannerUnitId, type BannerPlacement } from '@/config/ads';
const AdsModule = getAdsModule();

// AdMob BANNER is 320×50. We reserve exactly that height on the wrapper so the
// slot doesn't grow before the ad loads — without that minHeight, BannerAd
// would render at 0pt initially and the layout would jump downward when the
// ad arrives. With it, the slot is stable and the ad fades into place.
const BANNER_HEIGHT = 50;

interface AdBannerProps {
  colors: ColorPalette;
  placement?: BannerPlacement;
  /** If true, renders as an inline card (rounded corners, border) instead of a sticky bottom bar. */
  inline?: boolean;
}

export function AdBanner({ colors, placement = 'home', inline = false }: AdBannerProps) {
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
        onAdFailedToLoad={() => setFailed(true)}
      />
    </View>
  );
}

const BOTTOM_PAD = 4;
const INLINE_PAD = 8;

const styles = StyleSheet.create({
  bottomWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: BOTTOM_PAD,
    minHeight: BANNER_HEIGHT + BOTTOM_PAD * 2,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inlineWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: INLINE_PAD,
    minHeight: BANNER_HEIGHT + INLINE_PAD * 2,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
