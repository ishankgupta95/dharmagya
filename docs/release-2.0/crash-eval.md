> **Status (2026-09-23):** not installed; waiting on the owner. Measured install cost of @sentry/react-native 8.27.0: about +1.5–2.3 MB arm64 APK, +2–4 MB IPA, +0.5–0.9 MB gzipped JS (12–22% of the bundle).

## Scope and method

Read-only. No installs, no file edits, no git mutations were performed. Findings come from: `npm view` against the live registry (exact versions/metadata below were pulled directly, not from memory), `WebSearch`/`WebFetch` against docs.sentry.io, docs.bugsnag.com, firebase.google.com, GitHub, and a read of this repo's `app/_layout.tsx`, `app.json`, `package.json`, `eas.json`, `metro.config.js`, `src/config/ads.ts`. Repo state: Expo `~57.0.24`, RN `0.86.3`, React `19.2.3`, expo-router `~57.0.22`, New Architecture is the *only* architecture on RN 0.86 (old arch was removed in 0.82), no `metro.config.js` customization beyond `getDefaultConfig`, no `babel.config.js` (React Compiler on via `app.json` experiments).

Where I could not get an authoritative number (mainly precise native-size byte counts), I say so explicitly rather than inventing precision — see "What I could not verify" at the end.

## Candidates compared

