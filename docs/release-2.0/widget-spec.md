> **Status (2026-09-23):** design spec the widgets were built from. The code deviates from it where on-device testing proved the spec wrong; the "As built" section at the end is authoritative where the two disagree.

# Today's Panchang widget — Diya spec (Android RemoteViews + iOS WidgetKit)

Read-only audit of `/Users/ishank/code/personal/dharmagya` (branch `tactile-polish`). Sources used: `src/config/theme.ts` (Diya tokens), `app/(tabs)/index.tsx` (Home panchang hero + `PanchangRow`), `plugins/withTodayPanchangWidget.js` (current Sacred-Editorial Android widget), `src/types/widget.ts` + `src/services/widgets/*` (payload), `app/refresh-widget.tsx`, `app/settings/widget.tsx`, i18n `en.ts`/`hi.ts`, `app.json`, `PLAN.md` §4 / §7c / §11.

Two facts the implementers must know before starting:

- `design/redesign-preview.html` is the **old Sacred Editorial** study (Fraunces, parchment, sindoor, `#1A1008`). Do not take colours or type from it. `src/config/theme.ts` and the Home hero in `app/(tabs)/index.tsx` are the only Diya sources of truth.
- `@bacons/apple-targets ^5.0.0` is in `package.json` but there is no `targets/` folder and no plugin entry in `app.json`; the iOS implementer creates `targets/widget/expo-target.config.js` (see §8). The Android implementer replaces the templates inside `plugins/withTodayPanchangWidget.js` in place (same plugin, same receiver FQCN `com.ishank1995.dharmagya.widget.TodayPanchangWidget` — the ProGuard keep rule and `WidgetDataModule.kt` both reference it by name).

All numbers below are **dp/sp on Android and pt on iOS** unless a column says otherwise. "Latin" means the string has no Devanagari; "Devanagari" means it matches `/[ऀ-ॿ]/` (identical to `DEVA_RE` in `index.tsx:43`). The test is per string, never per language — a Hindi payload still carries Latin times such as `5:48 AM`.

---

## 0. Payload contract (v3) — what the renderers read

Both renderers read one JSON document (Android: `SharedPreferences dharmagya_widget_prefs / today_panchang_payload`; iOS: `UserDefaults(suiteName: "group.com.ishank1995.dharmagya")`, same key). Everything is a pre-formatted string; native never formats a number or a date.

```jsonc
{
  "v": 3,
  "writtenAtMs": 1758335400000,
  "lang": "en",                       // "en" | "hi"
  "theme": "system",                  // NEW — "system" | "light" | "dark"  (store.themeMode)
  "isDarkMode": true,                 // kept for v2 readers; v3 renderers ignore it
  "todayLabel": "Today",              // "आज"
  "tomorrowLabel": "Tomorrow",        // NEW — "कल"
  "staleLabel": "Out of date",        // NEW — "पुराना डेटा"
  "refreshLabel": "Refresh widget",   // NEW — a11y only — "विजेट रिफ्रेश करें"
  "openToUpdateLabel": "Open Dharmagya to update", // NEW — "अपडेट के लिए धर्मज्ञ खोलें"
  "locationLabel": "Pune",            // or null
  "days": [
    { "ymd": "2026-09-20", "dateLong": "Sat, 20 Sep 2026", "dateShort": "Sat, 20 Sep",   // dateShort NEW
      "slots": [ { "id":"tithi",     "label":"Tithi",      "value":"Krishna Panchami", "until":"until 6:12 PM" },
                 { "id":"nakshatra", "label":"Nakshatra",  "value":"Rohini",           "until":"until 9:40 PM" },
                 { "id":"sunrise",   "label":"Sunrise",    "value":"6:14 AM",          "until":null },
                 { "id":"rahuKalam", "label":"Rahu Kalam", "value":"4:30 PM – 6:00 PM","until":null } ] },
    { "ymd": "2026-09-21", "dateLong": "Sun, 21 Sep 2026", "dateShort": "Sun, 21 Sep", "slots": [ /* same shape */ ] }
  ]
}
```

Fields the spec **needs added** to what the brief listed: `theme`, `tomorrowLabel`, `staleLabel`, `refreshLabel`, `openToUpdateLabel`, per-day `ymd`, per-day `dateShort`. Fields the spec does **not** need: separate `sunrise/sunset/moonrise/moonset/tithi/nakshatra/paksha/masa` — every size renders only the four user-chosen slots (the whole point of `app/settings/widget.tsx`, which PLAN §7c records as currently inert because the Kotlin never reads `slots[]`). The v1 flat keys (`tithiName`, `labels`, …) may be dropped from the payload once both renderers ship.

Hindi `until` strings arrive already in Hindi word order (`"६:१२ PM तक"`, mirroring `home.untilTime: '{{time}} तक'`); renderers never split or re-assemble them.

### Day selection (both platforms, at every render)
```
deviceToday = local YYYY-MM-DD at render time
if deviceToday == days[0].ymd            → today := days[0], tomorrow := days[1]          (FRESH)
elif deviceToday == days[1].ymd          → today := days[1], tomorrow := none             (ROLLED — relabel with todayLabel)
else                                     → STALE  (payload is ≥ 2 calendar days old)      (§6)
if no payload / unparsable / v < 3       → EMPTY  (§6)
```

---

## 1. Colour tokens

Ground choice follows the app's own rule (PLAN §7c P17.23): `surface` for in-page cards, **`surfaceRaised` for anything that floats over the screen**. A home-screen widget floats, so dark = `nightRaised`, light = `riceCard`. The outline is the panchang hero's `borderAccent`; there is no gradient, no glow, no corner brackets (Diya: "ornament is gone — hierarchy is size, space and the single accent").

