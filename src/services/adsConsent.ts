import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import type { AdsConsentInfo } from 'react-native-google-mobile-ads';
import { getAdsModule, hasAnyAdUnit } from '@/config/ads';

// ─── Consent + SDK-init gate ─────────────────────────────────────────────────
// Google UMP (User Messaging Platform) consent first, Mobile Ads SDK
// initialisation second, gated on the answer. Every ad surface — AdBanner and
// the two interstitial placements — reads `canRequestAds` from here before it
// touches the native SDK, so no request is ever made ahead of, or against, the
// user's consent. The privacy policy promises exactly this: a Google-certified
// consent message that can be revisited later (see showAdPrivacyOptions).
//
// Module-level state on purpose, not zustand: this is process-lifetime truth
// that plain functions (interstitialAds.ts) need to read synchronously, and it
// must NOT be persisted by us — the UMP SDK owns the stored consent record and
// re-reads it on every launch. The only import from
// react-native-google-mobile-ads is a type; the native module is resolved
// lazily via getAdsModule(), so importing this file costs nothing at cold start.

export type AdsInitStatus = 'idle' | 'gathering' | 'ready' | 'failed';

export interface AdsState {
  /** `idle` → `gathering` → `ready` | `failed`. `failed` means UMP could not
   *  gather consent AND holds no decision to fall back on (no stored record,
   *  or a record whose status is still UNKNOWN). It is the one status that is
   *  re-attempted: by the next initAds() call, which app/(tabs)/_layout.tsx
   *  makes on every foreground. `ready` is final for the session. */
  status: AdsInitStatus;
  /** True only once consent (or its non-applicability outside regulated
   *  regions) allows ad requests AND the Mobile Ads SDK has been initialised. */
  canRequestAds: boolean;
  /** True when UMP requires that the user can revisit their choices; the
   *  "Ad privacy options" Settings row is rendered only then. */
  privacyOptionsRequired: boolean;
}

type AdsModuleType = NonNullable<ReturnType<typeof getAdsModule>>;

let state: AdsState = { status: 'idle', canRequestAds: false, privacyOptionsRequired: false };
const listeners = new Set<() => void>();

function setState(patch: Partial<AdsState>) {
  state = { ...state, ...patch };
  listeners.forEach((notify) => notify());
}

/** Synchronous read for non-React callers (interstitialAds.ts). Returns the
 *  cached object — never a fresh one — so it doubles as the
 *  useSyncExternalStore snapshot without tripping the identity check. */
