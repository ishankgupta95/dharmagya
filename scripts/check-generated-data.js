/**
 * Fail loudly when a checked-in generated data artifact was built by a
 * different panchang-ts than the one currently locked, or when one of the
 * app's hardcoded assumptions *about* those artifacts has stopped holding.
 *
 * Why this exists: every artifact in `ARTIFACTS` below is pre-computed *engine
 * output* committed to the repo, so bumping panchang-ts silently invalidates
 * them — nothing errors, the app just keeps serving last release's dates. That is exactly how the 5.1.1 → 5.2.1 bump shipped a stale
 * festival table with the wrong Vat Savitri dates and year-sized holes
 * (missing Navaratri 2027, Gudi Padwa 2026) until a manual audit caught it.
 * Both generators now stamp the engine version they ran under; this compares
 * those stamps to the lockfile and names the generator to re-run.
 *
 * `INVARIANTS` below then asks the second, harder question. A *correctly
 * regenerated* artifact can still break the app, because a good deal of code
 * reaches into these files by exact English string and by counted breadth. Both
 * of those degrade in total silence when the engine's vocabulary shifts under
 * them, so they get asserted here rather than discovered on a device:
 *
 *   (a)  every festival-name literal the app gates on resolves somewhere, and
 *   (a′) recurs in every year it is expected to (known engine holes listed);
 *   (b)  the region-breadth threshold still sits in a gap;
 *   (c)  the fixed 2020–2050 window is fully present, for every region, and
 *        was computed at the runtime's own fallback point;
 *   (d)  the on-device compute for years past the table reproduces the
 *        library's build of them, and the shipped table, byte for byte.
 *
 * Usage:  node scripts/check-generated-data.js
 */
/* global __dirname -- Node script; flat config ignores `eslint-env`. */

const fs = require('fs');
const { createRequire } = require('module');
const path = require('path');

// The invariant checks read the app's own TypeScript sources rather than
// duplicating their contents (see `NAME_MATCHER_FILES`). `typescript` is a
// devDependency, which is fine: this script is dev/CI tooling and nothing in a
// production (`--omit=dev`) install runs it — no build hook, no EAS step.
const ts = require('typescript');

const REPO_ROOT = path.join(__dirname, '..');

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8'));
}

// What an install actually pins. (`require('panchang-ts/package.json')` throws
// — the package blocks `./package.json` in its exports map.)
const LOCK_ENTRY = require('../package-lock.json').packages['node_modules/panchang-ts'];

/**
 * Version of the panchang-ts actually present in node_modules — the engine the
 * generators would run under right now. Compared against the lockfile as well,
 * because a lockfile change that has not been installed yet lets a regenerate
 * produce artifacts from the old engine.
 */
function installedPanchangVersion() {
  let dir = path.dirname(require.resolve('panchang-ts'));
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, 'package.json');
    if (fs.existsSync(candidate)) {
      const pkg = JSON.parse(fs.readFileSync(candidate, 'utf8'));
      if (pkg.name === 'panchang-ts') return pkg.version;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/** The scan window app/muhurat/index.tsx asks the candidate list to cover. */
const MUHURAT_SCAN_DAYS = 365;
/** Warn when a table's coverage is within this many years of running out. */
const MIN_FUTURE_YEARS = 2;

function daysBetween(fromYmd, to) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fromYmd);
  if (!m) return null;
  const from = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Math.round((Date.UTC(to.getFullYear(), to.getMonth(), to.getDate()) - from) / 86400000);
}

const ARTIFACTS = [
  {
    file: 'src/data/static/festivals-table.json',
    generator: 'node scripts/generate-festivals-table.js',
    readVersion: json => json._meta && json._meta.panchangTsVersion,
    // A table that is correct for its engine but expiring degrades silently:
    // the calendar loses every festival marker past `endYear`, the Navratri
    // guide loses its per-day dates, and festival reminders simply stop.
    checkCoverage: (json, now) => {
      const end = json._meta && json._meta.endYear;
      if (typeof end !== 'number') return 'no _meta.endYear — cannot check coverage';
      const remaining = end - now.getFullYear();
      return remaining < MIN_FUTURE_YEARS
        ? `covers only through ${end} (${remaining} year(s) ahead)`
        : null;
    },
  },
  {
    // Sibling of the festival table: which festival keys are region-specific.
    // Also pure engine output — a bump that adds a regional festival, or
    // re-scopes an existing one, leaves the app filtering on the old rules and
    // shows (or hides) festivals for the wrong states. Written by the same
    // generator, so it carries the same stamp. No coverage check: it is a
    // key -> regions map, not a dated one; the festival table's own coverage
    // check already governs the window they are both built over.
    file: 'src/data/static/festival-regions.json',
    generator: 'node scripts/generate-festivals-table.js',
    readVersion: json => json._meta && json._meta.panchangTsVersion,
  },
  {
    // Third sibling: per-(region, masa) date corrections to the table. Pure
    // engine output too (a diff of the engine against the table), so the same
    // bump that moves the table moves these; the parity invariant below then
    // checks that table + corrections still reproduce the engine.
    file: 'src/data/static/festival-variants.json',
    generator: 'node scripts/generate-festivals-table.js',
    readVersion: json => json._meta && json._meta.panchangTsVersion,
  },
  {
    file: 'src/data/static/moon-phases-table.json',
    generator: 'node scripts/generate-moon-phases-table.js',
    readVersion: json => json._meta && json._meta.panchangTsVersion,
    checkCoverage: (json, now) => {
      const end = json._meta && json._meta.endYear;
      if (typeof end !== 'number') return 'no _meta.endYear — cannot check coverage';
      const remaining = end - now.getFullYear();
      return remaining < MIN_FUTURE_YEARS
        ? `covers only through ${end} (${remaining} year(s) ahead)`
        : null;
    },
  },
  {
    file: 'src/data/static/muhurat-candidates.json',
    generator: 'node scripts/generate-muhurat-candidates.js',
    readVersion: json => json.panchangTsVersion,
    // The runtime disables the fast path once the file's age has eaten into
    // SCAN_DAYS of its own lookahead, so shipping past that point is not
    // *wrong*, it just silently costs every first-open a 365-call scan.
    checkCoverage: (json, now) => {
      const age = daysBetween(json.generatedAt, now);
      if (age === null || typeof json.lookaheadDays !== 'number') {
        return 'no generatedAt / lookaheadDays — cannot check coverage';
      }
      const budget = json.lookaheadDays - MUHURAT_SCAN_DAYS;
      return age > budget
        ? `generated ${age} days ago; the candidate fast path is disabled past ${budget}`
        : null;
    },
  },
];

// ─── Reading assumptions back out of the app's own source ────────────────────
// Every literal and threshold asserted below is LIFTED FROM THE TypeScript, not
// restated here. That is the whole point: a copy would be one more thing to
// keep in sync, and it would go quietly stale the first time someone adds a
// matcher. Parsing is done with the repo's own `typescript` rather than regex
// so that reformatting, added comments and quoting style cannot fool it.

