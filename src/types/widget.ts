/**
 * Payload written from JS into native shared storage and read by the
 * home-screen widgets:
 *
 *   Android — SharedPreferences `dharmagya_widget_prefs` / `today_panchang_payload`
 *   iOS     — UserDefaults(suiteName: "group.com.ishank1995.dharmagya"), same key
 *
 * The widget process reads only what's here — it never calls panchang-ts.
 * Every field is a pre-formatted string so the native renderers stay dumb:
 * native never formats a number or a date, never uppercases Devanagari, and
 * never splits or re-assembles an `until` string. Locale-specific digits
 * (Devanagari numerals) are resolved on the JS side before the write.
 *
 * Schema v3: two days — `[today, tomorrow]` — each carrying its own
 * device-local `ymd` so the renderers pick the right day at draw time
 * (FRESH / ROLLED / STALE) without any scheduled refresh.
 */
export interface WidgetSlot {
  /** Field ID from the widget catalog (tithi/yoga/sunset/...). Diagnostics
   *  only — native acts on label/value/until directly. */
  id: string;
  /** Already-localised slot kicker in Title Case (e.g. "Tithi" / "तिथि").
   *  Native uppercases Latin kickers; Devanagari is left as-is. */
  label: string;
  /** Already-localised + digit-converted primary value (e.g. "Krishna Panchami",
   *  "5:48 AM", "4:30 PM – 6:00 PM"). */
  value: string;
  /** Optional end-time annotation for elements that expire (tithi, nakshatra,
   *  yoga, karana), already in the language's word order ("until 6:12 PM" /
   *  "६:१२ PM तक"). Null when the field is fixed (sunrise, vara) or an
   *  end-time isn't applicable. */
  until: string | null;
}

export interface WidgetDay {
  /** Device-local YYYY-MM-DD of this day. Renderers compare it with the
   *  device's local date at draw time to decide today / rolled / stale. */
  ymd: string;
  /** Long date string (e.g. "Sat, 20 Sep 2026" / "शनि, २० सित॰ २०२६"). */
  dateLong: string;
  /** Short date string without the year (e.g. "Sat, 20 Sep" / "शनि, २० सित॰"). */
  dateShort: string;
  /** Four user-configurable info slots (settings/widget). Indices 0–1 render
   *  as the main rows with kicker + value + optional `until`; indices 2–3
   *  render as a two-column footer with kicker + value (no `until`). */
  slots: [WidgetSlot, WidgetSlot, WidgetSlot, WidgetSlot];
}

/** Mirrors the store's `themeMode`. 'system' lets the widget follow the
 *  platform scheme at render time; the explicit values force a register. */
export type WidgetTheme = 'system' | 'light' | 'dark';

export interface WidgetPayload {
  /** Schema version. v3 introduced the two-day `days[]` array and dropped the
   *  v1 flat keys (`tithiName` / `nakshatraName` / `sunrise` / `rahuKalam` /
   *  `labels` / top-level `dateLong`). Nothing reads them any more: the
   *  Android Kotlin written by `plugins/withTodayPanchangWidget.js` and the
   *  WidgetKit decoder in `targets/widget/PanchangPayload.swift` both read
   *  `days[]` / `slots[]` only and render `v < 3` as EMPTY. Those renderers
   *  ship in the same native build as this JS (CNG regenerates the Kotlin at
   *  prebuild; there is no OTA update channel), so an older v1 reader can
   *  never be handed a v3 payload. Do not re-add the flat keys unless the
   *  plugin is rolled back to a v1 reader.
   *
   *  Release gate: that guarantee only holds while this builder, the plugin
   *  and `targets/widget` land in the same commit and the same native build.
   *  A dev client prebuilt before the v3 plugin shows a blank widget with
   *  this JS until it is rebuilt, and if an OTA channel (`expo-updates`) is
   *  ever added, bump `runtimeVersion` with any payload schema change. */
  v: 3;
  /** Wallclock timestamp ms when this snapshot was written. */
  writtenAtMs: number;
  /** 'en' or 'hi'. Renderers render strings as-is; script decisions
   *  (serif twin, uppercasing, tracking) are per string, not per language. */
  lang: 'en' | 'hi';
  /** Theme preference — see WidgetTheme. */
  theme: WidgetTheme;
  /** Resolved theme mirror kept for v2 readers only; v3 renderers ignore it
   *  and derive the colour register from `theme`. */
  isDarkMode: boolean;
  /** Localised header kicker for today (e.g. "Today" / "आज"). */
  todayLabel: string;
  /** Localised kicker for the tomorrow block ("Tomorrow" / "कल"). */
  tomorrowLabel: string;
  /** Replaces `todayLabel` when neither day matches the device date
   *  ("Out of date" / "पुराना डेटा"). */
  staleLabel: string;
  /** Accessibility label of the Android refresh chip ("Refresh widget" /
   *  "विजेट रिफ्रेश करें"). */
  refreshLabel: string;
  /** Body line shown in place of the tomorrow block when it has no data
   *  ("Open Dharmagya to update" / "अपडेट के लिए धर्मज्ञ खोलें"). */
  openToUpdateLabel: string;
  /** Optional location label (e.g. "Pune") appended to today's header meta. */
  locationLabel: string | null;
  /** Exactly two entries: `[today, tomorrow]` as of `writtenAtMs`. Always
   *  two — a failed compute still emits its day with "—" values. */
  days: [WidgetDay, WidgetDay];
}
