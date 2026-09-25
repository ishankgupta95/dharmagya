import { createElement, type ReactElement } from 'react';
import { Platform } from 'react-native';
import type { BannerAdProps, InterstitialAd, RequestOptions } from 'react-native-google-mobile-ads';

// ─── Ad Unit IDs ─────────────────────────────────────────────────────────────
// Switch between test and production by changing this single import.
// Use `testAdUnitIds` for closed testing, `prodAdUnitIds` for production.

// import AD_UNITS from '@/data/static/adUnitIds.test.json';
import AD_UNITS from '@/data/static/adUnitIds.prod.json';

// Web never reaches this file: Metro picks `ads.web.ts` there, which returns
// null from every getter and never requires the SDK (the SDK's native view
// specs cannot be bundled for web). Any export added here must be mirrored in
// that shim; its parity type fails `tsc` until it is.

type AdsSdk = typeof import('react-native-google-mobile-ads');

// ─── Request options: the one place ad-request privacy is decided ────────────
// iOS — owner decision (b), 2026-09-23: no App Tracking Transparency prompt,
// non-personalised ads only. Every iOS ad request carries
// `requestNonPersonalizedAdsOnly`, which the native layer turns into the
// `npa=1` extra (RNGoogleMobileAdsCommon.mm). Because the app never asks for
// tracking permission the IDFA reads as zeros, so this is the configuration
// that matches the "no tracking" App Store privacy answer. There is
// deliberately no NSUserTrackingUsageDescription in the plist, which also
// means no AdMob "IDFA explainer" message may be published for the iOS app —
// see docs/release-2.0/privacy-surface.md §D.
//
// Android — `undefined`, so every request is exactly what it was before this
// switch existed: personalisation is whatever the user chose in the UMP
// consent form (src/services/adsConsent.ts).
//
// Frozen and module-level on purpose: BannerAd memoises on the identity of
// its requestOptions prop, and no caller can mutate the shared object.
const AD_REQUEST_OPTIONS: Readonly<RequestOptions> | undefined =
  Platform.OS === 'ios' ? Object.freeze({ requestNonPersonalizedAdsOnly: true }) : undefined;

// SDK exports that build or send an ad request. getAdsModule() hides them from
// its return type, so code that reaches the SDK through this file can request
// an ad only via renderBannerAd() / createInterstitialAd() below, and both
// attach AD_REQUEST_OPTIONS. A new format (rewarded, app-open…) needs a
// constructor here first. `Pick` makes a misspelt name a type error.
//
// Limit: this is a type on getAdsModule(), not a fence around the package. A
// direct value import of 'react-native-google-mobile-ads' anywhere else
// (`import { BannerAd } from …`, `require`, `import()`) type-checks cleanly
// and sends iOS requests WITHOUT the NPA flag. Keep this file the only value
// importer of the SDK; type-only imports are harmless. The eslint rule that
// would enforce it is spelled out in docs/release-2.0/privacy-surface.md §D.1.
type AdRequestExport = keyof Pick<
  AdsSdk,
  | 'BannerAd'
  | 'GAMBannerAd'
  | 'InterstitialAd'
  | 'GAMInterstitialAd'
  | 'RewardedAd'
  | 'RewardedInterstitialAd'
  | 'AppOpenAd'
  | 'NativeAd'
  | 'useInterstitialAd'
  | 'useRewardedAd'
  | 'useRewardedInterstitialAd'
  | 'useAppOpenAd'
>;

/** The SDK minus every ad-request constructor. See AdRequestExport. */
export type AdsModule = Omit<AdsSdk, AdRequestExport>;

/** BannerAd's props minus `requestOptions`, which renderBannerAd owns. */
export type BannerAdRequestProps = Omit<BannerAdProps, 'requestOptions'>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

// The require is deliberately deferred to the first getAdsModule() call rather
// than run at module scope: `react-native-google-mobile-ads` pulls in the whole
// native ad surface, and several call sites import this file only for a unit-id
// helper or a pacing constant. Memoized behind `resolved` so the try/catch runs
// exactly once and the Expo Go fallback (native module absent → ads silently
// disabled) is unchanged.
let sdk: AdsSdk | null = null;
let resolved = false;

