/**
 * Pre-compute "auspicious anywhere in India" candidate dates for each muhurat
 * occasion and write them to src/data/static/muhurat-candidates.json.
 *
 * Why this exists: the muhurta rule reads tithi / nakshatra / yoga at LOCAL
 * sunrise, so a fully precomputed list at one city would be wrong for users
 * elsewhere (sunrise drifts ~30–40 min east-to-west across India). This file
 * is therefore a *candidate* list — dates that satisfy the rule at any of
 * 5 reference longitudes spanning India. The runtime validates each
 * candidate at the user's actual coords, replacing the 365-day scan with
 * ~50 panchang calls.
 *
 * Source of rules: panchang-ts ships `STOCK_MUHURTA_RULES` and the named
 * `*Rule` exports (vivahRule, grihaPraveshRule, …). This script imports
 * those directly so there's a single source of truth across the whole
 * pipeline — runtime validator, candidate generator, and lib stay aligned.
 *
 * Usage:  node scripts/generate-muhurat-candidates.js
 */
/* eslint-env node */

const {
  scoreMuhurta,
  vivahRule,
  grihaPraveshRule,
  namakaranaRule,
  vahanKharidiRule,
  mundanRule,
  annaprashanRule,
  vidyarambhRule,
} = require('panchang-ts');
const fs = require('fs');
const path = require('path');

