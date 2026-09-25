/**
 * App-wide festival catalogue — read out of the pre-computed festival table
 * `src/data/static/festivals-table.json`, which
 * `scripts/generate-festivals-table.js` builds from panchang-ts's own
 * `buildFestivalsTable`. The library is still the single source of truth for
 * the dates; only the storage is ours. (4.2.0–4.3.1 bundled the table inside
 * the package and this module needed no local JSON; v5 removed every bundled
 * table, so the generator is back — see the script's header.)
 *
 * Shape is intentionally identical to the old JSON — a year-keyed map of
 * `{ date: 'YYYY-MM-DD', festivals: [{ key, name, type, description? }] }` rows
 * in ENGLISH — so every existing consumer (calendarService, vrat, navratri,
 * reminderScheduler, the festivals screen) works unchanged. `key` is the stable
 * language-independent id; it is what {@link festivalAllowedInRegion} matches on.
 *
 * Why English: several consumers run name-keyed heuristics over this data
 * (calendarService HEADLINE_MAJORS / deity matchers, vrat-type map, Navratri
 * Day-1 lookup, reminder tithi matchers). The bundled table also ships Hindi,
 * but Hindi rendering stays at the UI boundary via `localizeFestivalName` /
 * `localizeFestivalDescription` so the matching logic has a stable key set.
 *
 * Coverage + caveats (stamped into the table's `_meta` by the generator):
 *   - Reference location Ujjain / IST — the same point as `FALLBACK_COORDS`,
 *     so a no-location user's Panchang and Festivals screens agree. Within
 *     India these dates are
 *     essentially universal; elsewhere a festival can shift ±1 day.
 *   - Year range is {@link FESTIVALS_MIN_YEAR}..{@link FESTIVALS_MAX_YEAR}
 *     (the generator's FIXED 2020–2050 window; `npm run check:data` asserts
 *     every year in it is present). Years outside the range resolve to `[]`
 *     HERE, synchronously and for every consumer — this module never computes.
 *     The one surface that reaches past the table, the Festivals browse screen,
 *     goes through `src/services/festivalYearCache.ts`, which computes a small
 *     window of extra years on-device with {@link getFestivalsTableBuild} (the
 *     exact parameters this table was built with), off the render path, once,
 *     and caches them in SQLite.
 *   - Eclipses are EXCLUDED (visibility is location-dependent). They are
 *     sourced live via `getUpcomingEclipses` in panchangService (daily view /
 *     festivals screen) and calendarService (month grid).
 *   - The table is built at `region: 'all'` — the most INCLUSIVE setting, so it
 *     carries every regional variant. The user's Region is therefore applied at
 *     READ time via {@link festivalAllowedInRegion}, not at build time; a
 *     table built per-region would need 22 copies. That filter reads the
 *     generated `festival-regions.json` plus the hand-curated, additive-only
 *     {@link CURATED_REGIONS} map below, which is the ONLY place regional scope
 *     is edited by hand — the JSON stays a pure record of what the engine said.
 *   - The table is also built at `purnimanta`. Since panchang-ts 5.4 a key
 *     filter is not enough on its own: some regions list a DIFFERENT festival
 *     on a day (Masik Karthigai where Tamil Nadu has Karthigai Deepam), and a
 *     few observances are dated by the month system (Shravan Somvar, Mangala
 *     Gauri, Kartik Somvar, Magha Shanivar; Nepal by the solar month). The
 *     generated `festival-variants.json` carries those per-(region, masa)
 *     corrections and {@link festivalsForDay} / {@link festivalDaysForYear}
 *     apply them after the key filter — read festival rows through those, not
 *     the raw year map, anywhere the user's own Region or month system counts.
 */
import type { AyanamsaType, FestivalRegion, MasaSystem } from 'panchang-ts';
import {
  readFestivalsForYear,
  readFestivalsYearRange,
  type AnyFestivalsFile,
  type FestivalTableDay,
  type FestivalTableEntry,
  type FestivalTableMeta,
} from 'panchang-ts/festivals';

import regionIndex from './static/festival-regions.json';

type FestivalsTableFile = AnyFestivalsFile & {
  _meta: FestivalTableMeta & { panchangTsVersion?: string };
};

/**
 * The region index, imported eagerly: it is ~2.5 KB, `festivalAllowedInRegion`
 * needs it on every read, and its `_meta` carries the SAME year window the
 * table was built over (one generator run writes both, and
 * `scripts/check-generated-data.js` fails if their windows ever differ).
 */
