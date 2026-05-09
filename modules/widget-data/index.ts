import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

interface WidgetDataNativeModule {
  write(json: string): void;
  notifyAll(): void;
}

const native = requireOptionalNativeModule<WidgetDataNativeModule>('WidgetData');

/** Write the latest widget payload to native shared storage and ping the
 *  widget process to redraw. No-op (with a single warn) on platforms where the
 *  module isn't installed yet — currently iOS until the WidgetKit pass lands. */
export function writeWidgetPayload(json: string): void {
  if (!native) {
    if (Platform.OS === 'android') {
      console.warn('[widget-data] native module missing on Android — did you run `expo prebuild`?');
    }
    return;
  }
  native.write(json);
  native.notifyAll();
}

/** Force the widget to redraw from whatever's already in shared storage. Used
 *  by the Refresh tap target which wants to reflect a write that just landed. */
export function notifyWidgets(): void {
  if (!native) return;
  native.notifyAll();
}

export const isWidgetBridgeAvailable = native !== null;
