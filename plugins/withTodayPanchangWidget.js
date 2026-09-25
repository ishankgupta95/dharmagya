/**
 * P4.2 / P17 — Today's Panchang Android home-screen widget config plugin (Diya).
 *
 * Runs at `expo prebuild` time. It:
 *   1. Adds the AppWidgetProvider <receiver> to AndroidManifest.xml.
 *   2. Writes the provider Kotlin class into the host app's package
 *      (FQCN com.ishank1995.dharmagya.widget.TodayPanchangWidget — referenced
 *      by NAME from WidgetDataModule.kt and the ProGuard keep rule in app.json;
 *      never rename it).
 *   3. Writes res/xml provider info, the five sized layouts (xs/s/m/l/xl) plus
 *      the empty-state and picker-preview layouts, the drawables, and the
 *      sidecar widget_colors / widget_strings / widget_dimens files under
 *      res/values*. Sidecars are separate files because Android merges every
 *      *.xml under res/values and other plugins own colors.xml / strings.xml.
 *
 * The companion `modules/widget-data` local Expo module supplies the JS bridge
 * (`writeWidgetPayload` / `notifyWidgets`). This plugin is the visual surface.
 *
 * Spec: the Diya widget spec — §0 payload v3 + day selection, §1 colour
 * registers, §2 type roles (Latin/Devanagari twin TextViews), §3.1 layouts,
 * §4 header / refresh chip / deep links, §5 Hindi rules, §6 empty / stale /
 * rolled states, §7 Android 12+ specifics, §9 preview fixture.
 *
 * Deliberate deviations from the spec (product-owner instruction):
 *  - `updatePeriodMillis` = 1 800 000 (the 30-minute floor) so the provider is
 *    periodically poked and the day rolls over even when the app is never
 *    opened. The redraw is zero-compute: the payload is pre-formatted.
 *  - The receiver also listens for TIME_SET / TIMEZONE_CHANGED / DATE_CHANGED
 *    / LOCALE_CHANGED and redraws every instance (all but DATE_CHANGED are
 *    exempt from implicit-broadcast limits; DATE_CHANGED may not be delivered
 *    on 8+, harmless).
 *  - Midnight rollover alarm (overrides spec §10's "no AlarmManager"): one
 *    inexact, non-wakeup `setWindow(RTC, next local midnight + 1 min, 10 min)`
 *    per day, an explicit broadcast back to this provider, no exact-alarm
 *    permission. See `MidnightAlarm` in the Kotlin below for why setWindow and
 *    not set().
 *  - XS: the tithi owns the single line. `until` / the STALE label shows only
 *    when it fits beside the whole hero at the narrowest reported width (and is
 *    0dp/weight 1 + ellipsized in XML as a backstop); a STALE label that does
 *    not fit turns the dot danger-coloured instead.
 *  - The EMPTY title has Latin / Devanagari twins like the hero, picked by the
 *    device locale (EMPTY has no payload lang).
 *  - `android:previewImage` is omitted: no PNG can be rasterised at prebuild.
 *    API 31+ pickers use `previewLayout`; older pickers fall back to the icon.
 *
 * Deliberate deviations found in on-device review (the spec itself is wrong):
 *  - §7's `maxResizeWidth` / `maxResizeHeight` = 250dp are omitted. Launcher3
 *    takes maxSpan as the minimum over all orientation profiles, and 250dp is
 *    only 2–3 landscape cells, so targetCellWidth=4 fell outside [minSpan,
 *    maxSpan] and was discarded: Pixel Launcher pinned at 2×1 and capped resize
 *    at 3×3, making XL unreachable. No larger value helps (landscape cells are
 *    ~190dp wide). Without them the widget lands at the intended 4×2.
 *  - §3.1's SizeF keys ("the layout's true minimum") sat below the layouts'
 *    measured natural heights, so 1-row cells got a clipped S. The keys (and the
 *    pre-31 pickSize thresholds) are raised to the measured Devanagari heights
 *    at font scale 1.0 plus headroom: XS 40, S 150, M 185, L 285, XL 350dp.
 */
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// ── Receiver injection ───────────────────────────────────────────────────────

const WIDGET_PROVIDER_NAME = '.widget.TodayPanchangWidget';
const WIDGET_PROVIDER_INFO_RES = '@xml/today_panchang_widget_info';
const RECEIVER_ACTIONS = [
  'android.appwidget.action.APPWIDGET_UPDATE',
  'android.intent.action.TIME_SET',
  'android.intent.action.TIMEZONE_CHANGED',
  'android.intent.action.DATE_CHANGED',
  // Exempt from the API 26 implicit-broadcast limits. AppWidgetService does not
  // redraw providers on a locale change; the launcher just re-inflates the last
  // RemoteViews, so the EMPTY title twin chosen for the old locale would stick.
  'android.intent.action.LOCALE_CHANGED',
];

function injectReceiver(manifest) {
  const application = manifest.manifest.application?.[0];
  if (!application) return manifest;
  // Replace rather than skip, so a non-clean prebuild still picks up new actions.
  application.receiver = (application.receiver || []).filter(
    (r) => !(r.$ && r.$['android:name'] === WIDGET_PROVIDER_NAME),
  );
  application.receiver.push({
    $: {
      'android:name': WIDGET_PROVIDER_NAME,
      'android:exported': 'true',
      'android:label': '@string/widget_today_label',
    },
    'intent-filter': [
      { action: RECEIVER_ACTIONS.map((name) => ({ $: { 'android:name': name } })) },
    ],
    'meta-data': [
      {
        $: {
          'android:name': 'android.appwidget.provider',
          'android:resource': WIDGET_PROVIDER_INFO_RES,
        },
      },
    ],
  });
  return manifest;
}

// ── Colour registers (§1) ────────────────────────────────────────────────────
// Opaque hexes resolved against the widget ground. `values/` holds the light
// register under the bare `wg_*` names and `values-night/` the dark register
// under the SAME names, so theme "system" is pure resource qualification. Both
// registers are also duplicated under `_forced_dark` / `_forced_light` (in
// `values/` only) for the explicit themes, which Kotlin applies at runtime.

const DARK_REGISTER = {
  bg: '#241C30', // palette.nightRaised
  border: '#4F3C2B', // darkColors.borderAccent flattened on nightRaised
  accent_text: '#D8A31A', // turmeric — 7.15:1
  accent_fill: '#D8A31A',
  on_accent: '#171220', // palette.night
  text_primary: '#EDE8F0', // palette.bone
  text_secondary: '#A19AA7', // bone @ .62 — 5.99:1
  kicker: '#7E7886', // bone @ .45 — 3.83:1
  divider: '#312A3C',
  chip_bg: '#362A2E', // darkColors.accentSurface
  chip_border: '#4F3C2B',
  danger: '#E4708A', // palette.roseText
};

const LIGHT_REGISTER = {
  bg: '#FFFFFF', // palette.riceCard
  border: '#ECE2C7', // lightColors.borderAccent flattened on white
  accent_text: '#7A5900', // palette.turmericInk — 6.45:1 (never raw turmeric as text on light)
  accent_fill: '#D8A31A',
  on_accent: '#221B24', // palette.ink
  text_primary: '#221B24',
  text_secondary: '#69646A', // ink @ .68 — 5.78:1
  kicker: '#918D92', // ink @ .50 — 3.27:1
  divider: '#F0EFF0',
  chip_bg: '#FFF9E6', // lightColors.accentSurface
  chip_border: '#ECE2C7',
  danger: '#8C1D18', // palette.crimsonText
};

const colorEntries = (register, suffix) =>
  Object.entries(register)
    .map(([name, hex]) => `    <color name="wg_${name}${suffix}">${hex}</color>`)
    .join('\n');

const widgetColorsXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <!-- Light register (default qualifier). Dark lives in values-night/ under the same names. -->
${colorEntries(LIGHT_REGISTER, '')}

    <!-- Explicit-theme sets, applied at runtime by TodayPanchangWidget.kt (spec §1.3). -->
${colorEntries(DARK_REGISTER, '_forced_dark')}
${colorEntries(LIGHT_REGISTER, '_forced_light')}
</resources>
`;

const widgetColorsNightXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <!-- Dark register — picked by UI_MODE_NIGHT when the payload theme is "system". -->
${colorEntries(DARK_REGISTER, '')}
</resources>
`;

// ── Strings (§6, resolved on the device locale) ─────────────────────────────

const stringsXml = (s) => `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="widget_today_label">${s.label}</string>
    <string name="widget_today_desc">${s.desc}</string>
    <string name="widget_empty_title">${s.emptyTitle}</string>
    <string name="widget_empty_body">${s.emptyBody}</string>
    <string name="widget_refresh_label">${s.refresh}</string>
</resources>
`;

