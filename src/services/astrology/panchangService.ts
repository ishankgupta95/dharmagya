import * as Location from 'expo-location';
import {
  getDailyPanchang,
  getInstantPanchang,
  computePlanetaryPositions,
  getSiderealMoonLongitude,
  getUpcomingSolarEclipse,
  getUpcomingLunarEclipse,
  isEclipseVisibleAnyPhase,
  formatInZone,
  GRAHA_ABBR,
  PanchangError,
  type AyanamsaType,
  type DailyPanchangResult,
  type DailyTithiInfo,
  type DailyNakshatraInfo,
  type DailyYogaInfo,
  type DailyKaranaInfo,
  type FestivalRegion,
  type GrahaName,
  type Language,
  type TimePeriod,
} from 'panchang-ts';

import type {
  IPanchangDay,
  IPanchangElement,
  IQualitySlot,
  IHoraSlot,
  IGrahaPosition,
  IFestival,
  IEclipse,
  IEclipseSummary,
  IInstantPanchang,
  IBhadra,
  IChandraBalam,
  FestivalType,
} from '@/types';
import { pmark, ptime } from '@/utils/perfProfile';
import { DEFAULT_BIRTH_TIMEZONE, offsetMinutesForZone, wallclockInZoneToUtc } from '@/utils/time';

/**
 * A place the panchang can be computed for. `timezone` is the IANA zone the
 * coordinates actually sit in — set it whenever the place is *chosen* rather
 * than sensed (a curated city, or the Ujjain fallback), because the device
 * may be nowhere near it. Leave it undefined for a live GPS fix: the device is
 * by definition standing at those coordinates, so its own offset is correct.
 * See `timezoneMinutesFor` for why this matters.
 */
export interface PanchangCoords {
  lat: number;
  lon: number;
  timezone?: string;
}

// Ujjain (Avanti). Carries its zone: a user who skips the location step is shown
// an Ujjain panchang, and an Ujjain panchang has to be rendered in IST no matter
// where the phone is.
//
// Chosen for coverage, not for sanctity. Measured over 2026 against each city's
// own sunrise, Ujjain names the wrong tithi for the day on 1.51 percent of days
// for a population-weighted top-50 urban user, against 2.40 percent from the
// previous Varanasi default — India's urban mass sits west of the IST meridian.
// It is NOT the better pick for a rural-weighted base (2.30 vs 2.16 percent),
// and it sits ~29 min of sunrise west of the Rashtriya Panchang's Central
// Station where Varanasi was ~2 min east, so this moves the no-location default
// away from India's national reference. Deliberate, owner's call.
//
// A note on the folklore, since it will come up: Ujjayini IS the classical
// madhya-rekha (Surya Siddhanta i.62), but that is a prime MERIDIAN — a frame
// the desantara correction moves the answer *off* (SS i.60-61: "the result is
// the planet's mean position at the given place"), not a place a panchang is
// cast for. This constant is not more traditional than any other; it is a guess
// for a user we could not locate. `src/data/static/festivals-table.json` is
// generated at the same point so the Festivals and Panchang screens cannot
// disagree for these users.
export const FALLBACK_COORDS: PanchangCoords = { lat: 23.1765, lon: 75.7885, timezone: DEFAULT_BIRTH_TIMEZONE };

// Re-exported for diagnostic UI; everything else uses the canonical `IGrahaPosition.planetEn`.
export { GRAHA_ABBR };
export type { GrahaName };

/**
 * Native's janma (birth) nakshatra index (0=Ashwini … 26=Revati) derived
 * from the sidereal Moon longitude at the birth moment. Geocentric — does
 * not depend on birth location.
 */
export function computeJanmaNakshatraIndex(birth: Date): number {
  const lon = getSiderealMoonLongitude(birth, 'lahiri');
  const idx = Math.floor(lon / (360 / 27));
  return ((idx % 27) + 27) % 27;
}

/**
 * Native's janma (birth) rashi index (0=Mesha … 11=Meena) — companion to
 * janmaNakshatra, used for Chandra Balam.
 */
export function computeJanmaRashiIndex(birth: Date): number {
  const lon = getSiderealMoonLongitude(birth, 'lahiri');
  const idx = Math.floor(lon / 30);
  return ((idx % 12) + 12) % 12;
}

/**
 * Derive the janma indices used as panchang-ts cache options from the user's
 * stored birth fields. Returns empty when the user hasn't entered birth data —
 * downstream callers pass `undefined` through to `getCachedPanchangDay`.
 *
 * Important for cache cohesion: every today's-panchang fetch (widget refresh,
 * home tab, panchang screen) must compute janma the same way, otherwise their
 * cache keys diverge and the screen does its own ~300ms compute on cold open
 * even though the widget already pre-warmed.
 */