/** Parse one repo-relative `.ts` file into a SourceFile. */
function parseSource(rel) {
  const abs = path.join(REPO_ROOT, rel);
  return ts.createSourceFile(abs, fs.readFileSync(abs, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

/** Strip `as const` / `satisfies X` / parens off an initializer. */
function unwrapExpression(node) {
  let e = node;
  while (ts.isAsExpression(e) || ts.isSatisfiesExpression(e) || ts.isParenthesizedExpression(e)) {
    e = e.expression;
  }
  return e;
}

/**
 * The initializer of `const <name> = …` in `rel`.
 *
 * Throws when the declaration is gone. That is deliberate and is the check's
 * main defence against going quietly blind: a rename here means the assertion
 * below is no longer looking at anything, which must fail loudly and be
 * re-pointed by hand, not pass with an empty list.
 */
function declarationInitializer(rel, sourceFile, name) {
  let found = null;
  (function walk(node) {
    if (found) return;
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) {
      found = node;
      return;
    }
    ts.forEachChild(node, walk);
  })(sourceFile);
  if (!found || !found.initializer) {
    throw new Error(
      `${rel} no longer declares \`${name}\`. This check reads that declaration to know what to ` +
        'assert, so it is now asserting nothing — re-point it at whatever replaced it, or drop it here.',
    );
  }
  return unwrapExpression(found.initializer);
}

/** Property names of an object literal — quoted or bare, top level only. */
function objectLiteralKeys(node) {
  if (!ts.isObjectLiteralExpression(node)) throw new Error('expected an object literal');
  return node.properties
    .map(p => {
      if (!p.name) return null;
      if (ts.isStringLiteral(p.name) || ts.isNumericLiteral(p.name)) return p.name.text;
      return ts.isIdentifier(p.name) ? p.name.text : null;
    })
    .filter(Boolean);
}

/** String entries of an array literal. */
function arrayStringLiterals(node) {
  if (!ts.isArrayLiteralExpression(node)) throw new Error('expected an array literal');
  return node.elements.filter(ts.isStringLiteral).map(e => e.text);
}

/** Every node in a file, filtered by `pick`, which returns a string or null. */
function sweep(sourceFile, pick) {
  const out = [];
  (function walk(node) {
    const hit = pick(node);
    if (hit !== null && hit !== undefined) out.push(hit);
    ts.forEachChild(node, walk);
  })(sourceFile);
  return out;
}

// ─── (a) Festival-name matchers ──────────────────────────────────────────────
//
// A surprising amount of behaviour is gated on a festival's exact ENGLISH
// `name` as it appears in the shipped table: which vrat a reminder announces,
// which day Navratri starts on (and therefore the Ghatasthapana muhurat and
// eleven push notifications), and which of four same-day festivals gets to be
// the headline. All of it is `===` against a string the ENGINE chooses.
//
// Nothing enforces that contract. When a bump renames or re-punctuates a
// festival, the matcher just stops matching: the vrat label falls back to the
// raw name, the Navratri screen renders nothing, the calendar cell reverts to
// alphabetical order. No throw, no warning, no visible error — which is exactly
// how two separator regressions already shipped from this class (Chhath's
// em-dash becoming a colon, and the eclipse-description regex).
//
// So: lift every such literal out of the source and assert it still resolves.

/**
 * The three files that gate on a festival name, and the anchored declarations
 * to read them out of. The two sweeps below run over all three regardless, so
 * a new call site is picked up without editing this list.
 */
const NAME_MATCHER_FILES = [
  {
    // `FESTIVAL_NAME_TO_VRAT` is keyed by the table's English `name`; a miss
    // drops the reminder's tithi label back to the bare festival name.
    file: 'src/utils/vrat.ts',
    anchored: [{ decl: 'FESTIVAL_NAME_TO_VRAT', read: objectLiteralKeys, what: 'FESTIVAL_NAME_TO_VRAT keys' }],
  },
  {
    // `HEADLINE_MAJORS` is the same-day recognition ranking. A miss is silent
    // and total: `indexOf` returns -1, the entry never ranks, and the day falls
    // back to "first in the JSON", which is alphabetical — the exact bug the
    // list was written to fix ("Narak Chaturdashi" beating "Diwali").
    file: 'src/utils/festivalHeadline.ts',
    anchored: [{ decl: 'HEADLINE_MAJORS', read: arrayStringLiterals, what: 'HEADLINE_MAJORS entries' }],
  },
  {
    // Navratri's Day-1 lookups. The load-bearing four: a miss returns null from
    // `computeNavratriDates`, so the guide, the colour cycle, the Ghatasthapana
    // muhurat and the whole notification namespace go away at once.
    file: 'src/services/astrology/navratri.ts',
    anchored: [],
  },
];

/** `festivalDateInYear(year, 'Some Festival')` — the Navratri Day-1 lookups. */
function festivalDateInYearLookups(node) {
  if (!ts.isCallExpression(node)) return null;
  if (!ts.isIdentifier(node.expression) || node.expression.text !== 'festivalDateInYear') return null;
  const arg = node.arguments[1];
  return arg && ts.isStringLiteral(arg) ? arg.text : null;
}

/** `x.name === 'Some Festival'` / `!==` — e.g. the Sankranti tie-break. */
function nameEqualityLiterals(node) {
  if (!ts.isBinaryExpression(node)) return null;
  const op = node.operatorToken.kind;
  if (op !== ts.SyntaxKind.EqualsEqualsEqualsToken && op !== ts.SyntaxKind.ExclamationEqualsEqualsToken) {
    return null;
  }
  for (const [lhs, rhs] of [[node.left, node.right], [node.right, node.left]]) {
    if (ts.isStringLiteral(rhs) && ts.isPropertyAccessExpression(lhs) && lhs.name.text === 'name') {
      return rhs.text;
    }
  }
  return null;
}

const NAME_MATCHER_SWEEPS = [
  { pick: festivalDateInYearLookups, what: 'festivalDateInYear() lookups' },
  { pick: nameEqualityLiterals, what: '`.name` equality tests' },
];

/**
 * Literals that legitimately do NOT appear in the table, each with the name it
 * is an alias for.
 *
 * `HEADLINE_MAJORS` carries a couple of these as belt-and-braces ranking
 * entries against a name the engine might plausibly emit. They are inert
 * (`indexOf` simply never matches) rather than broken, so they must not fail
 * this check — but the exemption is only sound while the name they stand in for
 * IS still resolving, so that is asserted instead. If a bump ever starts
 * emitting the alias itself, nothing here needs to change.
 */
const ALIAS_LITERALS = {
  Janmashtami: 'Krishna Janmashtami',
  Vijayadashami: 'Dussehra',
};

/**
 * Every festival-name literal the app gates on, lifted out of
 * `NAME_MATCHER_FILES`, mapped to the call sites it came from (so a failure can
 * name them). Read at CHECK time, never copied here: `HEADLINE_MAJORS` in
 * particular grows, and an addition must be checked the moment it lands.
 *
 * Throws when a listed file yields nothing — see the note inside.
 */
function collectNameMatcherLiterals() {
  // literal -> the places it came from, so a failure names the call site.
  const origins = new Map();
  const record = (literal, where) => {
    if (!origins.has(literal)) origins.set(literal, new Set());
    origins.get(literal).add(where);
  };

  for (const source of NAME_MATCHER_FILES) {
    const sourceFile = parseSource(source.file);
    let found = 0;
    for (const { decl, read, what } of source.anchored) {
      const literals = read(declarationInitializer(source.file, sourceFile, decl));
      for (const literal of literals) record(literal, `${source.file} — ${what}`);
      found += literals.length;
    }
    for (const { pick, what } of NAME_MATCHER_SWEEPS) {
      const literals = sweep(sourceFile, pick);
      for (const literal of literals) record(literal, `${source.file} — ${what}`);
      found += literals.length;
    }
    // A listed file contributing nothing means the extractors lost track of it
    // — the helper was renamed, the map became a `Map`, the comparison moved
    // behind a variable — and the file's matchers are now unguarded. Failing
    // beats passing on an empty list; if a file honestly has no name literals
    // left, delete it from `NAME_MATCHER_FILES` as a deliberate edit.
    if (found === 0) {
      throw new Error(
        `no festival-name literals could be extracted from ${source.file}, which is listed here precisely ` +
          'because it gates on them. The extractors have lost track of the file — fix them, or drop the ' +
          'file from NAME_MATCHER_FILES if its matchers are genuinely gone.',
      );
    }
  }
  return origins;
}

/**
 * The shipped table decoded once: its year range, and every English festival
 * name mapped to the sorted `YYYY-MM-DD` dates it is emitted on.
 */
function festivalNameOccurrences() {
  // Required lazily so it runs AFTER main()'s lockfile-vs-node_modules gate. A
  // panchang-ts old enough to predate the `./festivals` subpath (v5 moved the
  // table out of the bundle) would otherwise throw MODULE_NOT_FOUND at load and
  // pre-empt the "run `npm install` first" message that explains why.
  const { readFestivalsForYear, readFestivalsYearRange } = require('panchang-ts/festivals');

  const table = readJson('src/data/static/festivals-table.json');
  const range = readFestivalsYearRange(table);
  const byName = new Map();
  for (let year = range.start; year <= range.end; year++) {
    for (const day of readFestivalsForYear(table, year, 'en') ?? []) {
      for (const festival of day.festivals) {
        if (!byName.has(festival.name)) byName.set(festival.name, []);
        byName.get(festival.name).push(day.date);
      }
    }
  }
  if (byName.size === 0) {
    throw new Error(
      `src/data/static/festivals-table.json decoded to no festivals at all for ${range.start}–${range.end}. ` +
        'Either the table is empty or its encoding changed under `readFestivalsForYear` — regenerate it.',
    );
  }
  for (const dates of byName.values()) dates.sort();
  return { range, byName };
}

const NAME_MATCHER_FIX =
  'These are matched with `===` against the table\'s English `name`, so a rename or a changed separator\n' +
  'in panchang-ts turns them into dead code with no error. Find what the engine calls each one now\n' +
  '(`node -e "…readFestivalsForYear(require(\'./src/data/static/festivals-table.json\'), 2026, \'en\')"`)\n' +
  'and update the matcher — do NOT delete it.';

/**
 * Assert every extracted literal resolves against the shipped festival table
 * AT LEAST ONCE across its full year range.
 *
 * This is the RENAME guard. A rename or re-punctuation removes a name from
 * EVERY year at once, which at-least-once catches with no false positives and
 * reports as one line per literal. Holes in individual years are a different
 * failure with a different fix (the engine, not the matcher), and are asserted
 * separately by {@link checkFestivalNameRecurrence}.
 */
function checkFestivalNameMatchers() {
  const origins = collectNameMatcherLiterals();
  const { range, byName } = festivalNameOccurrences();

  const unresolved = [];
  for (const [literal, where] of origins) {
    if (byName.has(literal)) continue;
    const canonical = ALIAS_LITERALS[literal];
    if (canonical === undefined) {
      unresolved.push({ literal, where, note: null });
      continue;
    }
    // The exemption is only worth anything while the real name still resolves.
    if (!origins.has(canonical)) {
      unresolved.push({
        literal,
        where,
        note: `exempt as an alias of "${canonical}", but nothing matches on "${canonical}" any more`,
      });
    } else if (!byName.has(canonical)) {
      unresolved.push({ literal, where, note: `exempt as an alias of "${canonical}", which also no longer resolves` });
    }
  }

  return {
    label: `festival-name matchers — ${origins.size} literal(s) against ${range.start}–${range.end}`,
    failures: unresolved.map(u => {
      const sites = [...u.where].join('; ');
      return `"${u.literal}" (${sites})${u.note ? ` — ${u.note}` : ''}`;
    }),
    fix: NAME_MATCHER_FIX,
  };
}

// ─── (a′) Festival-name matchers, year by year ──────────────────────────────
//
// Resolving somewhere in 2020–2050 is not the same as resolving in the year a
// user is looking at. When the engine simply fails to emit a festival in one
// year the matchers that depend on it go quiet for that year only: no Diwali
// headline, no Holi reminder, no Navratri guide. That is not matcher drift —
// the fix is upstream in panchang-ts — but it is exactly as silent, so it gets
// asserted per year here.

/**
 * The longest a festival that recurs at least once a year may go between two
 * emissions. A lunar year is 354–355 days and one with an adhika masa 383–385;
 * the longest gap measured across every literal in the 2020–2050 table is 385.
 * Five days of slack, and still well short of the ~710 days a skipped year
 * leaves. Monthly observances (Ekadashi, Pradosha, Sankashti…) never come near
 * it, so one rule covers every literal without a per-name cadence.
 */
const MAX_RECURRENCE_GAP_DAYS = 390;

/**
 * Years in which the locked panchang-ts genuinely does not emit a festival the
 * app gates on — whole day-rows absent, not renamed. ENGINE DATA HOLES, to be
 * fixed upstream, listed here only so that they are VISIBLE and do not mask a
 * new one.
 *
 * Empty since 5.4.0, whose festival-rule rework filled the last eleven (Diwali
 * 2036/2037/2046, Holi 2028/2037, Dhanteras 2028/2029/2038/2039, Thiru Onam
 * 2031/2050 were all absent under 5.3.0).
 *
 * Kept exact in both directions: a year that starts resolving again (an engine
 * fix) fails the check until its entry is deleted, so the list can only ever
 * shrink back to empty and never quietly exempts a year that no longer needs it.
 * Adding to it is an admission that the app ships without that festival in that
 * year, so it needs an upstream issue, not just an edit here.
 */
const KNOWN_ENGINE_HOLES = {};

const DAY_MS = 86400000;

function ymdToUtc(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/**
 * The years a recurring festival is missing from, given its sorted emission
 * dates over `range`: every gap longer than {@link MAX_RECURRENCE_GAP_DAYS}
 * between consecutive emissions (or between an emission and the range's edge)
 * is a missed occurrence, attributed to the year it should have fallen in —
 * evenly spaced inside an interior gap, a year on from the last emission (or a
 * year back from the first) at an edge.
 */
function recurrenceHoles(dates, range) {
  const holes = [];
  const rangeStart = Date.UTC(range.start, 0, 1);
  const rangeEnd = Date.UTC(range.end, 11, 31);
  const points = dates.map(ymdToUtc);
  const push = (ms, fromYmd, toYmd, gapDays) =>
    holes.push({ year: new Date(ms).getUTCFullYear(), between: `${fromYmd} → ${toYmd}`, gapDays });
  const iso = ms => new Date(ms).toISOString().slice(0, 10);

  // Interior gaps.
  for (let i = 1; i < points.length; i++) {
    const gapDays = Math.round((points[i] - points[i - 1]) / DAY_MS);
    if (gapDays <= MAX_RECURRENCE_GAP_DAYS) continue;
    const missing = Math.max(1, Math.round(gapDays / 365.25) - 1);
    for (let k = 1; k <= missing; k++) {
      push(points[i - 1] + (k * (points[i] - points[i - 1])) / (missing + 1), dates[i - 1], dates[i], gapDays);
    }
  }
  // Leading edge: the first emission is too far into the range.
  const leadDays = Math.round((points[0] - rangeStart) / DAY_MS);
  if (leadDays > MAX_RECURRENCE_GAP_DAYS) {
    for (let ms = points[0] - 365.25 * DAY_MS; ms >= rangeStart; ms -= 365.25 * DAY_MS) {
      push(ms, iso(rangeStart), dates[0], leadDays);
    }
  }
  // Trailing edge: the last emission stops too early.
  const last = points[points.length - 1];
  const trailDays = Math.round((rangeEnd - last) / DAY_MS);
  if (trailDays > MAX_RECURRENCE_GAP_DAYS) {
    for (let ms = last + 365.25 * DAY_MS; ms <= rangeEnd; ms += 365.25 * DAY_MS) {
      push(ms, dates[dates.length - 1], iso(rangeEnd), trailDays);
    }
  }
  return holes;
}

/**
 * Assert every extracted literal recurs in EVERY year it is expected to —
 * i.e. never goes longer than a year between emissions anywhere in the table's
 * range — except the engine holes recorded in {@link KNOWN_ENGINE_HOLES}.
 *
 * "Expected" is defined by recurrence, not by "present in each calendar year",
 * because a lunar festival near a year boundary legitimately skips a Gregorian
 * year (late December one year, early January the year after next) and would
 * fail a naive per-year test. A real hole leaves a gap of ~two lunar years,
 * which nothing legitimate does. Literals that never resolve at all are left to
 * {@link checkFestivalNameMatchers}, which reports them as renames.
 */
function checkFestivalNameRecurrence() {
  const origins = collectNameMatcherLiterals();
  const { range, byName } = festivalNameOccurrences();

  const failures = [];
  const exemptionsUsed = new Set();
  let checked = 0;
  for (const [literal, where] of origins) {
    const dates = byName.get(literal);
    if (!dates) continue; // never resolves — the rename check's finding, not this one's
    checked++;
    const known = new Set(KNOWN_ENGINE_HOLES[literal] ?? []);
    for (const hole of recurrenceHoles(dates, range)) {
      if (known.has(hole.year)) {
        exemptionsUsed.add(`${literal}@${hole.year}`);
        continue;
      }
      failures.push(
        `"${literal}" is not emitted in ${hole.year} (${hole.gapDays} days between ${hole.between}) ` +
          `— ${[...where].join('; ')}`,
      );
    }
  }
  for (const [literal, years] of Object.entries(KNOWN_ENGINE_HOLES)) {
    for (const year of years) {
      if (exemptionsUsed.has(`${literal}@${year}`)) continue;
      failures.push(
        origins.has(literal)
          ? `KNOWN_ENGINE_HOLES exempts "${literal}" in ${year}, but the table now emits it there (or ${year} ` +
              `is outside ${range.start}–${range.end}) — delete the exemption`
          : `KNOWN_ENGINE_HOLES exempts "${literal}", which no matcher uses any more — delete the entry`,
      );
    }
  }

  const exempt = Object.values(KNOWN_ENGINE_HOLES).reduce((n, ys) => n + ys.length, 0);
  return {
    label:
      `festival-name recurrence — ${checked} literal(s) year by year over ${range.start}–${range.end}, ` +
      `${exempt} known engine hole(s)`,
    failures,
    fix:
      'A literal the app gates on is missing from a year it recurs in, so every feature matching on it goes\n' +
      'quiet for that year alone. Look at the table around the date named: if the day-row is absent, it is an\n' +
      'engine data hole — report it upstream in panchang-ts, and only then record it in KNOWN_ENGINE_HOLES.\n' +
      'If the name changed in just that year, fix the matcher. If the festival is genuinely not annual,\n' +
      'this check needs a per-literal exemption with the reason — do not widen MAX_RECURRENCE_GAP_DAYS.',
  };
}

// ─── (b) Region-breadth threshold ────────────────────────────────────────────
//
// `LOCAL_MAX_REGIONS` in src/data/festivals.ts decides which festivals the
// Region setting is allowed to subtract. Its value is not a preference — it is
// read off a measured gap in the shipped index, and its own doc comment says
// so. The two assertions here keep that reading true.

/**
 * How far above `LOCAL_MAX_REGIONS` the first genuinely-broad key must sit.
 *
 * The shipped index (30 scoped keys) is distributed 1:20, 2:2, 3:2, 4:2, 5:2,
 * 8:1, 10:1 — the widest truly-regional keys are Hariyali Teej and Hartalika
 * Teej at 5, and the next entries up are Govardhan Puja at 8 and Bhai Dooj at
 * 10, both nationwide. So the threshold sits in an empty band three wide, and
 * moving it anywhere in 5..7 changes nothing. That margin is the property worth
 * asserting: a key landing at 6 or 7 puts the threshold on a cliff edge, where
 * one region either way flips a festival between "shown everywhere" and
 * "subtracted from most of the country", and it has to be re-derived by hand.
 */
const MIN_BREADTH_MARGIN = 3;

function checkRegionBreadth() {
  const regionIndex = readJson('src/data/static/festival-regions.json').keys;
  if (!regionIndex || typeof regionIndex !== 'object') {
    throw new Error('src/data/static/festival-regions.json has no `keys` map — regenerate it.');
  }

  const rel = 'src/data/festivals.ts';
  const sourceFile = parseSource(rel);

  const thresholdNode = declarationInitializer(rel, sourceFile, 'LOCAL_MAX_REGIONS');
  if (!ts.isNumericLiteral(thresholdNode)) {
    throw new Error(`${rel}: LOCAL_MAX_REGIONS is no longer a plain number literal — this check cannot read it.`);
  }
  const localMax = Number(thresholdNode.text);
  const curatedKeys = objectLiteralKeys(declarationInitializer(rel, sourceFile, 'CURATED_REGIONS'));

  const failures = [];

  // 1. The gap. `above` being empty means nothing is exempted by breadth at
  //    all, which is a fail-open (every key is genuinely local, or the broad
  //    ones went pan-Indian and left the index, where they are allowed
  //    everywhere anyway) — no cliff to sit on, so no failure.
  const above = Object.entries(regionIndex).filter(([, regions]) => regions.length > localMax);
  const firstBroad = above.length === 0 ? Infinity : Math.min(...above.map(([, r]) => r.length));
  if (firstBroad < localMax + MIN_BREADTH_MARGIN) {
    const onEdge = above
      .filter(([, r]) => r.length < localMax + MIN_BREADTH_MARGIN)
      .map(([key, r]) => `${key} (${r.length} regions)`);
    failures.push(
      `LOCAL_MAX_REGIONS is ${localMax} and the nearest key above it is at ${firstBroad}: ${onEdge.join(', ')}. ` +
        'The threshold no longer sits in a gap, so one region either way decides whether that festival is ' +
        'shown nationwide or subtracted from most of the country. Re-derive it against the new distribution.',
    );
  }

  // 2. Curated overrides still address a key the index actually has. A renamed
  //    key makes the override inert and silently restores the blank-day bug it
  //    was added to fix — src/data/festivals.ts warns about this at runtime,
  //    but only in a dev build someone happens to be watching.
  const orphaned = curatedKeys.filter(key => regionIndex[key] === undefined);
  if (orphaned.length > 0) {
    failures.push(
      `CURATED_REGIONS override(s) address keys the index no longer scopes: ${orphaned.join(', ')}. ` +
        'Either the engine widened them to pan-Indian (harmless — delete the entry) or it renamed them ' +
        '(not harmless — the curated regions are silently gone and those days go blank there again). ' +
        'Check which, in that order.',
    );
  }

  const margin = firstBroad === Infinity ? 'nothing above it' : `first broad key at ${firstBroad}`;
  return {
    label: `region breadth — LOCAL_MAX_REGIONS ${localMax}, ${margin}, ${curatedKeys.length} curated override(s)`,
    failures,
    fix: `Both are read live out of ${rel}; neither is duplicated here.`,
  };
}

// ─── (c) Coverage: every year of the fixed window, every region ──────────────
//
// The tables cover a FIXED window, set once in scripts/generate-festivals-table.js
// (both generators read it from there). The `EXPIRING` pass above only asks
// whether `_meta.endYear` is far enough ahead; it would happily pass a table
// whose `_meta` claims 2020–2050 while `years` is missing 2037, or a region
// index swept for fewer regions than the Settings picker offers. Everything
// downstream treats a missing year as "no festivals that year", silently.

/**
 * The window the app is promised to cover without computing anything — the
 * product floor, stated here independently of the generator so that shrinking
 * the generator's window is a deliberate two-file edit rather than a silent
 * one. The Festivals screen computes a few years past each edge on-device
 * (src/services/festivalYearCache.ts); inside this window it never does.
 */
const REQUIRED_COVERAGE = { start: 2020, end: 2050 };

/** Sanity floor for day-rows in one year. Every year carries ~24 Ekadashi
 *  dates, 12 Sankrantis and ~24 Pradoshas before any named festival; the
 *  2020–2050 table has 149–168 rows a year, so a year under this is a broken
 *  build, not a quiet one. */
const MIN_FESTIVAL_DAYS_PER_YEAR = 100;

/** Consecutive Purnima (or Amavasya) observance days are one synodic month
 *  apart (29.5 d), give or take the day a sunrise tithi lands on — or two
 *  months when a kshaya tithi touches no sunrise at all. Measured 29–59 over
 *  2020–2050; the bounds are the physics with a day of slack either side. */
const MOON_PHASE_GAP_DAYS = { min: 27, max: 61 };

/** String members of `type <name> = 'a' | 'b' | …` in `rel`. */
function typeAliasStringLiterals(rel, sourceFile, name) {
  let found = null;
  (function walk(node) {
    if (found) return;
    if (ts.isTypeAliasDeclaration(node) && node.name.text === name) {
      found = node;
      return;
    }
    ts.forEachChild(node, walk);
  })(sourceFile);
  if (!found) {
    throw new Error(`${rel} no longer declares \`type ${name}\` — re-point this check at whatever replaced it.`);
  }
  const members = ts.isUnionTypeNode(found.type) ? found.type.types : [found.type];
  return members
    .filter(m => ts.isLiteralTypeNode(m) && ts.isStringLiteral(m.literal))
    .map(m => m.literal.text);
}

function checkTableCoverage() {
  // Lazily, after main()'s engine gate: requiring the generator loads panchang-ts.
  // Requiring it only exposes its constants — its main() is guarded.
  const gen = require('./generate-festivals-table.js');
  const { readFestivalsForYear } = require('panchang-ts/festivals');
  const failures = [];
  const want = `${gen.START_YEAR}–${gen.END_YEAR}`;

  if (gen.START_YEAR > REQUIRED_COVERAGE.start || gen.END_YEAR < REQUIRED_COVERAGE.end) {
    failures.push(
      `scripts/generate-festivals-table.js builds ${want}, which no longer covers the required ` +
        `${REQUIRED_COVERAGE.start}–${REQUIRED_COVERAGE.end}.`,
    );
  }

  // Festival table: the generator's window exactly, and every year populated.
  const festivals = readJson('src/data/static/festivals-table.json');
  const fm = festivals._meta || {};
  if (fm.startYear !== gen.START_YEAR || fm.endYear !== gen.END_YEAR) {
    failures.push(`festivals-table.json covers ${fm.startYear}–${fm.endYear}; the generator builds ${want}.`);
  }
  for (let year = gen.START_YEAR; year <= gen.END_YEAR; year++) {
    const rows = readFestivalsForYear(festivals, year, 'en');
    if (!rows) {
      failures.push(`festivals-table.json has no ${year}.`);
      continue;
    }
    if (rows.length < MIN_FESTIVAL_DAYS_PER_YEAR) {
      failures.push(`festivals-table.json ${year} has only ${rows.length} day-row(s).`);
    }
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].date <= rows[i - 1].date) {
        failures.push(`festivals-table.json ${year} is not strictly date-sorted at ${rows[i].date}.`);
        break;
      }
    }
  }

  // Moon-phase table: same window, every year, both phases, physically spaced.
  const moon = readJson('src/data/static/moon-phases-table.json');
  const mm = moon._meta || {};
  if (mm.startYear !== gen.START_YEAR || mm.endYear !== gen.END_YEAR) {
    failures.push(`moon-phases-table.json covers ${mm.startYear}–${mm.endYear}; the generator builds ${want}.`);
  }
  for (const phase of ['full', 'new']) {
    const all = [];
    for (let year = gen.START_YEAR; year <= gen.END_YEAR; year++) {
      const days = moon.years && moon.years[String(year)] && moon.years[String(year)][phase];
      if (!Array.isArray(days) || days.length === 0) {
        failures.push(`moon-phases-table.json has no ${phase}-moon days for ${year}.`);
        continue;
      }
      const stray = days.find(d => !d.startsWith(`${year}-`));
      if (stray) failures.push(`moon-phases-table.json ${year}.${phase} carries ${stray}.`);
      all.push(...days);
    }
    for (let i = 1; i < all.length; i++) {
      const gap = Math.round((ymdToUtc(all[i]) - ymdToUtc(all[i - 1])) / DAY_MS);
      if (gap < MOON_PHASE_GAP_DAYS.min || gap > MOON_PHASE_GAP_DAYS.max) {
        failures.push(`moon-phases-table.json ${phase}: ${all[i - 1]} → ${all[i]} is ${gap} days apart.`);
      }
    }
  }

  // Region index: swept over the same window, for every region Settings offers.
  // The window equality is load-bearing twice over: src/data/festivals.ts reads
  // FESTIVALS_MIN_YEAR / FESTIVALS_MAX_YEAR off THIS file's `_meta`, so that the
  // 230 KB table itself can stay unloaded until something reads a festival.
  const regionsFile = readJson('src/data/static/festival-regions.json');
  const rm = regionsFile._meta || {};
  if (rm.startYear !== gen.START_YEAR || rm.endYear !== gen.END_YEAR) {
    failures.push(`festival-regions.json was swept over ${rm.startYear}–${rm.endYear}; the table is ${want}.`);
  }
  const storeRel = 'src/store/useStore.ts';
  const offered = typeAliasStringLiterals(storeRel, parseSource(storeRel), 'Region').filter(r => r !== 'all');
  const swept = Array.isArray(rm.regions) ? rm.regions : [];
  const notSwept = offered.filter(r => !swept.includes(r));
  const notOffered = swept.filter(r => !offered.includes(r));
  if (notSwept.length > 0) {
    failures.push(
      `festival-regions.json was not swept for ${notSwept.join(', ')}, which ${storeRel} offers ` +
        '(add them to REGIONS in scripts/generate-festivals-table.js).',
    );
  }
  if (notOffered.length > 0) {
    failures.push(`festival-regions.json was swept for ${notOffered.join(', ')}, which ${storeRel} no longer offers.`);
  }
  const genRegions = [...gen.REGIONS].sort().join(',');
  if ([...swept].sort().join(',') !== genRegions) {
    failures.push('festival-regions.json _meta.regions differs from the generator\'s REGIONS — regenerate it.');
  }
  for (const [key, regions] of Object.entries(regionsFile.keys || {})) {
    const unknown = regions.filter(r => !offered.includes(r));
    if (unknown.length > 0) failures.push(`festival-regions.json scopes ${key} to unknown region(s) ${unknown.join(', ')}.`);
  }

  return {
    label:
      `coverage — every year ${want} in the festival and moon-phase tables, region index swept ` +
      `for ${swept.length} region(s)`,
    failures,
    fix:
      'Re-run `npm run generate:festivals` and `npm run generate:moon-phases`. If the window itself\n' +
      'changed, that is a bundle-size decision (~0.9 KB gzipped per year) and REQUIRED_COVERAGE here\n' +
      'must move with it.',
  };
}

