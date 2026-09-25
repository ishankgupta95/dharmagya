/**
 * Build the app's Purnima / Amavasya observance table and write it to
 * src/data/static/moon-phases-table.json.
 *
 * Why this exists: the Purnima and Amavasya reminders used to be resolved by
 * string-searching festival *names* in the festival table. That table carries
 * no generic monthly row — the only names containing "Purnima"/"Amavasya" are
 * named festivals (Guru Purnima, Sharad Purnima, Kartika Purnima, Vat Savitri,
 * Mahalaya Amavasya) — so the reminders fired 4–5 and 2 times a year against a
 * setting that promises roughly twelve.
 *
 * Why not `buildMoonPhasesTable`: that publishes the astronomical syzygy
 * *instant*. The observance is the day whose SUNRISE tithi is Purnima (15) or
 * Amavasya (30), and the two disagree by ±1 day whenever the syzygy falls near
 * local midnight — pushing "Purnima tomorrow" on the wrong evening is a worse
 * failure than under-delivering. So this walks `getInstantPanchang` at each
 * day's real sunrise and records the days themselves. Offline cost is
 * irrelevant; it keeps the runtime engine-free, like the festival table.
 *
 * Same FIXED year window and same Ujjain/IST reference as
 * scripts/generate-festivals-table.js — both are read from that module rather
 * than restated here, so the two artifacts cannot drift apart on which years
 * the app can answer for (check-generated-data.js asserts they agree).
 *
 * Usage:  node scripts/generate-moon-phases-table.js
 */
/* global __dirname -- Node script; flat config ignores `eslint-env`. */

const { getInstantPanchang, getSunrise } = require('panchang-ts');
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

// The window and the reference point both come from the festival generator:
// requiring it only exposes its constants (its `main()` is guarded behind
// `require.main === module`). A second copy here is how the two tables would
// end up covering different years, or — worse — computing at different points,
// which would put a Purnima reminder a day off the festival row it names.
const {
  START_YEAR,
  END_YEAR,
  REFERENCE,
} = require('./generate-festivals-table.js');

const LOCATION = { latitude: REFERENCE.latitude, longitude: REFERENCE.longitude };

/** Local-midnight date in the reference zone, as a UTC instant. */
function localMidnightUtc(year, monthIdx, day) {
  return new Date(
    Date.UTC(year, monthIdx, day) - REFERENCE.timezoneOffsetMinutes * 60_000,
  );
}

function ymd(year, monthIdx, day) {
  return `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Drop any entry whose immediate predecessor is the previous calendar day. */
function dropDayAfter(days) {
  const out = [];
  for (const d of days) {
    const prev = out[out.length - 1];
    if (prev) {
      const [py, pm, pd] = prev.split('-').map(Number);
      const [cy, cm, cd] = d.split('-').map(Number);
      const gap =
        (Date.UTC(cy, cm - 1, cd) - Date.UTC(py, pm - 1, pd)) / 86_400_000;
      if (gap === 1) continue;
    }
    out.push(d);
  }
  return out;
}

function main() {
  const now = new Date();
  const startYear = START_YEAR;
  const endYear = END_YEAR;

  process.stderr.write(
    `Building Purnima / Amavasya days for ${REFERENCE.name}: ${startYear}–${endYear}…\n`,
  );
  const t0 = Date.now();

  const years = {};
  for (let year = startYear; year <= endYear; year++) {
    const full = [];
    const dark = [];
    for (let monthIdx = 0; monthIdx < 12; monthIdx++) {
      const daysInMonth = new Date(Date.UTC(year, monthIdx + 1, 0)).getUTCDate();
      for (let day = 1; day <= daysInMonth; day++) {
        const midnight = localMidnightUtc(year, monthIdx, day);
        let probe;
        try {
          probe = new Date(getSunrise(midnight, LOCATION).getTime() + 30_000);
        } catch {
          continue;
        }
        const inst = getInstantPanchang(probe, LOCATION, { computeEndTimes: false });
        if (!inst) continue;
        // Absolute synodic index: 14 = Purnima (end of shukla),
        // 29 = Amavasya (end of krishna).
        if (inst.angas.tithi.index === 14) full.push(ymd(year, monthIdx, day));
        else if (inst.angas.tithi.index === 29) dark.push(ymd(year, monthIdx, day));
      }
    }
    // A tithi can run past 24 h and so sit at sunrise on two consecutive days
    // (vriddhi). It then covers the whole of the FIRST day and only the small
    // hours of the second, so the first is the observance day — keeping both
    // would push the same reminder on two consecutive evenings.
    const entry = { full: dropDayAfter(full), new: dropDayAfter(dark) };
    years[String(year)] = entry;
    process.stderr.write(
      `  ${year}: ${entry.full.length} purnima, ${entry.new.length} amavasya\n`,
    );
  }

  const out = {
    _meta: {
      startYear,
      endYear,
      referenceLocation: REFERENCE.name,
      timezoneOffsetMinutes: REFERENCE.timezoneOffsetMinutes,
      generatedAt: now.toISOString(),
      note:
        'Days whose SUNRISE tithi is Purnima (index 14) or Amavasya (index 29) ' +
        `at ${REFERENCE.name} / IST — the observance day, not the syzygy instant.`,
      panchangTsVersion: LIB_VERSION,
    },
    years,
  };

  const outPath = path.join(__dirname, '..', 'src', 'data', 'static', 'moon-phases-table.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out) + '\n', 'utf8');

  const kb = (fs.statSync(outPath).size / 1024).toFixed(1);
  process.stderr.write(
    `Wrote ${outPath} — ${kb} KB, ${((Date.now() - t0) / 1000).toFixed(1)}s\n`,
  );
}

if (require.main === module) main();