export function deriveJanmaIndicesFromStore(state: {
  userBirthDate: string | null;
  userBirthTime: string | null;
  userBirthPlace: { timezone?: string } | null;
}): { janmaNakshatra?: number; janmaRashi?: number } {
  if (!state.userBirthDate) return {};
  const tz = state.userBirthPlace?.timezone ?? DEFAULT_BIRTH_TIMEZONE;
  try {
    const birthMoment = wallclockInZoneToUtc(state.userBirthDate, state.userBirthTime ?? '12:00', tz);
    return {
      janmaNakshatra: computeJanmaNakshatraIndex(birthMoment),
      janmaRashi: computeJanmaRashiIndex(birthMoment),
    };
  } catch {
    return {};
  }
}

// Name tables for computePlanetaryPositions (which uses callbacks, not a language option)
const RASHI_NAMES: Record<Language, string[]> = {
  en: [
    'Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya',
    'Tula', 'Vrischika', 'Dhanu', 'Makara', 'Kumbha', 'Meena',
  ],
  hi: [
    'मेष', 'वृषभ', 'मिथुन', 'कर्क', 'सिंह', 'कन्या',
    'तुला', 'वृश्चिक', 'धनु', 'मकर', 'कुम्भ', 'मीन',
  ],
};

const NAKSHATRA_NAMES: Record<Language, string[]> = {
  en: [
    'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashirsha', 'Ardra',
    'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni',
    'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
    'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha',
    'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati',
  ],
  hi: [
    'अश्विनी', 'भरणी', 'कृत्तिका', 'रोहिणी', 'मृगशिरा', 'आर्द्रा',
    'पुनर्वसु', 'पुष्य', 'आश्लेषा', 'मघा', 'पूर्वा फाल्गुनी', 'उत्तरा फाल्गुनी',
    'हस्त', 'चित्रा', 'स्वाति', 'विशाखा', 'अनुराधा', 'ज्येष्ठा',
    'मूल', 'पूर्वाषाढ़ा', 'उत्तराषाढ़ा', 'श्रवण', 'धनिष्ठा', 'शतभिषा',
    'पूर्वा भाद्रपद', 'उत्तरा भाद्रपद', 'रेवती',
  ],
};

const GRAHA_NAMES: Record<Language, Record<GrahaName, string>> = {
  en: { Sun: 'Sun', Moon: 'Moon', Mars: 'Mars', Mercury: 'Mercury', Jupiter: 'Jupiter', Venus: 'Venus', Saturn: 'Saturn', Rahu: 'Rahu', Ketu: 'Ketu' },
  hi: { Sun: 'सूर्य', Moon: 'चंद्र', Mars: 'मंगल', Mercury: 'बुध', Jupiter: 'बृहस्पति', Venus: 'शुक्र', Saturn: 'शनि', Rahu: 'राहु', Ketu: 'केतु' },
};

// Note on intentionally-unused panchang-ts surface area:
// • Classical aliases `dinamanaMinutes` / `ratrimanaMinutes` are not surfaced
//   because they're identical to `dayDurationMinutes` / `nightDurationMinutes`,
//   which we already display.
// • Standalone helpers — `computeAbhijitMuhurta`, `getMoonrise`, `getEclipseDuringDay`,
//   `computeVimshottariDasha` (raw), etc. — are deliberately not used directly:
//   all daily fields flow through `getDailyPanchang` so the LRU cache below
//   stays the source of truth, and `computeVimshottariDashaFromBirth` is
//   preferred over `computeVimshottariDasha` because we always have a birth
//   moment.

