/**
 * Which of several same-day festivals is *the* one to name.
 *
 * The festival table routinely puts three or four entries on one date — 2026
 * alone has 49 (date, category) collisions — and both the calendar cell and
 * the reminder scheduler have to reduce that to a single headline. Whichever
 * happens to be first in the table is alphabetical, so "Bathukamma: Saddula"
 * beat "Dussehra" and "Hartalika Teej" beat "Ganesh Chaturthi". This lives in
 * its own module (rather than in `calendarService`) so the notification path
 * can share the ranking without pulling the panchang engine in with it.
 */

/**
 * Headline tier for `type === 'major'` festivals. When multiple majors share a
 * single day, the one nearest the top of this list wins. Anything not in the
 * list defaults to "whichever was first in the JSON", which is alphabetical —
 * fine when there's no collision, broken when (e.g.) "Narak Chaturdashi"
 * lexically precedes "Diwali".
 */
export const HEADLINE_MAJORS: readonly string[] = [
  'Diwali',
  'Holi',
  'Maha Shivaratri',
  'Krishna Janmashtami',
  'Janmashtami',
  'Rama Navami',
  'Ganesh Chaturthi',
  'Hanuman Jayanti',
  'Vijayadashami',
  'Dussehra',
  'Raksha Bandhan',
  'Karva Chauth',
  'Akshaya Tritiya',
  // Above Maha Navami: since panchang-ts 5.4 dates Maha Navami by the first day
  // whose evening Navami reaches, the two share a day in some years (2020,
  // 2024, 2026, 2028, 2033, 2045, 2046 in the shipped table) — a day whose
  // sunrise tithi is still Ashtami. Unranked, Durga Ashtami lost the headline
  // and its evening-before push on every one; ranked, Maha Navami yields both
  // on those days instead (the Navratri Day-9 push still announces Navami).
  'Durga Ashtami',
  'Maha Navami',
  'Govardhan Puja',
  'Bhai Dooj',
  'Dhanteras',
  'Vasant Panchami',
  'Ugadi',
  'Gudi Padwa',
  'Mahalaya Amavasya',
  'Thiru Onam',
  // The `major` festivals that ARE a Purnima / Amavasya
  // (`MOON_PHASE_FESTIVAL` in `reminderScheduler`) and were not ranked yet —
  // with Diwali, Holi, Hanuman Jayanti, Raksha Bandhan and Mahalaya Amavasya
  // above, that is all of them. (Holi is ranked above for the years it still
  // sits on the Purnima; since panchang-ts 5.4 the Phalguna Purnima itself is
  // Holika Dahan, with Holi the next day in most years, and Holika Dahan never
  // shares a day with another major.) (Kartika Purnima and Phagli are `minor`; this
  // ranking only ever sees majors, so `reminderScheduler` titles those
  // itself.) Owner decision: a festival is the major title, so when one of
  // these is also that day's Purnima / Amavasya reminder, the push is "🪔 Guru
  // Purnima", not "🌕 Purnima tomorrow". Being listed here is what lets the
  // festival push win the reminder dedupe (`outranksTithi` in
  // `reminderScheduler`). Appended LAST on purpose: the ranking only decides
  // between two majors on one day, so no calendar headline, category or tint
  // changes — checked across the shipped 2020–2050 table in all 22 regions,
  // where every multi-major day these sit on already headlined the same
  // festival: Guru Purnima is the first row beside Basi / Pahili Raja (2027,
  // 2038, 2046; 'all' and Odisha), and Karaga, Yajur Upakarma and Engili Pula
  // only ever appear beside a higher-ranked Hanuman Jayanti, Raksha Bandhan or
  // Mahalaya Amavasya.
  'Guru Purnima',
  'Sharad Purnima',
  'Vat Savitri (Purnima)',
  'Vat Savitri (Amavasya)',
  'Karaga',
  'Yajur Upakarma (Avani Avittam)',
  'Bathukamma: Engili Pula',
  'Holika Dahan',
];

/** The minimum shape both consumers share. */
export interface HeadlineCandidate {
  name: string;
  description?: string;
}

/** Highest-ranked major among `majors`; falls back to the first entry. */
export function pickHeadlineMajor<T extends HeadlineCandidate>(majors: readonly T[]): T {
  let chosen = majors[0];
  let bestRank = Number.POSITIVE_INFINITY;
  for (const f of majors) {
    const rank = HEADLINE_MAJORS.indexOf(f.name);
    if (rank >= 0 && rank < bestRank) {
      bestRank = rank;
      chosen = f;
    }
  }
  return chosen;
}

/**
 * The name to announce for one same-day group of festivals that all resolve to
 * the same reminder category.
 *
 * - `major` uses the recognition ranking above.
 * - `sankranti` prefers a specific name ("Makar Sankranti") over the generic
 *   "Sankranti" the table also emits.
 * - `ekadashi` prefers the classical name, which the table carries in
 *   `description` — but only when that reads as a name: on a viddha/vriddha
 *   day the library puts a whole explanatory sentence there instead.
 */
export function pickHeadlineName(
  category: string,
  group: readonly HeadlineCandidate[],
): string {
  if (group.length === 0) return '';
  if (category === 'major') return pickHeadlineMajor(group).name;
  if (category === 'sankranti') {
    return (group.find(f => f.name !== 'Sankranti') ?? group[0]).name;
  }
  if (category === 'ekadashi') {
    const desc = group.find(f => f.description && /ekadashi$/i.test(f.description.trim()));
    if (desc?.description) return desc.description.trim();
    return group[0].name;
  }
  return group[0].name;
}
