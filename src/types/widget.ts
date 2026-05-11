/**
 * Payload written from JS into native shared storage (Android SharedPreferences,
 * iOS App Groups). The widget process reads only what's here — never calls
 * panchang-ts directly.
 *
 * All fields are pre-formatted strings so the native widget code stays dumb.
 * Numbers are intentionally avoided — locale-specific number rendering
 * (Devanagari numerals) is resolved on the JS side before write.
 */
export interface WidgetSlot {
  /** Field ID from the widget catalog (tithi/yoga/sunset/...). Used only for
   *  diagnostics — native side acts on label/value/until directly. */
  id: string;
  /** Already-localised slot kicker (e.g. "Tithi" / "तिथि"). Native uppercases. */
  label: string;
  /** Already-localised + digit-converted primary value (e.g. "Krishna Panchami",
   *  "5:48 AM", "4:30 PM – 6:00 PM"). */
  value: string;
  /** Optional end-time annotation for elements that expire (tithi, nakshatra,
   *  yoga, karana). Already prefixed with the localised "until" word. Null
   *  when the field is fixed (sunrise, vara) or end-time isn't applicable. */
  until: string | null;
}

export interface WidgetPayload {
  /** Schema version. v=2 introduced the slot-based layout. Native side reads
   *  defensively and falls back to "—" for unrecognised shapes. */
  v: 2;
  /** ISO YYYY-MM-DD of the day the snapshot was computed for. */
  ymd: string;
  /** Wallclock timestamp ms when this snapshot was written. */
  writtenAtMs: number;
  /** 'en' or 'hi'. The widget reads this and renders strings as-is. */
  lang: 'en' | 'hi';
  /** Localised display label for the widget header (e.g. "Today" / "आज"). */
  todayLabel: string;
  /** Long date string (e.g. "Wed, 6 May 2026" / "बुध, ६ मई २०२६"). */
  dateLong: string;
  /** Four user-configurable info slots. Indices 0–1 render in the main rows
   *  with kicker + value + optional `until`; indices 2–3 render as a 2-column
   *  footer with kicker + value (no `until`). */
  slots: [WidgetSlot, WidgetSlot, WidgetSlot, WidgetSlot];
  /** Optional location label (e.g. "Pune") shown on medium widget when present. */
  locationLabel: string | null;
  /** Resolved theme mirror — Kotlin picks light vs dark colors at render time. */
  isDarkMode: boolean;

  // ─── v1 legacy fields ──────────────────────────────────────────────────
  // The prebuild plugin scaffold (plugins/withTodayPanchangWidget.js) still
  // reads the v1 flat schema — `tithiName` / `nakshatraName` / `sunrise` /
  // `rahuKalam` plus a `labels` object — directly from SharedPreferences.
  // We emit both shapes so whichever native Kotlin ships in a given build
  // can render real values. Drop these only after the plugin templates are
  // migrated to read `slots[]`.
  tithiName: string;
  tithiEndTime: string;
  nakshatraName: string;
  nakshatraEndTime: string;
  sunrise: string;
  rahuKalam: string;
  labels: {
    tithi: string;
    nakshatra: string;
    sunrise: string;
    rahuKalam: string;
    until: string;
  };
}

const PLACEHOLDER_SLOTS: WidgetPayload['slots'] = [
  { id: 'tithi', label: 'Tithi', value: '—', until: null },
  { id: 'nakshatra', label: 'Nakshatra', value: '—', until: null },
  { id: 'sunrise', label: 'Sunrise', value: '—', until: null },
  { id: 'rahuKalam', label: 'Rahu Kalam', value: '—', until: null },
];

/** Sentinel payload rendered when no panchang data has ever been written. */
export const WIDGET_PLACEHOLDER: WidgetPayload = {
  v: 2,
  ymd: '',
  writtenAtMs: 0,
  lang: 'en',
  todayLabel: 'Today',
  dateLong: '—',
  slots: PLACEHOLDER_SLOTS,
  locationLabel: null,
  isDarkMode: true,
  tithiName: '—',
  tithiEndTime: '',
  nakshatraName: '—',
  nakshatraEndTime: '',
  sunrise: '—',
  rahuKalam: '—',
  labels: {
    tithi: 'Tithi',
    nakshatra: 'Nakshatra',
    sunrise: 'Sunrise',
    rahuKalam: 'Rahu Kalam',
    until: 'until',
  },
};
