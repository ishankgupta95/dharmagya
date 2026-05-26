/**
 * Vrat Kathas — re-export shim over `hindu-devotional-texts` (v0.3.0+).
 *
 * The library's `kathas/` module ships six finite vrat kathas — Satyanarayan
 * plus five vrat kathas (Karva Chauth, Vaibhav Lakshmi, Santoshi Mata, Solah
 * Somvar, Ahoi Ashtami). Each katha assembles `samagri` (puja items), `vidhi`
 * (procedure), and `chapters` (the narrative adhyays). This file is the app's
 * import boundary — screens import from `@/config/kathas`, never the package
 * directly — so the underlying storage can evolve without churn in the UI.
 *
 * Content posture: Satyanarayan is hand-typed and `verified`; the five vrat
 * kathas are researched-and-cited, shipped at `draft` (the library documents
 * their citations in its own module docs). The reader surfaces
 * `KATHA_DISCLAIMER` to match the accuracy posture the Puja Vidhi screens carry.
 *
 * Note: the narrative prose is English-primary — `hindi` exists only on a few
 * titles and samagri item names — so the reader is an English narrative reader
 * with a Devanagari title block, not a bilingual toggle like aarti/chalisa.
 */
import {
  getAllKathas,
  type Katha,
  type KathaParagraph,
  type KathaChapter,
  type SamagriItem,
  type KathaSlug,
  type Bilingual,
} from 'hindu-devotional-texts';

export type { Katha, KathaParagraph, KathaChapter, SamagriItem, KathaSlug, Bilingual };

// ─── The six kathas + lookups ────────────────────────────────────────────────

/** All six kathas, in the library's registry order (Satyanarayan first). */
export const ALL_KATHAS: readonly Katha[] = getAllKathas();

/** Look up a katha by slug; `undefined` for an unknown key. */
export function getKathaBySlug(slug: string | undefined): Katha | undefined {
  if (!slug) return undefined;
  return ALL_KATHAS.find((k) => k.slug === slug);
}

/**
 * Kathas tied to a given Library deity id — Satyanarayan→vishnu, Vaibhav
 * Lakshmi→lakshmi, Santoshi Mata→santoshi-mata, Solah Somvar→shiva. Karva
 * Chauth and Ahoi Ashtami carry no `deity` and never match. Accepts a raw
 * string so a route param can be passed without first narrowing to `Deity`.
 */
export function getKathasForDeity(deityId: string): Katha[] {
  return ALL_KATHAS.filter((k) => k.deity === deityId);
}

/**
 * Festival → katha matchers. Karva Chauth and Ahoi Ashtami are dated vrat
 * festivals with no Featured Puja; their katha is the natural cross-link from
 * the Festivals calendar. Satyanarayan is deliberately omitted — it is kept on
 * any purnima rather than a fixed festival date, and the Satyanarayan Puja
 * already answers that festival row.
 */
const FESTIVAL_MATCHERS: readonly { slug: KathaSlug; needles: string[] }[] = [
  { slug: 'karva-chauth', needles: ['karva chauth', 'karwa chauth'] },
  { slug: 'ahoi-ashtami', needles: ['ahoi ashtami', 'ahoi asthami'] },
];

/**
 * The katha that answers a festival row — a case-insensitive substring match
 * against the festival name or description. Mirrors `getPujaForFestivalName`.
 */
export function getKathaForFestivalName(
  name: string,
  description?: string,
): Katha | undefined {
  const haystack = `${name} ${description ?? ''}`.toLowerCase();
  const match = FESTIVAL_MATCHERS.find((m) =>
    m.needles.some((n) => haystack.includes(n)),
  );
  return match ? getKathaBySlug(match.slug) : undefined;
}

// ─── Disclaimer ──────────────────────────────────────────────────────────────

/**
 * App-side accuracy disclaimer for the katha reader. The library ships no
 * `KATHA_DISCLAIMER` constant (unlike `PUJA_DISCLAIMER`) — kathas carry their
 * citations in the library's own module docs. This mirrors the tone of
 * `PUJA_DISCLAIMER` / `NAVRATRI_SOURCES`.
 */
export const KATHA_DISCLAIMER: Bilingual = {
  en: "Vrat kathas are retold across many regional and family traditions — this is one widely-recited form, and the details of the puja vidhi and samagri vary by household. For any vrat, follow your family elders' and a pandit's guidance.",
  hi: 'व्रत कथाएँ अनेक क्षेत्रीय एवं पारिवारिक परंपराओं में भिन्न रूपों में सुनाई जाती हैं — यह एक प्रचलित रूप है, तथा पूजा-विधि एवं सामग्री के विवरण परिवार-अनुसार बदलते हैं। किसी भी व्रत हेतु अपने परिवार के ज्येष्ठजनों एवं पंडित जी के परामर्श का अनुसरण करें।',
};