const REGION_INDEX = regionIndex as {
  _meta: { startYear: number; endYear: number };
  keys: Record<string, string[]>;
};

/**
 * The year range, known WITHOUT loading the table — see {@link festivalsTable}
 * for why that matters. Read off the region index's `_meta`, which the coverage
 * check pins to the table's own; a dev build re-checks it the moment the table
 * is loaded.
 */
export const FESTIVALS_MIN_YEAR = REGION_INDEX._meta.startYear;
export const FESTIVALS_MAX_YEAR = REGION_INDEX._meta.endYear;

let loadedTable: FestivalsTableFile | null = null;

/**
 * The festival table, `require`d on first use rather than imported.
 *
 * Metro runs with `inlineRequires: false`, so a top-level `import` of the JSON
 * materializes the whole object literal when this module is evaluated — and
 * this module is on the pre-paint graph (`app/_layout.tsx` →
 * `services/reminderScheduler` → here). At 2020–2050 that literal is ~4,900
 * day-rows (~219 KB of bytecode, 3.5× the old 8-year table), yet nothing
 * reads a festival row before first paint: the first reader is the reminder
 * roll 1.5 s after launch, or a screen the user opens. A module factory
 * `require`d from inside a function runs on that first call instead, so the
 * cost moves off cold start without changing a single consumer.
 */
function festivalsTable(): FestivalsTableFile {
  if (loadedTable === null) {
    loadedTable = require('./static/festivals-table.json') as FestivalsTableFile;
    if (__DEV__) {
      const range = readFestivalsYearRange(loadedTable);
      if (range.start !== FESTIVALS_MIN_YEAR || range.end !== FESTIVALS_MAX_YEAR) {
        console.warn(
          `[festivals] festivals-table.json covers ${range.start}–${range.end} but festival-regions.json ` +
            `says ${FESTIVALS_MIN_YEAR}–${FESTIVALS_MAX_YEAR}. Regenerate both (npm run generate:festivals).`,
        );
      }
    }
  }
  return loadedTable;
}

/** Whether `year` is answered by the bundled table (as opposed to `[]`). */
export function isFestivalYearInTable(year: number): boolean {
  return Number.isInteger(year) && year >= FESTIVALS_MIN_YEAR && year <= FESTIVALS_MAX_YEAR;
}

/**
 * The parameters the bundled table was BUILT with, read back out of its own
 * `_meta` — i.e. the settings the in-range path answers under. These are the
 * generator's constants (Ujjain / IST, Lahiri, purnimanta, region `'all'`), not
 * the user's ayanamsa / masa-system settings: the table is one fixed artifact
 * for everyone, and the user's Region and month system are applied at READ time
 * by {@link festivalsForDay}. An out-of-range year computed on-device must
 * use exactly these so that 2051 answers the same way 2050 does, which is why
 * the compute path reads them here instead of restating them. The variants file
 * covers the table's window only, so those years answer in the table's own
 * convention (`all` + purnimanta) for the handful of month-system-dependent
 * observances — they are only ever browsed, never reminded about.
 *
 * `panchangTsVersion` is the engine that computed the table.
 * `scripts/check-generated-data.js` fails unless it equals the installed
 * panchang-ts, so at runtime it doubles as the version of the engine the app is
 * running — the cache key for anything computed on-device.
 *
 * A function, not a constant, so that asking for it never loads the table at
 * module-evaluation time (see {@link festivalsTable}).
 */
export interface FestivalsTableBuild {
  readonly referenceLocation: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly timezoneOffsetMinutes: number;
  readonly ayanamsa: AyanamsaType;
  readonly masaSystem: MasaSystem;
  readonly region: FestivalRegion;
  readonly panchangTsVersion: string;
}

let tableBuild: FestivalsTableBuild | null = null;

export function getFestivalsTableBuild(): FestivalsTableBuild {
  if (tableBuild === null) {
    const meta = festivalsTable()._meta;
    tableBuild = Object.freeze({
      referenceLocation: meta.referenceLocation,
      latitude: meta.latitude,
      longitude: meta.longitude,
      timezoneOffsetMinutes: meta.timezoneOffsetMinutes,
      ayanamsa: meta.ayanamsa as AyanamsaType,
      masaSystem: meta.masaSystem as MasaSystem,
      region: meta.region as FestivalRegion,
      panchangTsVersion: meta.panchangTsVersion ?? 'unstamped',
    });
  }
  return tableBuild;
}

