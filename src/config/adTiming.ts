// Ad pacing constants, deliberately split out of `@/config/ads`.
//
// `ads.ts` used to do a module-scope `require('react-native-google-mobile-ads')`
// (it is now deferred behind `getAdsModule()`), which pulls ~40 modules and 8
// synchronous `TurboModuleRegistry.getEnforcing` calls into bundle evaluation.
// `app/_layout.tsx` only ever needed the resume threshold, so importing it from
// `ads.ts` dragged the whole native ad surface onto the cold-start path for one
// integer; the split is kept so the pacing constants can never grow an import.
// These three values are plain numbers with no imports — anything that needs
// only pacing imports them from here and never touches the native module.

/** Minimum gap between interstitial ads in milliseconds (90 seconds). */
export const INTERSTITIAL_MIN_GAP_MS = 90_000;

/** No interstitials during the first session (first 5 minutes of lifetime usage). */
export const FIRST_SESSION_GRACE_MS = 5 * 60 * 1000;

/** Minimum time app must be in background before showing resume interstitial (60s). */
export const APP_RESUME_MIN_BACKGROUND_MS = 60_000;