Alpha resolved against the widget ground. Contrast is WCAG 2.x against that ground. Rule enforced here: every **readable string ≥ 4.5:1**, every **kicker ≥ 3:1**. Two app alphas fail that on an opaque ground and are therefore not used in the widget: dark `textMuted` (0.35 → 2.84:1) and light `textMuted` (0.42 → 2.62:1). Where the Home hero uses `textTertiary` for a readable string (`until`, times) the widget promotes it to `textSecondary`.

### 1.1 Dark register (ground `nightRaised`)

| Token | Diya source | Opaque hex | Contrast on `#241C30` | Used for |
|---|---|---|---|---|
| `wg_bg` | `palette.nightRaised` | `#241C30` | — | card ground |
| `wg_border` | `darkColors.borderAccent` rgba(216,163,26,.24) | `#4F3C2B` | 1.57 (non-text) | 1dp outline (Android only) |
| `wg_accent_text` | `darkColors.accentText` = turmeric | `#D8A31A` | **7.15** | TODAY kicker, ↻ glyph |
| `wg_accent_fill` | `palette.turmeric` | `#D8A31A` | — | hero dot, inverted chip fill |
| `wg_on_accent` | `palette.night` | `#171220` | 8.02 on turmeric | glyph on inverted chip |
| `wg_text_primary` | `palette.bone` | `#EDE8F0` | 13.55 | hero value (today) |
| `wg_text_secondary` | bone @ .62 | `#A19AA7` | **5.99** | date, location, row values, `until`, footer values, tomorrow hero |
| `wg_kicker` | bone @ .45 (`textTertiary`) | `#7E7886` | **3.83** | slot kickers, TOMORROW kicker, tomorrow ring |
| `wg_divider` | white @ .06 | `#312A3C` | — | 1dp rules |
| `wg_chip_bg` | `darkColors.accentSurface` turmeric @ .10 | `#362A2E` | turmeric on it 6.01 | ↻ chip fill |
| `wg_chip_border` | = `wg_border` | `#4F3C2B` | — | ↻ chip outline |
| `wg_danger` | `palette.roseText` | `#E4708A` | **5.44** | STALE kicker |

### 1.2 Light register (ground `riceCard`)

| Token | Diya source | Opaque hex | Contrast on `#FFFFFF` | Used for |
|---|---|---|---|---|
| `wg_bg` | `palette.riceCard` | `#FFFFFF` | — | card ground |
| `wg_border` | `lightColors.borderAccent` rgba(168,122,0,.22) | `#ECE2C7` | 1.29 (non-text) | 1dp outline (Android only) |
| `wg_accent_text` | `palette.turmericInk` | `#7A5900` | **6.45** | TODAY kicker, ↻ glyph |
| `wg_accent_fill` | `palette.turmeric` | `#D8A31A` | 2.29 (decorative dot only) | hero dot, inverted chip fill |
| `wg_on_accent` | `palette.ink` | `#221B24` | 7.34 on turmeric | glyph on inverted chip |
| `wg_text_primary` | `palette.ink` | `#221B24` | 16.80 | hero value (today) |
| `wg_text_secondary` | ink @ .68 | `#69646A` | **5.78** | date, location, row values, `until`, footer values, tomorrow hero |
| `wg_kicker` | ink @ .50 (`textTertiary`) | `#918D92` | **3.27** | slot kickers, TOMORROW kicker, tomorrow ring |
| `wg_divider` | ink @ .07 | `#F0EFF0` | — | 1dp rules |
| `wg_chip_bg` | `lightColors.accentSurface` | `#FFF9E6` | turmericInk on it 6.12 | ↻ chip fill |
| `wg_chip_border` | = `wg_border` | `#ECE2C7` | — | ↻ chip outline |
| `wg_danger` | `palette.crimsonText` | `#8C1D18` | **9.11** | STALE kicker |

Never use `#D8A31A` as text on the light ground (2.29:1) — that is the app-wide `accent` vs `accentText` rule from the 2.0.0 release audit. Material You / dynamic colour is **not** adopted (Diya is a fixed palette); iOS tinted mode is handled in §8.

### 1.3 Register selection
```
theme == "dark"   → dark register
theme == "light"  → light register
theme == "system" → platform scheme: Android = res/values-night qualifier (UI_MODE_NIGHT), iOS = @Environment(\.colorScheme)
EMPTY (no payload) → platform scheme
```

---

## 2. Type roles

System fonts only. Geist ↔ platform sans (Android `sans-serif` = Roboto; iOS SF, `design: .default`). Do **not** use `.rounded` or `.serif` designs on iOS and do not use `serif` for Latin on Android — Diya has no Latin serif. NotoSerifDevanagari ↔ Android `fontFamily="serif"` **for Devanagari strings only** (Android's `fonts.xml` maps the serif family's Devanagari fallback to Noto Serif Devanagari on API 26+; on 24–25 it degrades to Noto Sans Devanagari, which is acceptable). On iOS there is no serif Devanagari system face; SF `.default` falls back to Kohinoor Devanagari for every Devanagari string.