/**
 * Year-keyed festival rows in English, decoded LAZILY — one year on first
 * access, then cached forever.
 *
 * This used to be an eager IIFE that decoded every year in the range (8 years /
 * ~1,250 day-rows as shipped) at module load. That load is on the pre-paint
 * graph — `app/_layout.tsx` imports `services/reminderScheduler`, which imports
 * this — and a cold start only ever reads the current year (plus the next one
 * when the reminder horizon crosses a year boundary). Everything else was work
 * done before first frame for a screen the user may never open.
 *
 * Be precise about what this does and does not save: Metro emits the JSON as a
 * JS object literal, so the table's bytecode still ships in the bundle. Two
 * things are deferred: materializing that literal (see {@link festivalsTable}),
 * and the DERIVED per-year decode (`readFestivalsForYear` unpacking the packed
 * rows and picking the `en` names).
 *
 * The Proxy is here purely so the six existing consumers stay untouched; they
 * all index it as a plain `Record<string, FestivalTableDay[]>`.
 *
 * `calendarService` used to walk `Object.keys(...)` to build one flat date
 * index, which forced the whole table and cancelled this deferral out — it is
 * imported by `app/(tabs)/panchang.tsx`, so that decode simply moved from one
 * pre-paint tick to another. It now ingests only the civil year(s) a requested
 * month spans, so keep any new consumer year-scoped too rather than
 * reintroducing an `Object.keys` walk over the whole table.
 */
const decodedYears = new Map<string, FestivalTableDay[] | undefined>();

function decodeYear(yearKey: string): FestivalTableDay[] | undefined {
  if (decodedYears.has(yearKey)) return decodedYears.get(yearKey);
  const year = Number(yearKey);
  // Bail BEFORE touching the cache for anything that isn't an in-range year.
  // The `get` trap fires for every property read on the proxy, not just year
  // lookups (`toString`, `then` on a stray await, whatever a debugger pokes at),
  // and memoizing those would grow the Map with junk keys forever.
  if (!Number.isInteger(year) || year < FESTIVALS_MIN_YEAR || year > FESTIVALS_MAX_YEAR) {
    return undefined;
  }
  const rows = readFestivalsForYear(festivalsTable(), year, 'en') ?? undefined;
  decodedYears.set(yearKey, rows);
  return rows;
}

/** Only the years that actually decoded to rows, matching the old map's key set
 *  (a year the table doesn't carry was never a key). Forces the full decode. */
function decodedYearKeys(): string[] {
  const keys: string[] = [];
  for (let year = FESTIVALS_MIN_YEAR; year <= FESTIVALS_MAX_YEAR; year++) {
    const key = String(year);
    if (decodeYear(key) !== undefined) keys.push(key);
  }
  return keys;
}

const festivalsByYear = new Proxy({} as Record<string, FestivalTableDay[]>, {
  // Non-year reads fall through to the target, so the proxy keeps everything a
  // plain `{}` had — `toString`, `valueOf`, `hasOwnProperty`, `constructor`.
  // Swallowing them instead would make `String(festivalsByYear)` throw
  // ("cannot convert object to primitive value"), which is a nasty way for a
  // stray log line to take down a screen.
  get(target, prop) {
    if (typeof prop !== 'string') return Reflect.get(target, prop);
    return decodeYear(prop) ?? Reflect.get(target, prop);
  },
  has(target, prop) {
    if (typeof prop !== 'string') return Reflect.has(target, prop);
    return decodeYear(prop) !== undefined || Reflect.has(target, prop);
  },
  ownKeys() {
    return decodedYearKeys();
  },
  getOwnPropertyDescriptor(target, prop) {
    if (typeof prop !== 'string') return Reflect.getOwnPropertyDescriptor(target, prop);
    const rows = decodeYear(prop);
    if (rows === undefined) return undefined;
    // `configurable: true` is mandatory, not stylistic: the Proxy target is a
    // plain empty object, and reporting a non-configurable own property that
    // the target does not have is a Proxy invariant violation that throws.
    // `enumerable: true` is what makes `Object.keys` / spread see the year.
    return { value: rows, enumerable: true, configurable: true, writable: false };
  },
});