const widgetStringsXml = stringsXml({
  label: 'Today’s Panchang',
  desc: 'Tithi, nakshatra and timings for the day, at a glance.',
  emptyTitle: 'Today’s Panchang',
  emptyBody: 'Open Dharmagya once to load today’s panchang.',
  refresh: 'Refresh widget',
});

const widgetStringsHiXml = stringsXml({
  label: 'आज का पंचांग',
  desc: 'दिन की तिथि, नक्षत्र और समय — एक नज़र में।',
  emptyTitle: 'आज का पंचांग',
  emptyBody: 'आज का पंचांग लोड करने के लिए धर्मज्ञ एक बार खोलें।',
  refresh: 'विजेट रिफ्रेश करें',
});

// ── Dimens (§7 padding) ──────────────────────────────────────────────────────
// Pre-12 launchers add no outer padding of their own, 12+ launchers do, so the
// root margin collapses to 0 on API 31+ to avoid doubling it.

const dimensXml = (margin) => `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <dimen name="widget_outer_margin">${margin}</dimen>
</resources>
`;

// ── Drawables ────────────────────────────────────────────────────────────────

const shapeXml = (shape, body) => `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="${shape}">
${body}
</shape>
`;

/** Card ground: solid wg_bg + 1dp wg_border. Pre-31 radius 24dp (= borderRadius.hero);
 *  31+ uses the system widget radius (Pixel resolves it to 28dp). */
const bgDrawable = (suffix, radius) =>
  shapeXml(
    'rectangle',
    `    <solid android:color="@color/wg_bg${suffix}" />
    <corners android:radius="${radius}" />
    <stroke android:width="1dp" android:color="@color/wg_border${suffix}" />`,
  );

/** ↻ chip: 30dp circle, wg_chip_bg fill + 1dp wg_chip_border. */
const chipDrawable = (suffix) =>
  shapeXml(
    'oval',
    `    <size android:width="30dp" android:height="30dp" />
    <solid android:color="@color/wg_chip_bg${suffix}" />
    <stroke android:width="1dp" android:color="@color/wg_chip_border${suffix}" />`,
  );

/** STALE chip: turmeric fill, no border (turmeric is identical in both registers). */
const chipInvertedDrawable = shapeXml(
  'oval',
  `    <size android:width="30dp" android:height="30dp" />
    <solid android:color="@color/wg_accent_fill" />`,
);

/** 7dp hero dot (turmeric in both registers, so one drawable). */
const dotDrawable = shapeXml(
  'oval',
  `    <size android:width="7dp" android:height="7dp" />
    <solid android:color="@color/wg_accent_fill" />`,
);

/** XS STALE mark when the STALE label does not fit: the dot in wg_danger (resource-qualified,
 *  so theme "system" follows values-night; explicit themes recolour it via setColorFilter). */
const dotStaleDrawable = shapeXml(
  'oval',
  `    <size android:width="7dp" android:height="7dp" />
    <solid android:color="@color/wg_danger" />`,
);

/** 7dp tomorrow ring: 1.5dp wg_kicker stroke, no fill. Explicit themes recolour it via setColorFilter.
 *  The transparent <solid> is load-bearing: a GradientDrawable with no solid colour paints its
 *  fill opaque once a colour filter is set, turning the ring into a filled disc. */
const ringDrawable = shapeXml(
  'oval',
  `    <size android:width="7dp" android:height="7dp" />
    <solid android:color="@android:color/transparent" />
    <stroke android:width="1.5dp" android:color="@color/wg_kicker" />`,
);

/** Material "refresh" glyph. Painted black; the ImageView tint / runtime colour filter recolours it. */
const refreshIconVector = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="16dp"
    android:height="16dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
    <path
        android:fillColor="#FF000000"
        android:pathData="M17.65,6.35C16.2,4.9 14.21,4 12,4c-4.42,0 -7.99,3.58 -7.99,8s3.57,8 7.99,8c3.73,0 6.84,-2.55 7.73,-6h-2.08c-0.82,2.33 -3.04,4 -5.65,4 -3.31,0 -6,-2.69 -6,-6s2.69,-6 6,-6c1.66,0 3.14,0.69 4.22,1.78L13,11h7V4l-2.35,2.35z" />
</vector>
`;

// ── Provider info (§7 + the deliberate deviations in the header) ────────────
// No maxResizeWidth/Height: they defeat targetCellWidth on Launcher3 (see header).

const widgetInfoXml = `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="110dp"
    android:minHeight="40dp"
    android:minResizeWidth="110dp"
    android:minResizeHeight="40dp"
    android:targetCellWidth="4"
    android:targetCellHeight="2"
    android:resizeMode="horizontal|vertical"
    android:initialLayout="@layout/widget_today_m"
    android:previewLayout="@layout/widget_today_preview"
    android:description="@string/widget_today_desc"
    android:updatePeriodMillis="1800000"
    android:widgetCategory="home_screen" />