// Every `Date` panchang-ts publishes is a TRUE instant since v5 — `getUTC*` on
// one reads UTC, not the wall clock. Display comes from the `*Local` companion
// instead: offset-carrying ISO 8601 in the requested timezone, e.g.
// "2025-01-14T07:09:44.172+05:30", so the wall clock is a fixed-width slice.
function formatLocal(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  const h = Number(iso.slice(11, 13));
  if (!Number.isFinite(h)) return undefined;
  const m = iso.slice(14, 16);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

/**
 * The UTC offset in minutes east that panchang-ts is handed as `timezone` for
 * a given place and day. Two things it must get right, both of which the old
 * "read `-new Date().getTimezoneOffset()`" shortcut got wrong:
 *
 *  1. It must belong to the *coordinates*, not to the phone. `timezone` is what
 *     brackets the sunrise-to-next-sunrise Hindu day and what every `*Local`
 *     string is rendered in, so pairing Varanasi coordinates with a New York
 *     offset publishes the next Hindu day and prints "sunrise 7:48 PM".
 *  2. It must belong to the *date being viewed*, not to right now. In a
 *     DST-observing zone the two disagree by an hour for half the year, which
 *     shifts every rendered time and can land the compute on the wrong day.
 *
 * Resolved at local noon of the target day so a spring-forward morning does not
 * hand the pre-transition offset to the whole day. panchang-ts resolves an IANA
 * name once per call the same way, so this is as precise as the library allows.
 */
function timezoneMinutesFor(coords: PanchangCoords, date: Date): number {
  const noon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  if (coords.timezone) {
    const off = offsetMinutesForZone(coords.timezone, noon);
    if (off !== null) return off;
  }
  return -noon.getTimezoneOffset();
}

/** `timezoneMinutesFor` for callers outside this module. */
export function panchangTimezoneMinutes(coords: PanchangCoords, date: Date): number {
  return timezoneMinutesFor(coords, date);
}

/**
 * The instant to hand panchang-ts for a civil date: noon of that date in the
 * PLACE's zone (`timezoneMinutes` is what `timezoneMinutesFor` resolved for
 * the same `date`).
 *
 * Every day-shaped entry point here receives the day as a device-local `Date`
 * — a tapped grid cell's local midnight, `new Date()` on Home, a festival
 * table's YYYY-MM-DD parsed in local terms — and the civil date the caller
 * means is its device-local year/month/day. But the library does not read the
 * day off the device: `getDailyPanchang` (and `scoreMuhurta`, which wraps it)
 * takes the calendar day the instant falls on in `timezone`, the place's
 * offset. Passing the device-local instant straight through therefore names the
 * right day only while the device sits in the place's zone. Local midnight in
 * Sydney is 19:30 IST the evening before, so a device east of +05:30 viewing
 * Ujjain got the previous Hindu day for every tapped cell (and cached it under
 * the tapped ymd, so it stuck); local noon in Los Angeles is 00:30 IST the next
 * day, so a device at or west of −06:30 scored muhurats a day late. Noon of the
 * civil date *in the place's zone* lands mid-day for every device offset, and
 * for a device already in that zone it is the same instant `date` would have
 * resolved to, so the common Indian case is a no-op. `navratri.ts` anchors its
 * one `getDailyPanchang` the same way.
 *
 * Callers keep their original `date` for cache keys, `IPanchangDay.date` and
 * `MuhuratMatch.date`; only the instant given to the library changes.
 */
export function noonAtPlace(date: Date, timezoneMinutes: number): Date {
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12) - timezoneMinutes * 60_000,
  );
}

/**
 * Render an instant as a wall clock ("6:12 AM") in the place's own offset at
 * that instant — the same formatting `IPanchangDay` uses, for callers holding a
 * raw `Date` (e.g. a sunrise computed outside `getDailyPanchang`).
 */
export function formatInstantForPlace(date: Date, coords: PanchangCoords): string | undefined {
  return formatInstant(date, timezoneMinutesFor(coords, date));
}

/**
 * Same rendering for an instant the library did not localize for us — the
 * upcoming-eclipse helpers take no timezone, so there is no `*Local` on their
 * result and we render the instant in the device's offset ourselves.
 */
function formatInstant(date: Date | null | undefined, offsetMinutes: number): string | undefined {
  if (!date) return undefined;
  return formatLocal(formatInZone(date, offsetMinutes));
}

/** `{ start, end }` of any v5 window, rendered for display. */
function toWindow(p: {
  startLocal?: string | null;
  endLocal?: string | null;
}): { start: string; end: string } {
  return { start: formatLocal(p.startLocal) ?? '', end: formatLocal(p.endLocal) ?? '' };
}

/** Coerce the lib's locale-specific paksha string into our typed union. */
function normalizePaksha(p: string | undefined | null): 'Shukla' | 'Krishna' | null {
  if (!p) return null;
  const trimmed = p.trim();
  if (trimmed === 'Shukla' || trimmed === 'शुक्ल') return 'Shukla';
  if (trimmed === 'Krishna' || trimmed === 'कृष्ण') return 'Krishna';
  return null;
}

function toTithiElements(items: DailyTithiInfo[]): IPanchangElement[] {
  return items.map(item => ({
    name: item.name,
    endTime: formatLocal(item.endTimeLocal),
    endTimeMs: item.endTime?.getTime(),
    paksha: normalizePaksha(item.paksha),
    tithiNumber: item.number,
    completionPercentage: item.completionPercentage,
    startTime: formatLocal(item.startTimeLocal),
    isActiveAtSunrise: item.isActiveAtSunrise,
  }));
}

function toNakshatraElements(items: DailyNakshatraInfo[]): IPanchangElement[] {
  return items.map(item => ({
    name: item.name,
    endTime: formatLocal(item.endTimeLocal),
    endTimeMs: item.endTime?.getTime(),
    pada: item.pada,
    completionPercentage: item.completionPercentage,
    startTime: formatLocal(item.startTimeLocal),
    isActiveAtSunrise: item.isActiveAtSunrise,
  }));
}