/** Festival key → the regions that emit it, for the keys that are NOT emitted
 *  everywhere. Generated alongside the table by
 *  `scripts/generate-festivals-table.js`; see its header for how it is derived.
 *  This is the ENGINE's opinion and nothing else — hand curation lives in
 *  {@link CURATED_REGIONS} below, never in the JSON. */
const ENGINE_REGION_KEYS = REGION_INDEX.keys;

/** Every `FestivalRegion` a user can actually pick in Settings. `'all'` is the
 *  "no filtering" sentinel, not a place, so it is never a curation target. */
type ScopedRegion = Exclude<FestivalRegion, 'all'>;

interface CuratedRegion {
  /**
   * What the festival is called in this region, when that differs from the
   * table's name. DOCUMENTATION ONLY — there is no per-region label anywhere in
   * the app (the table carries one `name.en` / `name.hi` pair per key and
   * `localizeFestivalName` takes a language, not a region), so a user here still
   * reads the pan-Indian name. It is recorded because it is the evidence that
   * the add is the SAME observance under another name rather than a different
   * festival sharing the tithi, which is the mistake this table most invites.
   */
  readonly localName?: string;
  /** Why this is a genuine, widely-observed public or household observance
   *  there — naming the source class, not just asserting it. */
  readonly why: string;
}

/**
 * CURATED, ADDITIVE region overrides layered on the generated index.
 *
 * WHY THIS EXISTS. `festival-regions.json` records where panchang-ts happens to
 * EMIT a key, which is not the same as where the festival is observed. Where the
 * engine is too narrow and the day carries no other festival, the day's list goes
 * EMPTY, the date drops out of every festival branch of `pickPrimaryEvent`, and
 * the cell silently loses its plinth, its tint and its headline — an ordinary
 * day where a household is keeping a fast. {@link LOCAL_MAX_REGIONS} is the
 * blunt guard against that; this map is the precise one.
 *
 * WHY READ TIME AND NOT GENERATE TIME. The alternative was to bake these into
 * `buildRegionIndex` so the artifact ships pre-merged. Rejected on three counts.
 * (1) Provenance: once merged, nothing in the JSON distinguishes a region the
 * engine emitted from one we argued for, and the whole point of the file is to
 * be a faithful record of what the engine said — a `git diff` after an engine
 * bump then shows engine drift cleanly, with our edits nowhere in it. (2) The
 * breadth guard below can only be applied to the engine's own count if the two
 * lists stay separate; merged, an override that pushes a key past the threshold
 * would silently exempt it in all 21 regions (see the interaction note below).
 * (3) Survivability: `npm run generate:festivals` rewrites the JSON wholesale on
 * every engine bump — a baked override would have to be re-applied by the
 * generator forever and would be erased the one time someone regenerates with a
 * modified script, whereas a TypeScript map is simply not in that file's blast
 * radius. Cost of read time: one extra `Object.keys` pass at module load
 * (~10 entries) and the risk of an override going stale unnoticed — accepted,
 * because stale here means "shown in one region too many", not a blank day.
 *
 * ADDITIVE ONLY, BY CONSTRUCTION. There is no `remove` field. Subtracting a
 * region the engine emitted is how the Diwali-week regression happened, and a
 * false removal blanks a real festival day; if a removal is ever genuinely
 * warranted it needs its own reviewed mechanism, not a sign flip here.
 *
 * BAR FOR AN ENTRY. The festival is a genuine, widely-observed public or
 * household observance in that region — not "some community there might", not
 * "it is theoretically pan-Hindu". Over-adding is the mirror harm: it clutters a
 * calendar with festivals that are not the user's and makes the Region setting
 * meaningless. Each entry below was researched, then attacked on four failure
 * modes (pan-Hindu theorising, diaspora generalisation, a same-tithi observance
 * that is genuinely a DIFFERENT festival, and a single weak source) and
 * survived. Where the observance runs under another name, that name is stated in
 * `localName` and the app's standing "regional and family variations exist"
 * disclaimer carries the difference — a recognisable name beats a blank cell.
 *
 * REJECTED, so they are not re-proposed: Hartalika Teej in Uttarakhand (single
 * uncited tertiary source), Andhra Pradesh and Telangana (the local Bhadrapada
 * Shukla Tritiya observance there is a differently-named vrat and AP's own
 * gazette does not carry it); Singh Sankranti in Kerala (Chingam 1 is real but
 * is a different observance, so this key would ship a mislabelled duplicate);
 * Gangaur in Haryana (its two "sources" trace to one exam-prep cram book) and in
 * Maharashtra (Chaitra Gauri there is a distinct festival on the same tithi);
 * Baisakhi in Uttarakhand (Bikhauti is a different Mesha Sankranti festival).
 */