/**
 * The tables are generated at the SAME point as the runtime's no-location
 * fallback, `FALLBACK_COORDS` in panchangService — a no-location user's
 * Panchang and Festivals screens are the two halves of one answer, and if they
 * are computed at different places they contradict each other on every
 * tithi-boundary day. Both sides say so in comments; this makes it true.
 */
function checkReferencePoint() {
  const rel = 'src/services/astrology/panchangService.ts';
  const init = declarationInitializer(rel, parseSource(rel), 'FALLBACK_COORDS');
  if (!ts.isObjectLiteralExpression(init)) {
    throw new Error(`${rel}: FALLBACK_COORDS is no longer an object literal — this check cannot read it.`);
  }
  const numeric = name => {
    const prop = init.properties.find(p => p.name && ts.isIdentifier(p.name) && p.name.text === name);
    let e = prop && ts.isPropertyAssignment(prop) ? unwrapExpression(prop.initializer) : null;
    let sign = 1;
    if (e && ts.isPrefixUnaryExpression(e) && e.operator === ts.SyntaxKind.MinusToken) {
      sign = -1;
      e = e.operand;
    }
    if (!e || !ts.isNumericLiteral(e)) {
      throw new Error(`${rel}: FALLBACK_COORDS.${name} is no longer a number literal — this check cannot read it.`);
    }
    return sign * Number(e.text);
  };
  const fallback = { lat: numeric('lat'), lon: numeric('lon') };
  const { REFERENCE } = require('./generate-festivals-table.js');
  const meta = readJson('src/data/static/festivals-table.json')._meta || {};
  const failures = [];
  if (REFERENCE.latitude !== fallback.lat || REFERENCE.longitude !== fallback.lon) {
    failures.push(
      `scripts/generate-festivals-table.js REFERENCE is (${REFERENCE.latitude}, ${REFERENCE.longitude}) but ` +
        `FALLBACK_COORDS is (${fallback.lat}, ${fallback.lon}).`,
    );
  }
  if (meta.latitude !== fallback.lat || meta.longitude !== fallback.lon) {
    failures.push(
      `festivals-table.json was built at (${meta.latitude}, ${meta.longitude}) but FALLBACK_COORDS is ` +
        `(${fallback.lat}, ${fallback.lon}) — regenerate it.`,
    );
  }
  return {
    label: `reference point — tables built at FALLBACK_COORDS (${fallback.lat}, ${fallback.lon})`,
    failures,
    fix:
      'Move them together: REFERENCE in scripts/generate-festivals-table.js (which the moon-phase\n' +
      'generator also reads) and FALLBACK_COORDS in panchangService, then regenerate both tables.',
  };
}

