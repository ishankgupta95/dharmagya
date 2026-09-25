/**
 * Strip the upstream `hindu-devotional-texts` library's reviewer-facing
 * citation artifacts out of any prose the app renders to users — e.g. a
 * trailing parenthetical pointing at the library's internal source-citation
 * file, baked into an `about` / `significance` string. Those notes are for the
 * library's own content reviewers and mean nothing to an app user (see
 * `feedback_no_source_attribution_in_ui`). Applied at the config boundary so
 * the UI stays clean even after the package is reinstalled or bumped.
 *
 * Extracted from `@/config/scriptures` so every new content boundary
 * (stotra / sukta / sahasranama / tirtha / festival) sanitizes identically.
 */
export function stripSourceRefs(text: string): string {
  return text
    .replace(/\s*\((?:see|देखें)\s+SOURCES\.md\)/gi, '')
    .replace(/\s*[—–-]?\s*(?:see\s+)?SOURCES\.md[.।]?\s*$/gi, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/** Sanitize both halves of a `{ en, hi }` bilingual prose field. */
export function sanitizeBilingual<T extends { en: string; hi: string }>(b: T): T {
  return { ...b, en: stripSourceRefs(b.en), hi: stripSourceRefs(b.hi) };
}

/**
 * Characters NFD does not decompose, so the combining-mark strip below can't
 * reach them. IAST/ISO-15919 letters (ā ī ū ṛ ṇ ś ṣ ṭ ḍ ṁ ḥ ṅ ñ …) all
 * decompose cleanly; the only stragglers the library's romanisations can carry
 * are the modifier apostrophes some transliterations use for the avagraha.
 */
const UNDECOMPOSED: Record<string, string> = {
  'ʼ': "'", // ʼ modifier letter apostrophe
  'ʻ': "'", // ʻ modifier letter turned comma
};

/**
 * Romanise an IAST string into the conventional English spelling.
 *
 * The `hindu-devotional-texts` library writes names in IAST ("Kṛṣṇa
 * Janmāṣṭamī", "Akṣaya Tṛtīyā"). Two problems in the UI: NotoSerifDevanagari
 * carries no glyph for ṛ ṇ ṣ ṭ ḍ ṃ ḥ ṅ, so those words break to a per-glyph
 * system fallback mid-word; and IAST is chrome the app does not show.
 *
 * Stripping the marks alone is not enough — it yields "Krsna Janmastami" and
 * "Ekadasi", which read wrong AND disagree with the panchang festival table,
 * which spells the same days "Krishna Janmashtami" and "Ekadashi". So the
 * retroflex/sibilant set maps to its English digraph FIRST, and only then does
 * NFD strip whatever accents are left (the long vowels). That lands on the
 * spellings the rest of the app already uses.
 *
 * The strip is scoped to the Combining Diacritical Marks block (U+0300–U+036F)
 * — the only marks NFD emits for Latin — so Devanagari and its Vedic accents
 * pass through untouched, and this is a safe no-op on `hi` strings.
 */
const DIGRAPHS: Record<string, string> = {
  'ś': 'sh', 'Ś': 'Sh', 'ṣ': 'sh', 'Ṣ': 'Sh',
  'ṛ': 'ri', 'Ṛ': 'Ri', 'ṝ': 'ri', 'ḷ': 'li',
  'ñ': 'n', 'Ñ': 'N', 'ṅ': 'n', 'Ṅ': 'N',
  'ṇ': 'n', 'Ṇ': 'N', 'ṃ': 'm', 'Ṃ': 'M',
  'ḥ': 'h', 'Ḥ': 'H', 'ṭ': 't', 'Ṭ': 'T',
  'ḍ': 'd', 'Ḍ': 'D', 'ḻ': 'l', 'ṟ': 'r', 'ḵ': 'k',
};

export function romanize(text: string): string {
  return text
    // IAST `c` is already an English "ch", so ñ + c is "nch" — "Pañcamī"
    // becomes "Panchami", not "Pancami". Runs before the single-char table.
    .replace(/ñc/g, 'nch')
    .replace(/Ñc/g, 'Nch')
    .replace(/[śŚṣṢṛṚṝḷñÑṅṄṇṆṃṂḥḤṭṬḍḌḻṟḵ]/g, (c) => DIGRAPHS[c])
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
    .replace(/[ʻʼ]/g, (c) => UNDECOMPOSED[c]);
}

/**
 * Display-time spelling shim: the `hindu-devotional-texts` library spells
 * "Puja"; the app's chosen romanisation is "Pooja". Rewrite whole-word
 * "Puja"/"Pujas" (any case) to "Pooja"/"Poojas" so library-sourced puja names
 * read consistently with the app's own strings.
 *
 * Whole-word only — "Pujan" (Kanya Pujan / Shami Pujan, the distinct word
 * पूजन) and IAST transliterations ("pūjā", carrying diacritics) are left
 * untouched; it is also a no-op on Devanagari. Idempotent.
 *
 * Safe on prose, including prose that carries IAST: the match class is plain
 * ASCII, so a diacritic-bearing romanisation can never match. Apply it to any
 * English face the UI renders. Two things it must NOT be applied to:
 *
 *   · Half of a matching pair — a rewrite has to move both sides of a text
 *     match or neither, never one. `festivalMatchers[].needle` is matched
 *     against the RAW upstream festival text, so the app only controls one
 *     side: never rewrite it. `upacharas[].samagriRefs` is matched against
 *     `samagri[].label.en`, and both are app-side copies, so `poojas.ts`
 *     rewrites the pair together — that call is correct, keep it.
 *   · Recited verse lines — the aarti/chalisa `verses.english` arrays are
 *     romanised Hindi lyrics ("Le Puja Ki Thali"), not English prose. Respell
 *     a sung line and the reader no longer matches what is being recited.
 *
 * The clean permanent fix is an upstream package release spelling them
 * "Pooja" — drop this shim then.
 */
export function poojafy(text: string): string {
  return text
    .replace(/\bPUJAS\b/g, 'POOJAS')
    .replace(/\bPUJA\b/g, 'POOJA')
    .replace(/\bPujas\b/g, 'Poojas')
    .replace(/\bPuja\b/g, 'Pooja')
    .replace(/\bpujas\b/g, 'poojas')
    .replace(/\bpuja\b/g, 'pooja');
}