function toYogaElements(items: DailyYogaInfo[]): IPanchangElement[] {
  return items.map(item => ({
    name: item.name,
    endTime: formatLocal(item.endTimeLocal),
    endTimeMs: item.endTime?.getTime(),
    completionPercentage: item.completionPercentage,
    startTime: formatLocal(item.startTimeLocal),
    isActiveAtSunrise: item.isActiveAtSunrise,
  }));
}

function toKaranaElements(items: DailyKaranaInfo[]): IPanchangElement[] {
  return items.map(item => ({
    name: item.name,
    endTime: formatLocal(item.endTimeLocal),
    endTimeMs: item.endTime?.getTime(),
    karanaType: item.type,
    completionPercentage: item.completionPercentage,
    startTime: formatLocal(item.startTimeLocal),
    isActiveAtSunrise: item.isActiveAtSunrise,
  }));
}

interface RawQualitySlot extends TimePeriod {
  name: string;
  quality: IQualitySlot['quality'];
  qualityName: string;
}

function toQualitySlots(slots: readonly RawQualitySlot[]): IQualitySlot[] {
  return slots.map(s => ({
    name: s.name,
    quality: s.quality,
    qualityName: s.qualityName,
    ...toWindow(s),
  }));
}

function toHoraSlots(
  slots: DailyPanchangResult['periods']['hora']['day'],
): IHoraSlot[] {
  return slots.map(s => ({ planet: s.planet, planetIndex: s.planetIndex, ...toWindow(s) }));
}

function mapFestivals(list: DailyPanchangResult['festivals']): IFestival[] {
  // Collapse triple-emission Ekadashi: drop the generic 'ekadashi' entry when a
  // smarta_ekadashi or vaishnava_ekadashi is already present for the same day.
  const hasSubtype = list.some(
    f => f.type === 'smarta_ekadashi' || f.type === 'vaishnava_ekadashi'
  );
  return list
    .filter(f => !(hasSubtype && f.type === 'ekadashi'))
    .map(f => ({
      name: f.name,
      type: f.type as FestivalType,
      description: f.description,
    }));
}

function mapEclipse(
  e: DailyPanchangResult['eclipse'],
  loc: DailyPanchangResult['location'],
): IEclipse | null {
  if (!e) return null;
  return {
    kind: e.kind,
    subtype: e.subtype,
    peak: formatLocal(e.peakLocal) ?? '',
    start: formatLocal(e.startLocal) ?? '',
    end: formatLocal(e.endLocal) ?? '',
    // v5 publishes both sutak instants as null for a penumbral lunar eclipse —
    // no sutak applies to one. Keep the null rather than collapsing it to '',
    // so the render site can tell "no sutak" from "time unknown" instead of
    // printing an empty range.
    sutakStart: formatLocal(e.sutakStartLocal) ?? null,
    sutakEnd: formatLocal(e.sutakEndLocal) ?? null,
    // `EclipseInfo.visibleFromLocation` is the narrow at-*peak* test, so it
    // reads false for an eclipse that is plainly observable either side of
    // peak — e.g. a total lunar eclipse the Moon rises into. The UI states
    // "not visible from your location" as fact, so answer the question the
    // user is actually asking with the any-phase helper. "Not visible" still
    // legitimately appears (a lunar eclipse is never filtered by location);
    // only the false negatives go. Note the library's own `description` string
    // still hard-codes the at-peak wording, so it must not be rendered as-is.
    visibleFromLocation: isEclipseVisibleAnyPhase(e, loc),
    peakVisible: e.visibleFromLocation,
    // v5 renamed the [0,1] disc-*area* fraction we render as a percentage to
    // `obscuration`; the new `magnitude` is the disc-*diameter* fraction that
    // catalogues publish, which exceeds 1 when total and goes negative for a
    // penumbral lunar eclipse. Keep publishing the area fraction — but note it
    // is the UMBRAL area, so a penumbral lunar eclipse legitimately reads
    // exactly 0. That is "no umbral coverage", not a failed computation.
    obscuration: e.obscuration,
    description: e.description,
  };
}

function mapBhadra(b: DailyPanchangResult['inauspicious']['bhadra']): IBhadra | null {
  if (!b) return null;
  return { ...toWindow(b), location: b.location };
}

function mapChandraBalam(cb: DailyPanchangResult['chandraBalam']): IChandraBalam | null {
  if (!cb) return null;
  return {
    house: cb.house,
    quality: cb.quality,
    englishName: cb.englishName,
    name: cb.name,
  };
}

