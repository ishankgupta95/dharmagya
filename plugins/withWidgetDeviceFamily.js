/**
 * Align the iOS widget extension's device family with the app's.
 *
 * `@bacons/apple-targets` 5.0.0 derives `deviceFamilies` from
 * `ios.supportsTablet` but only App Clip targets honour it — every widget
 * target is emitted with a hard-coded `TARGETED_DEVICE_FAMILY = "1,2"`
 * (node_modules/@bacons/apple-targets/build/configuration-list.js). With
 * `supportsTablet: false` the app is `TARGETED_DEVICE_FAMILY = 1`, so the
 * `.appex` would declare iPad support inside an iPhone-only app. Nothing in
 * `expo-target.config.js` can set a build setting, hence this plugin.
 *
 * ORDER MATTERS: list this plugin BEFORE "@bacons/apple-targets" in app.json.
 * apple-targets registers its own `xcodeProjectBeta2` provider mod while its
 * plugin evaluates, and Expo refuses any mod added to a mod that already has a
 * provider (INVALID_MOD_ORDER). Mods registered earlier sit deeper in the
 * chain, so this action runs AFTER apple-targets has created the target and
 * before the provider writes project.pbxproj.
 *
 * Drop this plugin once apple-targets honours `deviceFamilies` for widgets.
 */
const { withXcodeProjectBeta } = require('@bacons/apple-targets/build/with-bacons-xcode');

const WIDGET_PRODUCT_NAME = 'TodayPanchangWidget';

const withWidgetDeviceFamily = (config) =>
  withXcodeProjectBeta(config, async (cfg) => {
    const supportsTablet = cfg.ios?.supportsTablet === true;
    const family = supportsTablet ? '1,2' : '1';
    const project = cfg.modResults;
    const targets = project.rootObject.props.targets ?? [];
    const widget = targets.find((t) => t.props.productName === WIDGET_PRODUCT_NAME);
    if (!widget) {
      // The target is created by apple-targets from targets/widget; if it is
      // missing, prebuild is running without that plugin — nothing to align.
      return cfg;
    }
    widget.setBuildSetting('TARGETED_DEVICE_FAMILY', family);
    return cfg;
  });

module.exports = withWidgetDeviceFamily;
