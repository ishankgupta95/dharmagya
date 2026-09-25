/**
 * Navratri / Navadurga — content data (Phase 14.3).
 *
 * The nine-day Navratri observance. *Content* lives here; computed data (the
 * dates of Day 1..9, the day-of-the-week colour cycle, Ghatasthapana muhurat)
 * lives in `src/services/astrology/navratri.ts`.
 *
 * **Content-accuracy posture (PLAN §8, hard):**
 *
 *  - **Colours are NOT hardcoded per Navadurga form.** The "Yellow = Day 1,
 *    Green = Day 2" lists online are a 2003 *Maharashtra Times* circulation
 *    gimmick, not tradition. The authoritative system assigns colours by the
 *    weekday Navratri starts → a fixed 9-colour weekly cycle.
 *    Colours are computed in [`navratri.ts`](../services/astrology/navratri.ts)
 *    from Day 1's weekday — they change every year. No `color:` field on
 *    `NavadurgaForm`.
 *
 *  - **Navadurga ↔ Navagraha planet mapping is fringe, not canonical.** Some
 *    astrology blogs map each form to a planet, but the mappings contradict
 *    each other across sources and authoritative references don't carry it.
 *    Not surfaced here.
 *
 *  - **Navadurga forms are Navratri *content*, not new Library deities.** The
 *    19-deity roster in `src/config/deities.ts` is fixed. A form's name +
 *    iconography is text; there is no avatar, no `/god/[id]` page. (Durga
 *    *herself* IS in the roster and remains so.)
 *
 *  - Mantras carry `reviewPending: true` until a qualified-reviewer pass
 *    lands; the detail screen surfaces this as a "provisional" caption.
 *
 * **Source of record.** The nine Navadurga forms, the four vrat tiers +
 * the vrat food lists, and the Durga Saptashati outline are sourced from
 * the `hindu-devotional-texts` library's `navratri/` module, which carries
 * the per-claim citations and flagged soft spots in its own module docs.
 */

// The Navadurga forms, the vrat tiers + foods, and the Durga Saptashati
// outline are all sourced from the shared `hindu-devotional-texts` library
// (v0.3.0+ `navratri/` module). Only the four-Navratri masa info, Gupt
// Navratri, and the app's lookup helpers stay here — app navigation/compute
// concerns, not shared devotional content.
import {
  getAllNavadurgaForms,
  navratriVratTiers,
  navratriVratFoods,
  saptashatiOutline,
  kanyaPujan,
} from 'hindu-devotional-texts';
import type {
  NavadurgaForm,
  KanyaPujanData,
} from 'hindu-devotional-texts';

import { poojafy } from '@/utils/sanitizeContent';

// ─── Shared types ────────────────────────────────────────────────────────────

/** A string with English + Hindi variants. Same shape as `vaarDevata.ts`. */
export interface Bilingual {
  en: string;
  hi: string;
}

// ─── The nine Navadurga forms ────────────────────────────────────────────────

/**
 * The Navadurga form types — `NavadurgaForm`, its worship `mantra`
 * (`NavadurgaMantra`), and its `dhyana` verse (`DhyanaShloka`) — are sourced
 * from the shared library's `navratri/` module (v0.3.0+). `NavadurgaForm`
 * carries: slug, day, name, iconography, significance, mantra, dhyana, bhog.
 *
 * The previous app-side `chakra` and `bhogAlt` fields are gone — `chakra`
 * was a non-canonical Tantric overlay (documented in the library's `navratri/`
 * module) and `bhogAlt` folded into the library's single `bhog`.
 * Nothing in the app rendered either field.
 */
export type { NavadurgaForm, KanyaPujanData };

// ─── Durga Saptashati — 13-chapter → 9-day map ───────────────────────────────

/**
 * One of the 13 chapters (adhyāyas) of the Devī Māhātmya / Durga Saptashati.
 *
 * The Saptashati is read across the 9 nights, with chapters grouped:
 * Day 1 → ch 1; Day 2 → ch 2–4; Day 3 → ch 5–8; Day 4 → ch 9–10;
 * Day 5 → ch 11; Day 6 → ch 12; Day 7 → ch 13; Day 8 → ch (revisit 1–13);
 * Day 9 → close. (JKYog / Devi Mahatmya commentaries; this is one of several
 * traditional groupings — also widely used: 3 days of Madhyam (ch 2–4) on
 * Day 2, etc. We surface the most-common North-Indian distribution.)
 *
 * **Full Sanskrit / Hindi verses are NOT shipped in v1** — that's its own
 * content-review project (700 verses across 13 chapters). What ships is the
 * chapter outline + the day-mapping, marked `reviewPending: true`. A user
 * who wants the full text is referred to the printed Saptashati.
 */
export interface SaptashatiChapter {
  /** 1..13. */
  number: number;
  /** Localised title. The Sanskrit name is the canonical reference. */
  titleSanskrit: string;
  titleEnglish: string;
  titleHindi: string;
  /** One-paragraph theme of the chapter. */
  theme: Bilingual;
  /** Optional in the shimmed shape — the library outline does not carry it. */
  reviewPending?: true;
}