// ─── (d) On-device compute parity ────────────────────────────────────────────
//
// Years outside the table are computed on the phone by
// src/services/festivalYearCompute.ts, which re-implements the library's
// `buildFestivalsTable` year step in yieldable slices. The two must never
// disagree — 2051 has to answer the way 2050 does — and the re-implementation is
// exactly the kind of copy that drifts when the engine changes underneath it.
// So the real TypeScript module is transpiled and run here, against both the
// library build and the shipped table.

/**
 * Load one self-contained repo TypeScript module under Node. Its relative
 * requires (`./static/*.json`) resolve from the module's own directory, and
 * `__DEV__` — React Native's build flag — reads as a release build.
 */
function loadTsModule(rel) {
  const abs = path.join(REPO_ROOT, rel);
  const { outputText } = ts.transpileModule(fs.readFileSync(abs, 'utf8'), {
    fileName: abs,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  });
  const mod = { exports: {} };
  // Evaluating our own transpiled source, never input.
  new Function('require', 'module', 'exports', '__DEV__', outputText)(createRequire(abs), mod, mod.exports, false);
  return mod.exports;
}

/** Key-order-independent JSON, for comparing rows built by different code. */
function canonicalJson(value) {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]]))
      : v,
  );
}

function firstRowDifference(actual, expected) {
  const n = Math.max(actual.length, expected.length);
  for (let i = 0; i < n; i++) {
    if (canonicalJson(actual[i]) !== canonicalJson(expected[i])) {
      const a = actual[i] ? `${actual[i].date} ${canonicalJson(actual[i].festivals)}` : 'nothing';
      const e = expected[i] ? `${expected[i].date} ${canonicalJson(expected[i].festivals)}` : 'nothing';
      return `row ${i}: on-device ${a} vs ${e}`;
    }
  }
  return null;
}

