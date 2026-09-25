import { Platform } from 'react-native';
import {
  createInterstitialAd,
  getAdsModule,
  getInterstitialUnitId,
  INTERSTITIAL_MIN_GAP_MS,
  FIRST_SESSION_GRACE_MS,
  type InterstitialPlacement,
} from '@/config/ads';
import { useStore } from '@/store/useStore';
import { getAdsState } from '@/services/adsConsent';

// getAdsModule() is called inside each entry point, never at module scope.
// This file is statically imported by app/_layout.tsx, so a module-level call
// would have put the whole native ad surface straight back onto the cold-start
// path that `@/config/ads` defers it off. The getter is memoized — one
// `require`, ever — so the per-call cost is a null check.

// ─── State ───────────────────────────────────────────────────────────────────

type Interstitial = NonNullable<ReturnType<typeof createInterstitial>>;

// The frequency cap is deliberately global — one interstitial per gap across the
// whole app, not one per placement.
let lastShownTimestamp = 0;

// The loaded ad and the in-flight flag, on the other hand, MUST be keyed by
// placement: each placement is its own ad unit id (see adUnitIds.prod.json), so
// a single global slot let a creative loaded for `contentExit` be shown under
// the `appResume` unit — the impression gets attributed to the wrong unit.
const currentAd: Partial<Record<InterstitialPlacement, Interstitial>> = {};
const isLoading: Partial<Record<InterstitialPlacement, boolean>> = {};

// Always build through createInterstitialAd (src/config/ads.ts), never the
// SDK's InterstitialAd directly: it attaches the platform's request options —
// non-personalised only on iOS, nothing on Android, where the request is the
// bare createForAdRequest(unitId) it always was.
function createInterstitial(placement: InterstitialPlacement) {
  const unitId = getInterstitialUnitId(placement);
  if (!unitId) return null;
  return createInterstitialAd(unitId);
}

// ─── Preload ─────────────────────────────────────────────────────────────────

/** Preload an interstitial so it's ready to show instantly. Call early. */
export function preloadInterstitial(placement: InterstitialPlacement) {
  // The `.loaded` half of this guard is what stops the leak: `isLoading` is
  // cleared in the same handler that stores the ad, so a second preload used to
  // sail through, build another InterstitialAd and overwrite the reference. The
  // orphan is unreclaimable — the library keeps a bound handler on a module
  // singleton emitter and the native SparseArray entry is never removed — so
  // browsing N screens stranded N full-screen creatives.
  // `canRequestAds` is the UMP consent gate (src/services/adsConsent.ts): no
  // interstitial is built, let alone requested, before consent has settled in
  // favour of ads — and none after it is withdrawn.
  const Ads = getAdsModule();
  if (
    Platform.OS === 'web' ||
    !Ads ||
    !getAdsState().canRequestAds ||
    isLoading[placement] ||
    currentAd[placement]?.loaded
  ) {
    return;
  }

  const ad = createInterstitial(placement);
  if (!ad) return;

  isLoading[placement] = true;
  const { AdEventType } = Ads;

  const unsubLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
    currentAd[placement] = ad;
    isLoading[placement] = false;
    unsubLoaded();
  });

  const unsubError = ad.addAdEventListener(AdEventType.ERROR, () => {
    isLoading[placement] = false;
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
  const Ads = getAdsModule();
  if (Platform.OS === 'web' || !Ads || !getAdsState().canRequestAds) return false;

  // First-session grace period: no interstitials in the first N minutes of lifetime usage
  const firstOpen = useStore.getState().firstOpenTimestamp;
  if (firstOpen > 0 && Date.now() - firstOpen < FIRST_SESSION_GRACE_MS) {
    return false;
  }

  // Frequency cap: minimum gap between interstitials
  if (Date.now() - lastShownTimestamp < INTERSTITIAL_MIN_GAP_MS) {
    return false;
  }

  const { AdEventType } = Ads;

  const ready = currentAd[placement];
  if (ready?.loaded) {
    delete currentAd[placement];

    // Re-preload for next time after this one closes
    const unsubClosed = ready.addAdEventListener(AdEventType.CLOSED, () => {
      unsubClosed();
      preloadInterstitial(placement);
    });

    ready.show();
    lastShownTimestamp = Date.now();
    return true;
  }

  // Ad not ready — preload for next time
  preloadInterstitial(placement);
  return false;
}
