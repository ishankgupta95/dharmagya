import { ExtensionStorage } from '@bacons/apple-targets';
import { requireOptionalNativeModule } from 'expo';

import { WIDGET_APP_GROUP, WIDGET_KIND, WIDGET_PAYLOAD_KEY } from './constants';

export { WIDGET_APP_GROUP, WIDGET_KIND, WIDGET_PAYLOAD_KEY } from './constants';

/**
 * iOS bridge — no native code of our own. `@bacons/apple-targets` ships an
 * `ExtensionStorage` Expo module whose `setString` lands in
 * `UserDefaults(suiteName: WIDGET_APP_GROUP)` and whose `reloadWidget(kind)`
 * calls `WidgetCenter.shared.reloadTimelines(ofKind:)`. The WidgetKit target
 * (`targets/widget`) reads the same key from the same suite.
 *
 * The package's JS wrapper silently stubs every call when its native module
 * is absent (Expo Go, a dev client built before the target existed), which
 * would make `isWidgetBridgeAvailable` lie — so availability is probed on
 * the native module directly, not on the wrapper.
 */
const native = requireOptionalNativeModule('ExtensionStorage');
const storage = native ? new ExtensionStorage(WIDGET_APP_GROUP) : null;

/** Write the payload JSON to the App Group and reload the widget timeline so
 *  WidgetKit redraws from the new snapshot straight away. */
export function writeWidgetPayload(json: string): void {
  if (!storage) return;
  storage.set(WIDGET_PAYLOAD_KEY, json);
  ExtensionStorage.reloadWidget(WIDGET_KIND);
}

/** Reload the widget timeline from whatever's already in the App Group. */
export function notifyWidgets(): void {
  if (!storage) return;
  ExtensionStorage.reloadWidget(WIDGET_KIND);
}

export const isWidgetBridgeAvailable = storage !== null;