`;

// ── Layout builder ───────────────────────────────────────────────────────────
// The five sized layouts share their blocks (header / hero / slot row / footer /
// tomorrow), so they are composed from small fragment functions instead of
// being hand-written five times. `c` is the colour-name suffix: '' for the live
// layouts (register picked by values-night), '_forced_dark' for the picker
// preview, which cannot run Kotlin and therefore hard-references the dark set.
// Only RemoteViews-safe view classes are used (FrameLayout / LinearLayout /
// TextView / ImageView) — plain View and Space are not remotable.

const escXml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const indent = (s) => s.replace(/^(?=.)/gm, '    ');

function el(tag, attrs, children = [], root = false) {
  const attrLines = Object.entries(attrs)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `android:${k}="${v}"`);
  const ns = root ? ['xmlns:android="http://schemas.android.com/apk/res/android"'] : [];
  const head = [`<${tag}`, ...ns, ...attrLines].join('\n    ');
  const kids = children.filter(Boolean);
  if (kids.length === 0) return `${head} />`;
  return `${head}>\n\n${kids.map(indent).join('\n\n')}\n\n</${tag}>`;
}

const tv = (id, attrs, text) =>
  el('TextView', { id: `@+id/${id}`, ...attrs, ...(text ? { text: escXml(text) } : {}) });

const WRAP = { layout_width: 'wrap_content', layout_height: 'wrap_content' };
const FILL = { layout_width: 'match_parent', layout_height: 'wrap_content' };
const WEIGHT = { layout_width: '0dp', layout_height: 'wrap_content', layout_weight: '1' };
const ONE_LINE = { maxLines: '1', ellipsize: 'end' };

// Type roles (§2). sp follows the user's font size; every value is one line +
// tail ellipsis so scaling degrades by truncation, never by overflow.
const ROLE = {
  kickerAccent: (c) => ({
    textColor: `@color/wg_accent_text${c}`, textSize: '10.5sp', lineHeight: '14sp',
    fontFamily: 'sans-serif-medium', letterSpacing: '0.15', maxLines: '1',
  }),
  kicker: (c) => ({
    textColor: `@color/wg_kicker${c}`, textSize: '10sp', lineHeight: '14sp',
    fontFamily: 'sans-serif-medium', letterSpacing: '0.13', ...ONE_LINE,
  }),
  meta: (c) => ({
    textColor: `@color/wg_text_secondary${c}`, textSize: '11sp', lineHeight: '15sp',
    fontFamily: 'sans-serif', ...ONE_LINE,
  }),
  until: (c, sp = '12.5sp') => ({
    textColor: `@color/wg_text_secondary${c}`, textSize: sp, lineHeight: '17sp',
    fontFamily: 'sans-serif', fontFeatureSettings: 'tnum', maxLines: '1',
  }),
  footerValue: (c) => ({
    textColor: `@color/wg_text_secondary${c}`, textSize: '13sp', lineHeight: '18sp',
    fontFamily: 'sans-serif-medium', fontFeatureSettings: 'tnum', ...ONE_LINE,
  }),
  body: (c) => ({
    textColor: `@color/wg_text_secondary${c}`, textSize: '12.5sp', lineHeight: '17sp',
    fontFamily: 'sans-serif', maxLines: '2', ellipsize: 'end',
  }),
};

// hero / row metrics: [sp, Latin line height, Devanagari line height] (§2, §5.2)
const HERO_20 = [20, 26, 28];
const HERO_18 = [18, 24, 26];
const HERO_15 = [15, 20, 22];
const ROW_15 = [15, 20, 22];
const ROW_14 = [14, 19, 21];

/**
 * Twin TextViews (§2): RemoteViews cannot swap a typeface, so every hero/row
 * value exists twice — `<name>_lat` (sans) and `<name>_dev` (serif, gone by
 * default) — and Kotlin shows exactly one after the Devanagari regex test.
 * `hero` = hero weight (Latin 500 / Devanagari 600); rows are 400 in both.
 */
function twin(name, [sp, latLine, devLine], { color, hero, width = WEIGHT, marginTop }, c, text) {
  const common = {
    ...width, layout_marginTop: marginTop, textColor: `@color/${color}${c}`, textSize: `${sp}sp`, ...ONE_LINE,
  };
  return [
    tv(`${name}_lat`, {
      ...common, lineHeight: `${latLine}sp`,
      fontFamily: hero ? 'sans-serif-medium' : 'sans-serif', fontFeatureSettings: 'tnum',
    }, text),
    // includeFontPadding stays at its default (true) so matras are not clipped (§5.2).
    // textFontWeight wins on API 28+, textStyle=bold is the pre-28 fallback.
    tv(`${name}_dev`, {
      ...common, lineHeight: `${devLine}sp`, fontFamily: 'serif',
      ...(hero ? { textStyle: 'bold', textFontWeight: '600' } : {}), visibility: 'gone',
    }),
  ];
}

/** 7dp mark (dot or ring), vertically centred on the row it leads. */
const mark = (id, drawable) =>
  el('ImageView', {
    id: `@+id/${id}`, layout_width: '7dp', layout_height: '7dp', layout_marginEnd: '9dp',
    layout_gravity: 'center_vertical', src: `@drawable/${drawable}`, importantForAccessibility: 'no',
  });

const untilView = (id, c, sp, extra = {}, text) =>
  tv(id, { ...WRAP, layout_marginStart: '8dp', ...ROLE.until(c, sp), ...extra }, text);

const divider = (id, c) =>
  el('FrameLayout', {
    id: `@+id/${id}`, layout_width: 'match_parent', layout_height: '1dp',
    layout_marginTop: '10dp', layout_marginBottom: '10dp', background: `@color/wg_divider${c}`,
  });

/** Header kicker pair: TODAY (accent) and its STALE twin (danger, gone). */
const headerKickers = (c, text) => [
  tv('today_kicker', { ...WRAP, ...ROLE.kickerAccent(c) }, text),
  tv('stale_kicker', { ...WRAP, ...ROLE.kickerAccent(c), textColor: `@color/wg_danger${c}`, visibility: 'gone' }),
];

/** M/L/XL header (§4): kicker · gap 8 · meta (weight 1); the end margin reserves the 44dp ↻ zone. */
const header = (c, fx) =>
  el('LinearLayout', { ...FILL, orientation: 'horizontal', layout_marginEnd: '44dp' }, [
    ...headerKickers(c, fx.todayLabel),
    tv('header_meta', { ...WEIGHT, layout_marginStart: '8dp', ...ROLE.meta(c) }, fx.meta),
  ]);

/** Hero row (§3): mark · gap 9 · value (weight 1, ellipsizes) · gap 8 · until (never truncated).
 *  Default (top) gravity keeps the LinearLayout baseline-aligning value and until. */
const heroRow = (c, fx, { prefix, markId, drawable, metrics, color, marginTop }) =>
  el('LinearLayout', { ...FILL, orientation: 'horizontal', layout_marginTop: marginTop }, [
    mark(markId, drawable),
    ...twin(prefix, metrics, { color, hero: true }, c, fx.heroValue),
    untilView(`${prefix}_until`, c, '12.5sp', {}, fx.heroUntil),
  ]);

/** Slot-1 row (mirrors PanchangRow): kicker (minWidth 64) · gap 10 · value (weight 1) · gap 8 · until. */
const slotRow = (c, fx, { prefix, metrics, marginTop }) =>
  el('LinearLayout', { ...FILL, orientation: 'horizontal', layout_marginTop: marginTop }, [
    tv(`${prefix}_kicker`, { ...WRAP, minWidth: '64dp', layout_marginEnd: '10dp', ...ROLE.kicker(c) }, fx.rowKicker),
    ...twin(prefix, metrics, { color: 'wg_text_secondary', hero: false }, c, fx.rowValue),
    untilView(`${prefix}_until`, c, '12.5sp', {}, fx.rowUntil),
  ]);

/** Footer: two equal columns (10dp gutter), kicker above value, 2dp apart. */
const footerCol = (prefix, c, fx, extra) =>
  el('LinearLayout', { ...WEIGHT, orientation: 'vertical', ...extra }, [
    tv(`${prefix}_kicker`, { ...FILL, ...ROLE.kicker(c) }, fx.kicker),
    tv(`${prefix}_value`, { ...FILL, layout_marginTop: '2dp', ...ROLE.footerValue(c) }, fx.value),
  ]);
const footer = (c, fx, prefix) =>
  el('LinearLayout', { ...FILL, orientation: 'horizontal' }, [
    footerCol(`${prefix}0`, c, fx.f0 || {}, {}),
    footerCol(`${prefix}1`, c, fx.f1 || {}, { layout_marginStart: '10dp' }),
  ]);

const refreshIcon = (id, tint, visibility) =>
  el('ImageView', {
    id: `@+id/${id}`, layout_width: '16dp', layout_height: '16dp', layout_gravity: 'center',
    src: '@drawable/ic_widget_refresh', tint, importantForAccessibility: 'no', visibility,
  });

/** ↻ affordance (§4): a 44×40 tap zone holding a 30dp chip, the 16dp glyph and
 *  its STALE twin (on-accent tint, gone). The zone, not the chip, is the target. */
const refreshZone = (c) =>
  el('FrameLayout', {
    id: '@+id/refresh_zone', layout_width: '44dp', layout_height: '40dp', layout_gravity: 'top|end',
    contentDescription: '@string/widget_refresh_label',
  }, [
    el('ImageView', {
      id: '@+id/refresh_chip', layout_width: '30dp', layout_height: '30dp', layout_gravity: 'center',
      src: `@drawable/widget_chip${c}`, importantForAccessibility: 'no',
    }),
    refreshIcon('refresh_icon', `@color/wg_accent_text${c}`),
    refreshIcon('refresh_icon_inv', `@color/wg_on_accent${c}`, 'gone'),
  ]);

/**
 * Card root: rounded ground + 14dp inset, outer margin from @dimen (8dp pre-31,
 * 0dp on 31+). With a chip the root is a FrameLayout whose 14dp top inset is
 * split 2dp padding + 12dp content margin, so the 30dp chip (centred in its
 * 40dp zone at y=22) sits on the 16dp header line's centre (14 + 8 = 22)
 * without inflating the header's height.
 */
function card(c, { chip = false, orientation = 'vertical', gravity, paddingV = '14dp' }, children) {
  const base = {
    id: '@+id/widget_root', layout_width: 'match_parent', layout_height: 'match_parent',
    layout_margin: '@dimen/widget_outer_margin', background: `@drawable/widget_bg${c}`,
    paddingStart: '14dp', paddingEnd: '14dp',
  };
  const root = chip
    ? el('FrameLayout', { ...base, paddingTop: '2dp', paddingBottom: '14dp' }, [
        el('LinearLayout', { ...FILL, orientation: 'vertical', layout_marginTop: '12dp' }, children),
        refreshZone(c),
      ], true)
    : el('LinearLayout', { ...base, orientation, gravity, paddingTop: paddingV, paddingBottom: paddingV }, children, true);
  return `<?xml version="1.0" encoding="utf-8"?>\n${root}\n`;
}

// ── Layouts (§3.1) ───────────────────────────────────────────────────────────

/** Today block shared by M / L / XL: header, hero 20, slot row 15, divider, footer. */
const todayBlock = (c, fx) => [
  header(c, fx),
  heroRow(c, fx, { prefix: 'hero', markId: 'hero_dot', drawable: 'widget_dot', metrics: HERO_20, color: 'wg_text_primary', marginTop: '10dp' }),
  slotRow(c, fx, { prefix: 'row', metrics: ROW_15, marginTop: '8dp' }),
  divider('divider_1', c),
  footer(c, fx, 'f'),
];

/** Tomorrow block: compact (L) = kicker+date, ring hero 15, row 14; full (XL) = M structure at hero 18.
 *  ROLLED / STALE hide `tmrw_block` and show the single `rolled_body` line instead. */
const tomorrowBlock = (c, full) => [
  divider('tmrw_divider', c),
  el('LinearLayout', { id: '@+id/tmrw_block', ...FILL, orientation: 'vertical' }, [
    el('LinearLayout', { ...FILL, orientation: 'horizontal' }, [
      tv('tmrw_kicker', { ...WRAP, ...ROLE.kicker(c) }),
      tv('tmrw_meta', { ...WEIGHT, layout_marginStart: '8dp', ...ROLE.meta(c) }),
    ]),
    heroRow(c, {}, {
      prefix: 'tmrw_hero', markId: 'tmrw_ring', drawable: 'widget_ring',
      metrics: full ? HERO_18 : HERO_15, color: 'wg_text_secondary', marginTop: '6dp',
    }),
    slotRow(c, {}, { prefix: 'tmrw_row', metrics: full ? ROW_15 : ROW_14, marginTop: '6dp' }),
    full ? divider('tmrw_divider_2', c) : null,
    full ? footer(c, {}, 'tmrw_f') : null,
  ]),
  tv('rolled_body', { ...FILL, ...ROLE.body(c), visibility: 'gone' }),
];

// XS — 2×1 ticker: dot · hero 15 · until 11.5, vertically centred. No kicker, date or ↻.
// STALE swaps `until` for the danger-coloured `hero_stale` twin (§6).
//
// The hero must win the one line (As built): on a 2×1 the old wrap_content `until` was measured
// at full width and squeezed the weighted hero to 0dp. Here the hero twins are wrap_content with
// NO weight, so LinearLayout measures them first against the whole row, and the trailing view is
// 0dp / weight 1: it only gets what the hero leaves, ellipsizes, and sits right-aligned (gravity
// end), which on a wide 4×1 looks exactly like the old right-anchored `until`. Kotlin also hides
// the trailing view when the launcher-reported width cannot hold it beside the whole hero; this
// XML is the backstop for an unknown or misreported width.
const xsTrailing = (id, c, extra = {}) =>
  tv(id, {
    ...WEIGHT, layout_marginStart: '8dp', ...ROLE.until(c, '11.5sp'),
    ellipsize: 'end', gravity: 'end', ...extra,
  });

const layoutXs = (c) =>
  card(c, { gravity: 'center_vertical', paddingV: '8dp' }, [
    el('LinearLayout', { ...FILL, orientation: 'horizontal' }, [
      mark('hero_dot', 'widget_dot'),
      ...twin('hero', HERO_15, { color: 'wg_text_primary', hero: true, width: WRAP }, c),
      xsTrailing('hero_until', c),
      xsTrailing('hero_stale', c, { textColor: `@color/wg_danger${c}`, visibility: 'gone' }),
    ]),
  ]);

// S — 2×2: `TODAY · dateShort` / hero 18 / until / flexible (min 6) / kicker / row 14. No dot, no ↻.
const layoutS = (c) =>
  card(c, {}, [
    el('LinearLayout', { ...FILL, orientation: 'horizontal' }, [
      ...headerKickers(c),
      tv('header_meta', { ...WEIGHT, layout_marginStart: '4dp', ...ROLE.meta(c) }),
    ]),
    ...twin('hero', HERO_18, { color: 'wg_text_primary', hero: true, width: FILL, marginTop: '8dp' }, c),
    tv('hero_until', { ...FILL, ...ROLE.until(c) }),
    el('FrameLayout', { layout_width: 'match_parent', layout_height: '0dp', layout_weight: '1' }),
    tv('row_kicker', { ...FILL, layout_marginTop: '6dp', ...ROLE.kicker(c) }),
    ...twin('row', ROW_14, { color: 'wg_text_secondary', hero: false, width: FILL }, c),
  ]);

// M — 4×2 (default + picker preview): header + ↻, hero, slot row, divider, footer.
const layoutM = (c, fx = {}) => card(c, { chip: true }, todayBlock(c, fx));
// L — 4×3: M + tomorrow compact.  XL — 4×4: M + tomorrow full, top-anchored.
const layoutL = (c) => card(c, { chip: true }, [...todayBlock(c, {}), ...tomorrowBlock(c, false)]);
const layoutXl = (c) => card(c, { chip: true }, [...todayBlock(c, {}), ...tomorrowBlock(c, true)]);

// EMPTY (§6): dot + title, body on S+, ↻ on M+. Strings resolve on the device locale.
// The title is a hero-role string, so it gets the same twins as the hero (§2 / §5.2):
// `empty_title_lat` sans-serif-medium, `empty_title_dev` serif at 600 (bold pre-28) with the
// taller Devanagari line height. Both carry @string/widget_empty_title; Kotlin shows one, chosen
// by testing that string as resolved on the device locale (EMPTY has no payload lang).
const emptyTitle = (c, [sp, latLine, devLine]) => {
  const common = {
    ...WEIGHT, textColor: `@color/wg_text_primary${c}`, textSize: `${sp}sp`, ...ONE_LINE,
    text: '@string/widget_empty_title',
  };
  return [
    tv('empty_title_lat', { ...common, lineHeight: `${latLine}sp`, fontFamily: 'sans-serif-medium' }),
    tv('empty_title_dev', {
      ...common, lineHeight: `${devLine}sp`, fontFamily: 'serif',
      textStyle: 'bold', textFontWeight: '600', visibility: 'gone',
    }),
  ];
};
const emptyHead = (c, metrics, extra = {}) =>
  el('LinearLayout', { ...FILL, orientation: 'horizontal', gravity: 'center_vertical', ...extra }, [
    mark('empty_dot', 'widget_dot'),
    ...emptyTitle(c, metrics),
  ]);
const emptyBody = (c) =>
  tv('empty_body', { ...FILL, layout_marginTop: '4dp', ...ROLE.body(c), text: '@string/widget_empty_body' });

const layoutEmptyXs = (c) =>
  card(c, { gravity: 'center_vertical', paddingV: '8dp' }, [emptyHead(c, HERO_15)]);
const layoutEmptyS = (c) => card(c, {}, [emptyHead(c, HERO_18), emptyBody(c)]);
const layoutEmptyM = (c) =>
  card(c, { chip: true }, [emptyHead(c, HERO_18, { layout_marginEnd: '44dp' }), emptyBody(c)]);

// Picker preview (§9): M with the fixture as literals + the dark register hard-referenced.
const FIXTURE = {
  todayLabel: 'TODAY',
  meta: 'Sat, 20 Sep 2026 · Pune',
  heroValue: 'Krishna Panchami',
  heroUntil: 'until 6:12 PM',
  rowKicker: 'NAKSHATRA',
  rowValue: 'Rohini',
  rowUntil: 'until 9:40 PM',
  f0: { kicker: 'SUNRISE', value: '6:14 AM' },
  f1: { kicker: 'RAHU KALAM', value: '4:30 PM – 6:00 PM' },
};

// ── Kotlin provider ──────────────────────────────────────────────────────────
// No Kotlin string templates are used below so the JS template literal never
// needs an escaped `$`.

const kotlinWidget = (pkg) => `package ${pkg}.widget

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.content.res.Resources
import android.graphics.Paint
import android.graphics.Typeface
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.text.TextPaint
import android.util.SizeF
import android.util.TypedValue
import android.view.View
import android.widget.RemoteViews
import ${pkg}.R
import org.json.JSONObject
import java.time.LocalDate
import java.util.Calendar
import java.util.Locale
import java.util.TimeZone

