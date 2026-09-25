/**
 * Today's Panchang — iOS WidgetKit extension (the iOS half of P4.2, spec §8).
 *
 * Read by `@bacons/apple-targets` on every config evaluation and at
 * `npx expo prebuild -p ios`. The plugin:
 *   - creates the `TodayPanchangWidget` app-extension target and links this
 *     folder to it as a PBXFileSystemSynchronizedRootGroup — every file here
 *     except this config and Info.plist is a target member (Swift sources
 *     compile, `Assets.xcassets` and `PrivacyInfo.xcprivacy` are bundled);
 *     the plugin writes no privacy manifest for the .appex, so
 *     `PrivacyInfo.xcprivacy` here is hand-maintained — it declares the
 *     UserDefaults required-reason API (1C8F.1, app-group suite) that
 *     PanchangPayloadStore reads. Add a category there whenever the widget
 *     starts calling another required-reason API, or App Store Connect
 *     rejects the upload with ITMS-91053;
 *   - writes `colors` into `targets/widget/Assets.xcassets/<name>.colorset`
 *     on every prebuild (generated — never hand-edit those Contents.json);
 *   - writes `entitlements` to
 *     `ios/.targets/TodayPanchangWidget/generated.entitlements` and points
 *     CODE_SIGN_ENTITLEMENTS + REGISTER_APP_GROUPS at it;
 *   - registers the target in `extra.eas.build.experimental.ios.appExtensions`
 *     so EAS Build provisions `com.ishank1995.dharmagya.widget`.
 *
 * Contract with the app (modules/widget-data/constants.ts):
 *   UserDefaults(suiteName: "group.com.ishank1995.dharmagya")
 *     ["today_panchang_payload"] = JSON v3            (ExtensionStorage.setString)
 *   WidgetCenter.shared.reloadTimelines(ofKind: "TodayPanchangWidget")
 *
 * The main app MUST carry the same app group in app.json → ios.entitlements
 * (the plugin mirrors it into the target when this file omits `entitlements`;
 * we pin it explicitly per spec §8 and warn once when the app side is missing
 * so the mismatch is visible in every `expo config` / prebuild run).
 */
const APP_GROUP = 'group.com.ishank1995.dharmagya';
const APP_GROUP_KEY = 'com.apple.security.application-groups';

let warnedAboutMainAppGroup = false;

/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => {
  const ios = (config && config.ios) || {};
  const mainAppGroups = ios.entitlements ? ios.entitlements[APP_GROUP_KEY] : undefined;
  if (
    !warnedAboutMainAppGroup &&
    (!Array.isArray(mainAppGroups) || !mainAppGroups.includes(APP_GROUP))
  ) {
    warnedAboutMainAppGroup = true;
    console.warn(
      `[targets/widget] app.json → expo.ios.entitlements["${APP_GROUP_KEY}"] ` +
        `must include "${APP_GROUP}". The widget reads that suite; without the ` +
        'entitlement the app cannot write the payload and the widget stays empty.',
    );
  }

  return {
    type: 'widget',
    // Product / target name, PRODUCT_MODULE_NAME and the folder under
    // ios/.targets/. Also the WidgetKit `kind` — keep in sync with
    // `TodayPanchangWidget.kind` in TodayPanchangWidget.swift and
    // WIDGET_KIND in modules/widget-data/constants.ts.
    name: 'TodayPanchangWidget',
    // CFBundleDisplayName of the .appex. Not what the gallery shows (that is
    // configurationDisplayName from Swift). No apostrophe: the value lands in
    // a pbxproj build setting.
    displayName: 'Dharmagya Widget',
    // → com.ishank1995.dharmagya.widget (appended to the main bundle id).
    bundleIdentifier: '.widget',
    // §8: iOS 17 floor. containerBackground(for:) and
    // showsWidgetContainerBackground are iOS 17 APIs; the app itself ships at
    // the Expo default (16.4), so the widget simply does not load below 17.
    deploymentTarget: '17.0',
    entitlements: {
      [APP_GROUP_KEY]: [APP_GROUP],
    },
    colors: {
      // ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME → `Color.accentColor`
      // in Swift. Painted only on the widgetAccentable TODAY kicker + hero
      // dot when the container background is removed or the rendering mode
      // is accented / vibrant (§8); the system tints those and desaturates
      // the rest.
      $accent: '#D8A31A',
      // ASSETCATALOG_COMPILER_WIDGET_BACKGROUND_COLOR_NAME — the system uses
      // it behind the widget-editing sheet only.
      $widgetBackground: { light: '#FFFFFF', dark: '#241C30' },

      // Diya registers, §1.1 (dark, ground nightRaised) / §1.2 (light, ground
      // riceCard). Swift reads `Color("WidgetBackground")` for
      // theme == "system"; every other token is resolved from the literal hex
      // in WidgetTheme.swift so an explicit light/dark theme can override the
      // system scheme. The full set is still generated so the asset catalog
      // documents the palette and Xcode previews pick it up.
      WidgetBackground: { light: '#FFFFFF', dark: '#241C30' },
      WidgetAccentText: { light: '#7A5900', dark: '#D8A31A' },
      WidgetAccentFill: '#D8A31A',
      WidgetTextPrimary: { light: '#221B24', dark: '#EDE8F0' },
      WidgetTextSecondary: { light: '#69646A', dark: '#A19AA7' },
      WidgetKicker: { light: '#918D92', dark: '#7E7886' },
      WidgetDivider: { light: '#F0EFF0', dark: '#312A3C' },
      WidgetDanger: { light: '#8C1D18', dark: '#E4708A' },
    },
  };
};