export function mapToPanchangDay(result: DailyPanchangResult): IPanchangDay {
  const { sun, moon, angas, calendar, muhurtas, inauspicious, periods } = result;
  return {
    date: result.date,
    tithis: toTithiElements(angas.tithis),
    nakshatras: toNakshatraElements(angas.nakshatras),
    yogas: toYogaElements(angas.yogas),
    karanas: toKaranaElements(angas.karanas),
    sunrise: formatLocal(sun.riseLocal) ?? '—',
    sunset: formatLocal(sun.setLocal) ?? '—',
    nextSunrise: formatLocal(sun.nextRiseLocal),
    ayanamsa: result.ayanamsa,
    rahuKalamStart: formatLocal(inauspicious.rahuKalam.startLocal),
    rahuKalamEnd: formatLocal(inauspicious.rahuKalam.endLocal),
    yamagandaStart: formatLocal(inauspicious.yamaganda.startLocal),
    yamagandaEnd: formatLocal(inauspicious.yamaganda.endLocal),
    gulikaKalamStart: formatLocal(inauspicious.gulikaKalam.startLocal),
    gulikaKalamEnd: formatLocal(inauspicious.gulikaKalam.endLocal),
    abhijitMuhurtaStart: formatLocal(muhurtas.abhijit?.startLocal),
    abhijitMuhurtaEnd: formatLocal(muhurtas.abhijit?.endLocal),
    durMuhurta: inauspicious.durMuhurta.map(toWindow),
    vara: angas.vara.name,
    hinduMonth: calendar.chandramasa.purnimantaName,
    // `chandramasa.name`/`.index` follow whichever `masaSystem` was requested,
    // and this service deliberately never passes one — so `.name` is always the
    // purnimanta name and reading it here made the Amanta setting a no-op.
    // The two absolute fields are system-independent; always read those.
    hinduMonthAmanta: calendar.chandramasa.amantaName,
    hinduMonthPurnimanta: calendar.chandramasa.purnimantaName,
    isAdhikaMasa: calendar.chandramasa.isAdhika,
    masa: calendar.masa.name,
    vikramSamvat: calendar.samvat.vikramSamvat,
    shakaSamvat: calendar.samvat.shakaSamvat,
    chandraRashi: moon.rashi.name,
    suryaNakshatra: sun.nakshatra.name,
    moonrise: formatLocal(moon.riseLocal),
    moonset: formatLocal(moon.setLocal),
    brahmaMuhurtaStart: formatLocal(muhurtas.brahma.startLocal),
    brahmaMuhurtaEnd: formatLocal(muhurtas.brahma.endLocal),
    vijayaMuhurtaStart: formatLocal(muhurtas.vijaya.startLocal),
    vijayaMuhurtaEnd: formatLocal(muhurtas.vijaya.endLocal),
    godhuliMuhurtaStart: formatLocal(muhurtas.godhuli.startLocal),
    godhuliMuhurtaEnd: formatLocal(muhurtas.godhuli.endLocal),
    nishitaMuhurtaStart: formatLocal(muhurtas.nishita.startLocal),
    nishitaMuhurtaEnd: formatLocal(muhurtas.nishita.endLocal),
    // v5: Amrit Kala and Varjyam are both nakshatra-anchored collections —
    // 0–2 windows a day, not the single window 4.x published. A transition
    // day genuinely carries two, and dropping the second is what 4.x got
    // wrong, so both are surfaced.
    amritKala: muhurtas.amritKala.map(toWindow),
    madhyahnaStart: formatLocal(muhurtas.madhyahna.startLocal),
    madhyahnaEnd: formatLocal(muhurtas.madhyahna.endLocal),
    pratahSandhyaStart: formatLocal(muhurtas.pratahSandhya.startLocal),
    pratahSandhyaEnd: formatLocal(muhurtas.pratahSandhya.endLocal),
    sayahnaSandhyaStart: formatLocal(muhurtas.sayahnaSandhya.startLocal),
    sayahnaSandhyaEnd: formatLocal(muhurtas.sayahnaSandhya.endLocal),
    varjyam: inauspicious.varjyam.map(toWindow),
    gandaMula: inauspicious.gandaMula.active
      ? {
          nakshatraName: inauspicious.gandaMula.nakshatraName,
          severity: inauspicious.gandaMula.severity,
        }
      : null,
    anandadiYoga: { name: result.anandadiYoga.name, quality: result.anandadiYoga.quality },
    tarabala: result.tarabala
      ? { name: result.tarabala.name, englishName: result.tarabala.englishName, quality: result.tarabala.quality }
      : null,
    chandraBalam: mapChandraBalam(result.chandraBalam),
    bhadra: mapBhadra(inauspicious.bhadra),
    eclipse: mapEclipse(result.eclipse, result.location),
    panchaka: inauspicious.panchaka,
    panchakaRahita: inauspicious.panchakaRahita.map(toWindow),
    dayDurationMinutes: sun.dayDurationMinutes,
    nightDurationMinutes: sun.nightDurationMinutes,
    choghadiya: {
      day: toQualitySlots(periods.choghadiya.day),
      night: toQualitySlots(periods.choghadiya.night),
    },
    gowriPanchangam: {
      day: toQualitySlots(periods.gowri.day),
      night: toQualitySlots(periods.gowri.night),
    },
    doGhatiMuhurta: {
      day: toQualitySlots(muhurtas.doGhati.day),
      night: toQualitySlots(muhurtas.doGhati.night),
    },
    hora: {
      day: toHoraSlots(periods.hora.day),
      night: toHoraSlots(periods.hora.night),
    },
    specialYogas: result.specialYogas.map(y => ({ name: y.name, type: y.type })),
    festivals: mapFestivals(result.festivals),
  };
}

