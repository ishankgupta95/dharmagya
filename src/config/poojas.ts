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
 * The one app-side transform applied here is the "Pooja" spelling shim (see
 * `poojafy`): the library spells "Puja" throughout its English prose, the app
 * spells it "Pooja" everywhere else, and both used to land on the same screen.
 *
 * The library carries `reviewPending: true` on every mantra and documents its
 * per-claim citations in its own module docs; see the library README's
 * "Content review debt" section.
 */
import {
  getAllPujas,
  PUJA_DISCLAIMER as LIB_PUJA_DISCLAIMER,
  type ArcStep,
  type Bilingual,
  type Puja,
  type PujaSamagriItem,
  type Upachara,
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

// ─── "Pooja" spelling shim ───────────────────────────────────────────────────

/**
 * Rewrite the English face of a bilingual field from the library's "Puja"
 * spelling to the app's "Pooja" (see `poojafy`). The Devanagari `hi` face is
 * untouched, and `poojafy` matches plain ASCII only, so an IAST-bearing string
 * ("pūjā") passes through unchanged.
 */
function poojafyEn<T extends Bilingual>(b: T): T {
  return { ...b, en: poojafy(b.en) };
}

// ─── Disclaimer ──────────────────────────────────────────────────────────────

/**
 * The library's accuracy disclaimer, respelled. It is rendered verbatim under
 * the "About this" heading on both `/pooja` and `/pooja/[slug]`, and its own
 * English prose spells "puja" — so it has to go through the same shim as the
 * screen's title. Both consumers already import it from here.
 */
export const PUJA_DISCLAIMER: Bilingual = poojafyEn(LIB_PUJA_DISCLAIMER);

// ─── The seven featured pujas + lookups ──────────────────────────────────────

function poojafyArcStep(s: ArcStep): ArcStep {
  return {
    ...s,
    line: poojafyEn(s.line),
    conditional: s.conditional ? poojafyEn(s.conditional) : s.conditional,
  };
}

function poojafyUpachara(u: Upachara): Upachara {
  return {
    ...u,
    line: poojafyEn(u.line),
    // `samagriRefs` are matched against `samagri[].label.en` to build a step's
    // "needed now" list, and that label is respelled below — so both sides of
    // the match move together. (No puja ships refs today; this keeps the next
    // package bump from breaking the linkage silently.)
    samagriRefs: u.samagriRefs?.map(poojafy),
  };
}

function poojafySamagriItem(s: PujaSamagriItem): PujaSamagriItem {
  return {
    ...s,
    label: poojafyEn(s.label),
    group: s.group ? poojafyEn(s.group) : s.group,
  };
}

/**
 * Rewrite every English string a pooja screen renders from the library's
 * "Puja" spelling to the app's "Pooja" (see `poojafy`). The Devanagari `hi`
 * face and the step mantras (Devanagari + IAST) are untouched.
 *
 * Field-explicit on purpose — a blind deep walk would also rewrite
 * `festivalMatchers[].needle`, which `getPujaForFestivalName` matches against
 * the RAW upstream festival name/description, silently killing the festival →
 * pooja cross-link. `sources` is skipped for the opposite reason: no screen
 * renders it (the "About this" block shows `PUJA_DISCLAIMER` instead).
 *
 * Everything rewritten here is display-only: lookups key on `slug`,
 * `rosterDeity`, and `festivalMatchers`, never on `name`.
 */
function poojafyPuja(p: Puja): Puja {
  return {
    ...p,
    name: poojafyEn(p.name),
    kicker: poojafyEn(p.kicker),
    whenWhy: poojafyEn(p.whenWhy),
    sankalpa: poojafyEn(p.sankalpa),
    samagri: p.samagri.map(poojafySamagriItem),
    preUpacharas: p.preUpacharas.map(poojafyArcStep),
    upacharas: p.upacharas.map(poojafyUpachara),
    postUpacharas: p.postUpacharas.map(poojafyArcStep),
    stotraKathaRef: p.stotraKathaRef
      ? {
          ...p.stotraKathaRef,
          label: poojafyEn(p.stotraKathaRef.label),
          note: poojafyEn(p.stotraKathaRef.note),
        }
      : p.stotraKathaRef,
    variantNotes: p.variantNotes.map((v) => ({
      ...v,
      label: poojafyEn(v.label),
      text: poojafyEn(v.text),
    })),
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