const CURATED_REGIONS: Readonly<
  Record<string, Readonly<Partial<Record<ScopedRegion, CuratedRegion>>>>
> = {
  baisakhi: {
    'himachal-pradesh': {
      localName: 'Baisakhi / Biswa',
      why:
        "hpkangra.nic.in names two state-level Baisakhi fairs (Kaleshwar Mahadev " +
        "Dehra, Jwalli) plus household 'Biswa' on 13 April; Rewalsar in Mandi keeps " +
        'it too. The engine already grants Haryana but not HP.',
    },
  },
  gangaur: {
    'madhya-pradesh': {
      localName: 'Gangaur (Isar Ji and Gawarja in Nimar and Malwa)',
      why:
        "Drik: 'celebrated on a very large scale in Nimar, Madhya Pradesh'; " +
        'khargone.nic.in and dhar.nic.in each carry a district Gangaur page, and ' +
        'Drik agrees with the engine on the tithi.',
    },
    'uttar-pradesh': {
      localName: 'Gangaur / Gauri Teej (Braj and Bundelkhand)',
      why:
        'Drik and both Wikipedias scope it to Braj and UP-Bundelkhand, ~35–40M ' +
        'people. State-level is the only granularity this index has, so the rest ' +
        'of UP sees a name it will not know — accepted against a blanked day.',
    },
  },
  gudi_padwa: {
    'madhya-pradesh': {
      localName: 'Gudi Padwa / गुड़ी पड़वा (popularly Nav Samvatsar)',
      why:
        'MP GAD notification F-3-1-2025-Ek-4 gazettes "गुड़ी पड़वा / Gudi Padwa" as a ' +
        'GENERAL (not optional) state holiday in 2025 and 2026, and the state runs ' +
        'Vikramotsav at Ujjain under that name. Today MP users see only "Ugadi".',
    },
  },
  harela: {
    'himachal-pradesh': {
      localName: 'Hariyali / Rihyali; Dakhrain in Jubbal and Kinnaur',
      why:
        "hpkangra.nic.in lists 'Haryali' on Shravana 1 with BOTH of Harela's " +
        'signature rites — the 5-to-7-grain basket sown ten days ahead, and the ' +
        'clay Shiva-Parvati marriage. Kangra alone is ~a fifth of the state.',
    },
  },
  hariyali_teej: {
    punjab: {
      localName: 'Teeyan (Teeyan da Tyohar / Teeyan da Mela)',
      why:
        "The Tribune (Ludhiana): 'Teej, locally celebrated as Teeyan', Sawan sudi 3 " +
        '— shukla dates are identical under both masa systems, so it is the day the ' +
        'table encodes. utsav.gov.in and Punjab Tourism both carry Teeyan da Mela.',
    },
  },
  hartalika_teej: {
    goa: {
      localName: 'Tai (Hartalika)',
      why:
        "Navhind Times and Gomantak Times cover 'Tai or Hartalika' on Chavath eve — " +
        'Shiva-Parvati nirjala vrat, with its own festival-specific moni patoli. ' +
        'Sources differ on breadth (Brahmin/GSB households) but not on whether.',
    },
    gujarat: {
      localName: 'Kevda Trij (Kevada Trij)',
      why:
        'ETV Bharat Gujarati cites the Vratraj equating Kevda Trij with Haritalika ' +
        'Vrat; Zee and TV9 Gujarati headline it "હરતાલિકા તીજ એટલે કે કેવડા ત્રીજ". ' +
        'Same deities, tithi and nirjala vow.',
    },
    jharkhand: {
      why:
        'Prabhat Khabar runs Ranchi CITY-DESK Hartalika Teej coverage across years ' +
        '(named local participants), and Drik lists Jharkhand beside Bihar, UP, MP ' +
        'and Rajasthan — four of which the engine already emits. Carved out of Bihar ' +
        'in 2000, so this is continuous practice, not transplant.',
    },
    karnataka: {
      localName: 'Gowri Habba (Swarna Gauri Vrata)',
      why:
        'Drik equates the two BIDIRECTIONALLY and gives the same date the table has; ' +
        'named in the Karnataka Industrial Establishments (National and Festival ' +
        'Holidays) Act, 1963. The ritual grammar genuinely differs — recorded as a ' +
        'known softness; upstream deserves its own gowri_habba key.',
    },
    nepal: {
      localName: 'Haritalika Teej',
      why:
        'Gazetted holiday (Nepal Gazette, Hamro Patro); Kathmandu Post and Himalayan ' +
        'Times name it Haritalika, same Bhadra Shukla Tritiya nirjala vrat, kept ' +
        'across ethnicities. Three table dates cross-checked against Nepali sources.',
    },
  },
  kajari_teej: {
    bihar: {
      localName: 'Kajari / Kajri Teej (also Badi Teej, Satudi Teej)',
      why:
        "Grierson's Bihar Peasant Life §1443 records the Bhadon tij with the " +
        'diagnostic sattu parana, in a Bihar-only survey. The engine already grants ' +
        'Bihar both other Teejs, which makes this omission look like an artefact.',
    },
  },
  singh_sankranti: {
    uttarakhand: {
      localName: 'Ghee Sankranti (Ghyu Tyar / Olgia)',
      why:
        'nainital.nic.in lists Ghee Sankranti among the region\'s observed ' +
        'sankrantis; Uttarakhand Post ties it explicitly to the Sun entering Simha ' +
        'and to the name सिंह संक्रांति, which is the label this key already renders.',
    },
  },
  varamahalakshmi: {
    maharashtra: {
      localName: 'Varad Lakshmi Vrat / वरदलक्ष्मी व्रत',
      why:
        "Drik's own MARATHI calendar curates वरदलक्ष्मी व्रत while its Bengali and " +
        'Gujarati calendars omit it, so this is regional curation, not a rendering ' +
        'artefact; same last-Friday-of-Shravana-shukla rule. Family custom kept ' +
        'alongside Jivati, so narrower than a mass public festival.',
    },
  },
};

