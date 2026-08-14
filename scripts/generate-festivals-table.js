/**
 * Build the app's festival table and write it to
 * src/data/static/festivals-table.json.
 *
 * Why this exists: panchang-ts 4.2.0–4.3.1 shipped a *bundled* festival table
 * that `panchang-ts/festivals` read with no argument. v5 removed every bundled
 * JSON — `readFestivalsForYear(source, year, lang)` now requires the consumer
 * to pass a table it built and cached itself. So the generator that 4.2.0 let
 * us delete comes back, this time as a thin wrapper around the library's
 * `buildFestivalsTable` rather than around our own festival rules. The library
 * is still the single source of truth; only the storage moved.
 *
 * The emitted file is dictionary-encoded by the library (v5), so it is ~28% of
 * the size the same table would have been in 4.x, and it carries BOTH locales —
 * `src/data/festivals.ts` reads the `en` view because several consumers run
 * name-keyed heuristics over it, and Hindi is applied at the UI boundary via
 * `localizeFestivalName`.
 *
 * Re-run this when the rolling year window ages out (the range is −2 / +5 years
 * from the run date, matching what the bundled table used to cover).
 *
 * Usage:  node scripts/generate-festivals-table.js
 */
/* eslint-env node */

const { buildFestivalsTable } = require('panchang-ts');
const fs = require('fs');
const path = require('path');

// Varanasi (Kashi) / IST — the same reference the bundled table used, and the
// same fallback coords `panchangService.FALLBACK_COORDS` applies. Within India
// these dates are essentially universal; elsewhere a festival can shift ±1 day.
const REFERENCE = {
  name: 'Varanasi',
  latitude: 25.3176,
  longitude: 82.9739,
  timezoneOffsetMinutes: 330,
};

const YEARS_PAST = 2;
const YEARS_FUTURE = 5;

const NOTE =
  'Built by scripts/generate-festivals-table.js for Varanasi (IST). Eclipses ' +
  'are excluded because visibility is location-dependent; they are sourced ' +
  'live via getUpcomingEclipses.';

function main() {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const startYear = currentYear - YEARS_PAST;
  const endYear = currentYear + YEARS_FUTURE;

  process.stderr.write(
    `Building festivals for ${REFERENCE.name}: ${startYear}–${endYear}…\n`,
  );
  const t0 = Date.now();

  const file = buildFestivalsTable({
    location: { latitude: REFERENCE.latitude, longitude: REFERENCE.longitude },
    timezoneOffsetMinutes: REFERENCE.timezoneOffsetMinutes,
    startYear,
    endYear,
    languages: ['en', 'hi'],
    ayanamsa: 'lahiri',
    masaSystem: 'purnimanta',
    region: 'all',
    referenceLocation: REFERENCE.name,
    generatedAt: now.toISOString(),
    note: NOTE,
  });

  const outPath = path.join(__dirname, '..', 'src', 'data', 'static', 'festivals-table.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(file) + '\n', 'utf8');

  const days = Object.values(file.years).reduce((s, d) => s + d.length, 0);
  const kb = (fs.statSync(outPath).size / 1024).toFixed(1);
  process.stderr.write(
    `Wrote ${outPath} — ${days} days, ${kb} KB, ${((Date.now() - t0) / 1000).toFixed(1)}s\n`,
  );
}

main();
