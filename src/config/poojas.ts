/**
 * Puja Vidhi — re-export shim over `hindu-devotional-texts` (v0.3.0+).
 *
 * The seven featured pujas, the 16-step Shodashopachara template, and every
 * puja type now live in the shared `hindu-devotional-texts` library, in its
 * `puja/` module. This file is kept as the app's import boundary — screens
 * still import from `@/config/poojas` — but all content and types are sourced
 * from the library. The previous inline dataset has been removed.
 *
 * Type names are bridged to the names the app's screens already use:
 *   library `Puja`            → app `PujaContent`
 *   library `PujaSamagriItem` → app `SamagriItem`
 *
 * The library carries `reviewPending: true` on every mantra and documents its
 * per-claim citations in its own module docs; see the library README's
 * "Content review debt" section.
 */
import {
  getAllPujas,
  type Puja,
  type PujaSamagriItem,
} from 'hindu-devotional-texts';
import { poojafy } from '@/utils/sanitizeContent';

// ─── Types (sourced from the library) ────────────────────────────────────────

export type {
  Puja,
  PujaSlug,
  PujaMantra,
  Upachara,
  UpacharaName,
  UpacharaSlug,
  ArcStep,
  PostPujaLink,
  StotraKathaRef,
  FestivalMatch,
} from 'hindu-devotional-texts';

/** The app's historical name for the library's `Puja`. */
export type PujaContent = Puja;

/** The app's historical name for the library's `PujaSamagriItem`. */
export type SamagriItem = PujaSamagriItem;

// ─── Disclaimer ──────────────────────────────────────────────────────────────

export { PUJA_DISCLAIMER } from 'hindu-devotional-texts';

// ─── The seven featured pujas + lookups ──────────────────────────────────────

/**
 * Rewrite a puja's display name + kicker from the library's "Puja" spelling to
 * the app's "Pooja" (see `poojafy`). English face only — the Devanagari `hi`
 * face is unaffected, and step text / mantras (which carry IAST) are left to
 * the upstream package. `name` is display-only here: lookups key on `slug`,
 * `rosterDeity`, and `festivalMatchers`, never on `name`, so this is safe.
 */
function poojafyPuja(p: Puja): Puja {
  return {
    ...p,
    name: { ...p.name, en: poojafy(p.name.en) },
    kicker: p.kicker ? { ...p.kicker, en: poojafy(p.kicker.en) } : p.kicker,
  };
}

/** All seven featured pujas, in display order. */
export const FEATURED_PUJAS: readonly PujaContent[] = getAllPujas().map(poojafyPuja);

/** Look up a featured puja by slug; `undefined` for an unknown key. */
export function getPujaBySlug(slug: string | undefined): PujaContent | undefined {
  if (!slug) return undefined;
  return FEATURED_PUJAS.find((p) => p.slug === slug);
}

/**
 * Pujas whose `rosterDeity` matches the given Library deity id. Used by the
 * deity-detail and Vaar Devata screens. Accepts a raw string so a route param
 * can be passed without first narrowing it to `Deity`.
 */
export function getPujasForDeity(deityId: string): PujaContent[] {
  return FEATURED_PUJAS.filter((p) => p.rosterDeity === deityId);
}

/**
 * The featured puja that answers a festival row — a case-insensitive substring
 * match against the festival name or its description. Returns the first puja
 * whose `festivalMatchers` contain a needle found in the haystack; `undefined`
 * if none answers.
 */
export function getPujaForFestivalName(
  name: string,
  description?: string,
): PujaContent | undefined {
  const haystack = `${name} ${description ?? ''}`.toLowerCase();
  return FEATURED_PUJAS.find((p) =>
    p.festivalMatchers?.some((m) => haystack.includes(m.needle)),
  );
}