// ── Cache layer ──────────────────────────────────────────────────────────────
// Small in-memory LRUs for the user-facing screens. Direct `getDailyPanchang` /
// `fetchPanchang` calls stay uncached so [muhurat.ts](./muhurat.ts)'s 365-day
// bulk scan doesn't thrash this cache.

interface CachedDay { day: IPanchangDay; full: boolean }
const DAY_CACHE = new Map<string, CachedDay>();
const DAY_CACHE_MAX = 60;
function ymdLocal(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayCacheKey(
  date: Date,
  lat: number,
  lon: number,
  timezoneMinutes: number,
  language: Language,
  region: FestivalRegion,
  janmaNakshatra: number | undefined,
  janmaRashi: number | undefined,
  ayanamsa: AyanamsaType,
): string {
  const j = janmaNakshatra ?? '_';
  const r = janmaRashi ?? '_';
  // `timezoneMinutes` is part of the key because it decides which Hindu day is
  // published and which wall clock every time renders in — two entries for the
  // same ymd on either side of a DST change (or a flight) are different days.
  //
  // `region` scopes `IPanchangDay.festivals` only, which no screen renders today
  // (the calendar grid, the festivals list and the reminder scheduler all read
  // the bundled table in `src/data/festivals.ts` instead, scoped there by
  // `festivalAllowedInRegion`). It stays in the key regardless: it does change
  // the cached object's contents, so serving one region's entry to another
  // would hand the first reader of that field the wrong festivals.
  return `${ymdLocal(date)}|${lat.toFixed(4)}|${lon.toFixed(4)}|${timezoneMinutes}|${language}|${region}|${j}|${r}|${ayanamsa}`;
}

function lruSet<K, V>(map: Map<K, V>, key: K, value: V, max: number) {
  if (map.has(key)) map.delete(key);
  map.set(key, value);
  if (map.size > max) {
    const first = map.keys().next().value as K;
    map.delete(first);
  }
}

function lruHit<K, V>(map: Map<K, V>, key: K): V | undefined {
  const v = map.get(key);
  if (v === undefined) return undefined;
  map.delete(key);
  map.set(key, v);
  return v;
}

/**
 * Attach `planetaryPositions` to a mapped day as a memoised lazy accessor.
 *
 * Two constraints pull against each other here. Graha positions are an
 * *instant* computation and the Moon moves ~0.55°/h, so they have to be probed
 * at the same moment the rest of the day's limbs are read — sunrise. Probing at
 * whatever instant happened to ask first (screen-mount time, or a tapped cell's
 * local midnight) put the Moon tile in a different rashi from the Chandra Rashi
 * row on the same screen. But they also cost about as much as everything else
 * in the day put together (measured on Node 24: 0.41 ms against 0.51 ms for the
 * whole `getDailyPanchang`), and only the Panchang screen's Planetary Positions
 * card ever reads them — Home's launch-screen fetch and the widget refresh
 * render no graha at all.
 *
 * So the sunrise instant is captured here, at map time, and the computation is
 * deferred to the first read. The same-instant pairing with `chandraRashi` is
 * structural — both are `raw.sun.rise`, no matter which screen asks or when —
 * while the cost lands only on the surface that renders the card. The value is
 * memoised on the cached day, so re-renders and later cache hits are free.
 */
function defineLazyGrahaPositions(
  day: IPanchangDay,
  sunrise: Date,
  language: Language,
  ayanamsa: AyanamsaType,
): void {
  let positions: IGrahaPosition[] | undefined;
  let computed = false;
  Object.defineProperty(day, 'planetaryPositions', {
    enumerable: true,
    configurable: true,
    get(): IGrahaPosition[] | undefined {
      if (computed) return positions;
      computed = true;
      const endGraha = ptime('panchang:grahaPositions');
      try {
        positions = fetchGrahaPositions(sunrise, language, ayanamsa);
      } catch {
        /* non-critical — the Planetary Positions card simply does not render */
      }
      endGraha();
      return positions;
    },
  });
}

/**
 * Cached panchang-for-a-day. A full-pass result (`computeEndTimes: true`) also
 * satisfies later fast-pass requests — cache is upgrade-only.
 */
export function getCachedPanchangDay(
  date: Date,
  coords: PanchangCoords,
  opts: {
    computeEndTimes: boolean;
    language: Language;
    region: FestivalRegion;
    janmaNakshatra?: number;
    janmaRashi?: number;
    ayanamsa?: AyanamsaType;
  },
): IPanchangDay | null {
  const ayanamsa = opts.ayanamsa ?? 'lahiri';
  const timezone = timezoneMinutesFor(coords, date);
  const key = dayCacheKey(date, coords.lat, coords.lon, timezone, opts.language, opts.region, opts.janmaNakshatra, opts.janmaRashi, ayanamsa);
  const hit = lruHit(DAY_CACHE, key);
  if (hit && (hit.full || !opts.computeEndTimes)) {
    pmark('panchang:cache:hit', `endTimes=${opts.computeEndTimes} ${ymdLocal(date)}`);
    return hit.day;
  }

  pmark('panchang:cache:miss', `endTimes=${opts.computeEndTimes} ${ymdLocal(date)}`);
  const endLib = ptime(`panchang:getDailyPanchang endTimes=${opts.computeEndTimes}`);
  // The library reads the day off the instant in `timezone`, not off the
  // device — see `noonAtPlace`. The cache key above stays on the caller's
  // device-local ymd, which is the civil date this instant is anchored to.
  const raw = getDailyPanchang(
    noonAtPlace(date, timezone),
    { latitude: coords.lat, longitude: coords.lon },
    {
      timezone,
      computeEndTimes: opts.computeEndTimes,
      language: opts.language,
      region: opts.region,
      janmaNakshatra: opts.janmaNakshatra,
      janmaRashi: opts.janmaRashi,
      ayanamsa,
    },
  );
  endLib();
  if (!raw) return null;
  const endMap = ptime('panchang:mapToPanchangDay');
  const mapped = mapToPanchangDay(raw);
  // The library echoes the instant it was given as `result.date`; hand the
  // caller back the `Date` it asked with, as this always did.
  mapped.date = date;
  endMap();
  // Pinned to sunrise, computed on first read — see `defineLazyGrahaPositions`.
  defineLazyGrahaPositions(mapped, raw.sun.rise, opts.language, ayanamsa);
  lruSet(DAY_CACHE, key, { day: mapped, full: opts.computeEndTimes }, DAY_CACHE_MAX);
  return mapped;
}

export function fetchGrahaPositions(
  date: Date,
  language: Language = 'en',
  ayanamsa: AyanamsaType = 'lahiri',
): IGrahaPosition[] {
  const grahaNames = GRAHA_NAMES[language];
  const rashiNames = RASHI_NAMES[language];
  const nakshatraNames = NAKSHATRA_NAMES[language];
  const raw = computePlanetaryPositions(
    date,
    ayanamsa,
    (idx) => nakshatraNames[idx],
    (idx) => rashiNames[idx],
  );
  const keys: { key: keyof typeof raw; en: GrahaName }[] = [
    { key: 'sun', en: 'Sun' },
    { key: 'moon', en: 'Moon' },
    { key: 'mars', en: 'Mars' },
    { key: 'mercury', en: 'Mercury' },
    { key: 'jupiter', en: 'Jupiter' },
    { key: 'venus', en: 'Venus' },
    { key: 'saturn', en: 'Saturn' },
    { key: 'rahu', en: 'Rahu' },
    { key: 'ketu', en: 'Ketu' },
  ];
  return keys.map(({ key, en }) => {
    const p = raw[key];
    return {
      planet: grahaNames[en] ?? en,
      planetEn: en,
      rashi: p.rashi.name,
      degreeInRashi: Math.round(p.degreeInRashi * 100) / 100,
      nakshatra: p.nakshatra.name,
      nakshatraPada: p.nakshatra.pada,
      isRetrograde: p.isRetrograde,
    };
  });
}

// Only checks existing permission — never shows a dialog.
// Permission is requested explicitly from the location-permission screen.
async function getCoords(): Promise<PanchangCoords> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status === 'granted') {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      // No `timezone`: a live fix means the device is standing at these
      // coordinates, so its own per-date offset is the right one.
      return { lat: loc.coords.latitude, lon: loc.coords.longitude };
    }
  } catch (e) {
    if (e instanceof PanchangError) {
      console.warn('[panchang]', e.code, e.message);
    }
  }
  return FALLBACK_COORDS;
}