export interface SaptashatiDayMapEntry {
  day: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  /** 1..13 chapter numbers read on this day. */
  chapters: number[];
  /** Short note about why this grouping (e.g. "Madhyam — Lakshmi episode"). */
  note: Bilingual;
}

// ─── Vrat (fasting) ──────────────────────────────────────────────────────────

export interface VratTier {
  slug: 'nirjala' | 'phalahar' | 'satvik' | 'two-day';
  label: Bilingual;
  description: Bilingual;
}

// ─── The nine forms (canonical Day 1 → Day 9 order) ──────────────────────────

export const NAVADURGA_FORMS: readonly NavadurgaForm[] = getAllNavadurgaForms();

// ─── The four Navratris ──────────────────────────────────────────────────────

/** Which Navratri are we computing? */
export type NavratriKind = 'sharad' | 'chaitra' | 'magha-gupt' | 'ashadha-gupt';

export interface NavratriMasaInfo {
  kind: NavratriKind;
  /** Localised name. */
  name: Bilingual;
  /** purnimanta masaIndex used by `convertHinduToGregorian`. */
  masaIndex: number;
  /** Approximate Gregorian window. */
  windowLabel: Bilingual;
  /** True when the full 9-day guide applies (Sharad / Chaitra). */
  fullGuide: boolean;
}

/**
 * The four Navratris. Sharad + Chaitra get the full 9-day Navadurga guide;
 * Magha Gupt + Ashadha Gupt are tantric/sadhana observances with the Ten
 * Mahavidyas, kept private — surface a calendar entry + info card only.
 */
export const NAVRATRI_MASAS: readonly NavratriMasaInfo[] = [
  {
    kind: 'chaitra',
    name: { en: 'Chaitra Navratri', hi: 'चैत्र नवरात्रि' },
    masaIndex: 0,
    windowLabel: { en: 'March – April', hi: 'मार्च – अप्रैल' },
    fullGuide: true,
  },
  {
    kind: 'ashadha-gupt',
    name: { en: 'Ashadha Gupt Navratri', hi: 'आषाढ़ गुप्त नवरात्रि' },
    masaIndex: 3,
    windowLabel: { en: 'June – July', hi: 'जून – जुलाई' },
    fullGuide: false,
  },
  {
    kind: 'sharad',
    name: { en: 'Sharad Navratri', hi: 'शारदीय नवरात्रि' },
    masaIndex: 6,
    windowLabel: { en: 'September – October', hi: 'सितंबर – अक्टूबर' },
    fullGuide: true,
  },
  {
    kind: 'magha-gupt',
    name: { en: 'Magha Gupt Navratri', hi: 'माघ गुप्त नवरात्रि' },
    masaIndex: 10,
    windowLabel: { en: 'January – February', hi: 'जनवरी – फ़रवरी' },
    fullGuide: false,
  },
] as const;

/** A short informational paragraph shown on the Gupt-Navratri info card. */
export const GUPT_NAVRATRI_INFO: Bilingual = {
  en: 'The Gupt ("hidden") Navratris are tantra-focused observances in which the Ten Mahavidyas — Kali, Tara, Tripurasundari, Bhuvaneshvari, Bhairavi, Chinnamasta, Dhumavati, Bagalamukhi, Matangi, Kamala — are worshipped, not the Navadurga. They are kept private and are intended for serious sadhakas under a teacher\'s guidance.',
  hi: 'गुप्त नवरात्रि तंत्र-प्रधान साधना-काल हैं — इनमें नवदुर्गा नहीं, अपितु दश-महाविद्या (काली, तारा, त्रिपुरसुंदरी, भुवनेश्वरी, भैरवी, छिन्नमस्ता, धूमावती, बगलामुखी, मातंगी, कमला) की उपासना की जाती है। ये साधना गोपनीय है तथा गुरु के मार्गदर्शन में गंभीर साधकों हेतु अभिप्रेत है।',
};

// ─── Durga Saptashati outline (sourced from hindu-devotional-texts) ──────────

/**
 * The 13-chapter outline of the Durga Saptashati (Devī Māhātmya), the 9-day
 * reading map, and its caption — all now sourced from the shared
 * `hindu-devotional-texts` library (`navratri/` module). Outline only; the
 * 700 verses are not shipped. The library `SaptashatiChapter` adds a `charita`
 * field and drops the required `reviewPending` flag — both are non-breaking
 * here (`reviewPending` is now optional on the app interface above).
 */
export const SAPTASHATI_CHAPTERS = saptashatiOutline.chapters;

/** The "about the Saptashati" paragraph (bilingual), sourced from the library. */
export const SAPTASHATI_ABOUT = saptashatiOutline.about;

/** Caption noting the 9-day chapter map is one of several traditional groupings. */
export const SAPTASHATI_DAY_MAP_CAPTION = saptashatiOutline.nineDayMapNote;