async function checkComputeParity() {
  const rel = 'src/services/festivalYearCompute.ts';
  const { computeFestivalYear } = loadTsModule(rel);
  if (typeof computeFestivalYear !== 'function') {
    throw new Error(`${rel} no longer exports computeFestivalYear — re-point this check.`);
  }
  const { buildFestivalsTable } = require('panchang-ts');
  const { readFestivalsForYear } = require('panchang-ts/festivals');
  const table = readJson('src/data/static/festivals-table.json');
  const m = table._meta;
  const params = {
    latitude: m.latitude,
    longitude: m.longitude,
    timezoneOffsetMinutes: m.timezoneOffsetMinutes,
    ayanamsa: m.ayanamsa,
    masaSystem: m.masaSystem,
    region: m.region,
  };
  const libraryYear = year =>
    readFestivalsForYear(
      buildFestivalsTable({
        location: { latitude: m.latitude, longitude: m.longitude },
        timezoneOffsetMinutes: m.timezoneOffsetMinutes,
        startYear: year,
        endYear: year,
        languages: m.languages,
        ayanamsa: m.ayanamsa,
        masaSystem: m.masaSystem,
        region: m.region,
      }),
      year,
      'en',
    );

  const failures = [];
  const compare = (what, actual, expected) => {
    const diff = firstRowDifference(actual, expected);
    if (diff) failures.push(`${what}: ${diff}`);
  };

  // Just past each edge, against the library's own build of that year.
  for (const year of [m.startYear - 1, m.endYear + 1]) {
    const result = await computeFestivalYear(year, params);
    if (!result.complete) failures.push(`${year}: the compute reported incomplete with no abort signal.`);
    compare(`${year} vs buildFestivalsTable`, result.days, libraryYear(year));
  }
  // The table's last year, against the SHIPPED rows themselves.
  const shippedYear = m.endYear;
  compare(
    `${shippedYear} vs festivals-table.json`,
    (await computeFestivalYear(shippedYear, params)).days,
    readFestivalsForYear(table, shippedYear, 'en'),
  );
  // Stop part-way and resume: must land on the same rows as one straight run.
  // The stopped half is sliced one day at a time (`sliceBudgetMs: 0`) — the
  // phone's slicing on a slow device, and a deterministic stop point here,
  // where the default time budget would put a machine-speed-dependent number of
  // days in each slice. The resumed half runs on the default budget, so both
  // slicings are covered against the library's one straight build.
  const resumeYear = m.endYear + 1;
  const STOP_AT_DAY = 150;
  const controller = new AbortController();
  const stoppedRun = await computeFestivalYear(resumeYear, params, {
    signal: controller.signal,
    sliceBudgetMs: 0,
    onChunk: partial => {
      if (partial.daysDone >= STOP_AT_DAY) controller.abort();
    },
  });
  if (stoppedRun.complete || stoppedRun.daysDone !== STOP_AT_DAY) {
    failures.push(
      `${resumeYear}: an abort at day ${STOP_AT_DAY} (one-day slices) did not leave a partial run ending there ` +
        `(complete ${stoppedRun.complete}, daysDone ${stoppedRun.daysDone}).`,
    );
  } else {
    const resumed = await computeFestivalYear(resumeYear, params, { resume: stoppedRun });
    compare(`${resumeYear} stopped at day ${stoppedRun.daysDone} and resumed`, resumed.days, libraryYear(resumeYear));
  }

  return {
    label: `on-device compute parity — ${m.startYear - 1}, ${m.endYear + 1} vs the library, ${shippedYear} vs the table, stop/resume`,
    failures,
    fix:
      `${rel} no longer reproduces panchang-ts's buildFestivalsTable year step, so years computed on the\n` +
      'phone would disagree with the shipped table. Diff it against `buildYear` in\n' +
      'node_modules/panchang-ts/dist/index.cjs (bucketing, eclipse filter, entry shape) and bring it back in line.',
  };
}