/**
 * Today's Panchang home-screen widget (Diya).
 *
 * Reads the pre-formatted v3 payload from SharedPreferences
 * (dharmagya_widget_prefs / today_panchang_payload, written by the WidgetData
 * module) and renders it into one of five layouts (xs / s / m / l / xl). Native
 * never formats a number or a date: day selection (FRESH / ROLLED / STALE)
 * compares the device-local date with the payload's per-day ymd, and every
 * other string is displayed verbatim. Any missing or malformed data degrades
 * to the EMPTY placeholder, never a crash.
 */
class TodayPanchangWidget : AppWidgetProvider() {

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        when {
            // The zone changed. ActivityThread already clears the process-wide cached
            // default before this broadcast lands; clearing it again here (the same
            // call the platform makes) means the redraw and the re-armed midnight
            // alarm can never resolve the old zone, whatever the delivery order.
            action == Intent.ACTION_TIMEZONE_CHANGED -> {
                TimeZone.setDefault(null)
                redrawAll(context)
            }
            // Clock set, date changed (not delivered to manifest receivers on 8+) or
            // our own midnight alarm: redraw every instance so the payload's ymd is
            // re-evaluated. onUpdate re-arms the alarm for the next midnight.
            // Locale changed: re-pick the EMPTY title twin for the new device locale.
            action == Intent.ACTION_TIME_CHANGED ||
                action == Intent.ACTION_DATE_CHANGED ||
                action == Intent.ACTION_LOCALE_CHANGED ||
                action == MidnightAlarm.action(context) -> redrawAll(context)
            else -> super.onReceive(context, intent)
        }
    }

    override fun onEnabled(context: Context) {
        MidnightAlarm.schedule(context)
    }

    override fun onDisabled(context: Context) {
        // Last instance removed: nothing left to roll over.
        MidnightAlarm.cancel(context)
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        val model = Model.load(context)
        appWidgetIds.forEach { id ->
            val options = appWidgetManager.getAppWidgetOptions(id)
            appWidgetManager.updateAppWidget(id, remoteViewsFor(context, model, options))
        }
        // Every draw path (placement, the ENABLED + UPDATE pair sent after boot, the
        // 30-min poke, a payload write, a time change, the alarm itself) comes through
        // here, so the alarm is re-armed after a reboot clears it. Same PendingIntent
        // every time: this replaces the pending alarm rather than adding one.
        MidnightAlarm.schedule(context)
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: Bundle
    ) {
        appWidgetManager.updateAppWidget(
            appWidgetId,
            remoteViewsFor(context, Model.load(context), newOptions)
        )
    }

    private fun redrawAll(context: Context) {
        val manager = AppWidgetManager.getInstance(context) ?: return
        val ids = manager.getAppWidgetIds(ComponentName(context, TodayPanchangWidget::class.java))
        if (ids != null && ids.isNotEmpty()) {
            onUpdate(context, manager, ids)
        } else {
            // A stray alarm or time broadcast with no instance placed.
            MidnightAlarm.cancel(context)
        }
    }

    private fun remoteViewsFor(context: Context, model: Model, options: Bundle): RemoteViews {
        val renderer = Renderer(context, model, options)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // API 31+: the launcher picks the largest key that fits its cell (spec §3.1).
            // Heights are each layout's measured natural height (Latin / Devanagari at
            // font scale 1.0: XS 36/41, S 131/149, M 162/181, L 250/280, XL 309/344dp),
            // NOT the spec's smaller numbers, so a layout is never chosen for a cell it
            // overflows. Pixel: 1-row -> XS, 2x2 -> S, 4x2 -> M, 4x3 -> L, 4x4 -> XL.
            return RemoteViews(
                mapOf(
                    SizeF(110f, 40f) to renderer.build(Size.XS),
                    SizeF(110f, 150f) to renderer.build(Size.S),
                    SizeF(240f, 185f) to renderer.build(Size.M),
                    SizeF(240f, 285f) to renderer.build(Size.L),
                    SizeF(240f, 350f) to renderer.build(Size.XL)
                )
            )
        }
        return renderer.build(pickSize(options))
    }

    /**
     * Pre-31: pick by the launcher's minimum cell size (dp) using the same
     * thresholds as the SizeF keys (keep the two in sync). A 4-wide cell too
     * short for M gets S, which is what the 31+ best-fit lookup would choose too.
     */
    private fun pickSize(options: Bundle): Size {
        val w = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0)
        val h = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0)
        return when {
            w >= 240 && h >= 350 -> Size.XL // 4x4
            w >= 240 && h >= 285 -> Size.L // 4x3
            w >= 240 && h >= 185 -> Size.M // 4x2
            h >= 150 -> Size.S // 2x2
            else -> Size.XS // 2x1 / 4x1 ticker
        }
    }
}