/** The 9-day Saptashati reading map. */
export const SAPTASHATI_DAY_MAP = saptashatiOutline.nineDayMap;

// ─── Vrat (fasting) — sourced from hindu-devotional-texts ────────────────────

/** The four vrat-intensity tiers, sourced from the library's `navratri/` module. */
export const VRAT_TIERS = navratriVratTiers;

/** The allowed / forbidden Navratri vrat foods, sourced from the library. */
export const VRAT_FOODS = navratriVratFoods;

// ─── Kanya Pujan (sourced from hindu-devotional-texts) ───────────────────────

/**
 * Rewrite the English face of a bilingual field from the library's "Puja"
 * spelling to the app's "Pooja" (see `poojafy`). The Devanagari `hi` face is
 * untouched, and `poojafy` matches plain ASCII only, so an IAST-bearing string
 * ("pūjā") passes through unchanged. Mirrors `poojafyEn` in `poojas.ts`.
 */
function poojafyEn<T extends Bilingual>(b: T): T {
  return { ...b, en: poojafy(b.en) };
}

/**
 * The Kanya Pujan dataset — the Ashtami/Navami rite of honouring nine young
 * girls as the Devi: a bilingual `about`, `whenObserved`, the nine `ageNames`
 * (ages 2 → 10), the step `protocol`, the customary `offerings`, and regional
 * `notes`. Sourced from the library's `navratri/` module; surfaced on the
 * `/navratri/kanya-pujan` screen and cross-linked from the Day 8/9 card.
 *
 * Respelled at this config boundary: the regional `notes` gloss the rite as
 * "Kumari Puja", and the screen renders every field below verbatim. Field-
 * explicit and exhaustive rather than selective, so a package bump that moves
 * the spelling into another field is still covered. Nothing here is a lookup
 * key — the screen indexes `ageNames` by position and matches nothing on text
 * — so respelling is display-only. The rite's own name keeps its "Pujan"
 * spelling (पूजन is a distinct word, and `poojafy` matches whole words only).
 */
export const KANYA_PUJAN: KanyaPujanData = {
  ...kanyaPujan,
  about: poojafyEn(kanyaPujan.about),
  whenObserved: poojafyEn(kanyaPujan.whenObserved),
  ageNames: kanyaPujan.ageNames.map(a => ({ ...a, name: poojafyEn(a.name) })),
  protocol: kanyaPujan.protocol.map(poojafyEn),
  offerings: kanyaPujan.offerings.map(poojafyEn),
  notes: kanyaPujan.notes.map(poojafyEn),
};

// ─── Disclaimer ──────────────────────────────────────────────────────────────

export const NAVRATRI_SOURCES: Bilingual = {
  en: "Navratri practice varies by region, sampradaya and family tradition — this is one widely-kept form. Dates and the Ghatasthapana muhurat are computed from the panchang for your location. The nine per-day mantras use the plain 'om devi …ayai namah' pattern from the Devi Mahatmya commentary lineage, with that day's form of the goddess named in the middle; other Shakta and Tantric lineages prefix a bija-syllable — hreem (Bhuvaneshvari-bija), shreem (Lakshmi-bija), kleem (Kama-bija), aim (Vagbhava-bija) — and a guru or family pandit would teach the form belonging to that initiation. For any major observance, follow a pandit's guidance.",
  hi: 'नवरात्रि साधना क्षेत्र, सम्प्रदाय एवं पारिवारिक परंपरा के अनुसार भिन्न होती है — यह एक प्रचलित रूप है। तिथियाँ एवं घटस्थापना मुहूर्त आपके स्थान के पंचांग से गणित हैं। नौ दैनिक मन्त्र देवी-माहात्म्य टीका परंपरा के सरल "ॐ देवी …ायै नमः" स्वरूप में हैं, जिनमें बीच में उस दिन की देवी का नाम आता है; अन्य शाक्त एवं तान्त्रिक परंपराओं में बीज-अक्षर — ह्रीं (भुवनेश्वरी-बीज), श्रीं (लक्ष्मी-बीज), क्लीं (काम-बीज), ऐं (वाग्भव-बीज) — पूर्व में जोड़े जाते हैं, तथा गुरु अथवा कुल-पंडित अपनी दीक्षा-अनुसार स्वरूप सिखाते हैं। किसी भी बड़े अनुष्ठान के लिए पंडित जी के परामर्श का अनुसरण करें।',
};

// ─── Lookup helpers ──────────────────────────────────────────────────────────

export function getNavratriMasa(kind: NavratriKind): NavratriMasaInfo {
  const m = NAVRATRI_MASAS.find(x => x.kind === kind);
  if (!m) throw new Error(`Unknown Navratri kind: ${kind}`);
  return m;
}

export function getSaptashatiDay(day: number): SaptashatiDayMapEntry | undefined {
  return SAPTASHATI_DAY_MAP.find(d => d.day === day);
}