export function getAdsState(): AdsState {
  return state;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** React view of the gate. useSyncExternalStore keeps it React-Compiler safe:
 *  no ref reads during render, no setState inside an effect. */
export function useAdsReady(): AdsState {
  return useSyncExternalStore(subscribe, getAdsState, getAdsState);
}

// ─── SDK initialisation (exactly once) ───────────────────────────────────────

let sdkInit: Promise<void> | null = null;

function ensureSdkInitialized(Ads: AdsModuleType): Promise<void> {
  if (!sdkInit) {
    sdkInit = (async () => {
      const mobileAds = Ads.MobileAds();
      await mobileAds.setRequestConfiguration({
        maxAdContentRating: Ads.MaxAdContentRating.PG,
        tagForChildDirectedTreatment: false,
        tagForUnderAgeOfConsent: false,
      });
      await mobileAds.initialize();
    })().catch(() => {
      // initialize() rejecting is not a consent problem: the SDK also
      // self-initialises on the first ad request, and consent already
      // permits one. Swallow so the gate still opens.
    });
  }
  return sdkInit;
}

async function applyConsent(Ads: AdsModuleType, info: AdsConsentInfo): Promise<void> {
  const privacyOptionsRequired =
    info.privacyOptionsRequirementStatus === Ads.AdsConsentPrivacyOptionsRequirementStatus.REQUIRED;
  if (info.canRequestAds) await ensureSdkInitialized(Ads);
  setState({ status: 'ready', canRequestAds: info.canRequestAds, privacyOptionsRequired });
}

// ─── Entry points ────────────────────────────────────────────────────────────

let initRun: Promise<void> | null = null;

/**
 * Gather UMP consent, then initialise the Mobile Ads SDK if consent allows ad
 * requests. Idempotent: concurrent and repeat callers share one run; only a
 * run that ended `failed` is re-attempted by a later call. Never rejects.
 *
 * Kicked from app/(tabs)/_layout.tsx once onboarding is complete, so the
 * consent form (which gatherConsent shows only where regulation requires it —
 * a no-op outside the EEA / UK / CH and regulated US states) can never
 * interrupt onboarding. The same layout calls it again on every foreground
 * while the gate reads `failed`, which is how an offline first launch picks
 * up consent once the device is back online.
 */
export function initAds(): Promise<void> {
  if (initRun && state.status !== 'failed') return initRun;
  initRun = runInit();
  return initRun;
}

async function runInit(): Promise<void> {
  // The unit-id check goes first because it is a pure read over the JSON:
  // where it fails, the native module is never even required.
  const Ads = Platform.OS !== 'web' && hasAnyAdUnit() ? getAdsModule() : null;
  if (!Ads) {
    // Three cases, one answer. Web and Expo Go have no native SDK. A platform
    // whose adUnitIds.prod.json slots are all placeholders — iOS today — has
    // nothing to serve, and running UMP there would present regulated users a
    // GDPR / US-state consent form for ads that can never appear. Settle on a
    // permanent "no ads" answer so banners collapse instead of holding an
    // empty slot forever. The iOS case self-resolves the moment real ids are
    // pasted into the JSON: hasAnyAdUnit() flips to true, no code change, and
    // every iOS request already carries the non-personalised flag.
    setState({ status: 'ready', canRequestAds: false, privacyOptionsRequired: false });
    return;
  }

  setState({ status: 'gathering' });

  // ── iOS App Tracking Transparency: decided (b), 2026-09-23 ───────────────
  // No ATT prompt; iOS serves non-personalised ads only. Nothing runs here:
  // the NPA flag is a per-request option, and it is attached centrally in
  // src/config/ads.ts (renderBannerAd / createInterstitialAd are the only
  // ways to request an ad). Android requests are untouched and stay
  // UMP-driven. The app ships no NSUserTrackingUsageDescription, so the
  // AdMob console must NOT publish an "IDFA explainer" / ATT message for the
  // iOS app: gatherConsent() below would then call the ATT API, and iOS
  // terminates an app that does so without that plist key. Switching to
  // (a) later = that console message + the plugin's
  // `userTrackingUsageDescription` + dropping the NPA flag in ads.ts.
  // ─────────────────────────────────────────────────────────────────────────

  let info: AdsConsentInfo | null = null;
  try {
    // Requests a consent-info update and presents the form only when it is
    // required for this user; resolves immediately everywhere else.
    info = await Ads.AdsConsent.gatherConsent();
  } catch {
    // Offline, or the UMP servers were unreachable. A previous session's
    // consent may still allow ads, so fall back to the stored record.
    try {
      info = await Ads.AdsConsent.getConsentInfo();
    } catch {
      info = null;
    }
  }

  // A record with status UNKNOWN and no permission to request ads is not a
  // decision, it is the absence of one. On Android getConsentInfo() never
  // rejects — it hands back whatever the SDK holds, and on a device that has
  // never completed a consent-info update (offline first launch, captive
  // portal, UMP unreachable) that is exactly this shape. Settling `ready` on
  // it would silence ads for the whole session; `failed` is retryable.
  if (!info || (!info.canRequestAds && info.status === Ads.AdsConsentStatus.UNKNOWN)) {
    setState({ status: 'failed', canRequestAds: false });
    return;
  }
  await applyConsent(Ads, info);
}

/**
 * Present UMP's privacy-options form so the user can review or withdraw the
 * consent they gave. Only meaningful when `privacyOptionsRequired` is true —
 * the Settings row that calls this is rendered only then. State is refreshed
 * afterwards either way, so a withdrawal unmounts every banner and silences
 * the interstitials immediately. Never rejects.
 */
export async function showAdPrivacyOptions(): Promise<void> {
  const Ads = getAdsModule();
  if (Platform.OS === 'web' || !Ads) return;

  let info: AdsConsentInfo | null = null;
  try {
    info = await Ads.AdsConsent.showPrivacyOptionsForm();
  } catch {
    // Form failed to load or present; re-read the stored record so state
    // still mirrors whatever the SDK holds.
    try {
      info = await Ads.AdsConsent.getConsentInfo();
    } catch {
      info = null;
    }
  }
  if (info) await applyConsent(Ads, info);
}