/**
 * Device-local calendar arithmetic. Stateless on purpose: the zone is read from
 * TimeZone.getDefault() on every call and never kept in a field, so the next
 * draw after a time-zone change already uses the new zone. java.time needs
 * API 26 without desugaring (minSdk is 24), hence the Calendar branches.
 */
private object LocalClock {

    /** Device-local YYYY-MM-DD right now (spec §0 day selection). */
    fun today(): String {
        val zone = TimeZone.getDefault()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            return LocalDate.now(zone.toZoneId()).toString()
        }
        val cal = Calendar.getInstance(zone)
        return String.format(
            Locale.ROOT,
            "%04d-%02d-%02d",
            cal.get(Calendar.YEAR),
            cal.get(Calendar.MONTH) + 1,
            cal.get(Calendar.DAY_OF_MONTH)
        )
    }

    /**
     * Epoch ms of the start of the next local day plus offsetMs. DST-safe:
     * atStartOfDay (and the lenient Calendar) resolve a skipped midnight to
     * the first instant that exists, e.g. 01:00.
     */
    fun nextMidnightMs(offsetMs: Long): Long {
        val zone = TimeZone.getDefault()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val zoneId = zone.toZoneId()
            val start = LocalDate.now(zoneId).plusDays(1).atStartOfDay(zoneId)
            return start.toInstant().toEpochMilli() + offsetMs
        }
        val cal = Calendar.getInstance(zone)
        cal.add(Calendar.DAY_OF_MONTH, 1)
        cal.set(Calendar.HOUR_OF_DAY, 0)
        cal.set(Calendar.MINUTE, 0)
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)
        return cal.timeInMillis + offsetMs
    }
}

/**
 * Midnight rollover. DATE_CHANGED is not delivered to manifest receivers on
 * API 26+, so without this the widget kept yesterday under TODAY until the next
 * 30-minute updatePeriodMillis poke. One inexact alarm per day, and no
 * SCHEDULE_EXACT_ALARM / USE_EXACT_ALARM permission:
 *
 *  - setWindow(RTC, midnight + 1 min, 10 min) is delivered between 00:01 and
 *    00:11. Plain set() gets AlarmManagerService's heuristic window of 75% of
 *    the time until the trigger (current AOSP caps that at one hour, older
 *    releases do not), so an alarm set at 18:00 for 00:01 could land at 01:01,
 *    or around 04:30 before the cap. A non-zero window is not an exact alarm,
 *    so it needs no permission. 10 minutes is also the minimum window Android
 *    12+ enforces for inexact alarms, so asking for less would gain nothing.
 *  - RTC, not RTC_WAKEUP: nobody sees the widget with the screen off. A due
 *    non-wakeup alarm is held and delivered the moment the screen turns on,
 *    before the launcher is visible, so the device is never woken for it.
 *  - The +1 min keeps the fire clearly inside the new day.
 *  - Explicit broadcast to this provider (component + package), with an
 *    action scoped to the package and one fixed request code. Every call
 *    builds the same PendingIntent, so a reschedule replaces the pending alarm
 *    instead of adding another one.
 */
private object MidnightAlarm {
    private const val ACTION_SUFFIX = ".widget.MIDNIGHT"
    // 0 and 1 are the deep-link activity PendingIntents (REQ_OPEN / REQ_REFRESH).
    private const val REQUEST_CODE = 2
    private const val OFFSET_MS = 60_000L
    private const val WINDOW_MS = 10 * 60_000L

    fun action(context: Context): String = context.packageName + ACTION_SUFFIX

    fun schedule(context: Context) {
        val manager = context.getSystemService(AlarmManager::class.java) ?: return
        val operation = pendingIntent(context, PendingIntent.FLAG_UPDATE_CURRENT) ?: return
        try {
            manager.setWindow(AlarmManager.RTC, LocalClock.nextMidnightMs(OFFSET_MS), WINDOW_MS, operation)
        } catch (e: RuntimeException) {
            // SecurityException on a locked-down OEM build, or IllegalStateException at the
            // per-app alarm cap. The 30-minute updatePeriodMillis poke still rolls the day over.
        }
    }

    fun cancel(context: Context) {
        val operation = pendingIntent(context, PendingIntent.FLAG_NO_CREATE) ?: return
        try {
            context.getSystemService(AlarmManager::class.java)?.cancel(operation)
        } catch (e: RuntimeException) {
            // Nothing to do; the PendingIntent is cancelled below either way.
        }
        operation.cancel()
    }

    private fun pendingIntent(context: Context, flag: Int): PendingIntent? {
        val intent = Intent(action(context))
            .setClass(context, TodayPanchangWidget::class.java)
            .setPackage(context.packageName)
        return PendingIntent.getBroadcast(
            context,
            REQUEST_CODE,
            intent,
            PendingIntent.FLAG_IMMUTABLE or flag
        )
    }
}

private enum class Size { XS, S, M, L, XL }

private enum class State { EMPTY, FRESH, ROLLED, STALE }

private class Slot(val label: String, val value: String, val until: String?)

private class Day(val ymd: String, val dateLong: String, val dateShort: String, val slots: List<Slot>)