export async function fetchPanchang(
  date: Date,
  savedCoords?: PanchangCoords | null,
  computeEndTimes = true,
  language: Language = 'en',
  region: FestivalRegion = 'all',
  janmaNakshatra?: number,
  janmaRashi?: number,
  ayanamsa: AyanamsaType = 'lahiri',
): Promise<IPanchangDay | null> {
  try {
    const coords = savedCoords ?? (await getCoords());
    const timezone = timezoneMinutesFor(coords, date);
    // Anchored to the place, not the device — see `noonAtPlace`.
    const result = getDailyPanchang(
      noonAtPlace(date, timezone),
      { latitude: coords.lat, longitude: coords.lon },
      { timezone, computeEndTimes, language, region, janmaNakshatra, janmaRashi, ayanamsa },
    );
    if (!result) return null;
    const mapped = mapToPanchangDay(result);
    // `result.date` echoes the anchored instant; callers get their own `Date`
    // back, as this always did.
    mapped.date = date;
    return mapped;
  } catch (e) {
    if (e instanceof PanchangError) {
      console.warn('[panchang]', e.code, e.message);
    }
    return null;
  }
}

export async function fetchPanchangForToday(
  savedCoords?: PanchangCoords | null,
  language: Language = 'en',
  region: FestivalRegion = 'all',
  ayanamsa: AyanamsaType = 'lahiri',
  janmaNakshatra?: number,
  janmaRashi?: number,
): Promise<IPanchangDay | null> {
  try {
    const coords = savedCoords ?? (await getCoords());
    return getCachedPanchangDay(new Date(), coords, {
      computeEndTimes: true, language, region, ayanamsa, janmaNakshatra, janmaRashi,
    });
  } catch (e) {
    if (e instanceof PanchangError) {
      console.warn('[panchang]', e.code, e.message);
    }
    return null;
  }
}