/**
 * Engine list ∪ curated additions, for curated keys only. Built once at module
 * load. A curated key the engine no longer scopes (absent from the index, i.e.
 * already pan-Indian) is skipped: the override is then inert, which is the
 * correct fail-open, not an error.
 */
const EFFECTIVE_REGION_KEYS: Record<string, string[]> = (() => {
  const out: Record<string, string[]> = {};
  const inert: string[] = [];
  for (const [key, additions] of Object.entries(CURATED_REGIONS)) {
    const engine = ENGINE_REGION_KEYS[key];
    if (engine === undefined) {
      // Either the key went pan-Indian (correct fail-open) or it was renamed
      // upstream and this override is now dead. The two are indistinguishable
      // here, and a dead override silently restores the blank-day bug the
      // curation exists to prevent — so say so in dev rather than fail quiet.
      inert.push(key);
      continue;
    }
    out[key] = [...new Set([...engine, ...Object.keys(additions)])].sort();
  }
  if (__DEV__ && inert.length > 0) {
    console.warn(
      `[festivals] ${inert.length} curated region override(s) are inert — the engine no longer scopes ` +
        `these keys: ${inert.join(', ')}. Either they became pan-Indian (fine, drop the entry) or they ` +
        `were renamed upstream (not fine, the region is silently gone). Re-check after a panchang-ts bump.`,
    );
  }
  return out;
})();

/**
 * How many regions an index entry may list and still count as a genuinely
 * LOCAL festival — i.e. one it is correct to subtract from other regions.
 *
 * The index records where panchang-ts happens to EMIT a key, which is not the
 * same as where the festival is observed, and for broad observances the engine
 * scopes far more narrowly than reality. Two Diwali-week `type: 'major'` keys
 * make the case: `govardhan_puja` is listed for 8 regions and `bhai_dooj` for
 * 10, yet both are nationwide (Govardhan Puja is Bali Pratipada in
 * Maharashtra; Bhai Dooj is Tikka in Punjab, Bhai Phonta in Bengal). Both days
 * carry that one festival and nothing else, so filtering them blanked
 * 2026-11-10 for 13 regions and 2026-11-11 for 11 — and an empty festival list
 * drops the day out of `pickPrimaryEvent`'s festival branches entirely, losing
 * the plinth, the tint and the headline.
 *
 * 5 sits in a clean gap in the shipped index: the broadest genuinely-regional
 * keys are Hariyali Teej and Hartalika Teej at 5 regions each, the next
 * entries up are Govardhan Puja at 8 and Bhai Dooj at 10, and nothing is
 * listed for 6 or 7 — so the threshold is not balanced on a cliff edge, and
 * truly local festivals (Pongal 1, Gudi Padwa 2, Lohri 3) still filter.
 *
 * This is counted against {@link ENGINE_REGION_KEYS} ONLY, never against the
 * curated total — see the interaction note on {@link festivalAllowedInRegion}.
 * That is also why the gap described above stays true: curation never writes to
 * the index, so those counts are still 5 / 8 / 10.
 */