| Role | Size (sp = pt) | Line height | Weight | Tracking | Case | Colour | Android family | iOS font |
|---|---|---|---|---|---|---|---|---|
| `kickerAccent` — TODAY / STALE | 10.5 (Deva 11) | 14 | 500 | Latin +1.6 (`letterSpacing="0.15"`), Deva 0 | Latin upper, Deva as-is | `wg_accent_text` (`wg_danger` when stale) | `sans-serif-medium` | `.system(size:10.5, weight:.medium)` `.tracking(1.6)` |
| `kicker` — slot labels, TOMORROW | 10 (Deva 11) | 14 | 500 | Latin +1.3 (`0.13`), Deva 0 | as above | `wg_kicker` | `sans-serif-medium` | `.system(size:10, weight:.medium)` `.tracking(1.3)` |
| `meta` — date · location | 11 | 15 | 400 | 0 | as-is | `wg_text_secondary` | `sans-serif` | `.system(size:11)` |
| `hero` — slot 0 value | 20 (M/L/XL, systemLarge) · 19 (systemMedium) · 18 (S, systemSmall) · 15 (XS) | 26 (Deva 28) | Latin 500 / Deva 600 | 0 | as-is | today `wg_text_primary`, tomorrow `wg_text_secondary` | Latin `sans-serif-medium`; Deva `serif` + `textFontWeight="600"` (API 28+, else `textStyle="bold"`) | Latin `.medium`; Deva `.semibold` |
| `heroUntil` — slot 0 `until` | 12.5 | 17 | 400 tabular | 0 | as-is | `wg_text_secondary` | `sans-serif`, `fontFeatureSettings="tnum"` | `.system(size:12.5).monospacedDigit()` |
| `row` — slot 1 value | 15 (systemMedium 14) | 20 (Deva 22) | 400 | 0 | as-is | `wg_text_secondary` | Latin `sans-serif`; Deva `serif` | `.regular` |
| `rowUntil` — slot 1 `until` | 12.5 | 17 | 400 tabular | 0 | as-is | `wg_text_secondary` | as `heroUntil` | as `heroUntil` |
| `footerValue` — slots 2–3 | 13 (systemMedium 12.5) | 18 | 500 tabular | 0 | as-is | `wg_text_secondary` | `sans-serif-medium` + `tnum` | `.medium.monospacedDigit()` |
| `body` — empty/stale helper line | 12.5 | 17 | 400 | 0 | as-is | `wg_text_secondary` | `sans-serif` | `.regular` |

Android implementation note for the two families: RemoteViews cannot change a TextView's typeface at runtime, so every `hero` and `row` TextView is written **twice** in the layout XML — `@+id/<name>_lat` (`sans-serif`/`sans-serif-medium`) and `@+id/<name>_dev` (`serif`) — and Kotlin shows exactly one with `setViewVisibility` after testing the string against the Devanagari regex. Footer values, `until` strings, meta and kickers use `sans-serif` regardless of script (below 14sp Noto Sans Devanagari is the more legible fallback, and these are mostly digits anyway).

Tabular figures: Android `android:fontFeatureSettings="tnum"`; iOS `.monospacedDigit()`. Applies to every role that can carry a time.

Font scaling: Android `sp` follows the user's font size and is not resisted; every value is `maxLines="1"` + `ellipsize="end"`, so the layout degrades by truncation, never by overflow. iOS uses fixed point sizes (no Dynamic Type) plus `.minimumScaleFactor(0.8)` on `hero` only.

---

## 3. Layouts per size

Common rules for every size:

- Outer inset 14 (Android `android:padding="14dp"` on the root; iOS: rely on the system content margins and add nothing — do **not** call `.contentMarginsDisabled()`).
- Everything start-aligned; `hi` is LTR. Nothing is centred except the XS ticker's vertical axis.
- Hero row = 7×7 turmeric dot (`wg_accent_fill`, Android: `ImageView` + oval drawable; iOS: `Circle().fill`) · gap 9 · value (`layout_weight=1` / `.layoutPriority(0)`) · gap 8 · `until` (`wrap_content` / `.layoutPriority(1)`, `.fixedSize()`). The value shrinks and ellipsizes; `until` is never truncated. `until` sits on the value's baseline, right-anchored by the value's stretch.
- Slot-1 row (mirrors `PanchangRow` in `index.tsx:551`) = kicker (`minWidth` 64, never a fixed width) · gap 10 · value (weight 1) · gap 8 · `until`.
- Footer = two equal columns (each 50% minus a 10 gutter), kicker above value, gap 2 between them.
- Dividers 1dp/pt `wg_divider`, 10 above and 10 below (8 on systemMedium).
- Every value: 1 line, tail ellipsis. Header meta: 1 line, tail ellipsis — composed as `dateLong + " · " + locationLabel` so the location is what gets cut first. When `locationLabel` is null, no separator.
- Tomorrow block: kicker `tomorrowLabel` in `wg_kicker` (not accent), hero value in `wg_text_secondary`, and the dot becomes a 7×7 **ring** (1.5 stroke, `wg_kicker`, no fill). No location, no ↻.

### 3.1 Android

One provider, five layouts, chosen by available size. API 31+: `RemoteViews(mapOf(SizeF→RemoteViews))` with the keys below (the launcher picks the largest key that fits). API < 31: pick by `OPTION_APPWIDGET_MIN_WIDTH` / `MIN_HEIGHT` against the same thresholds. The dp keys are the layout's true minimum, not the 70n−30 cell formula — real launchers give a 4×2 well over 250×150.

| Layout | Key `SizeF(w,h)` | Nominal cells | Content |
|---|---|---|---|
| `widget_today_xs` | (110, 40) | 2×1 | ticker: dot + slot0 value + until |
| `widget_today_s` | (110, 100) | 2×2 | kicker·dateShort, hero, until, slot1 |
| `widget_today_m` | (240, 150) | 4×2 | header + ↻, hero, slot1, divider, footer |
| `widget_today_l` | (240, 240) | 4×3 | M + tomorrow compact |
| `widget_today_xl` | (240, 330) | 4×4 | M + tomorrow full |