| | `@sentry/react-native` | `@react-native-firebase/crashlytics` | `@bugsnag/react-native` |
|---|---|---|---|
| Latest npm version (checked live) | **8.27.0** | **26.4.0** (requires `@react-native-firebase/app@26.4.0` peer, exact-pinned) | **8.10.0** |
| New Architecture / Fabric-TurboModules | README lists "RN New Architecture support" as a feature; min RN `>=0.65.0`. No RN‑0.86‑specific note found. | Per an official maintainer discussion, only the Cloud Functions package has moved to TurboModules so far; the SDK is stated to work with New Arch RN but the native module itself is still interop-layer, not a native Fabric/TurboModule. No RN 0.86-specific breakage reported in my search. | A "Support New Architecture (TurboModules/Fabric)" GitHub issue is marked **released**, but I could not pin the exact version/date it shipped in. |
| Android ANR detection | Enabled **by default**, no extra config. | Enabled **by default** ("Crashlytics captures ANRs automatically"); Crashlytics-side ANR display is limited to devices on **Android 11+**. | Enabled **by default** at a ~5s main-thread-block threshold. |
| iOS app-hang detection | Enabled **by default**, `enableAppHangTracking` (default `true`) + `appHangTimeoutInterval` (default 2s) are configurable; pause/resume APIs since 8.13.0. | **Not supported.** Crashlytics for Apple platforms only reports crashes and non-fatals; app hangs remain an open Firebase feature request (issue #6975), not shipped. | Supported — reported as an app hang/freeze once the main thread blocks long enough (docs cite ~10s before the OS watchdog would kill it; Bugsnag's own threshold is configurable and lower). |
| Config plugin + `expo prebuild` | Yes — `@sentry/react-native/expo` ships as the config plugin (also importable as the bare package name); confirmed app.json shape below. | Yes — `@react-native-firebase/app`'s own Expo config plugin handles `google-services.json`/`GoogleService-Info.plist` injection; `crashlytics` itself needs no separate plugin beyond that. | Partial — `npx bugsnag-expo-cli init` wires `app.json` and installs **EAS build hooks** for release/source-map reporting; for anything beyond the standard flow (bare workflow, custom native code) Bugsnag's own docs say to fall back to the plain React Native guide, implying the Expo path is thinner/less battle-tested than Sentry's. |
| Source-map upload on EAS Build | **Automatic** — the config plugin wires an EAS Build hook that uploads source maps as part of the native build; you provide `SENTRY_AUTH_TOKEN`. | Symbol/mapping upload is handled by the Crashlytics Gradle plugin (Android) and an Xcode run-script phase (iOS) added by the native config plugin — no separate token needed, but it does need `google-services.json` / `GoogleService-Info.plist` present, which this repo does not currently have. | **Automatic for `eas build`** via the installed build hook. Explicitly **not automatic for EAS Update** — that path needs a manual `bugsnag-cli` upload keyed by `codeBundleId`. |
| Unpacked npm package size (`npm view … dist.unpackedSize`, not what Metro ships) | 8.9 MB — but this includes `@sentry/cli` (a native build-time binary) and `@sentry/bundler-plugins`, neither of which ends up in the RN JS bundle. | 268 KB for `crashlytics` itself + 1.5 MB for the required `@react-native-firebase/app` peer = **~1.8 MB** unpacked JS/TS source. | 16.7 MB unpacked, dominated by `@bugsnag/delivery-react-native` and several plugin packages; again not representative of what Metro tree-shakes into the bundle. |
| Estimated JS bundle delta (Metro, minified) | Sentry's own team has publicly discussed the JS SDK core being **hundreds of KB** in the worst case (a since-fixed GitHub issue cited ~500 KB before a 2022 size-reduction pass; current guidance is to only import the integrations you use). Expect roughly **100–250 KB minified** for a minimal `Sentry.init` (core + native bridge + a couple of integrations), before gzip, growing quickly if you add `mobileReplayIntegration` or full tracing. | Firebase RN wrapper code is thin (native SDK does the heavy lifting); expect low tens of KB minified. | Bugsnag ships many small plugin packages that are mostly bundled together (console/network breadcrumbs, react integration, etc.); comparable order of magnitude to Sentry's core, likely **~100–200 KB** minified, but I found no independent benchmark to cite. |
| Native size delta (Android AAR / iOS framework) | Could not get an exact byte figure from Maven Central / CocoaPods metadata via the tools available this session (search returned the artifact pages but not machine-readable sizes). Industry consensus is Sentry's native Android/iOS SDKs are comparatively lean (no bundled UI, minimal deps) — commonly reported as low single-digit MB before R8/App Bundle slicing, but **I could not independently verify a number for the current 8.27.0 native SDKs** and you should measure directly (`./gradlew :app:assembleRelease` size diff, and an EAS iOS build size diff) before committing. | Firebase iOS SDK is the SDK most commonly flagged as heavy: `FirebaseCrashlytics` on Apple platforms pulls in `FirebaseCore`, `FirebaseInstallations`, and (as of recent Firebase versions) `FirebaseSessions` as new mandatory dependencies — commonly reported in the low-single-digit-MB range combined, but I could not source an exact current figure. On Android, `firebase-crashlytics` + `firebase-common` + `firebase-installations` pull in `play-services-basement`/`play-services-tasks`, which **may partially de-dupe** with the Play Services classes this app already ships via `react-native-google-mobile-ads`, but Firebase-specific classes are still net-new. | Similarly, I could not source an exact current AAR/framework size; Bugsnag's Android/iOS native agents are generally described as lightweight but I have no citable number for the current release. |
| Free tier | 5,000 errors/month, 1 user, 30-day retention (Developer plan). Paid tiers start at $26/mo (Team) with usage-based overage. | **Free and unlimited**, on both the Spark and Blaze Firebase plans — no event cap, no seat limit. | 7,500 events/month on the free plan, 1 user, 7-day retention. Paid starts around $20–33/mo depending on the source, scaling to $99/mo+ at 25k events. |
| Needs a brand-new vendor/credential set for this app | New Sentry org/project + DSN + auth token. | **New Firebase project** — this app has none today (only AdMob app IDs are configured); needs `google-services.json` + `GoogleService-Info.plist` added to the repo/EAS, a new Google Cloud/Firebase relationship. | New Bugsnag org/project + API key + auth token. |
| iOS Privacy Manifest (`PrivacyInfo.xcprivacy`) | **Does not ship one automatically for React Native's default static linking.** Sentry's docs are explicit: "if you are using statically linked libraries, which is the default for React Native applications, you need to provide the privacy manifest yourself." Sentry's docs supply the exact file content to drop in (declares Crash/Performance/Diagnostic data categories; required-reason APIs: User Defaults `CA92.1`, System Boot Time `35F9.1`, File Timestamp `C617.1` — all marked not linked to identity, not used for tracking). | Firebase's iOS pods have shipped their own `PrivacyInfo.xcprivacy` manifests since Firebase iOS SDK ~10.x (bundled inside each pod, e.g. `FirebaseCrashlytics.xcframework`), so Xcode's automatic manifest aggregation picks it up **without your involvement**, given the pods are consumed as the SDK ships them. | Could not find or verify a public confirmation that Bugsnag Cocoa ships its own `PrivacyInfo.xcprivacy`. Given several Bugsnag components (`@bugsnag/delivery-react-native` etc.) and the general React Native static-linking pattern, treat this the same as Sentry — **assume you must verify/add it yourself** until proven otherwise. |
| App Store "App Privacy" label impact | Crash Data (device/OS info, stack traces) — not linked to identity by default if `sendDefaultPii: false` (the default) and no custom user IDs are attached. | Same category (device/OS info, crash logs); Firebase docs explicitly place the burden on you to declare this accurately, and warn that any custom keys/user IDs you attach turn it into identity-linked data. | Same category and same caveat — whatever you attach as user context turns "not linked" into "linked." |
| `sentry-expo` (mentioned in the ask) | N/A — this is the package to migrate *away from*. Deprecated since Expo SDK 50 (Jan 2024); merged into `@sentry/react-native`. Still installable, not receiving fixes. Not relevant to a fresh SDK 57 install. | — | — |
| "Anything lighter, production-grade" | Instabug and Embrace.io both do crash+ANR+app-hang but are not lighter (comparable or heavier native footprint, and are paid-first). Microsoft App Center Crashes has been sunset and should be ruled out. `react-native-exception-handler` is genuinely lighter but is **JS-crash-only** with no ANR/app-hang detection, no dashboard, no symbolication pipeline — it does not meet "production grade" for a first release given the explicit ANR/app-hang requirement. **Conclusion: no lighter option meets the stated bar; Crashlytics is the lightest of the three real contenders, at the cost of no iOS app-hang detection.** |

## Recommendation: `@sentry/react-native` (currently 8.27.0)

Reasoning, weighted by what this specific app needs before a Play staged rollout + first iOS release:

1. It is the only one of the three with both Android ANR **and** iOS app-hang detection enabled by default and independently confirmed (Crashlytics has no iOS app-hang story at all — a real gap given the ask explicitly wants both platforms covered before a first iOS release).
2. It requires no new backend relationship — this app doesn't have a Firebase project today, and standing one up (with `google-services.json`/`GoogleService-Info.plist` committed or EAS-secreted) is nontrivial extra surface for a launch-week task, versus Sentry's DSN + auth token.
3. Its Expo integration is the most mature and explicit of the three (dedicated `@sentry/react-native/expo` config plugin, automatic EAS Build source-map hook, actively released — 8.27.0 was current at query time).
4. Free tier (5,000 events/month) is almost certainly enough for a staged rollout given this is a solo-maintained app; Crashlytics' unlimited free tier is nicer but not decisive against the missing iOS capability.

Trade-off to accept: you must add the `PrivacyInfo.xcprivacy` file yourself (Sentry's docs hand you the exact contents — this is a 5-minute, one-time task, not a blocker), and you should budget for the JS bundle delta (order of 100–250 KB minified) on a codebase that this project's own memory log (`project_p11_4_landed`, `project_p11_6_landed`) shows has been actively fighting bundle bloat.

## Total install cost (with sourcing caveats noted above)

- **JS bundle:** ~100–250 KB minified for a minimal `Sentry.init` (no session replay, `tracesSampleRate: 0`, no extra integrations). Not independently gzip-measured for the current 8.27.0 release in this session.
- **Android native:** could not obtain an exact current AAR byte figure from Maven Central via the tools available; measure with an APK/AAB size diff on a spike branch before merging.
- **iOS native:** could not obtain an exact current framework byte figure from CocoaPods/SPM metadata; measure with an IPA size diff on a spike branch before merging.
- **Build-time only (not shipped):** `@sentry/cli` (used for source-map/dSYM upload during EAS Build) and `@sentry/bundler-plugins` — these inflate the npm package's 8.9 MB unpacked size but never enter the runtime bundle or app binary.

## Exact install + config steps (do not run yet — this task is read-only)

1. **Package** (do not install now): `@sentry/react-native@^8.27.0` in `dependencies`. No separate Expo-plugin package needed — the plugin ships inside the same package at `@sentry/react-native/expo`.

2. **`app.json` plugin block** — add to the existing `expo.plugins` array (alongside the other config plugins already there, e.g. `react-native-google-mobile-ads`, `./plugins/withTodayPanchangWidget`):
   ```json
   [
     "@sentry/react-native/expo",
     {
       "url": "https://sentry.io/",
       "organization": "<your-org-slug>",
       "project": "<your-project-slug>"
     }
   ]
   ```

3. **`metro.config.js`** — this repo's current file is a bare `getDefaultConfig(__dirname)`. Sentry needs its Metro serializer wrapped in:
   ```js
   const { getSentryExpoConfig } = require('@sentry/react-native/metro');
   const config = getSentryExpoConfig(__dirname);
   module.exports = config;
   ```

4. **`Sentry.init` — low-noise setup**, called once at module scope near the top of `app/_layout.tsx` (same place `SplashScreen.preventAutoHideAsync()` and `pmark('app:_layout:moduleEval')` already run), then wrap the default export with `Sentry.wrap(...)`:
   ```js
   import * as Sentry from '@sentry/react-native';

   Sentry.init({
     dsn: '<your dsn>',
     enabled: !__DEV__,
     tracesSampleRate: 0,              // no performance tracing noise
     enableNativeCrashHandling: true,  // native (Java/ObjC) crash capture
     enableAppHangTracking: true,      // iOS app-hang detection (default true; explicit for clarity)
     appHangTimeoutInterval: 2,        // seconds, Sentry default
     // Android ANR detection is on by default with no JS-exposed timeout knob
     // as of this SDK version (a native-option-exposure GitHub issue is open
     // for anr/app-hang tuning parity) — leave as default.
     sendDefaultPii: false,            // no PII
     attachScreenshot: false,
     attachViewHierarchy: false,
     // Session Replay stays OFF simply by NOT adding
     // `integrations: [Sentry.mobileReplayIntegration()]` — it is opt-in,
     // not something you need to explicitly disable.
   });

   // ... export default function RootLayout() { ... }
   export default Sentry.wrap(RootLayout);
   ```

5. **Wire the existing `ErrorBoundary` to actually report.** This is the concrete, non-obvious integration point for this repo: `app/_layout.tsx`'s `ErrorBoundary` (the `expo-router` `Try`/`ErrorBoundary` crash screen) catches the error and renders a fallback UI — a React error boundary **stops propagation**, so it never reaches Sentry's global `ErrorUtils` handler on its own. Add inside that component:
   ```js
   useEffect(() => {
     Sentry.captureException(error);
   }, [error]);
   ```
   Without this, every crash this screen currently catches (including the documented `initDatabase`-under-`SQLiteProvider` rejection case) would render the existing "Something went wrong" UI but **never appear in Sentry** — the same class of invisible failure this file's own comments already call out for the Zustand-rehydration watchdog and Play Vitals.

6. **EAS secrets/env vars needed:**
   - `SENTRY_AUTH_TOKEN` — required for the config plugin's EAS Build hook to upload source maps/debug files. Add via `eas secret:create --scope project --name SENTRY_AUTH_TOKEN --type string --value <token>` (never hardcode in `eas.json`).
   - Optionally `SENTRY_ORG` / `SENTRY_PROJECT` as env vars if you prefer not to hardcode them in `app.json`'s plugin config.
   - Note per Sentry/Bugsnag docs parity: this upload path only fires for `eas build`, not for EAS Update — if this app ever adopts EAS Update/OTA, source maps for that path need a separate manual upload step.

7. **iOS Privacy Manifest** — since React Native links Sentry's Cocoa SDK statically by default, add `PrivacyInfo.xcprivacy` (Sentry's docs give you the exact JSON: Crash/Performance/Other-Diagnostic data categories, `NSPrivacyAccessedAPICategoryUserDefaults` reason `CA92.1`, `NSPrivacyAccessedAPICategorySystemBootTime` reason `35F9.1`, `NSPrivacyAccessedAPICategoryFileTimestamp` reason `C617.1`) to the iOS project (or via a small config plugin/`ios.entitlements`-style asset copy if you want it to survive `prebuild`).

8. **Interaction with `react-native-google-mobile-ads`:** no functional conflict — RNGMA does not install its own global JS error handler. Two things worth knowing: (a) Sentry's ANR/thread-dump captures may occasionally show frames inside the Google Mobile Ads SDK if an ad load stalls the main thread — that's useful signal, not noise to filter; (b) this file's `getAdsModule()` helper deliberately defers `require('react-native-google-mobile-ads')` to avoid ~40 modules/8 sync `TurboModuleRegistry` calls on cold start — Sentry's own native init also does some synchronous native work at the earliest possible point (by design, to catch pre-JS crashes), so re-measure cold start via the existing `pmark`/`perfProfile` instrumentation after adding it, given how much prior work (P11.1–P11.6 per project memory) went into cold-start budget on this app.

## What I could not verify (be honest about gaps)

- Exact current native binary size deltas (Android AAR bytes, iOS framework bytes) for any of the three SDKs — `npm view`/CocoaPods/Maven searches returned artifact pages, not machine-readable current sizes, in this session. Treat all "MB" figures above as industry-general estimates, not measurements of the current releases, and verify with a spike-branch size diff before deciding.
- Whether `@bugsnag/react-native`'s iOS component ships its own `PrivacyInfo.xcprivacy` — no authoritative source found either way.
- Whether `@sentry/react-native`'s "New Architecture support" claim (from its own README) has been independently validated against RN 0.86.3 specifically, versus RN 0.76–0.81 New-Arch opt-in builds — I found the general claim but no RN-0.86-specific changelog entry or issue confirming it.
- The precise current JS-bundle-size delta Metro would produce for a minimal `Sentry.init` on this exact app (React 19.2, Hermes, New Arch) — I found historical GitHub-issue figures (~264 KB, ~500 KB before a 2022 slimming pass) but nothing current and app-specific; the only trustworthy number here would come from an actual `npx react-native-bundle-visualizer`-style measurement, which this read-only task did not run.
- Bugsnag's exact New-Architecture ship date/version (issue marked "released," version/date not stated in what I could fetch).

No files were created, edited, or deleted, and no packages were installed, per the task's read-only constraint.