const LOCAL_MAX_REGIONS = 5;

/**
 * Whether a festival key belongs in a `region`'s calendar.
 *
 * The table itself carries every regional variant (it is built at `'all'`), and
 * `FestivalTableEntry` has no per-festival region tag, so the scoping lives in
 * the generated `festival-regions.json` index instead.
 *
 * Two classes of key are always allowed. An unknown one is treated as
 * pan-Indian, so a festival a panchang-ts bump starts emitting shows up for
 * everyone rather than silently disappearing until the index is regenerated;
 * and one listed for more than {@link LOCAL_MAX_REGIONS} regions is a broad
 * observance the index merely scopes narrowly, so subtracting it would blank
 * the day for most of the country.
 *
 * INTERACTION ORDER — deliberate, and the one thing to get right here. The
 * breadth guard is tested against the ENGINE's list, BEFORE curation is folded
 * in, so a curated add can never trip it. Testing the merged list instead would
 * make the two mechanisms fight: Hartalika Teej goes 5 → 10 regions here, which
 * on a merged count would exempt it and put a north-Indian name on the calendar
 * in Kerala, Assam, Odisha, Bengal and Punjab — 11 regions gained to fix 5, the
 * exact over-add the Region setting exists to prevent. The guard means "the
 * engine itself called this broad, so trust it over the index"; a curated key is
 * one a human has already scoped by hand, so the heuristic has nothing left to
 * add and is superseded for that key. (If a future bump widens a curated key's
 * own list past the threshold, the guard fires as usual and the override goes
 * inert — fail-open, same as any other broad key.)
 */
export function festivalAllowedInRegion(key: string, region: FestivalRegion): boolean {
  if (region === 'all') return true;
  const engineAllowed = ENGINE_REGION_KEYS[key];
  if (engineAllowed === undefined) return true;
  if (engineAllowed.length > LOCAL_MAX_REGIONS) return true;
  return (EFFECTIVE_REGION_KEYS[key] ?? engineAllowed).includes(region);
}

// ─── Per-(region, masa) corrections ──────────────────────────────────────────

interface FestivalVariantsFile {
  _meta: { table: string; startYear: number; endYear: number; panchangTsVersion: string };
  entries: FestivalTableEntry[];
  patches: {
    when: string[];
    remove: [string, number][];
    /** date, entry, the engine's position for it that day, the key listed before it. */
    add: [string, number, number, string | null][];
  }[];
}

interface DayPatch {
  remove: FestivalTableEntry[];
  /** In the engine's order for the day (`pos`), so each `after` is placed first. */
  add: { entry: FestivalTableEntry; pos: number; after: string | null }[];
}

let loadedVariants: FestivalVariantsFile | null = null;

/** `require`d on first use for the same reason as {@link festivalsTable}; a
 *  user on the table's own Region + month system never loads it at all. */
function festivalVariants(): FestivalVariantsFile {
  if (loadedVariants === null) {
    loadedVariants = require('./static/festival-variants.json') as FestivalVariantsFile;
  }
  return loadedVariants;
}

/** The (region, masa) the table answers exactly — no correction ever applies.
 *  Read from the table's own `_meta` so it cannot drift from the build. */
function isTableBuild(region: FestivalRegion, masaSystem: MasaSystem): boolean {
  const build = getFestivalsTableBuild();
  return region === build.region && masaSystem === build.masaSystem;
}

/** date → corrections, per `region|masa`, built on first use of that pair. */
const patchIndex = new Map<string, Map<string, DayPatch>>();

