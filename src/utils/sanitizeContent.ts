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
