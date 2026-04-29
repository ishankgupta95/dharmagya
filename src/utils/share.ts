import { Linking, Platform, Share } from 'react-native';
import * as StoreReview from 'expo-store-review';

const ANDROID_PACKAGE = 'com.ishank1995.dharmagya';
export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;

export async function shareApp(message: string): Promise<void> {
  const url = PLAY_STORE_URL;
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
  await Linking.openURL(PLAY_STORE_URL);
}