/**
 * Version of the panchang-ts that is actually INSTALLED (and therefore the one
 * that computed this artifact). Read by walking up from the resolved entry
 * point to the package root rather than by depth arithmetic, so it does not
 * silently read the wrong package.json if the entry ever moves.
 *
 * The lockfile is deliberately NOT the source here: stamping the locked version
 * while computing with node_modules lets a regenerate-before-`npm install` write
 * an artifact under one engine and certify it as another —
 * scripts/check-generated-data.js compares the stamp against the lockfile, so
 * it would be comparing the lockfile to itself. (`require('panchang-ts/package.json')`
 * throws: the package blocks `./package.json` in its exports map.)
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
  throw new Error('Cannot resolve the installed panchang-ts version');
}

const LIB_VERSION = installedPanchangVersion();

// ─── Lookahead window ────────────────────────────────────────────────────────
// The runtime scans a 365-day window, so the fast path is only sound while the
// file still covers `today + 364`. The staleness budget it gets is therefore
// LOOKAHEAD_DAYS - 365, i.e. one year with the current 730 — NOT the whole
// lookahead. (The runtime derives its gate from `lookaheadDays` for exactly
// this reason; a hardcoded 540 here once claimed 18 months of budget and let
// the fast path run against a list that stopped short of the scan window.)
const LOOKAHEAD_DAYS = 365 * 2;

// The candidates are scored under the default ayanamsa, so the runtime only
// takes this fast path for a Lahiri user — the list is not a superset of the
// passing days under any other sidereal convention.

// ─── Reference longitudes ────────────────────────────────────────────────────
// 5 points bracketing India end-to-end. The east-west sweep is what matters;
// latitude barely shifts sunrise within India. Picking real cities (vs.
// abstract longitudes) keeps the values memorable.
const REFERENCES = [
  { name: 'Ahmedabad',  latitude: 23.0225, longitude: 72.5714 }, // ~72.6°E west
  { name: 'Pune',       latitude: 18.5204, longitude: 73.8567 }, // ~73.8°E
  { name: 'Bhopal',     latitude: 23.2599, longitude: 77.4126 }, // ~77.4°E central
  { name: 'Kolkata',    latitude: 22.5726, longitude: 88.3639 }, // ~88.4°E
  { name: 'Imphal',     latitude: 24.8170, longitude: 93.9368 }, // ~93.9°E far east
];
const TIMEZONE = 330; // IST = UTC+5:30 = 330 minutes

// ─── Occasion → stock rule mapping ───────────────────────────────────────────
// Mirror of `OCCASION_TO_RULE` in src/services/astrology/muhurat.ts. The two
// exist independently because this script runs in plain Node (CommonJS) and
// the runtime is TypeScript — but both pull from the same `panchang-ts`
// exports so the *rule data* never duplicates.
const OCCASION_RULES = {
  vivah: vivahRule,
  'griha-pravesh': grihaPraveshRule,
  namkaran: namakaranaRule,
  vahan: vahanKharidiRule,
  mundan: mundanRule,
  annaprashan: annaprashanRule,
  vidyarambh: vidyarambhRule,
};
const ALL_OCCASIONS = Object.keys(OCCASION_RULES);

// ─── Date helpers ────────────────────────────────────────────────────────────

function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ─── Generation ──────────────────────────────────────────────────────────────

function generate() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const generatedAt = ymd(today);

  // Map<occasion, Set<ymd>>
  const candidateSets = new Map();
  for (const occ of ALL_OCCASIONS) candidateSets.set(occ, new Set());

  for (let dayIdx = 0; dayIdx < LOOKAHEAD_DAYS; dayIdx++) {
    const cursor = new Date(today);
    cursor.setDate(cursor.getDate() + dayIdx);
    const dayKey = ymd(cursor);
    // Score NOON IST of the civil date, not the machine's local midnight:
    // panchang-ts reads the calendar day off the instant in the offset it is
    // given, so a local midnight on a machine east of IST (e.g. Sydney) is
    // still the PREVIOUS IST day and every emitted YYYY-MM-DD would be keyed
    // to the wrong scored day. Noon IST of the civil date is zone-independent
    // and matches `noonAtPlace` in src/services/astrology/panchangService.ts.
    const at = new Date(
      Date.UTC(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), 12) - TIMEZONE * 60_000,
    );

    if (dayIdx % 30 === 0) {
      process.stdout.write(`  day ${dayIdx + 1}/${LOOKAHEAD_DAYS} (${dayKey})\r`);
    }

    for (const occ of ALL_OCCASIONS) {
      const rule = OCCASION_RULES[occ];
      // A date is a candidate iff scoreMuhurta passes at any reference. We
      // short-circuit on the first ref that passes so the average cost per
      // (day, occasion) stays close to one panchang compute, not five.
      let isCandidate = false;
      for (let r = 0; r < REFERENCES.length; r++) {
        const ref = REFERENCES[r];
        try {
          const result = scoreMuhurta(
            at,
            { latitude: ref.latitude, longitude: ref.longitude },
            rule,
            { timezone: TIMEZONE },
          );
          if (result.passes) {
            isCandidate = true;
            break;
          }
        } catch {
          // skip problematic dates / refs
        }
      }
      if (isCandidate) candidateSets.get(occ).add(dayKey);
    }
  }

  process.stdout.write('\n');

  const candidates = {};
  for (const occ of ALL_OCCASIONS) {
    candidates[occ] = [...candidateSets.get(occ)].sort();
  }

  return {
    version: 2,
    generatedAt,
    lookaheadDays: LOOKAHEAD_DAYS,
    references: REFERENCES.map(r => r.name),
    ruleSource: 'panchang-ts STOCK_MUHURTA_RULES',
    // Which build of those rules. `ruleSource` alone can't tell a stale file
    // from a fresh one, and scoreMuhurta's output moves with the engine — so
    // scripts/check-generated-data.js gates this against the locked version.
    panchangTsVersion: LIB_VERSION,
    candidates,
  };
}

function main() {
  console.log(`Generating muhurat candidates for ${LOOKAHEAD_DAYS} days × ${REFERENCES.length} references × ${ALL_OCCASIONS.length} occasions...`);
  const out = generate();

  for (const occ of ALL_OCCASIONS) {
    console.log(`  ${occ.padEnd(15)} ${out.candidates[occ].length} candidates`);
  }

  const outPath = path.join(__dirname, '..', 'src', 'data', 'static', 'muhurat-candidates.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  const bytes = fs.statSync(outPath).size;
  console.log(`\nWritten ${(bytes / 1024).toFixed(1)} KB to ${outPath}`);
}

main();