function patchesFor(region: FestivalRegion, masaSystem: MasaSystem): Map<string, DayPatch> {
  const combo = `${region}|${masaSystem}`;
  let byDate = patchIndex.get(combo);
  if (byDate) return byDate;
  byDate = new Map();
  const file = festivalVariants();
  const slot = (ymd: string): DayPatch => {
    let p = byDate!.get(ymd);
    if (!p) {
      p = { remove: [], add: [] };
      byDate!.set(ymd, p);
    }
    return p;
  };
  for (const patch of file.patches) {
    if (!patch.when.includes(combo)) continue;
    for (const [ymd, i] of patch.remove) slot(ymd).remove.push(file.entries[i]);
    for (const [ymd, i, pos, after] of patch.add) slot(ymd).add.push({ entry: file.entries[i], pos, after });
  }
  for (const p of byDate.values()) p.add.sort((a, b) => a.pos - b.pos);
  patchIndex.set(combo, byDate);
  return byDate;
}

/** A festival row as consumers type it: the table entry with `type` widened
 *  to `string`, which is how most of them declare it. */
type FestivalRowEntry = { key: string; name: string; type: string; description?: string };

function sameEntry(a: FestivalRowEntry, b: FestivalRowEntry): boolean {
  return a.key === b.key && a.name === b.name && a.type === b.type && a.description === b.description;
}

/**
 * The festivals a user in `region` keeping `masaSystem` observes on `ymd`,
 * given that date's table rows (`[]` when the table has no row for it — a
 * correction can add a day the table does not carry).
 *
 * The key-level {@link festivalAllowedInRegion} filter first, then the
 * generated corrections for that exact (region, masa) — see `buildVariants` in
 * `scripts/generate-festivals-table.js`. Together they reproduce the engine's
 * own answer for that combination; `npm run check:data` asserts it, apart from
 * the deliberate widenings (breadth guard, {@link CURATED_REGIONS}).
 *
 * Returns `tableRows` itself when nothing changes, so treat the result as
 * read-only.
 */
export function festivalsForDay<T extends FestivalRowEntry>(
  ymd: string,
  tableRows: readonly T[],
  region: FestivalRegion,
  masaSystem: MasaSystem,
): readonly T[] {
  const filtered =
    region === 'all' ? tableRows : tableRows.filter(f => festivalAllowedInRegion(f.key, region));
  if (isTableBuild(region, masaSystem)) return filtered;
  const patch = patchesFor(region, masaSystem).get(ymd);
  if (!patch) return filtered;
  const out = filtered.filter(f => !patch.remove.some(r => sameEntry(r, f)));
  // Each correction goes where the engine lists it — right after the key it
  // follows, or first — not at the end: the calendar headlines a day by its
  // first minor festival. Adds arrive in engine order, so an `after` that is
  // itself a correction is already in place. A correction is a table entry,
  // the same shape every caller's rows are.
  for (const { entry, after } of patch.add) {
    if (out.some(f => sameEntry(f, entry))) continue;
    const anchor = after === null ? -1 : out.findIndex(f => f.key === after);
    const at = after === null ? 0 : anchor === -1 ? out.length : anchor + 1;
    out.splice(at, 0, entry as T);
  }
  return out;
}

/** Memoized {@link festivalDaysForYear} results, per `year|region|masa`. */
const yearViews = new Map<string, FestivalTableDay[]>();

/**
 * Every festival day of an in-table `year` as `region` + `masaSystem` see it —
 * {@link festivalsForDay} over the year, with days a correction empties dropped
 * and days it adds included, date-sorted. `[]` outside the table's range.
 */
export function festivalDaysForYear(
  year: number,
  region: FestivalRegion,
  masaSystem: MasaSystem,
): readonly FestivalTableDay[] {
  const base = decodeYear(String(year));
  if (!base) return [];
  if (region === 'all' && isTableBuild(region, masaSystem)) return base;
  const memoKey = `${year}|${region}|${masaSystem}`;
  const hit = yearViews.get(memoKey);
  if (hit) return hit;

  const rowsByDate = new Map<string, readonly FestivalTableEntry[]>();
  for (const day of base) rowsByDate.set(day.date, day.festivals);
  if (!isTableBuild(region, masaSystem)) {
    const prefix = `${year}-`;
    for (const ymd of patchesFor(region, masaSystem).keys()) {
      if (ymd.startsWith(prefix) && !rowsByDate.has(ymd)) rowsByDate.set(ymd, []);
    }
  }
  const days: FestivalTableDay[] = [];
  for (const ymd of [...rowsByDate.keys()].sort()) {
    const festivals = festivalsForDay(ymd, rowsByDate.get(ymd)!, region, masaSystem);
    if (festivals.length > 0) days.push({ date: ymd, festivals: [...festivals] });
  }
  yearViews.set(memoKey, days);
  return days;
}

export default festivalsByYear;
