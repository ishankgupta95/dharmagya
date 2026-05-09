import { Platform } from 'react-native';
import {
  getAdsModule,
  getInterstitialUnitId,
  INTERSTITIAL_MIN_GAP_MS,
  FIRST_SESSION_GRACE_MS,
  type InterstitialPlacement,
} from '@/config/ads';
import { useStore } from '@/store/useStore';

const AdsModule = getAdsModule();

// ─── State ───────────────────────────────────────────────────────────────────

let lastShownTimestamp = 0;
let currentAd: ReturnType<typeof createInterstitial> | null = null;
let isLoading = false;

function createInterstitial(placement: InterstitialPlacement) {
  if (!AdsModule) return null;
  const { InterstitialAd, AdEventType } = AdsModule;
  const unitId = getInterstitialUnitId(placement);
  if (!unitId) return null;
  return InterstitialAd.createForAdRequest(unitId);
}

// ─── Preload ─────────────────────────────────────────────────────────────────

/** Preload an interstitial so it's ready to show instantly. Call early. */
export function preloadInterstitial(placement: InterstitialPlacement) {
  if (Platform.OS === 'web' || !AdsModule || isLoading) return;

  const ad = createInterstitial(placement);
  if (!ad) return;

  isLoading = true;
  const { AdEventType } = AdsModule;

  const unsubLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
    currentAd = ad as any;
    isLoading = false;
    unsubLoaded();
  });

  const unsubError = ad.addAdEventListener(AdEventType.ERROR, () => {
    isLoading = false;
    unsubError();
  });

  ad.load();
}

// ─── Show ────────────────────────────────────────────────────────────────────

/**
 * Attempt to show an interstitial ad.
 * Returns false if the ad was suppressed (frequency cap, first-session grace, etc.).
 */
export function showInterstitial(placement: InterstitialPlacement): boolean {
  if (Platform.OS === 'web' || !AdsModule) return false;

  // First-session grace period: no interstitials in the first N minutes of lifetime usage
  const firstOpen = useStore.getState().firstOpenTimestamp;
  if (firstOpen > 0 && Date.now() - firstOpen < FIRST_SESSION_GRACE_MS) {
    return false;
  }

  // Frequency cap: minimum gap between interstitials
  if (Date.now() - lastShownTimestamp < INTERSTITIAL_MIN_GAP_MS) {
    return false;
  }

  const { AdEventType } = AdsModule;

  if (currentAd && (currentAd as any).loaded) {
    const ad = currentAd;
    currentAd = null;

    // Re-preload for next time after this one closes
    const unsubClosed = (ad as any).addAdEventListener(AdEventType.CLOSED, () => {
      unsubClosed();
      preloadInterstitial(placement);
    });

    (ad as any).show();
    lastShownTimestamp = Date.now();
    return true;
  }

  // Ad not ready — preload for next time
  preloadInterstitial(placement);
  return false;
}