/** The payload after day selection (spec §0). today == null means EMPTY. */
private class Model(
    val state: State,
    val theme: String,
    val today: Day?,
    val tomorrow: Day?,
    val todayLabel: String,
    val tomorrowLabel: String,
    val staleLabel: String,
    val refreshLabel: String?,
    val openToUpdateLabel: String,
    val locationLabel: String?
) {
    companion object {
        private const val PREFS_NAME = "dharmagya_widget_prefs"
        private const val KEY_PAYLOAD = "today_panchang_payload"

        private val EMPTY = Model(State.EMPTY, "system", null, null, "", "", "", null, "", null)

        fun load(context: Context): Model {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val raw = prefs.getString(KEY_PAYLOAD, null) ?: return EMPTY
            val json = try {
                JSONObject(raw)
            } catch (e: Exception) {
                return EMPTY
            }
            if (json.optInt("v", 0) < 3) return EMPTY
            val days = json.optJSONArray("days")
            val first = parseDay(days?.optJSONObject(0)) ?: return EMPTY
            val second = parseDay(days?.optJSONObject(1))

            // Resolved now, on every draw (never cached), so a zone change is picked up.
            val deviceToday = LocalClock.today()
            val state: State
            val today: Day
            val tomorrow: Day?
            when {
                deviceToday == first.ymd -> {
                    state = State.FRESH
                    today = first
                    tomorrow = second
                }
                second != null && deviceToday == second.ymd -> {
                    state = State.ROLLED
                    today = second
                    tomorrow = null
                }
                else -> {
                    state = State.STALE
                    today = first
                    tomorrow = null
                }
            }
            val theme = when (json.str("theme")) {
                "dark" -> "dark"
                "light" -> "light"
                else -> "system"
            }
            return Model(
                state = state,
                theme = theme,
                today = today,
                tomorrow = tomorrow,
                todayLabel = json.str("todayLabel") ?: "Today",
                tomorrowLabel = json.str("tomorrowLabel") ?: "Tomorrow",
                staleLabel = json.str("staleLabel") ?: "Out of date",
                refreshLabel = json.str("refreshLabel"),
                openToUpdateLabel = json.str("openToUpdateLabel") ?: "Open Dharmagya to update",
                locationLabel = json.str("locationLabel")
            )
        }

        /** Always four slots; missing ones become dashes so every layout id resolves. */
        private fun parseDay(obj: JSONObject?): Day? {
            if (obj == null) return null
            val slots = obj.optJSONArray("slots")
            val list = (0 until 4).map { i ->
                val s = slots?.optJSONObject(i)
                Slot(s?.str("label") ?: "", s?.str("value") ?: "—", s?.str("until"))
            }
            return Day(
                obj.str("ymd") ?: "",
                obj.str("dateLong") ?: "",
                obj.str("dateShort") ?: "",
                list
            )
        }

        /** optString turns JSON null into the string "null"; treat it as absent instead. */
        private fun JSONObject.str(key: String): String? =
            if (!has(key) || isNull(key)) null else optString(key)
    }
}

/**
 * Colour overrides for the explicit themes (spec §1.3). Theme "system" sets
 * nothing (every field null) and lets values-night pick the register when the
 * host inflates the layout.
 */
private class Colors(
    val accentText: Int?,
    val onAccent: Int?,
    val primary: Int?,
    val secondary: Int?,
    val kicker: Int?,
    val divider: Int?,
    val danger: Int?,
    val bgRes: Int?,
    val chipRes: Int?
) {
    companion object {
        private val SYSTEM = Colors(null, null, null, null, null, null, null, null, null)

        fun forTheme(context: Context, theme: String): Colors = when (theme) {
            "dark" -> Colors(
                context.getColor(R.color.wg_accent_text_forced_dark),
                context.getColor(R.color.wg_on_accent_forced_dark),
                context.getColor(R.color.wg_text_primary_forced_dark),
                context.getColor(R.color.wg_text_secondary_forced_dark),
                context.getColor(R.color.wg_kicker_forced_dark),
                context.getColor(R.color.wg_divider_forced_dark),
                context.getColor(R.color.wg_danger_forced_dark),
                R.drawable.widget_bg_forced_dark,
                R.drawable.widget_chip_forced_dark
            )
            "light" -> Colors(
                context.getColor(R.color.wg_accent_text_forced_light),
                context.getColor(R.color.wg_on_accent_forced_light),
                context.getColor(R.color.wg_text_primary_forced_light),
                context.getColor(R.color.wg_text_secondary_forced_light),
                context.getColor(R.color.wg_kicker_forced_light),
                context.getColor(R.color.wg_divider_forced_light),
                context.getColor(R.color.wg_danger_forced_light),
                R.drawable.widget_bg_forced_light,
                R.drawable.widget_chip_forced_light
            )
            else -> SYSTEM
        }
    }
}

/**
 * Fills one RemoteViews per size from a Model. Layout defaults come from the XML; Kotlin only overrides.
 * options is this instance's AppWidgetManager options bundle (reported sizes, for the XS fit test).
 */
