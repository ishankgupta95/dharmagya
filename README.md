# Dharmagya

Hindu devotional app built with Expo + React Native. Panchang, aartis, chalisas, rashifal, muhurat, and vimshottari dasha — all offline-first.

## Development

```bash
npm install
npx expo start
```

## Build locally

Requires Android SDK (set `ANDROID_HOME`), JDK, and `eas login`.

**APK** (sideload to any device — enable "Install from unknown sources"):

```bash
EAS_LOCAL_BUILD_SKIP_CLEANUP=1 ANDROID_HOME=$HOME/Library/Android/sdk eas build --platform android --profile preview --local
```

**AAB** (for Play Store upload):

```bash
EAS_LOCAL_BUILD_SKIP_CLEANUP=1 ANDROID_HOME=$HOME/Library/Android/sdk eas build --platform android --profile production --local
```

Artifact lands in the project root. Bump `version` + `android.versionCode` in [app.json](app.json) before each Play Store build (`appVersionSource: "local"` in [eas.json](eas.json) means EAS reads them verbatim).
