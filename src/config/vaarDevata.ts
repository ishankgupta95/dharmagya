/**
 * Vaar Devata — re-export shim over `hindu-devotional-texts` (v0.5.0+).
 *
 * The weekday-deity dataset (seven days · deities · weekday mantras · fasting
 * rules · regional variant notes), its types, and the lookup helpers now live
 * in the shared `hindu-devotional-texts` library, in its `vaar/` module. This
 * file is kept as the app's import boundary — screens still import from
 * `@/config/vaarDevata` — but all content and types are sourced from the
 * library. The previous inline dataset has been removed; there were no
 * app-only concerns in it (the ruling colour renders as a plain labelled
 * swatch, so it travels with the content).
 *
 * Mirrors the pattern already used by [pujas](./pujas.ts), [kathas](./kathas.ts),
 * [navratri](./navratri.ts), and [scriptures](./scriptures.ts).
 */
export type {
  Bilingual,
  GrahaKey,
  DayKey,
  VaarDeity,
  VaarMantra,
  VaarVariantNote,
  VaarOffering,
  VaarDevata,
} from 'hindu-devotional-texts';

export {
  VAAR_DEVATA,
  VAAR_SOURCES,
  getVaarDevataForDate,
  getVaarDevataByKey,
  getVaarDevataByGraha,
  vaarRosterIds,
  vaarDeityNames,
} from 'hindu-devotional-texts';
