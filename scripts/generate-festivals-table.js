/**
 * Build the app's festival table and write it to
 * src/data/static/festivals-table.json, plus the region index that scopes it,
 * src/data/static/festival-regions.json, and the per-(region, masa) date
 * corrections layered on both, src/data/static/festival-variants.json (see
 * `buildVariants`).
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
 * The table is built at `region: 'all'` — the most INCLUSIVE setting — because
 * one table per region would be 22 copies of the same 31 years. The user's
 * Region is applied at read time instead, which needs a key → regions index the
 * table itself does not carry (`FestivalTableEntry` is `{key,name,type,description?}`
 * and `_meta.region` is one table-wide string). So this script also sweeps
 * `computeFestivalsForYear` once per region per year and writes the keys that
 * are NOT emitted everywhere to `festival-regions.json`, which
 * `src/data/festivals.ts` reads via `festivalAllowedInRegion`. Deriving it
 * rather than hand-maintaining it means an engine bump that re-scopes a
 * festival cannot leave the app filtering on last release's rules.
 *
 * IMPORTANT, IF A REGENERATE SURPRISES YOU: this file is the engine's opinion of
 * regional scope and NOTHING ELSE — no hand edits belong in it, and re-running
 * this script is always safe. Where the engine scopes a real observance too
 * narrowly (Hartalika Teej in Nepal, Teeyan in Punjab, Gowri Habba in
 * Karnataka…), the correction lives in the curated, additive-only
 * `CURATED_REGIONS` map in `src/data/festivals.ts`, applied at READ time on top
 * of what this writes. So a `git diff` of festival-regions.json after a bump
 * shows engine drift only, uncontaminated by our judgement calls — and the
 * corrections survive this script rewriting the file wholesale. Read that map's
 * header before concluding a region is missing.
 *
 * COVERAGE is the FIXED window {@link START_YEAR}..{@link END_YEAR} (2020–2050),
 * not a window rolled off the run date. It used to be −2 / +5 years from
 * whenever the script happened to run, which made every regenerate move the
 * edges and left the app answering for eight years at a time. Fixed edges mean
 * a regenerate after an engine bump changes dates and nothing else, and
 * `scripts/check-generated-data.js` asserts every year in the window is present
 * (it reads the two constants from this module rather than restating them).
 * Years outside the window are computed on-device, once, and cached in SQLite
 * by `src/services/festivalYearCache.ts` — with the same parameters this table
 * was built with, read back out of its `_meta`.
 *
 * Cost of the window, measured at 2020–2050: 28.2 KB gzipped (232 KB raw) for
 * the table, ~0.9 KB a year; the engine sweep below is 22 × 2 × 31
 * `computeFestivalsForYear` calls, so a full run takes about a minute and a half.
 *
 * Usage:  node scripts/generate-festivals-table.js
 *
 * Requiring this file (rather than running it) only exposes `START_YEAR`,
 * `END_YEAR`, `REFERENCE`, `REGIONS` and `MASA_SYSTEMS` — `main()` runs only as
 * a script.
 */
/* global __dirname -- Node script; flat config ignores `eslint-env`. */

const { buildFestivalsTable, computeFestivalsForYear } = require('panchang-ts');
const { readFestivalsForYear } = require('panchang-ts/festivals');
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

// Ujjain (Avanti) / IST — the SAME point as `panchangService.FALLBACK_COORDS`,
// and it must stay that way: the runtime fallback and this table are the two
// halves of what a no-location user sees, so if they disagree the Panchang and
// Festivals screens contradict each other on the tithi-boundary days. Within
// India these dates are essentially universal; elsewhere a festival can shift
// ±1 day.
const REFERENCE = {
  name: 'Ujjain',
  latitude: 23.1765,
  longitude: 75.7885,
  timezoneOffsetMinutes: 330,
};

