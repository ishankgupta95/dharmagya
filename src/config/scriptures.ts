/**
 * Scriptures — re-export shim over `hindu-devotional-texts` (v0.4.0+).
 *
 * The library's `scriptures/` module ships two full-text scriptures: the
 * Bhagavad Geeta (18 chapters · 701 shlokas · Devanagari + IAST, no English
 * translation) and the Tulsi Sundarkand (1 chapter · 63 shlokas · Devanagari
 * only). Both surface a bilingual `about` summary. The Durga Saptashati outline
 * lives in `@/config/navratri` — it is a 13-chapter outline + 9-day pāṭha map
 * with no verses, sourced separately, and the scripture index lists it
 * alongside the two library scriptures.
 *
 * This file is the app's import boundary — screens import from
 * `@/config/scriptures`, never the package directly — so the underlying
 * storage can evolve without churn in the UI.
 */
import {
  getAllScriptures,
  type Scripture,
  type ScriptureSlug,
  type ScriptureVerse,
  type Chapter,
  type Bilingual,
} from 'hindu-devotional-texts';

export type { Scripture, ScriptureSlug, ScriptureVerse, Chapter, Bilingual };

// ─── The two library scriptures + lookups ────────────────────────────────────

/**
 * Strip the upstream library's reviewer-facing citation artifacts out of any
 * prose the app renders to users — e.g. a trailing parenthetical pointing at
 * the library's internal source-citation file, baked into a scripture's
 * `about` text. Those notes are for the library's own content reviewers and
 * mean nothing to an app user. Applied at this boundary so the UI stays clean
 * even after the package is reinstalled or bumped.
 */
function stripSourceRefs(text: string): string {
  return text
    .replace(/\s*\((?:see|देखें)\s+SOURCES\.md\)/gi, '')
    .replace(/\s*[—–-]?\s*(?:see\s+)?SOURCES\.md[.।]?\s*$/gi, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function sanitizeScripture(s: Scripture): Scripture {
  if (!s.about) return s;
  return { ...s, about: { en: stripSourceRefs(s.about.en), hi: stripSourceRefs(s.about.hi) } };
}

/** All library scriptures, in registry order (Geeta first, Sundarkand second). */
export const ALL_SCRIPTURES: readonly Scripture[] = getAllScriptures().map(sanitizeScripture);

/** Look up a scripture by slug; `undefined` for an unknown key. */
export function getScriptureBySlug(slug: string | undefined): Scripture | undefined {
  if (!slug) return undefined;
  return ALL_SCRIPTURES.find((s) => s.slug === slug);
}

/**
 * Scriptures tied to a Library deity id — Geeta→krishna, Sundarkand→hanuman.
 * Accepts a raw string so a route param can be passed without first narrowing.
 */
export function getScripturesForDeity(deityId: string): Scripture[] {
  return ALL_SCRIPTURES.filter((s) => s.deity === deityId);
}

// ─── Disclaimer ──────────────────────────────────────────────────────────────

/**
 * App-side accuracy disclaimer for scripture readers. The library documents
 * its scripture citations in its own module docs but exports no constant.
 * This mirrors the tone of `KATHA_DISCLAIMER` / `PUJA_DISCLAIMER`.
 */
export const SCRIPTURE_DISCLAIMER: Bilingual = {
  en: 'Scripture readings carry centuries of recension and family pronunciation. Verses are presented as the source text; English glosses are not shipped — pair this reader with a trusted translation when studying meaning.',
  hi: 'शास्त्रीय पाठ में सदियों के पाठान्तर एवं पारिवारिक उच्चारण की परम्पराएँ हैं। यहाँ केवल मूल पाठ प्रस्तुत है — अर्थ हेतु किसी विश्वसनीय अनुवाद का सहारा लें।',
};