// ─── (e) Region + month-system parity ────────────────────────────────────────
//
// The app ships ONE table (`all` + purnimanta) and reshapes it at read time for
// the user's Region and month system: a key filter, then the generated
// per-combination corrections in festival-variants.json. Both halves failed
// silently in the 5.3 → 5.4 bump — a user outside Tamil Nadu lost a Masik
// Karthigai a year, and Amanta users got the North Indian Shravan Mondays — so
// the real TypeScript read path (`festivalDaysForYear`) is run here against the
// engine's own answer for every (region, masa) the Settings pickers offer.
//
// The app may show MORE than the engine only for a key the region index does
// not scope to that region at all: the breadth guard and CURATED_REGIONS widen
// those on purpose. It may never show less.

/**
 * Years compared. The full 31-year window is 44 × 31 engine calls (~2 min), so
 * by default the check runs the window's edges plus the next three years from
 * today; the variants are generated the same way for every year, so the sample
 * guards the read path rather than the data. `CHECK_DATA_FULL=1` runs them all.
 */
function parityYears(gen, now) {
  if (process.env.CHECK_DATA_FULL === '1') {
    return Array.from({ length: gen.END_YEAR - gen.START_YEAR + 1 }, (_, i) => gen.START_YEAR + i);
  }
  const y = now.getFullYear();
  return [...new Set([gen.START_YEAR, y, y + 1, y + 2, gen.END_YEAR])]
    .filter(year => year >= gen.START_YEAR && year <= gen.END_YEAR)
    .sort();
}

