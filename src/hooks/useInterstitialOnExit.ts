import { useEffect } from 'react';
import type { InterstitialPlacement } from '@/config/ads';
import { preloadInterstitial, showInterstitial } from '@/services/interstitialAds';

/**
 * Preloads an interstitial ad on mount and attempts to show it when
 * the component unmounts (user navigating away from content detail).
 */
export function useInterstitialOnExit(placement: InterstitialPlacement = 'contentExit') {
  useEffect(() => {
    preloadInterstitial(placement);
    return () => {
      showInterstitial(placement);
    };
  }, [placement]);
}
