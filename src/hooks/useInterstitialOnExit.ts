import { useEffect } from 'react';
import { preloadInterstitial, showInterstitial } from '@/services/interstitialAds';

/**
 * Preloads an interstitial ad on mount and attempts to show it when
 * the component unmounts (user navigating away from content detail).
 */
export function useInterstitialOnExit() {
  useEffect(() => {
    preloadInterstitial('contentExit');
    return () => {
      showInterstitial('contentExit');
    };
  }, []);
}
