import { useState } from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { useIsFocused } from 'expo-router';
import type { ColorPalette } from '@/config/theme';
import { getAdsModule, getBannerUnitId, renderBannerAd, type BannerPlacement } from '@/config/ads';
import { useAdsReady } from '@/services/adsConsent';
import { TabBarClearance } from '@/components/common/TabBarClearance';

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
  /**
   * The sticky bottom bar is pinned below a NativeTabs tab screen's ScrollView.
   * On iOS the tab bar floats over the screen, so the bar is lifted clear of
   * it (TabBarClearance); a no-op on Android and for inline cards. Only applied
   * while the banner actually renders, so an empty slot adds no padding.
   */
  aboveTabBar?: boolean;
}

export function AdBanner({ colors, placement = 'home', inline = false, aboveTabBar = false }: AdBannerProps) {
  const [failed, setFailed] = useState(false);

  // NativeTabs has no lazy gate — it calls contentRenderer() for every tab, so
  // without this every tab screen (plus anything already in the stack) would
  // inflate a native ad view and fire a request at launch when only one slot is
  // actually on screen. The latch is deliberately ONE-WAY: gating on the raw
  // `isFocused` would unmount the BannerAd on every tab switch and re-request an
  // ad on every return, which is worse — unbounded requests and a wrecked fill
  // rate. Once a slot has been seen, its ad stays mounted for the session.
  const isFocused = useIsFocused();
  const [everFocused, setEverFocused] = useState(isFocused);
  if (isFocused && !everFocused) setEverFocused(true);

  // Consent gate (src/services/adsConsent.ts). Until initAds() has settled the
  // reserved slot below is still rendered, just without the BannerAd, so the
  // layout doesn't jump when consent resolves and the ad arrives. Once it has
  // settled `ready` with no permission to request ads — consent declined or
  // later withdrawn — the slot is permanently unavailable for this session and
  // collapses, exactly as a failed load does. `failed` (UMP unreachable with
  // no stored decision) collapses it too, but is re-attempted on the next
  // foreground; if that succeeds the slot simply re-renders with its ad.
  const { status, canRequestAds } = useAdsReady();
  const adsUnavailable = status === 'failed' || (status === 'ready' && !canRequestAds);

  // Resolved here, not at module scope: this component is imported by ~30
  // screens, and a module-level call would evaluate the native ad surface the
  // moment the first of them is bundled in. The getter is memoized, so after
  // the first call this is a null check.
  const Ads = getAdsModule();

  if (Platform.OS === 'web' || !Ads || failed || adsUnavailable) return null;

  const { BannerAdSize } = Ads;
  const unitId = getBannerUnitId(placement);

  if (!unitId) return null;

  const slot = (
    <View
      style={[
        inline ? styles.inlineWrapper : styles.bottomWrapper,
        inline
          ? { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }
          : { borderTopColor: colors.divider },
      ]}>
      {/* Mount banners only through renderBannerAd (src/config/ads.ts),
          never the SDK's BannerAd directly: it attaches the platform's
          request options, which on iOS means non-personalised ads only.
          Android's request is unchanged. */}
      {everFocused &&
        canRequestAds &&
        renderBannerAd({
          unitId,
          size: BannerAdSize.BANNER,
          onAdFailedToLoad: () => setFailed(true),
        })}
    </View>
  );

  return aboveTabBar && !inline ? <TabBarClearance>{slot}</TabBarClearance> : slot;
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