/**
 * Snapshot of tithi/nakshatra/yoga/karana at the queried instant. Lighter than
 * `getCachedPanchangDay` — used to render an "AT THIS MOMENT" line on Today.
 */
export function fetchInstantPanchang(
  now: Date,
  coords: PanchangCoords,
  language: Language = 'en',
  ayanamsa: AyanamsaType = 'lahiri',
): IInstantPanchang | null {
  try {
    const raw = getInstantPanchang(
      now,
      { latitude: coords.lat, longitude: coords.lon },
      { language, ayanamsa, computeEndTimes: false },
    );
    if (!raw) return null;
    return {
      tithi: raw.angas.tithi.name,
      nakshatra: raw.angas.nakshatra.name,
      yoga: raw.angas.yoga.name,
      karana: raw.angas.karana.name,
    };
  } catch (e) {
    if (e instanceof PanchangError) {
      console.warn('[panchang]', e.code, e.message);
    }
    return null;
  }
}

// Eclipses are deterministic and far apart; a tiny memo is plenty.
interface EclipseCacheEntry {
  solar: IEclipseSummary | null;
  lunar: IEclipseSummary | null;
}
const ECLIPSE_CACHE = new Map<string, EclipseCacheEntry>();
const ECLIPSE_CACHE_MAX = 8;

const ECLIPSE_LOOK_AHEAD_DAYS = 365;

function eclipseDateOf(d: Date): string {
  // v5 publishes true instants, so the device-local calendar date of the peak
  // is what these getters read.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function summarizeEclipse(
  e: ReturnType<typeof getUpcomingSolarEclipse>,
  coords: PanchangCoords,
): IEclipseSummary | null {
  if (!e) return null;
  return {
    kind: e.kind,
    subtype: e.subtype,
    date: eclipseDateOf(e.peak),
    // The upcoming-eclipse helpers take no timezone, so their result carries no
    // `*Local` strings — render the instant ourselves, in the place's offset at
    // the moment of the peak (an eclipse can be up to a year out, so "now" is
    // the wrong side of a DST boundary as often as not).
    peak: formatInstant(e.peak, timezoneMinutesFor(coords, e.peak)) ?? '',
    // Same at-peak-vs-any-phase correction as `mapEclipse`.
    visibleFromLocation: isEclipseVisibleAnyPhase(e, { latitude: coords.lat, longitude: coords.lon }),
    description: e.description,
  };
}

export function fetchUpcomingEclipses(
  fromDate: Date,
  coords: PanchangCoords,
): EclipseCacheEntry {
  const key = `${eclipseDateOf(fromDate)}|${coords.lat.toFixed(2)}|${coords.lon.toFixed(2)}`;
  const hit = lruHit(ECLIPSE_CACHE, key);
  if (hit) return hit;
  const loc = { latitude: coords.lat, longitude: coords.lon };
  let solar: IEclipseSummary | null = null;
  let lunar: IEclipseSummary | null = null;
  try {
    solar = summarizeEclipse(getUpcomingSolarEclipse(fromDate, loc, ECLIPSE_LOOK_AHEAD_DAYS), coords);
  } catch (e) {
    if (e instanceof PanchangError) console.warn('[panchang]', e.code, e.message);
  }
  try {
    lunar = summarizeEclipse(getUpcomingLunarEclipse(fromDate, loc, ECLIPSE_LOOK_AHEAD_DAYS), coords);
  } catch (e) {
    if (e instanceof PanchangError) console.warn('[panchang]', e.code, e.message);
  }
  const entry: EclipseCacheEntry = { solar, lunar };
  lruSet(ECLIPSE_CACHE, key, entry, ECLIPSE_CACHE_MAX);
  return entry;
}
