# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Build APK (Android)

Requires Android SDK, NDK, and an Expo account (`eas login`).

```bash
EAS_LOCAL_BUILD_SKIP_CLEANUP=1 ANDROID_HOME=$HOME/Library/Android/sdk eas build --platform android --profile preview --local
```

The APK will be output to the project root when done. Transfer it to any Android device and install directly (enable "Install from unknown sources" on the device).