function loadSdk(): AdsSdk | null {
  if (!resolved) {
    resolved = true;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      sdk = require('react-native-google-mobile-ads');
    } catch {
      // Native module not available (Expo Go). Ads silently disabled.
    }
  }
  return sdk;
}

/** The ads SDK for consent, initialisation, events and sizes — or null when
 *  the native module is absent. Ad requests go through renderBannerAd() and
 *  createInterstitialAd(), never through this. */
export function getAdsModule(): AdsModule | null {
  return loadSdk();
}

/**
 * The BannerAd element for one slot, carrying this platform's request
 * options. The only sanctioned way to put a banner on screen. On Android no
 * `requestOptions` key is added at all, so the request is unchanged.
 */
export function renderBannerAd(props: BannerAdRequestProps): ReactElement | null {
  const Ads = loadSdk();
  if (!Ads) return null;
  const withOptions: BannerAdProps = AD_REQUEST_OPTIONS
    ? { ...props, requestOptions: AD_REQUEST_OPTIONS }
    : props;
  return createElement(Ads.BannerAd, withOptions);
}

/**
 * An unloaded interstitial for `unitId`, carrying this platform's request
 * options (iOS: non-personalised only; Android: none — identical to the
 * bare `createForAdRequest(unitId)` it replaces). Null without the SDK.
 */
export function createInterstitialAd(unitId: string): InterstitialAd | null {
  const Ads = loadSdk();
  if (!Ads) return null;
  return AD_REQUEST_OPTIONS
    ? Ads.InterstitialAd.createForAdRequest(unitId, AD_REQUEST_OPTIONS)
    : Ads.InterstitialAd.createForAdRequest(unitId);
}

export type BannerPlacement = keyof typeof AD_UNITS.banner;
export type InterstitialPlacement = keyof typeof AD_UNITS.interstitial;

// The iOS slots in adUnitIds.prod.json are still `ca-app-pub-XXXX…` stand-ins.
// A request carrying one of those is not merely a failed load, it is a
// malformed request fired at Google on every mount — so a placeholder resolves
// to '' and every call site takes its existing "no ad" branch instead.
const PLACEHOLDER_MARKER = 'XXXXXXXX';

function resolveUnitId(ids: { android: string; ios: string }): string {
  const id = Platform.select({ android: ids.android, ios: ids.ios }) ?? '';
  return id.includes(PLACEHOLDER_MARKER) ? '' : id;
}

export function getBannerUnitId(placement: BannerPlacement): string {
  if (!loadSdk()) return '';
  return resolveUnitId(AD_UNITS.banner[placement]);
}

export function getInterstitialUnitId(placement: InterstitialPlacement): string {
  if (!loadSdk()) return '';
  return resolveUnitId(AD_UNITS.interstitial[placement]);
}

/**
 * True when at least one banner or interstitial slot resolves to a real unit
 * id on the current platform. A pure read over the JSON — it deliberately does
 * NOT touch getAdsModule(), so callers can decide whether the native module is
 * worth requiring at all. adsConsent.ts uses it to skip the whole UMP + SDK
 * flow where nothing can be served: showing regulated users a consent form for
 * ads that will never appear is pure friction. Today that is iOS, whose slots
 * above are still placeholders; paste the real ids into adUnitIds.prod.json
 * and this flips to true with no code change — consent and ads then switch on
 * with the iOS non-personalised request options above already attached.
 */
export function hasAnyAdUnit(): boolean {
  const slots = [...Object.values(AD_UNITS.banner), ...Object.values(AD_UNITS.interstitial)];
  return slots.some((ids) => resolveUnitId(ids) !== '');
}

// ─── Constants ───────────────────────────────────────────────────────────────
// Single definition lives in `@/config/adTiming`, which has no imports at all —
// re-exported here so callers that already need the native surface keep their
// existing import path, while pacing-only callers can skip this module.

export {
  INTERSTITIAL_MIN_GAP_MS,
  FIRST_SESSION_GRACE_MS,
  APP_RESUME_MIN_BACKGROUND_MS,
} from '@/config/adTiming';
