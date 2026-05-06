/**
 * Payload written from JS into native shared storage (Android SharedPreferences,
 * iOS App Groups). The widget process reads only what's here — never calls
 * panchang-ts directly.
 *
 * All fields are pre-formatted strings so the native widget code stays dumb.
 * Numbers are intentionally avoided — locale-specific number rendering
 * (Devanagari numerals) is resolved on the JS side before write.
 */
export interface WidgetPayload {
  /** Schema version. Bump when fields are added/removed; native side reads
   *  defensively and falls back to "—" for missing values. */
  v: 1;
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
  /** Localised "Tithi" / "Nakshatra" / "Sunrise" / "Rahu Kalam" labels. */
  labels: {
    tithi: string;
    nakshatra: string;
    sunrise: string;
    rahuKalam: string;
    until: string;
  };
  /** Active-at-sunrise tithi name (already localised). */
  tithiName: string;
  /** Tithi end time string, or null when it spans the whole day. */
  tithiEndTime: string | null;
  /** Active-at-sunrise nakshatra name. */
  nakshatraName: string;
  nakshatraEndTime: string | null;
  /** Sunrise time (already in 12h/24h per user pref). */
  sunrise: string;
  /** Rahu Kalam window string, e.g. "4:30 PM – 6:00 PM". */
  rahuKalam: string;
  /** Optional location label (e.g. "Pune") shown on medium widget when present. */
  locationLabel: string | null;
  /** Resolved theme mirror — Kotlin picks light vs dark colors at render time. */
  isDarkMode: boolean;
}

/** Sentinel payload rendered when no panchang data has ever been written. */
export const WIDGET_PLACEHOLDER: WidgetPayload = {
  v: 1,
  ymd: '',
  writtenAtMs: 0,
  lang: 'en',
  todayLabel: 'Today',
  dateLong: '—',
  labels: {
    tithi: 'Tithi',
    nakshatra: 'Nakshatra',
    sunrise: 'Sunrise',
    rahuKalam: 'Rahu Kalam',
    until: 'until',
  },
  tithiName: '—',
  tithiEndTime: null,
  nakshatraName: '—',
  nakshatraEndTime: null,
  sunrise: '—',
  rahuKalam: '—',
  locationLabel: null,
  isDarkMode: true,
};