function checkRegionMasaParity() {
  const rel = 'src/data/festivals.ts';
  const { festivalDaysForYear } = loadTsModule(rel);
  if (typeof festivalDaysForYear !== 'function') {
    throw new Error(`${rel} no longer exports festivalDaysForYear — re-point this check.`);
  }
  const gen = require('./generate-festivals-table.js');
  const { computeFestivalsForYear } = require('panchang-ts');
  const table = readJson('src/data/static/festivals-table.json');
  const variants = readJson('src/data/static/festival-variants.json');
  const regionKeys = readJson('src/data/static/festival-regions.json').keys || {};
  const m = table._meta;
  const failures = [];

  // The variants must be built against THIS table, for every option offered.
  if (variants._meta.table !== `${m.region}|${m.masaSystem}`) {
    failures.push(
      `festival-variants.json corrects a ${variants._meta.table} table, but festivals-table.json is ` +
        `${m.region}|${m.masaSystem}.`,
    );
  }
  if (variants._meta.startYear !== m.startYear || variants._meta.endYear !== m.endYear) {
    failures.push(
      `festival-variants.json covers ${variants._meta.startYear}–${variants._meta.endYear}; the table is ` +
        `${m.startYear}–${m.endYear}.`,
    );
  }
  const storeRel = 'src/store/useStore.ts';
  const storeSource = parseSource(storeRel);
  const offeredMasa = typeAliasStringLiterals(storeRel, storeSource, 'MasaSystem');
  const offeredRegions = typeAliasStringLiterals(storeRel, storeSource, 'Region');
  const missingMasa = offeredMasa.filter(x => !variants._meta.masaSystems.includes(x));
  const missingRegions = offeredRegions.filter(x => !variants._meta.regions.includes(x));
  if (missingMasa.length > 0 || missingRegions.length > 0) {
    failures.push(
      `festival-variants.json was not built for ${[...missingRegions, ...missingMasa].join(', ')}, which ` +
        `${storeRel} offers (add them to REGIONS / MASA_SYSTEMS in scripts/generate-festivals-table.js).`,
    );
  }

  const atom = (ymd, f) =>
    `${ymd} ${JSON.stringify({ key: f.key, name: f.name, type: f.type, description: f.description })}`;
  const years = parityYears(gen, new Date());
  const location = { latitude: m.latitude, longitude: m.longitude };
  let combos = 0;
  for (const region of offeredRegions) {
    for (const masaSystem of offeredMasa) {
      combos++;
      const missing = [];
      const extra = [];
      const misordered = [];
      for (const year of years) {
        const engine = new Set();
        const engineDays = new Map();
        for (const day of computeFestivalsForYear(year, location, {
          timezone: m.timezoneOffsetMinutes,
          ayanamsa: m.ayanamsa,
          masaSystem,
          language: 'en',
          region,
        })) {
          if (day.festival.type === 'eclipse') continue;
          const ymd = new Date(day.date.getTime() + m.timezoneOffsetMinutes * 60000).toISOString().slice(0, 10);
          engine.add(atom(ymd, day.festival));
          if (!engineDays.has(ymd)) engineDays.set(ymd, []);
          engineDays.get(ymd).push(atom(ymd, day.festival));
        }
        const app = new Map();
        for (const day of festivalDaysForYear(year, region, masaSystem)) {
          const listed = day.festivals.map(f => atom(day.date, f));
          for (const [i, f] of day.festivals.entries()) app.set(listed[i], f.key);
          // Order matters (the calendar headlines a day by its first minor), so
          // the engine's festivals must appear in the engine's order; a
          // deliberate widening may sit anywhere among them.
          // (A missing festival is reported above as missing, not here.)
          const expected = engineDays.get(day.date) ?? [];
          const shown = listed.filter(a => engine.has(a));
          if (expected.every(a => listed.includes(a)) && shown.join('\n') !== expected.join('\n')) {
            misordered.push(day.date);
          }
        }
        for (const a of engine) if (!app.has(a)) missing.push(a);
        for (const [a, key] of app) {
          if (engine.has(a)) continue;
          // A deliberate widening: the engine never emits this key in this region.
          const scoped = regionKeys[key];
          if (region !== 'all' && scoped !== undefined && !scoped.includes(region)) continue;
          extra.push(a);
        }
      }
      const combo = `${region}|${masaSystem}`;
      if (missing.length > 0) {
        failures.push(`${combo}: ${missing.length} festival(s) the engine lists are missing, first ${missing[0]}`);
      }
      if (extra.length > 0) {
        failures.push(`${combo}: ${extra.length} festival(s) the engine does not list are shown, first ${extra[0]}`);
      }
      if (misordered.length > 0) {
        failures.push(`${combo}: ${misordered.length} day(s) list the engine's festivals out of its order, first ${misordered[0]}`);
      }
    }
  }

  return {
    label:
      `region + month-system parity — ${combos} combination(s) × ${years.join(', ')}` +
      (process.env.CHECK_DATA_FULL === '1' ? '' : ' (CHECK_DATA_FULL=1 for every year)'),
    failures,
    fix:
      'The app\'s read-time view of the table (key filter + festival-variants.json) no longer reproduces\n' +
      'computeFestivalsForYear for that Region / month system. Regenerate (`npm run generate:festivals`);\n' +
      `if it still fails, the read path in ${rel} (festivalsForDay) and buildVariants in the generator disagree.`,
  };
}

