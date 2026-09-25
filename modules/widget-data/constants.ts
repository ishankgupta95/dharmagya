/**
 * Strings shared by the JS bridge, the iOS WidgetKit target
 * (`targets/widget/expo-target.config.js`) and `app.json` — keep them in sync
 * by importing from here rather than retyping them.
 */

/** iOS App Group shared by the app and the widget extension. Must match
 *  `ios.entitlements["com.apple.security.application-groups"]` in app.json
 *  and the target's `entitlements`. */
export const WIDGET_APP_GROUP = 'group.com.ishank1995.dharmagya';

/** Key of the JSON payload in shared storage — identical on both platforms
 *  (Android SharedPreferences `dharmagya_widget_prefs`; iOS
 *  `UserDefaults(suiteName: WIDGET_APP_GROUP)`). */
export const WIDGET_PAYLOAD_KEY = 'today_panchang_payload';

/** WidgetKit `kind` of the iOS widget — the timeline reloaded after a write. */
export const WIDGET_KIND = 'TodayPanchangWidget';
