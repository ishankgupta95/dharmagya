// Ads config — web half. Metro picks this file over `ads.ts` when bundling
// for web. `react-native-google-mobile-ads` cannot be bundled there at all
// (its native view specs import react-native's codegenNativeComponent, which
// has no web implementation, so `expo export --platform web` failed), and web
// has no ads anyway. Every getter answers "no SDK / no unit", which every
// call site already treats as "no ad": banners render null, interstitials are
// no-ops and adsConsent settles `ready` with `canRequestAds: false`.
//
// Each export is typed by its native twin (the `import type` is erased at
// build time, so nothing from ads.ts is bundled here), and WebShimParity
// below fails `tsc` if ads.ts ever gains an export this file lacks.

import type * as NativeAds from './ads';

export type AdsModule = NativeAds.AdsModule;
export type BannerAdRequestProps = NativeAds.BannerAdRequestProps;
export type BannerPlacement = NativeAds.BannerPlacement;
export type InterstitialPlacement = NativeAds.InterstitialPlacement;

export const getAdsModule: typeof NativeAds.getAdsModule = () => null;
export const renderBannerAd: typeof NativeAds.renderBannerAd = () => null;
export const createInterstitialAd: typeof NativeAds.createInterstitialAd = () => null;
export const getBannerUnitId: typeof NativeAds.getBannerUnitId = () => '';
export const getInterstitialUnitId: typeof NativeAds.getInterstitialUnitId = () => '';
export const hasAnyAdUnit: typeof NativeAds.hasAnyAdUnit = () => false;

export {
  INTERSTITIAL_MIN_GAP_MS,
  FIRST_SESSION_GRACE_MS,
  APP_RESUME_MIN_BACKGROUND_MS,
} from '@/config/adTiming';

/** Compile-time only. The argument is the set of ads.ts value exports this
 *  file lacks; anything but `never` violates the constraint and fails `tsc`,
 *  naming the missing export. */
type NoMissingExports<Missing extends never> = Missing;
export type WebShimParity = NoMissingExports<
  Exclude<keyof typeof NativeAds, keyof typeof import('./ads.web')>
>;