const INVARIANTS = [
  checkFestivalNameMatchers,
  checkFestivalNameRecurrence,
  checkRegionBreadth,
  checkTableCoverage,
  checkReferencePoint,
  checkComputeParity,
  checkRegionMasaParity,
];

async function main() {
  if (!LOCK_ENTRY || !LOCK_ENTRY.version) {
    console.error(
      'Cannot read panchang-ts version from package-lock.json ' +
        "(packages['node_modules/panchang-ts']). Run `npm install` first.",
    );
    process.exitCode = 1;
    return;
  }
  const locked = LOCK_ENTRY.version;
  const installed = installedPanchangVersion();
  if (installed !== locked) {
    console.error(
      `node_modules has panchang-ts ${installed ?? 'nothing resolvable'} but the lockfile pins ${locked}.\n` +
        'Regenerating now would compute with one engine and stamp the other. Run `npm install` first.',
    );
    process.exitCode = 1;
    return;
  }

  const now = new Date();
  const stale = [];
  const expiring = [];
  for (const artifact of ARTIFACTS) {
    const json = readJson(artifact.file);
    const stamped = artifact.readVersion(json);
    const coverage = artifact.checkCoverage ? artifact.checkCoverage(json, now) : null;
    if (coverage) {
      expiring.push({ ...artifact, coverage });
      console.log(`  EXPIRING ${artifact.file} — ${coverage}`);
      continue;
    }
    if (stamped === locked) {
      console.log(`  ok     ${artifact.file}`);
      continue;
    }
    // An unstamped artifact predates this check, which means it was built by
    // an unknown engine — treat it as stale rather than trusting it.
    stale.push({ ...artifact, stamped });
    console.log(`  STALE  ${artifact.file} — built with ${stamped ?? 'an unrecorded version'}`);
  }

  // Invariants run whatever the artifacts said: a stale table can still be
  // matched correctly, and a fresh one can still have broken every matcher.
  const broken = [];
  for (const check of INVARIANTS) {
    let result;
    try {
      // Awaited: the compute-parity check runs the time-sliced (async) compute.
      result = await check();
    } catch (e) {
      // A throw here is the check itself losing its footing — a renamed
      // declaration, an unreadable artifact. That is a failure, not a skip:
      // skipping is how a guard quietly stops guarding.
      broken.push({ label: `${check.name} could not run`, failures: [e.message], fix: null });
      console.log(`  FAIL   ${check.name} — could not run`);
      continue;
    }
    if (result.failures.length === 0) {
      console.log(`  ok     ${result.label}`);
      continue;
    }
    broken.push(result);
    console.log(`  FAIL   ${result.label} — ${result.failures.length} problem(s)`);
  }

  if (stale.length === 0 && expiring.length === 0 && broken.length === 0) {
    console.log(
      `\nGenerated data matches locked panchang-ts ${locked}, and the app's assumptions about it still hold.`,
    );
    return;
  }

  if (stale.length > 0) {
    console.error(
      `\n${stale.length} generated artifact(s) do not match locked panchang-ts ${locked}.\n` +
        'Their dates are engine output, so an engine bump changes them. Re-run:\n' +
        stale.map(a => `  ${a.generator}\n`).join('') +
        'then commit the regenerated JSON.',
    );
  }
  if (expiring.length > 0) {
    console.error(
      `\n${expiring.length} generated artifact(s) are running out of coverage.\n` +
        'They are correct for their engine but their window is ageing out, which\n' +
        'degrades silently in the app rather than failing. Re-run:\n' +
        expiring.map(a => `  ${a.generator}\n`).join('') +
        'then commit the regenerated JSON.',
    );
  }
  for (const b of broken) {
    console.error(
      `\n${b.label}: ${b.failures.length} problem(s).\n` +
        b.failures.map(f => `  - ${f}\n`).join('') +
        (b.fix ? `${b.fix}\n` : ''),
    );
  }
  process.exitCode = 1;
}

main().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