**XS — 2×1 (`widget_today_xs`)**, content vertically centred, single line:
```
┌──────────────────────────────────────┐
│ ● Krishna Panchami      until 6:12 PM│   dot 7 · hero 15/500 primary · until 11.5 secondary (tabular)
└──────────────────────────────────────┘
```
No kicker, no date, no ↻ (the dot is the brand mark). Tap anywhere → `dharmagya:///panchang`. If `until` is null the value takes the full width.

**S — 2×2 (`widget_today_s`)**:
```
┌────────────────────────┐
│ TODAY · Sat, 20 Sep    │  kickerAccent 10.5 + " · " + dateShort as meta 11 (one TextView pair, baseline-aligned, 1 line, ellipsize end)
│                        │  8
│ Krishna Panchami       │  hero 18/500 primary, 1 line
│ until 6:12 PM          │  heroUntil 12.5 secondary  (row hidden when null; hero keeps its slot)
│                        │  flexible space (min 6)
│ NAKSHATRA              │  kicker 10
│ Rohini                 │  row 14 secondary, 1 line  (slot1.until omitted at this size)
└────────────────────────┘
```
No dot at S (width is precious), no ↻, whole card taps to `/panchang`.

**M — 4×2 (`widget_today_m`)** — the default and the picker preview:
```
┌────────────────────────────────────────────────────┐ 14
│ TODAY  Sat, 20 Sep 2026 · Pune                (↻)  │ header row 16 tall; kickerAccent · gap 8 · meta (weight 1) · chip
│                                                    │ 10
│ ● Krishna Panchami                  until 6:12 PM  │ hero 20 primary · heroUntil 12.5 secondary
│                                                    │ 8
│ NAKSHATRA   Rohini                  until 9:40 PM  │ kicker 10 (minWidth 64) · row 15 secondary · rowUntil 12.5
│ ────────────────────────────────────────────────── │ divider, 10/10
│ SUNRISE                 RAHU KALAM                 │ footer kickers 10
│ 6:14 AM                 4:30 PM – 6:00 PM          │ footer values 13/500 tabular secondary
└────────────────────────────────────────────────────┘ 14
```
Hindi rendering of the same layout (no case change, no tracking, serif twins shown):
```
│ आज  शनि, २० सित॰ २०२६ · पुणे                   (↻)  │
│ ● कृष्ण पंचमी                        ६:१२ PM तक   │
│ नक्षत्र     रोहिणी                    ९:४० PM तक   │
│ ────────────────────────────────────────────────── │
│ सूर्योदय                 राहु काल                    │
│ ६:१४ AM                 ४:३० PM – ६:०० PM          │
```

**L — 4×3 (`widget_today_l`)** = M, then:
```
│ ────────────────────────────────────────────────── │ divider 10/10
│ TOMORROW  Sun, 21 Sep 2026                         │ kicker 10 (wg_kicker) · meta 11
│                                                    │ 6
│ ○ Krishna Shashthi                  until 7:58 PM  │ ring 7 · hero 15 secondary · until 12.5
│ NAKSHATRA   Mrigashira             until 11:02 PM  │ row 14 secondary  (6 above)
└────────────────────────────────────────────────────┘
```
Tomorrow compact shows slots 0–1 only (no footer cells).

**XL — 4×4 (`widget_today_xl`)** = M, divider, then the tomorrow block at **full** M structure (header without location/↻, hero 18 secondary with ring, slot-1 row, divider, footer cells). Content is top-anchored; leftover height stays empty at the bottom.

When ROLLED (no tomorrow data), L and XL hide the tomorrow block and show one `body` line in its place: `openToUpdateLabel`.

### 3.2 iOS

Families: `.systemSmall`, `.systemMedium`, `.systemLarge`, `.accessoryRectangular`. Sizes below are iPhone 15-class content areas after the system's 16pt margins.

**systemSmall (≈126×126 content)**:
```
┌──────────────────┐
│ TODAY            │ kickerAccent 10.5
│ Sat, 20 Sep      │ meta 11 (dateShort)
│                  │ 8
│ Krishna Panchami │ hero 18 semibold(Deva)/medium(Latin) primary, lineLimit 1, minimumScaleFactor 0.8
│ until 6:12 PM    │ heroUntil 12 secondary
│                  │ Spacer(minLength: 4)
│ NAKSHATRA        │ kicker 10
│ Rohini           │ row 14 secondary, lineLimit 1
└──────────────────┘
```
No dot, no location.

**systemMedium (≈306×126; SE ≈289×116)** — identical structure to Android M **without the ↻ chip**, with the tighter numbers: header 13 tall, gap 8, hero 19 (line 24), gap 6, row 14 (line 18), divider gap 8/8, footer kicker 10 + value 12.5. `VStack(alignment: .leading, spacing: 0)` with explicit `Spacer().frame(height:)` gaps so nothing stretches; the footer `HStack` gets `.layoutPriority(1)` so the hero is what compresses on SE.

**systemLarge (≈306×322)**: Today at systemMedium metrics (hero 20) · divider (10/10) · Tomorrow at full structure (kicker+date, ring hero 18 secondary, slot-1 row, divider, footer cells) · `Spacer()` to the bottom. ROLLED: replace the tomorrow block with one `body` line `openToUpdateLabel`.