private class Renderer(
    private val context: Context,
    private val model: Model,
    private val options: Bundle
) {

    private val colors = Colors.forTheme(context, model.theme)

    /** Narrowest reported width in dp, read once per draw pass. 0 when the launcher reports none. */
    private val narrowestWidthDp: Float by lazy { readNarrowestWidthDp() }

    /** Whether the EMPTY title, as the launcher will resolve it, is Devanagari. */
    private val emptyTitleIsDevanagari: Boolean by lazy { isDevanagari(deviceLocaleString(R.string.widget_empty_title)) }

    fun build(size: Size): RemoteViews {
        val today = model.today ?: return buildEmpty(size)
        val layout = when (size) {
            Size.XS -> R.layout.widget_today_xs
            Size.S -> R.layout.widget_today_s
            Size.M -> R.layout.widget_today_m
            Size.L -> R.layout.widget_today_l
            Size.XL -> R.layout.widget_today_xl
        }
        val views = RemoteViews(context.packageName, layout)
        colors.bgRes?.let { views.setInt(R.id.widget_root, "setBackgroundResource", it) }
        when (size) {
            Size.XS -> bindXs(views, today)
            Size.S -> bindS(views, today)
            Size.M -> bindM(views, today)
            Size.L -> {
                bindM(views, today)
                bindTomorrow(views, full = false)
            }
            Size.XL -> {
                bindM(views, today)
                bindTomorrow(views, full = true)
            }
        }
        views.setOnClickPendingIntent(R.id.widget_root, deepLink(REQ_OPEN, URI_PANCHANG))
        return views
    }

    /** EMPTY (spec §6): resource strings on the device locale, platform scheme, no colour overrides. */
    private fun buildEmpty(size: Size): RemoteViews {
        val layout = when (size) {
            Size.XS -> R.layout.widget_empty_xs
            Size.S -> R.layout.widget_empty_s
            else -> R.layout.widget_empty_m
        }
        val views = RemoteViews(context.packageName, layout)
        // Title twins (spec §2 / §5.2): serif at 600 for Devanagari, sans-serif-medium otherwise.
        val devanagari = emptyTitleIsDevanagari
        views.setViewVisibility(R.id.empty_title_lat, if (devanagari) View.GONE else View.VISIBLE)
        views.setViewVisibility(R.id.empty_title_dev, if (devanagari) View.VISIBLE else View.GONE)
        if (size == Size.M || size == Size.L || size == Size.XL) {
            views.setOnClickPendingIntent(R.id.refresh_zone, deepLink(REQ_REFRESH, URI_REFRESH))
        }
        views.setOnClickPendingIntent(R.id.widget_root, deepLink(REQ_OPEN, URI_PANCHANG))
        return views
    }

    // ── Per-size binding ────────────────────────────────────────────────────

    /**
     * XS: the hero owns the one line. The trailing until (or, when STALE, the
     * STALE label, spec §6) shows only if it fits beside the whole hero value.
     */
    private fun bindXs(views: RemoteViews, day: Day) {
        val slot = day.slots[0]
        setTwin(views, R.id.hero_lat, R.id.hero_dev, slot.value, colors.primary)
        var staleDot = false
        if (model.state == State.STALE) {
            views.setViewVisibility(R.id.hero_until, View.GONE)
            if (xsTrailingFits(slot.value, model.staleLabel)) {
                views.setViewVisibility(R.id.hero_stale, View.VISIBLE)
                setText(views, R.id.hero_stale, model.staleLabel, colors.danger)
            } else {
                // No room for the label: the dot turns danger-coloured instead, so the card
                // never passes off an old tithi as today's.
                views.setViewVisibility(R.id.hero_stale, View.GONE)
                staleDot = true
            }
        } else {
            views.setViewVisibility(R.id.hero_stale, View.GONE)
            val until = slot.until
            val shown = if (until != null && xsTrailingFits(slot.value, until)) until else null
            setOptional(views, R.id.hero_until, shown, colors.secondary)
        }
        // Set on every draw (recycled views keep the last image and filter). Filter 0 is
        // transparent SRC_ATOP, i.e. no tint: the resource colour shows through.
        views.setImageViewResource(R.id.hero_dot, if (staleDot) R.drawable.widget_dot_stale else R.drawable.widget_dot)
        val dotFilter = if (staleDot) colors.danger else null
        views.setInt(R.id.hero_dot, "setColorFilter", dotFilter ?: 0)
    }

    /**
     * Whether trailing fits beside the whole hero on the XS line at the
     * narrowest width the launcher reports, measured with the XS type roles
     * (hero 15sp, trailing 11.5sp tabular). With no reported width it answers
     * true and leaves it to the XML, where the hero is measured first and the
     * trailing view can only shrink and ellipsize.
     */
    private fun xsTrailingFits(hero: String, trailing: String): Boolean {
        val widthDp = narrowestWidthDp
        if (widthDp <= 0f) return true
        val res = context.resources
        val metrics = res.displayMetrics
        // Outer margin both sides, 14dp padding both sides, 7dp dot + 9dp gap, 8dp before
        // the trailing view, and 4dp slack for launcher rounding.
        val chromePx = 2f * res.getDimension(R.dimen.widget_outer_margin) +
            TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, 14f + 14f + 7f + 9f + 8f + 4f, metrics)
        val availablePx = widthDp * metrics.density - chromePx
        val heroPx = textPaint(15f, heroTypeface(hero)).measureText(hero)
        val trailingPaint = textPaint(11.5f, Typeface.create("sans-serif", Typeface.NORMAL))
        trailingPaint.fontFeatureSettings = "tnum"
        return heroPx + trailingPaint.measureText(trailing) <= availablePx
    }

    private fun textPaint(sp: Float, typeface: Typeface): TextPaint {
        val paint = TextPaint(Paint.ANTI_ALIAS_FLAG)
        // COMPLEX_UNIT_SP follows the user's font scale (non-linear on API 34+), like the TextViews.
        paint.textSize = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, sp, context.resources.displayMetrics)
        paint.typeface = typeface
        return paint
    }

    /** Mirrors the hero twins: Latin sans-serif-medium; Devanagari serif at 600 (bold before API 28). */
    private fun heroTypeface(text: String): Typeface = when {
        !isDevanagari(text) -> Typeface.create("sans-serif-medium", Typeface.NORMAL)
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.P -> Typeface.create(Typeface.SERIF, 600, false)
        else -> Typeface.create(Typeface.SERIF, Typeface.BOLD)
    }

    /**
     * API 31+ lists every size the launcher may show this instance at
     * (orientations, foldable postures) and the XS RemoteViews in the size map
     * serves all of them, so the narrowest one is the one that has to fit.
     * Older launchers report the portrait width as MIN_WIDTH.
     */
    private fun readNarrowestWidthDp(): Float {
        val sizes = reportedSizes()
        if (!sizes.isNullOrEmpty()) return sizes.minOf { it.width }
        return options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0).toFloat()
    }

    /** OPTION_APPWIDGET_SIZES (API 31+); null below 31 or when the launcher sends none. */
    @Suppress("DEPRECATION")
    private fun reportedSizes(): List<SizeF>? = when {
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU ->
            options.getParcelableArrayList(AppWidgetManager.OPTION_APPWIDGET_SIZES, SizeF::class.java)
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ->
            options.getParcelableArrayList<SizeF>(AppWidgetManager.OPTION_APPWIDGET_SIZES)
        else -> null
    }

    /**
     * A string resolved on the device's locales, as the launcher resolves this
     * app's resources when it inflates the RemoteViews, rather than on this
     * process's configuration.
     */
    private fun deviceLocaleString(id: Int): String {
        val config = Configuration(context.resources.configuration)
        config.setLocales(Resources.getSystem().configuration.locales)
        return try {
            context.createConfigurationContext(config).getString(id)
        } catch (e: RuntimeException) {
            context.getString(id)
        }
    }

    private fun bindS(views: RemoteViews, day: Day) {
        bindHeaderKicker(views)
        setText(views, R.id.header_meta, "· " + day.dateShort, colors.secondary)
        setTwin(views, R.id.hero_lat, R.id.hero_dev, day.slots[0].value, colors.primary)
        setOptional(views, R.id.hero_until, day.slots[0].until, colors.secondary)
        setKicker(views, R.id.row_kicker, day.slots[1].label, colors.kicker)
        setTwin(views, R.id.row_lat, R.id.row_dev, day.slots[1].value, colors.secondary)
    }

    private fun bindM(views: RemoteViews, day: Day) {
        bindHeaderKicker(views)
        val location = model.locationLabel
        val meta = if (location.isNullOrEmpty()) day.dateLong else day.dateLong + " · " + location
        setText(views, R.id.header_meta, meta, colors.secondary)
        bindRefreshChip(views)
        setTwin(views, R.id.hero_lat, R.id.hero_dev, day.slots[0].value, colors.primary)
        setOptional(views, R.id.hero_until, day.slots[0].until, colors.secondary)
        setKicker(views, R.id.row_kicker, day.slots[1].label, colors.kicker)
        setTwin(views, R.id.row_lat, R.id.row_dev, day.slots[1].value, colors.secondary)
        setOptional(views, R.id.row_until, day.slots[1].until, colors.secondary)
        colors.divider?.let { views.setInt(R.id.divider_1, "setBackgroundColor", it) }
        bindFooter(views, day, R.id.f0_kicker, R.id.f0_value, R.id.f1_kicker, R.id.f1_value)
    }

    private fun bindTomorrow(views: RemoteViews, full: Boolean) {
        colors.divider?.let { views.setInt(R.id.tmrw_divider, "setBackgroundColor", it) }
        val tomorrow = model.tomorrow
        // Both visibilities on every draw: the host recycles the inflated view when the
        // layout id is unchanged, so ROLLED at midnight followed by FRESH after the app
        // writes would otherwise keep the block hidden.
        views.setViewVisibility(R.id.tmrw_block, if (tomorrow == null) View.GONE else View.VISIBLE)
        views.setViewVisibility(R.id.rolled_body, if (tomorrow == null) View.VISIBLE else View.GONE)
        if (tomorrow == null) {
            // ROLLED / STALE (or a one-day payload): one body line instead of the block.
            setText(views, R.id.rolled_body, model.openToUpdateLabel, colors.secondary)
            return
        }
        setKicker(views, R.id.tmrw_kicker, model.tomorrowLabel, colors.kicker)
        setText(views, R.id.tmrw_meta, tomorrow.dateLong, colors.secondary)
        colors.kicker?.let { views.setInt(R.id.tmrw_ring, "setColorFilter", it) }
        setTwin(views, R.id.tmrw_hero_lat, R.id.tmrw_hero_dev, tomorrow.slots[0].value, colors.secondary)
        setOptional(views, R.id.tmrw_hero_until, tomorrow.slots[0].until, colors.secondary)
        setKicker(views, R.id.tmrw_row_kicker, tomorrow.slots[1].label, colors.kicker)
        setTwin(views, R.id.tmrw_row_lat, R.id.tmrw_row_dev, tomorrow.slots[1].value, colors.secondary)
        setOptional(views, R.id.tmrw_row_until, tomorrow.slots[1].until, colors.secondary)
        if (full) {
            colors.divider?.let { views.setInt(R.id.tmrw_divider_2, "setBackgroundColor", it) }
            bindFooter(
                views, tomorrow,
                R.id.tmrw_f0_kicker, R.id.tmrw_f0_value, R.id.tmrw_f1_kicker, R.id.tmrw_f1_value
            )
        }
    }

    // ── Shared blocks ───────────────────────────────────────────────────────

    /** TODAY in accent, or its STALE twin in danger (spec §6). Both are resource-coloured in system mode. */
    /**
     * State toggles below set BOTH branches on every draw. AppWidgetHostView
     * reapplies a new RemoteViews onto the already-inflated view when the layout
     * id is unchanged, so a visibility or image set in an earlier draw survives
     * into the next one unless it is set again (STALE -> FRESH, ROLLED -> FRESH).
     */
    private fun bindHeaderKicker(views: RemoteViews) {
        val stale = model.state == State.STALE
        views.setViewVisibility(R.id.today_kicker, if (stale) View.GONE else View.VISIBLE)
        views.setViewVisibility(R.id.stale_kicker, if (stale) View.VISIBLE else View.GONE)
        if (stale) {
            setKicker(views, R.id.stale_kicker, model.staleLabel, colors.danger, accent = true)
        } else {
            setKicker(views, R.id.today_kicker, model.todayLabel, colors.accentText, accent = true)
        }
    }

    /** ↻ chip (spec §4): STALE inverts it (turmeric fill, on-accent glyph twin). */
    private fun bindRefreshChip(views: RemoteViews) {
        model.refreshLabel?.let { views.setContentDescription(R.id.refresh_zone, it) }
        val stale = model.state == State.STALE
        val chip = if (stale) R.drawable.widget_chip_inverted else colors.chipRes ?: R.drawable.widget_chip
        views.setImageViewResource(R.id.refresh_chip, chip)
        views.setViewVisibility(R.id.refresh_icon, if (stale) View.GONE else View.VISIBLE)
        views.setViewVisibility(R.id.refresh_icon_inv, if (stale) View.VISIBLE else View.GONE)
        if (stale) {
            colors.onAccent?.let { views.setInt(R.id.refresh_icon_inv, "setColorFilter", it) }
        } else {
            colors.accentText?.let { views.setInt(R.id.refresh_icon, "setColorFilter", it) }
        }
        views.setOnClickPendingIntent(R.id.refresh_zone, deepLink(REQ_REFRESH, URI_REFRESH))
    }

    private fun bindFooter(views: RemoteViews, day: Day, k0: Int, v0: Int, k1: Int, v1: Int) {
        setKicker(views, k0, day.slots[2].label, colors.kicker)
        setText(views, v0, day.slots[2].value, colors.secondary)
        setKicker(views, k1, day.slots[3].label, colors.kicker)
        setText(views, v1, day.slots[3].value, colors.secondary)
    }

    // ── Primitives ──────────────────────────────────────────────────────────

    private fun setText(views: RemoteViews, id: Int, text: String, color: Int?) {
        views.setTextViewText(id, text)
        if (color != null) views.setTextColor(id, color)
    }

    /** Hides the view when the string is absent (e.g. a null until). */
    private fun setOptional(views: RemoteViews, id: Int, text: String?, color: Int?) {
        if (text.isNullOrEmpty()) {
            views.setViewVisibility(id, View.GONE)
        } else {
            views.setViewVisibility(id, View.VISIBLE)
            setText(views, id, text, color)
        }
    }

    /** Twin TextViews (spec §2): show the serif twin for Devanagari, the sans twin otherwise. */
    private fun setTwin(views: RemoteViews, latinId: Int, devaId: Int, text: String, color: Int?) {
        val devanagari = isDevanagari(text)
        views.setViewVisibility(latinId, if (devanagari) View.GONE else View.VISIBLE)
        views.setViewVisibility(devaId, if (devanagari) View.VISIBLE else View.GONE)
        setText(views, if (devanagari) devaId else latinId, text, color)
    }

    /**
     * Kickers (spec §5.1): Latin is uppercased at the role's size and tracking (kickerAccent
     * 10.5sp / 0.15, kicker 10sp / 0.13, as in the XML); Devanagari stays as-is at 11sp,
     * tracking 0. Size and tracking are set in both branches so a recycled view does not
     * keep the other script's metrics after a language switch.
     */
    private fun setKicker(views: RemoteViews, id: Int, text: String, color: Int?, accent: Boolean = false) {
        if (isDevanagari(text)) {
            views.setTextViewText(id, text)
            views.setTextViewTextSize(id, TypedValue.COMPLEX_UNIT_SP, 11f)
            views.setFloat(id, "setLetterSpacing", 0f)
        } else {
            views.setTextViewText(id, text.uppercase(Locale.ROOT))
            views.setTextViewTextSize(id, TypedValue.COMPLEX_UNIT_SP, if (accent) 10.5f else 10f)
            views.setFloat(id, "setLetterSpacing", if (accent) 0.15f else 0.13f)
        }
        if (color != null) views.setTextColor(id, color)
    }

    private fun isDevanagari(text: String): Boolean = DEVANAGARI.containsMatchIn(text)

    private fun deepLink(requestCode: Int, uri: String): PendingIntent {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(uri))
        // Explicit package: another installed app that registers the
        // dharmagya:// scheme must not receive (or chooser-hijack) widget taps.
        intent.setPackage(context.packageName)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        return PendingIntent.getActivity(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
    }

    companion object {
        private val DEVANAGARI = Regex("[\\\\u0900-\\\\u097F]")
        private const val REQ_OPEN = 0
        private const val REQ_REFRESH = 1
        private const val URI_PANCHANG = "dharmagya:///panchang"
        private const val URI_REFRESH = "dharmagya:///refresh-widget"
    }
}
`;

// ── File-write helpers ───────────────────────────────────────────────────────

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
}

function removeIfExists(filePath) {
  if (fs.existsSync(filePath)) fs.rmSync(filePath);
}

// Files written by the pre-Diya (Sacred Editorial) template. A non-clean
// prebuild would otherwise leave them referencing colours that no longer exist.
const LEGACY_FILES = [
  ['layout', 'widget_today_small.xml'],
  ['layout', 'widget_today_medium.xml'],
  ['drawable', 'widget_background.xml'],
  ['drawable', 'widget_background_light.xml'],
  ['drawable', 'widget_refresh_background.xml'],
  ['drawable', 'widget_refresh_background_light.xml'],
];

// ── Plugin entry ─────────────────────────────────────────────────────────────

const withTodayPanchangWidget = (config) => {
  config = withAndroidManifest(config, (cfg) => {
    cfg.modResults = injectReceiver(cfg.modResults);
    return cfg;
  });

  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      const pkg = cfg.android?.package;
      if (!pkg) {
        throw new Error('[withTodayPanchangWidget] expo.android.package is required.');
      }
      const projectRoot = cfg.modRequest.platformProjectRoot;
      const appSrcMain = path.join(projectRoot, 'app', 'src', 'main');
      const packagePath = path.join(appSrcMain, 'java', ...pkg.split('.'), 'widget');
      const res = (dir) => path.join(appSrcMain, 'res', dir);

      for (const [dir, name] of LEGACY_FILES) removeIfExists(path.join(res(dir), name));

      writeFile(path.join(packagePath, 'TodayPanchangWidget.kt'), kotlinWidget(pkg));
      writeFile(path.join(res('xml'), 'today_panchang_widget_info.xml'), widgetInfoXml);

      // Layouts (§3.1) + empty states (§6) + picker preview (§9).
      writeFile(path.join(res('layout'), 'widget_today_xs.xml'), layoutXs(''));
      writeFile(path.join(res('layout'), 'widget_today_s.xml'), layoutS(''));
      writeFile(path.join(res('layout'), 'widget_today_m.xml'), layoutM(''));
      writeFile(path.join(res('layout'), 'widget_today_l.xml'), layoutL(''));
      writeFile(path.join(res('layout'), 'widget_today_xl.xml'), layoutXl(''));
      writeFile(path.join(res('layout'), 'widget_today_preview.xml'), layoutM('_forced_dark', FIXTURE));
      writeFile(path.join(res('layout'), 'widget_empty_xs.xml'), layoutEmptyXs(''));
      writeFile(path.join(res('layout'), 'widget_empty_s.xml'), layoutEmptyS(''));
      writeFile(path.join(res('layout'), 'widget_empty_m.xml'), layoutEmptyM(''));

      // Drawables: card ground (24dp pre-31, system radius on 31+), chips, marks, glyph.
      for (const suffix of ['', '_forced_dark', '_forced_light']) {
        writeFile(path.join(res('drawable'), `widget_bg${suffix}.xml`), bgDrawable(suffix, '24dp'));
        writeFile(
          path.join(res('drawable-v31'), `widget_bg${suffix}.xml`),
          bgDrawable(suffix, '@android:dimen/system_app_widget_background_radius'),
        );
        writeFile(path.join(res('drawable'), `widget_chip${suffix}.xml`), chipDrawable(suffix));
      }
      writeFile(path.join(res('drawable'), 'widget_chip_inverted.xml'), chipInvertedDrawable);
      writeFile(path.join(res('drawable'), 'widget_dot.xml'), dotDrawable);
      writeFile(path.join(res('drawable'), 'widget_dot_stale.xml'), dotStaleDrawable);
      writeFile(path.join(res('drawable'), 'widget_ring.xml'), ringDrawable);
      writeFile(path.join(res('drawable'), 'ic_widget_refresh.xml'), refreshIconVector);

      // Sidecar values: colours (light / night / forced), strings (en / hi), dimens (pre-31 / 31+).
      writeFile(path.join(res('values'), 'widget_colors.xml'), widgetColorsXml);
      writeFile(path.join(res('values-night'), 'widget_colors.xml'), widgetColorsNightXml);
      writeFile(path.join(res('values'), 'widget_strings.xml'), widgetStringsXml);
      writeFile(path.join(res('values-hi'), 'widget_strings.xml'), widgetStringsHiXml);
      writeFile(path.join(res('values'), 'widget_dimens.xml'), dimensXml('8dp'));
      writeFile(path.join(res('values-v31'), 'widget_dimens.xml'), dimensXml('0dp'));

      return cfg;
    },
  ]);

  return config;
};

module.exports = withTodayPanchangWidget;