/**
 * First and last civil year the table covers, inclusive. Fixed rather than
 * rolled off the run date — see the header. Moving either edge is a bundle-size
 * decision (~0.9 KB gzipped per year) as much as a coverage one; keep
 * `scripts/generate-moon-phases-table.js` on the same window, which
 * check-generated-data.js enforces.
 */
const START_YEAR = 2020;
const END_YEAR = 2050;

/**
 * Every `FestivalRegion` except `'all'`. panchang-ts exports the union as a TYPE
 * only (`FestivalRegion` in dist/index.d.ts) with no runtime list, so this has
 * to be spelled out; it mirrors `Region` in src/store/useStore.ts, which is the
 * set the Settings picker actually offers. `buildRegionIndex` below throws if a
 * festival ends up scoped to none of them, which is what a region added
 * upstream would look like from here.
 */
const REGIONS = [
  'tamil-nadu', 'kerala', 'karnataka', 'andhra-pradesh', 'telangana',
  'west-bengal', 'odisha', 'assam', 'bihar', 'jharkhand',
  'gujarat', 'maharashtra', 'goa', 'rajasthan',
  'punjab', 'haryana', 'himachal-pradesh', 'uttarakhand', 'uttar-pradesh',
  'madhya-pradesh', 'nepal',
];

const NOTE =
  `Built by scripts/generate-festivals-table.js for ${REFERENCE.name} (IST). Eclipses ` +
  'are excluded because visibility is location-dependent; they are sourced ' +
  'live via getUpcomingEclipses.';

/**
 * The month systems the Settings picker offers (`MasaSystem`). The table is
 * built at `purnimanta`; since panchang-ts 5.4 a handful of observances are
 * dated by the month system (see {@link buildVariants}), so the sweep below
 * runs under each.
 */
const MASA_SYSTEMS = ['purnimanta', 'amanta'];

/** The table's own build: the one (region, masa) combination it answers exactly. */
const TABLE_REGION = 'all';
const TABLE_MASA = 'purnimanta';

/** `YYYY-MM-DD` of a `computeFestivalsForYear` date, which is the local
 *  midnight at the reference offset. */
function referenceYmd(date) {
  return new Date(date.getTime() + REFERENCE.timezoneOffsetMinutes * 60000).toISOString().slice(0, 10);
}

/** A festival as the table's English view spells it: `{key,name,type,description?}`. */
function tableEntry(f) {
  const e = { key: f.key, name: f.name, type: f.type };
  if (f.description !== undefined) e.description = f.description;
  return e;
}

/**
 * What the engine itself answers for every (region, masa) the app can be set
 * to, over the table's window: `Map<"region|masa", Map<YYYY-MM-DD, entry[]>>`.
 * Eclipse rows are dropped exactly as `buildFestivalsTable` drops them.
 *
 * 22 regions (`all` included) × 2 month systems × 31 years of
 * `computeFestivalsForYear` — most of this script's run time. The purnimanta
 * half is what the region index is derived from; all of it feeds the variants.
 */
function sweepEngine(startYear, endYear) {
  const location = { latitude: REFERENCE.latitude, longitude: REFERENCE.longitude };
  const out = new Map();
  for (const region of [TABLE_REGION, ...REGIONS]) {
    for (const masaSystem of MASA_SYSTEMS) {
      const byDate = new Map();
      for (let year = startYear; year <= endYear; year++) {
        const days = computeFestivalsForYear(year, location, {
          timezone: REFERENCE.timezoneOffsetMinutes,
          ayanamsa: 'lahiri',
          masaSystem,
          language: 'en',
          region,
        });
        for (const day of days) {
          if (day.festival.type === 'eclipse') continue;
          const ymd = referenceYmd(day.date);
          if (!byDate.has(ymd)) byDate.set(ymd, []);
          byDate.get(ymd).push(tableEntry(day.festival));
        }
      }
      out.set(`${region}|${masaSystem}`, byDate);
    }
  }
  return out;
}

