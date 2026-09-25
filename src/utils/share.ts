import { Linking, Platform, Share } from 'react-native';
import * as StoreReview from 'expo-store-review';

const ANDROID_PACKAGE = 'com.ishank1995.dharmagya';
export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;

/**
 * Numeric App Store Connect app id (the `id…` part of an apps.apple.com URL).
 * Empty until the App Store Connect record exists; until then iOS shares and
 * rate-fallbacks point at the website so Google Play is never referenced on iOS
 * (App Review 2.3.10).
 */
export const APP_STORE_ID = '';
export const APP_STORE_URL = APP_STORE_ID
  ? `https://apps.apple.com/app/id${APP_STORE_ID}`
  : 'https://dharmagya.app';

/** Store page for the platform the app is running on. */
export const STORE_URL = Platform.OS === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;

export async function shareApp(message: string): Promise<void> {
  const url = STORE_URL;
  try {
    await Share.share(
      Platform.OS === 'ios'
        ? { message, url }
        : { message: `${message}\n${url}` },
    );
  } catch {
    // user cancelled / share sheet failed — nothing to do
  }
}

export async function requestRating(): Promise<void> {
  if (await StoreReview.isAvailableAsync()) {
    if (await StoreReview.hasAction()) {
      await StoreReview.requestReview();
      return;
    }
  }
  await Linking.openURL(STORE_URL);
}
