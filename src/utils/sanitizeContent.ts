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
 * Display-time spelling shim: the `hindu-devotional-texts` library spells
 * "Puja"; the app's chosen romanisation is "Pooja". Rewrite whole-word
 * "Puja"/"Pujas" (any case) to "Pooja"/"Poojas" so library-sourced puja names
 * read consistently with the app's own strings.
 *
 * Whole-word only — "Pujan" (Kanya Pujan / Shami Pujan, the distinct word
 * पूजन) and IAST transliterations ("pūjā", carrying diacritics) are left
 * untouched; it is also a no-op on Devanagari. Idempotent. Scope it to short
 * NAME / kicker fields, not arbitrary library prose (which can carry IAST).
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