**accessoryRectangular (lock screen, ≈160×60 content, 3 lines)**:
```
┌────────────────────────┐
│ TODAY · SAT, 20 SEP    │ caption2 11 semibold, uppercase (Latin only), .widgetAccentable()
│ Krishna Panchami       │ headline 15 semibold, lineLimit 1, minimumScaleFactor 0.85
│ until 6:12 PM · Rohini │ caption 12, .secondary, lineLimit 1  (= slot0.until · slot1.value; omit the missing half and its separator)
└────────────────────────┘
```
Lock-screen widgets render vibrant/monochrome: use only `Color.primary` / `Color.secondary` here, never the hex tokens. No location on the lock screen. STALE on the lock screen: line 1 = `staleLabel` (still accentable).

---

## 4. Header, refresh affordance, tap targets

**Header (M, L, XL, systemMedium, systemLarge)** = `kickerAccent(todayLabel)` · gap 8 · `meta(dateLong[ · locationLabel])` · flexible · [Android only: ↻ chip]. S/systemSmall collapse to `todayLabel · dateShort` on one line and drop the location. XS/accessoryRectangular drop the location. Location is never shown for tomorrow.

**Refresh affordance — Android only, sizes M/L/XL.** A 30×30dp circle (`wg_chip_bg` fill, 1dp `wg_chip_border`, radius 15dp) holding a 16dp vector `ic_widget_refresh` (Material "refresh" path, `res/drawable`, tinted at runtime with `setInt(id, "setColorFilter", wg_accent_text)`). It lives inside a 44×40dp `FrameLayout` (`@+id/refresh_zone`, gravity end|center_vertical, top-right of the header, 14dp from both card edges) which is the click target — the visible chip is smaller than the target on purpose. `contentDescription = refreshLabel`. Do not use the `↻` text glyph (OEM fonts drop it). STALE inverts the chip: fill `wg_accent_fill`, icon `wg_on_accent`, no border. iOS has no refresh chip anywhere; WidgetKit reloads on its own timeline (§8) and the app reloads timelines after every payload write.

**Tap targets / deep links (unchanged URIs, triple slash):**

| Region | Android | iOS |
|---|---|---|
| Whole card (`@+id/widget_root`) | `PendingIntent` ACTION_VIEW `dharmagya:///panchang`, `FLAG_IMMUTABLE | FLAG_UPDATE_CURRENT`, request code 0 | `.widgetURL(URL("dharmagya:///panchang"))` on the root view of every family |
| ↻ zone (`@+id/refresh_zone`) | ACTION_VIEW `dharmagya:///refresh-widget`, request code 1 | — |
| Tomorrow block | same as whole card (no date-specific route exists; do not invent one) | same |

`app/refresh-widget.tsx` already forces a recompute and `dismissTo('/panchang')`; nothing there changes.

---

## 5. Hindi (Devanagari) rules

Applied per **string**, decided by the Devanagari regex, not by `lang`:

1. Kickers: no uppercasing (Android: never call `.uppercase()` on a Devanagari string; iOS: no `.textCase(.uppercase)`), tracking **0** (Android `views.setFloat(id, "setLetterSpacing", 0f)`; iOS `.tracking(0)`), size **11** instead of 10/10.5 (Android `setTextViewTextSize(id, COMPLEX_UNIT_SP, 11f)`).
2. `hero` and `row` values switch to the serif twin on Android (§2) and to `.semibold`/`.regular` SF-with-fallback on iOS. Line height 28 for hero, 22 for row (vs 26/20 Latin) so matras (ि, ी, ू, ्र) are not clipped: Android `android:lineHeight` on the `_dev` twins, `android:includeFontPadding="true"` (leave the default; never set it false on a Devanagari TextView); iOS `.lineSpacing(2)`.
3. Minimum sizes with Devanagari: values ≥ 13, kickers ≥ 11. XS ticker with a Devanagari hero uses 15 as specified (already ≥ 13).
4. Never split or re-order `until` strings; never append "until"/"तक" natively.
5. Devanagari digits arrive pre-converted when the user opted in (`useDevanagariNumerals`); tabular-figure settings apply to them unchanged.
6. Latin kickers are uppercased natively (Android `.uppercase(Locale.ROOT)`, iOS `.textCase(.uppercase)`); the payload keeps Title Case, as `widgetFields.ts` documents.

---

## 6. Empty, stale and rolled states

**EMPTY (no payload / unparsable / `v < 3`)** — no `lang` is known, so strings come from native resources keyed on the **device** locale (`res/values/widget_strings.xml` + `res/values-hi/`; iOS `Localizable.strings` en + hi):

| key | en | hi |
|---|---|---|
| `widget_today_label` (provider label / `configurationDisplayName`) | Today's Panchang | आज का पंचांग |
| `widget_today_desc` (`android:description` / WidgetKit `description`) | Tithi, nakshatra and timings for the day, at a glance. | दिन की तिथि, नक्षत्र और समय — एक नज़र में। |
| `widget_empty_title` | Today's Panchang | आज का पंचांग |
| `widget_empty_body` | Open Dharmagya once to load today's panchang. | आज का पंचांग लोड करने के लिए धर्मज्ञ एक बार खोलें। |

Empty layout (all sizes; XS shows only the title line):
```
┌────────────────────────────────────────────────────┐
│ ● Today's Panchang                            (↻)  │ dot + hero 18 primary; ↻ on M+ (Android)
│ Open Dharmagya once to load today's panchang.      │ body 12.5 secondary, maxLines 2
└────────────────────────────────────────────────────┘
```
Register follows the platform scheme. Whole card → `/panchang` (the app writes the payload on foreground via `refreshTodayWidget`).

