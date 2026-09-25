import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

export { WIDGET_APP_GROUP, WIDGET_KIND, WIDGET_PAYLOAD_KEY } from './constants';

/**
 * Android bridge (and the default for any other non-iOS platform): the local
 * `WidgetData` native module writes the payload JSON to SharedPreferences and
 * broadcasts an update to the AppWidgetProvider.
 *
 * iOS never resolves this file — Metro picks the sibling `index.ios.ts`,
 * which writes through `@bacons/apple-targets`' ExtensionStorage. That keeps
 * `@bacons/apple-targets` out of the Android bundle entirely (verified by
 * grepping `expo export` output for both platforms). Both files export
 * exactly the same API.
 *
 * Gotcha: this package's `main` is the extensionless `"index"` on purpose.
 * metro-resolver tries the exact path first and only applies platform
 * extensions to an extensionless prefix, so `"main": "index.ts"` would
 * short-circuit to this file on iOS too and silently skip `index.ios.ts`.
 */
interface WidgetDataNativeModule {
  write(json: string): void;
  notifyAll(): void;
}

const native = requireOptionalNativeModule<WidgetDataNativeModule>('WidgetData');

/** Write the latest widget payload to native shared storage and ping the
 *  widget process to redraw. No-op (with a single warn on Android) when the
 *  module isn't linked, e.g. in Expo Go. */
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