/**
 * Which of the table's festival keys are region-specific, and where.
 *
 * Swept over the SAME year window the table covers rather than one reference
 * year: a festival can be absent from a given year (adhika-masa shifts, a
 * variant that only lands in some years), and a key missing from the sweep
 * would be treated as pan-Indian and shown to everyone.
 *
 * Returns `{ key: [region, …] }` for the scoped keys only. Keys every region
 * emits are omitted — `festivalAllowedInRegion` treats an absent key as
 * pan-Indian, so the file stays small and a newly emitted festival fails open.
 */
function buildRegionIndex(dictKeys, sweep) {
  const byKey = new Map();
  for (const region of REGIONS) {
    for (const entries of sweep.get(`${region}|${TABLE_MASA}`).values()) {
      for (const { key } of entries) {
        if (!byKey.has(key)) byKey.set(key, new Set());
        byKey.get(key).add(region);
      }
    }
  }

  const keys = {};
  const orphans = [];
  for (const key of [...dictKeys].sort()) {
    const regions = byKey.get(key);
    if (!regions) {
      orphans.push(key);
      continue;
    }
    if (regions.size === REGIONS.length) continue; // pan-Indian — omit
    keys[key] = [...regions].sort();
  }
  // A key the table emits at 'all' but no single region emits would vanish for
  // every user who picks a region. That means REGIONS has gone stale against
  // panchang-ts, so fail rather than ship a table that filters itself away.
  if (orphans.length > 0) {
    throw new Error(
      `${orphans.length} festival key(s) are emitted at region 'all' but by no ` +
        `region in REGIONS — the list is stale against panchang-ts ${LIB_VERSION}: ` +
        orphans.join(', '),
    );
  }
  return keys;
}

/**
 * The corrections that turn the one shipped table into the engine's own answer
 * for every other (region, masa) combination.
 *
 * The table answers exactly for `all` + `purnimanta`. The app applies the
 * user's Region at read time by KEY (`festivalAllowedInRegion`), which is
 * enough as long as a region's calendar is the table minus the keys it never
 * emits. panchang-ts 5.4 broke that in two ways, both documented upstream:
 *
 *  - Region-dependent DAYS: on Karthigai Deepam's day only `all` and
 *    `tamil-nadu` list `karthigai_deepam`; every other region lists
 *    `masik_karthigai` instead. The table, built at `all`, carries only the
 *    former, so a key filter left every region outside Tamil Nadu with no
 *    Masik Karthigai that month.
 *  - Month-system-dependent DAYS: Shravan Somvar, Mangala Gauri, Kartik Somvar
 *    and Magha Shanivar follow `masaSystem` (and, for region `nepal`, the solar
 *    month), where 5.3 always gave the amanta dates. A purnimanta table showed
 *    Amanta and Nepal users the North Indian Mondays.
 *
 * Rather than hand-code those two cases, this diffs the engine against the
 * key-filtered table for every combination, so a future rule of the same shape
 * is picked up by a regenerate and asserted by `check:data`. For combination
 * C = region|masa, with `emits(region)` the keys the region index says it
 * emits (every key for `all`):
 *
 *   remove(C) = table entries whose key the region emits, absent from engine(C)
 *   add(C)    = engine(C) entries absent from the table
 *
 * Each (op, date, entry) atom is stored once, grouped by the exact set of
 * combinations it applies to, so the amanta re-datings shared by 21
 * combinations cost one copy. An `add` also records where the engine lists it
 * that day — its index and the key right before it — because order is not
 * cosmetic: the calendar headlines a day by its FIRST minor festival. Keys the index does NOT scope to a region but the
 * app still shows there (the breadth guard, curated additions) are untouched:
 * those are deliberate app-side widenings, not engine answers.
 */