**STALE (`deviceToday` matches neither day, i.e. payload written ≥ 2 days ago)** — content stays visible (it is still the last known panchang) but the header tells the truth:
- `kickerAccent` text = `staleLabel`, colour `wg_danger`.
- meta = the payload's `days[0].dateLong` unchanged (so the old date is legible).
- Android M/L/XL: ↻ chip inverted (turmeric fill). XS/S: unchanged apart from — XS has no header, so XS renders `staleLabel` in place of `until`, in `wg_danger` 11.5.
- Tomorrow block (L/XL/systemLarge) replaced by one `body` line `openToUpdateLabel`.
- iOS: additionally, systemSmall replaces the `dateShort` line with `staleLabel` in `wg_danger`.

**ROLLED (`deviceToday == days[1].ymd`)** — render `days[1]` as today with `todayLabel`; tomorrow block → `openToUpdateLabel` line (§3). Not an error state; no danger colour.

---

## 7. Android 12+ specifics (`res/xml/today_panchang_widget_info.xml`)

```xml
<appwidget-provider
    android:minWidth="110dp"  android:minHeight="40dp"          <!-- XS -->
    android:minResizeWidth="110dp"  android:minResizeHeight="40dp"
    android:maxResizeWidth="250dp"  android:maxResizeHeight="250dp"   <!-- 4x4 by the 70n−30 formula -->
    android:targetCellWidth="4"  android:targetCellHeight="2"       <!-- default placement = M -->
    android:resizeMode="horizontal|vertical"
    android:initialLayout="@layout/widget_today_m"
    android:previewLayout="@layout/widget_today_preview"          <!-- API 31+ -->
    android:previewImage="@drawable/widget_today_preview_png"      <!-- < 31; render M with the §9 fixture -->
    android:description="@string/widget_today_desc"
    android:updatePeriodMillis="0"                                 <!-- unchanged 2026-05-06 decision -->
    android:widgetCategory="home_screen" />
```

- **Rounded corners**: `res/drawable-v31/widget_bg.xml` uses `android:radius="@android:dimen/system_app_widget_background_radius"` (Pixel resolves to 28dp, matching the theme comment "hero 24 // Android 28"); `res/drawable/widget_bg.xml` (pre-31) uses `24dp` (= `borderRadius.hero` as implemented). Both: `<solid @color/widget_bg>` + `<stroke 1dp @color/widget_border>`. Nested chip radius 15dp (a circle; `system_app_widget_inner_radius` is irrelevant for a full circle).
- **Padding**: Android 12 launchers add their own outer padding. Define `@dimen/widget_outer_margin` = `8dp` in `values/` and `0dp` in `values-v31/`, apply it as `layout_margin` on the root so pre-12 launchers get breathing room and 12+ does not double it. Card inset stays 14dp inside.
- **System theme**: layout XML references only `@color/widget_*` names; `res/values/widget_colors.xml` holds the light register, `res/values-night/widget_colors.xml` the dark register (same names). For `theme == "system"` Kotlin sets **no** colours and lets the host re-inflate on `uiMode` changes. For explicit themes Kotlin overrides every text/tint/background with the `*_forced_dark` / `*_forced_light` resource set (both registers duplicated under those suffixes in `values/` only), exactly as the current template does for light.
- **Responsive layouts**: API 31+ `RemoteViews(mapOf(SizeF(110f,40f) to xs, SizeF(110f,100f) to s, SizeF(240f,150f) to m, SizeF(240f,240f) to l, SizeF(240f,330f) to xl))`; below 31 choose in `onAppWidgetOptionsChanged`/`onUpdate` from `OPTION_APPWIDGET_MIN_WIDTH/MIN_HEIGHT` with the same thresholds (`w ≥ 240 && h ≥ 330 → xl`, `≥ 240 → l`, `≥ 150 → m`, `w < 240 && h ≥ 100 → s`, else `xs`).
- **Preview layout** `widget_today_preview.xml` = M's XML with the §9 fixture strings as `android:text` literals and the dark register colours hard-referenced (the picker cannot run Kotlin). `widgetFeatures` is not set (configuration lives in-app at `/settings/widget`).
- Remotable calls used: `setTextViewText`, `setTextColor`, `setViewVisibility`, `setInt(…,"setBackgroundResource",…)`, `setInt(…,"setColorFilter",…)`, `setFloat(…,"setLetterSpacing",…)`, `setTextViewTextSize`, `setContentDescription`, `setOnClickPendingIntent`. Nothing else is needed; do not reach for `setColorAttr` (Material You is not adopted).

---

## 8. iOS 17+ specifics

