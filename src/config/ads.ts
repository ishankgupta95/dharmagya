import { Platform } from 'react-native';

// ─── Ad Unit IDs ─────────────────────────────────────────────────────────────
// Switch between test and production by changing this single import.
// Use `testAdUnitIds` for closed testing, `prodAdUnitIds` for production.

// import AD_UNITS from '@/data/static/adUnitIds.test.json';
import AD_UNITS from '@/data/static/adUnitIds.prod.json';

// ─── Helpers ─────────────────────────────────────────────────────────────────

let AdsModule: typeof import('react-native-google-mobile-ads') | null = null;
try {
  AdsModule = require('react-native-google-mobile-ads');
} catch {
  // Native module not available (Expo Go). Ads silently disabled.
}

export function getAdsModule() {
  return AdsModule;
}

export type BannerPlacement = keyof typeof AD_UNITS.banner;
export type InterstitialPlacement = keyof typeof AD_UNITS.interstitial;

export function getBannerUnitId(placement: BannerPlacement): string {
  if (!AdsModule) return '';
  const ids = AD_UNITS.banner[placement];
  return Platform.select({ android: ids.android, ios: ids.ios }) ?? '';
}

export function getInterstitialUnitId(placement: InterstitialPlacement): string {
  if (!AdsModule) return '';
  const ids = AD_UNITS.interstitial[placement];
  return Platform.select({ android: ids.android, ios: ids.ios }) ?? '';
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Minimum gap between interstitial ads in milliseconds (90 seconds). */
export const INTERSTITIAL_MIN_GAP_MS = 90_000;

/** No interstitials during the first session (first 5 minutes of lifetime usage). */
export const FIRST_SESSION_GRACE_MS = 5 * 60 * 1000;

/** Minimum time app must be in background before showing resume interstitial (60s). */
export const APP_RESUME_MIN_BACKGROUND_MS = 60_000;