function buildVariants(table, regionKeys, sweep, startYear, endYear) {
  const tableByDate = new Map();
  for (let year = startYear; year <= endYear; year++) {
    for (const day of readFestivalsForYear(table, year, 'en') ?? []) {
      tableByDate.set(day.date, day.festivals.map(tableEntry));
    }
  }
  const emits = (key, region) =>
    region === TABLE_REGION || regionKeys[key] === undefined || regionKeys[key].includes(region);

  // atom id -> { op, ymd, json, pos, after, combos }
  const atoms = new Map();
  const note = (op, ymd, entry, combo, pos = null, after = null) => {
    const json = JSON.stringify(entry);
    const id = `${op}\u0000${ymd}\u0000${json}\u0000${pos}\u0000${after}`;
    if (!atoms.has(id)) atoms.set(id, { op, ymd, json, pos, after, combos: [] });
    atoms.get(id).combos.push(combo);
  };

  for (const [combo, engineByDate] of sweep) {
    const region = combo.split('|')[0];
    const dates = new Set([...tableByDate.keys(), ...engineByDate.keys()]);
    for (const ymd of dates) {
      const base = (tableByDate.get(ymd) ?? []).filter(e => emits(e.key, region)).map(e => JSON.stringify(e));
      const engine = (engineByDate.get(ymd) ?? []).map(e => JSON.stringify(e));
      for (const e of base) if (!engine.includes(e)) note('remove', ymd, JSON.parse(e), combo);
      engine.forEach((e, pos) => {
        if (base.includes(e)) return;
        const after = pos === 0 ? null : JSON.parse(engine[pos - 1]).key;
        note('add', ymd, JSON.parse(e), combo, pos, after);
      });
    }
  }

  // The table's own combination must need nothing: if it does, the table and
  // the sweep disagree about the same engine call, which is a generator bug.
  const ownCombo = `${TABLE_REGION}|${TABLE_MASA}`;
  const selfDiff = [...atoms.values()].filter(a => a.combos.includes(ownCombo));
  if (selfDiff.length > 0) {
    throw new Error(
      `the table disagrees with computeFestivalsForYear at its own build (${ownCombo}) on ` +
        `${selfDiff.length} entr(ies), first ${selfDiff[0].op} ${selfDiff[0].ymd} ${selfDiff[0].json}`,
    );
  }

  const entries = [];
  const entryIndex = new Map();
  const indexOf = json => {
    if (!entryIndex.has(json)) {
      entryIndex.set(json, entries.length);
      entries.push(JSON.parse(json));
    }
    return entryIndex.get(json);
  };
  const byCombos = new Map();
  for (const atom of [...atoms.values()].sort((a, b) => (a.ymd < b.ymd ? -1 : a.ymd > b.ymd ? 1 : 0))) {
    const when = [...atom.combos].sort();
    const groupKey = when.join(',');
    if (!byCombos.has(groupKey)) byCombos.set(groupKey, { when, remove: [], add: [] });
    byCombos
      .get(groupKey)
      [atom.op].push(
        atom.op === 'add'
          ? [atom.ymd, indexOf(atom.json), atom.pos, atom.after]
          : [atom.ymd, indexOf(atom.json)],
      );
  }
  const patches = [...byCombos.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, patch]) => patch);
  return { entries, patches };
}

