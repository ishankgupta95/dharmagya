import type { GrahaName } from 'panchang-ts';

/**
 * Localized name for a graha.
 *
 * `GrahaName` is a hard English literal union in panchang-ts, so no `language`
 * option can ever move it — the library returns "Jupiter" even on a chart built
 * with `language: 'hi'` whose rashi names come back in Devanagari. Several
 * kundli surfaces rendered it raw, printing Latin planet names next to
 * Devanagari rashis in the same row while the Dasha card one screen away said
 * बृहस्पति for the same planet.
 *
 * `dasha.planet.*` already covers all nine lords in both locales and its keys
 * are exactly the lowercase of every `GrahaName`, so no new strings are needed.
 *
 * Localize only what is *rendered*: the raw `GrahaName` is also used as a React
 * key, as a `GRAHA_ABBR` index, and in retrograde guards (`!== 'Sun'`), none of
 * which may be swapped.
 */
export function grahaLabel(
  graha: GrahaName,
  t: (key: string) => string,
): string {
  return t(`dasha.planet.${graha.toLowerCase()}`);
}
