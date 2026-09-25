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
 * The one app-side transform applied here is the "Pooja" spelling shim (see
 * `poojafy`): the library's English prose spells "puja", the app spells it
 * "Pooja" everywhere else. The three lookups are re-implemented over the
 * respelled array rather than re-exported, because the library's own lookups
 * would hand back the untouched objects.
 *
 * Mirrors the pattern already used by [pujas](./poojas.ts), [kathas](./kathas.ts),
 * [navratri](./navratri.ts), and [scriptures](./scriptures.ts).
 */
import {
  VAAR_DEVATA as LIB_VAAR_DEVATA,
  type Bilingual,
  type GrahaKey,
  type VaarDevata,
} from 'hindu-devotional-texts';
import { poojafy } from '@/utils/sanitizeContent';

export type {
  DayKey,
  VaarDeity,
  VaarMantra,
  VaarVariantNote,
  VaarOffering,
} from 'hindu-devotional-texts';

export type { Bilingual, GrahaKey, VaarDevata };

// `vaarRosterIds` / `vaarDeityNames` are pure functions over a `VaarDevata` the
// caller already holds, so they operate on the respelled objects as-is.
export { VAAR_SOURCES, vaarRosterIds, vaarDeityNames } from 'hindu-devotional-texts';

// ─── "Pooja" spelling shim ───────────────────────────────────────────────────

/** Respell the English face of a bilingual field; see `poojafy`. */
function poojafyEn<T extends Bilingual>(b: T): T {
  return { ...b, en: poojafy(b.en) };
}

/**
 * Respell the English prose faces of one weekday entry — the fasting summary
 * ("…after Shiva puja"), the regional variant notes, and each deity's
 * contextual line. Devanagari, the weekday mantra (Devanagari + IAST), and
 * every identity field (`dayKey`, `grahaKey`, `rosterId`) are untouched.
 */
function poojafyVaar(v: VaarDevata): VaarDevata {
  return {
    ...v,
    deities: v.deities.map((d) => ({ ...d, note: poojafyEn(d.note) })),
    fasting: poojafyEn(v.fasting),
    variantNotes: v.variantNotes.map((n) => ({
      ...n,
      label: poojafyEn(n.label),
      text: poojafyEn(n.text),
    })),
  };
}

// ─── The seven weekday entries + lookups ─────────────────────────────────────

/** All seven weekday entries, indexed by `Date.getDay()` (0 = Sunday). */
export const VAAR_DEVATA: readonly VaarDevata[] = LIB_VAAR_DEVATA.map(poojafyVaar);

/** The day's Vaar Devata for a given date (`Date.getDay()`-indexed). */
export function getVaarDevataForDate(d: Date): VaarDevata {
  return VAAR_DEVATA[d.getDay()];
}

/** Look up by day slug ('sunday' … 'saturday'); `undefined` for an unknown key. */
export function getVaarDevataByKey(key: string | undefined): VaarDevata | undefined {
  if (!key) return undefined;
  return VAAR_DEVATA.find((v) => v.dayKey === key);
}

/** Look up by ruling graha — e.g. for a dasha-lord weekday remedy. */
export function getVaarDevataByGraha(graha: GrahaKey): VaarDevata | undefined {
  return VAAR_DEVATA.find((v) => v.grahaKey === graha);
}