function main() {
  const now = new Date();
  const startYear = START_YEAR;
  const endYear = END_YEAR;

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

  // Stamp the engine that computed these dates. `BuildFestivalsTableOptions`
  // takes no arbitrary meta, so merge it into the returned `_meta` after the
  // build. scripts/check-generated-data.js diffs this against the locked
  // version: every date here is engine output, so a panchang-ts bump silently
  // invalidates the whole table (5.1.1 → 5.2.1 moved Vat Savitri and dropped
  // festivals outright) with nothing otherwise failing.
  file._meta.panchangTsVersion = LIB_VERSION;

  const outPath = path.join(__dirname, '..', 'src', 'data', 'static', 'festivals-table.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(file) + '\n', 'utf8');

  const days = Object.values(file.years).reduce((s, d) => s + d.length, 0);
  const kb = (fs.statSync(outPath).size / 1024).toFixed(1);
  process.stderr.write(
    `Wrote ${outPath} — ${days} days, ${kb} KB, ${((Date.now() - t0) / 1000).toFixed(1)}s\n`,
  );

  // Region index and variants — sibling artifacts, same engine stamp. One
  // computeFestivalsForYear per (region, masa) per year.
  process.stderr.write(
    `Sweeping ${REGIONS.length + 1} regions × ${MASA_SYSTEMS.length} month systems × ` +
      `${endYear - startYear + 1} years…\n`,
  );
  const t1 = Date.now();
  const sweep = sweepEngine(startYear, endYear);
  // `_dict` dedupes on the whole entry, so one key appears once per distinct
  // name/description pair (e.g. every Pradosha variant). Collapse to keys.
  const dictKeys = [...new Set(file._dict.map(e => e.key))];
  const regionFile = {
    _meta: {
      panchangTsVersion: LIB_VERSION,
      referenceLocation: REFERENCE.name,
      startYear,
      endYear,
      // The regions the sweep actually ran, so check-generated-data.js can
      // assert the index was built for every region the Settings picker offers
      // (the `Region` union in src/store/useStore.ts) over every year above.
      regions: [...REGIONS],
      generatedAt: now.toISOString(),
      note:
        'Festival key -> the regions that emit it, for keys NOT emitted by every ' +
        'region. Built by scripts/generate-festivals-table.js because the festival ' +
        'table is generated at region "all" and carries no per-festival region tag. ' +
        'A key absent here is pan-Indian and always shown.',
    },
    keys: buildRegionIndex(dictKeys, sweep),
  };
  const regionPath = path.join(__dirname, '..', 'src', 'data', 'static', 'festival-regions.json');
  fs.writeFileSync(regionPath, JSON.stringify(regionFile, null, 1) + '\n', 'utf8');
  process.stderr.write(
    `Wrote ${regionPath} — ${Object.keys(regionFile.keys).length} of ${dictKeys.length} ` +
      `keys are region-scoped, ${((Date.now() - t1) / 1000).toFixed(1)}s\n`,
  );

  const { entries, patches } = buildVariants(file, regionFile.keys, sweep, startYear, endYear);
  const variantsFile = {
    _meta: {
      panchangTsVersion: LIB_VERSION,
      referenceLocation: REFERENCE.name,
      startYear,
      endYear,
      table: `${TABLE_REGION}|${TABLE_MASA}`,
      regions: [TABLE_REGION, ...REGIONS],
      masaSystems: [...MASA_SYSTEMS],
      generatedAt: now.toISOString(),
      note:
        'Per (region|masa) corrections to festivals-table.json, each patch applying to the ' +
        'combinations in `when`: `remove` is [YYYY-MM-DD, index into entries]; `add` is ' +
        '[YYYY-MM-DD, index into entries, engine position that day, key listed before it or null]. ' +
        'Applied at read time by src/data/festivals.ts after the key-level region filter.',
    },
    entries,
    patches,
  };
  const variantsPath = path.join(__dirname, '..', 'src', 'data', 'static', 'festival-variants.json');
  fs.writeFileSync(variantsPath, JSON.stringify(variantsFile) + '\n', 'utf8');
  const atomCount = patches.reduce((n, p) => n + p.remove.length + p.add.length, 0);
  process.stderr.write(
    `Wrote ${variantsPath} — ${patches.length} patch group(s), ${atomCount} correction(s), ` +
      `${(fs.statSync(variantsPath).size / 1024).toFixed(1)} KB\n`,
  );
}

module.exports = { START_YEAR, END_YEAR, REFERENCE, REGIONS, MASA_SYSTEMS };

if (require.main === module) main();