- **Target**: `targets/widget/expo-target.config.js` — `{ type: 'widget', name: 'TodayPanchangWidget', deploymentTarget: '17.0', entitlements: { 'com.apple.security.application-groups': ['group.com.ishank1995.dharmagya'] }, colors: { WidgetBackground: { light: '#FFFFFF', dark: '#241C30' }, WidgetAccentText: { light: '#7A5900', dark: '#D8A31A' }, WidgetAccentFill: '#D8A31A', WidgetTextPrimary: { light: '#221B24', dark: '#EDE8F0' }, WidgetTextSecondary: { light: '#69646A', dark: '#A19AA7' }, WidgetKicker: { light: '#918D92', dark: '#7E7886' }, WidgetDivider: { light: '#F0EFF0', dark: '#312A3C' }, WidgetDanger: { light: '#8C1D18', dark: '#E4708A' } } }`. The main app also needs the same app-group entitlement (`app.json → ios.entitlements`) and `@bacons/apple-targets` added to `plugins`. `modules/widget-data` gains an iOS module writing the same JSON to `UserDefaults(suiteName:)` and calling `WidgetCenter.shared.reloadAllTimelines()`.
- **Kind / families**: `kind = "TodayPanchangWidget"`, `supportedFamilies: [.systemSmall, .systemMedium, .systemLarge, .accessoryRectangular]`, `configurationDisplayName` / `description` from §6 strings.
- **Timeline** (`TimelineProvider`, read the payload in `getTimeline`): entry 1 at `now` (day selection §0), entry 2 at the next local midnight rendering `days[1]` as today (ROLLED), entry 3 at midnight + 24h rendering STALE; policy `.atEnd`. `placeholder(in:)` = §9 fixture; `getSnapshot` = live payload or fixture.
- **containerBackground**: `.containerBackground(for: .widget) { Color("WidgetBackground") }` when `theme == "system"`; for explicit themes pass the literal `Color(hex:)` of that register. No border on iOS (the system supplies the widget chrome). Nothing else is painted behind content.
- **Removable background / StandBy / accented rendering**: read `@Environment(\.showsWidgetContainerBackground)` and `@Environment(\.widgetRenderingMode)`. When the background is removed (StandBy, iOS 18 tinted home screen, lock screen) or the mode is `.accented`/`.vibrant`, replace **every** hex colour with semantic colours: primary text `.primary`, secondary/kicker `.secondary`, accent kicker + dot `Color.accentColor` (set the target's `AccentColor` asset to `#D8A31A`) and mark the TODAY kicker and the dot `.widgetAccentable()`; nothing else is accentable (tinted mode then paints them with the user's tint and everything else in monochrome). Dividers are hidden in these modes. StandBy shows systemSmall at 2× — the §3.2 small layout is already the one that must survive on pure black.
- Fixed point sizes (no Dynamic Type); `.minimumScaleFactor(0.8)` on `hero` only; `.lineLimit(1)` everywhere except the empty-state body (2).
- `.privacySensitive()` is not applied (no personal data beyond a city name, which the lock-screen family omits anyway).

---

## 9. Preview / placeholder fixture (both platforms, en, dark)

```
todayLabel "Today" · dateLong "Sat, 20 Sep 2026" · dateShort "Sat, 20 Sep" · locationLabel "Pune"
slots: Tithi "Krishna Panchami" until "until 6:12 PM" · Nakshatra "Rohini" until "until 9:40 PM" · Sunrise "6:14 AM" · Rahu Kalam "4:30 PM – 6:00 PM"
tomorrow: dateLong "Sun, 21 Sep 2026" · Tithi "Krishna Shashthi" until "until 7:58 PM" · Nakshatra "Mrigashira" until "until 11:02 PM" · Sunrise "6:14 AM" · Rahu Kalam "3:00 PM – 4:30 PM"
```
Used by Android `widget_today_preview.xml` / `previewImage`, iOS `placeholder(in:)` and Xcode previews. iOS applies `.redacted(reason: .placeholder)` in `placeholder(in:)` only.

---

## 10. Out of scope / do not do

- No gradient, glow, corner brackets, mandala, IAST or Sanskrit chrome (standing feedback: no decorative taglines, no Sanskrit in UI).
- No new deep-link routes; no per-date panchang route.
- No change to refresh scheduling (`updatePeriodMillis` stays 0; no WorkManager/AlarmManager) — day rollover happens at render on Android and via the timeline on iOS.
- No Material You dynamic colour; no `.rounded`/`.serif` SF designs; no custom font assets in either widget bundle.
- The Home hero's verdict line (`dayVerdict`) is not surfaced — it is `reviewPending` and would need its own payload string; leave it out until the P16.3 reviewer pass clears.

---

## As built — deviations from this spec (2026-09-23, authoritative)

- **Android `updatePeriodMillis = 1800000`** (spec said 0) plus `TIME_SET`, `TIMEZONE_CHANGED` and `DATE_CHANGED` in the receiver's intent-filter, all redrawing every instance. `DATE_CHANGED` is not delivered to manifest receivers on API 26+, which left yesterday under TODAY for up to ~30 min after midnight; the midnight alarm below closes that gap.
- **Android midnight alarm** (overrides §10's "no AlarmManager"). `TodayPanchangWidget.kt` → `MidnightAlarm` calls `setWindow(RTC, next local midnight + 1 min, 10 min, pi)`, so the widget redraws between 00:01 and 00:11.
  - **Why `setWindow`, not `set()`:** `set()` is inexact with a heuristic window of 75% of the time until the trigger (`AlarmManagerService.maxTriggerTime`; current AOSP caps it at 1 h, older releases do not). An alarm set at 18:00 for 00:01 could therefore arrive at 01:01, or around 04:30 before the cap. A non-zero window is still an inexact alarm, so no `SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM` permission is needed. 10 min is also the minimum window Android 12+ enforces for inexact alarms.
  - **Why `RTC`, not `RTC_WAKEUP`:** it never wakes the device. A due non-wakeup alarm is held and delivered as soon as the screen turns on (`interactiveStateChangedLocked`), before the launcher is visible. In Doze it is deferred to the next maintenance window or screen-on. One alarm a day fits even the restricted standby bucket's quota.
  - **The PendingIntent:** an explicit broadcast (`setClass` + `setPackage`) to the provider, with action `<package>.widget.MIDNIGHT`, request code 2, and `FLAG_IMMUTABLE | FLAG_UPDATE_CURRENT`. Every schedule builds the same PendingIntent, so a reschedule replaces the pending alarm and never stacks a second one. No manifest change is needed, because explicit broadcasts bypass the intent-filter.
  - **When it is (re)armed:** in `onEnabled` and at the end of every `onUpdate`. `onUpdate` covers placement, the ENABLED + UPDATE pair sent after boot, the 30-min poke, every payload write, `TIME_SET` / `TIMEZONE_CHANGED` / `DATE_CHANGED`, and the alarm's own fire, which redraws every instance and re-arms for the next midnight.
  - **When it is cancelled:** in `onDisabled`, and when a redraw finds no instance placed.
  - **Failure handling:** `SecurityException` / `IllegalStateException` (per-app alarm cap) are caught. The 30-min poke remains the fallback.
  - **Midnight maths:** `LocalDate.now(zone).plusDays(1).atStartOfDay(zone)` on API 26+, and a lenient `Calendar` on 24–25 (minSdk is 24, and there is no desugaring). Both resolve a midnight skipped by DST to the first instant that exists, e.g. 01:00 in America/Santiago; checked on the JVM.
- **Zone resolved on every draw.** Android: day selection and the midnight maths read `TimeZone.getDefault()` on each call, and nothing caches a zone. `TIMEZONE_CHANGED` also calls `TimeZone.setDefault(null)` before redrawing (the same reset `ActivityThread.updateTimeZone` performs), so neither the redraw nor the re-armed alarm can see the old zone whatever the delivery order. iOS: `getSnapshot` / `getTimeline` call `NSTimeZone.resetSystemTimeZone()` first, because `TimeZone.current` is a per-process cache and the extension has no UIApplication to reset it. The timeline's calendar has `TimeZone.current` pinned explicitly.
- **XS gives the hero priority, so `until` can drop** (§3's "until is never truncated" does not hold at XS). The hero twins are `wrap_content` with no weight, so LinearLayout measures them first. `hero_until` / `hero_stale` are `0dp` / weight 1 with `gravity="end"` and an end ellipsis: they only get what the hero leaves, which on a wide 4×1 looks the same as before. Kotlin also hides the trailing view unless it fits beside the whole hero value. It measures both with `TextPaint`, using the XS type roles (hero 15sp in the right twin's face, trailing 11.5sp tabular), against the narrowest width in `OPTION_APPWIDGET_SIZES` (API 31+) or `OPTION_APPWIDGET_MIN_WIDTH`, minus card chrome and 4dp of slack. If no width is reported, the XML alone keeps the hero whole. A STALE label that does not fit is replaced by the dot in `wg_danger` (`widget_dot_stale`), so a narrow card never passes off an old tithi as today's.
- **EMPTY title has Latin / Devanagari twins** (`empty_title_lat` sans-serif-medium, `empty_title_dev` serif 600 / bold pre-28 with the Devanagari line height). The twin is picked by resolving `widget_empty_title` against `Resources.getSystem()` locales, which is what the launcher inflates with, not this process's configuration. The receiver also listens for `LOCALE_CHANGED`, which is exempt from the implicit-broadcast limits, and redraws on it. AppWidgetService does not redraw providers on a locale change, so without this the launcher would re-inflate the last RemoteViews with the twin chosen for the old locale.
- **Recycled views.** `AppWidgetHostView` re-applies a new RemoteViews onto the already-inflated view when the layout id is unchanged, so a toggle from one draw survives into the next unless it is set again. Every state toggle is therefore set in both branches on every draw: header TODAY/STALE kickers, ↻ chip image and glyph twins, tomorrow block vs `rolled_body`, XS `until`/STALE/dot, EMPTY title twins, and kicker size and tracking per script. Without that, ROLLED at midnight followed by FRESH after the app writes kept the L/XL tomorrow block hidden.
- **Known limitation (not fixed):** colours for an explicit theme are applied with `setTextColor` / `setColorFilter` / `setBackgroundResource`, and theme `system` applies none. After switching from an explicit theme back to `system`, a recycled view keeps the old register until the launcher re-inflates it (uiMode change, launcher restart, resize to another layout).
- **JS refresh queue.** `refreshTodayWidget({ force: true })` made while a compute is running queues exactly one follow-up that runs after the running write and resolves when its own write lands. Every forced or plain request made while that follow-up is still queued shares it. A forced request shares the running compute instead only when the store snapshot has not changed since that compute read it, which keeps the cold-start plain + forced pair to one compute.
- **No `maxResizeWidth/Height`.** 250dp made Pixel Launcher ignore the 4x2 target and cap the widget at 3x3 (verified on an API 36.1 emulator), so XL was unreachable.
- **Size keys are the measured natural heights**, not §3.1's values: API 31+ `SizeF` XS (110,40), S (110,150), M (240,185), L (240,285), XL (240,350); pre-31 thresholds match (`w>=240&&h>=350` XL, `>=285` L, `>=185` M, `h>=150` S, else XS). Keys and `pickSize` must stay in sync.
- **Tomorrow ring drawable** has a transparent `<solid>` before its stroke; without it `setColorFilter` under forced themes fills the ring into a disc.
- **Deep-link intents are explicit** (`setPackage(context.packageName)`).
- **English dates use `en-IN`** (day before month, like the rest of the app); the fixture in §9 still shows the intended format.
- **iOS footer values with Devanagari render at ≥ 13pt** (§5.3), iOS STALE entry scheduled with `nextDate(after:)` so a DST jump at midnight does not delay it.
- **iOS systemSmall STALE**: kicker line shows `staleLabel` in danger colour; the date line keeps `days[0].dateShort` (the spec's two statements would otherwise print the label twice).
- **iOS widget target is iPhone-only** (`plugins/withWidgetDeviceFamily.js`, listed before `@bacons/apple-targets`), deployment target 17.0 (app is 16.4), own `PrivacyInfo.xcprivacy` (UserDefaults `1C8F.1`).
